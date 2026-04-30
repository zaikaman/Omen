import type { Request, Response } from "express";

import {
  RunsRepository,
  ZeroGRefsRepository,
  createSupabaseServiceRoleClient,
} from "@omen/db";
import {
  type ProofArtifact,
  type Run,
} from "@omen/shared";
import { RunManifestBuilder, zeroGManifestableProofArtifactSchema } from "@omen/zero-g";

import type { BackendEnv } from "../bootstrap/env.js";

const parseLimit = (value: unknown, defaultLimit: number) => {
  if (typeof value !== "string") {
    return defaultLimit;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 50) : defaultLimit;
};

type ProofSummary = {
  runId: string;
  manifestRefId: string | null;
  finalSignalId: string | null;
  finalIntelId: string | null;
  artifactCount: number;
  storageCount: number;
  computeCount: number;
  chainCount: number;
  postCount: number;
  createdAt: string;
};

const manifestBuilder = new RunManifestBuilder();

const isPersistenceConfigured = (env: Pick<BackendEnv, "supabase">) =>
  Boolean(env.supabase.url && env.supabase.serviceRoleKey);

const createRepositories = (env: Pick<BackendEnv, "supabase">) => {
  const client = createSupabaseServiceRoleClient({
    url: env.supabase.url ?? "",
    anonKey: env.supabase.anonKey ?? env.supabase.serviceRoleKey ?? "",
    serviceRoleKey: env.supabase.serviceRoleKey ?? "",
    schema: env.supabase.schema,
  });

  return {
    runs: new RunsRepository(client),
    zeroGRefs: new ZeroGRefsRepository(client),
  };
};

const sortArtifacts = (artifacts: ProofArtifact[]) =>
  [...artifacts].sort((left, right) => left.createdAt.localeCompare(right.createdAt));

const buildManifest = (run: Run, artifacts: ProofArtifact[], environment: string) => {
  const manifestArtifact =
    artifacts.find((artifact) => artifact.refType === "manifest") ?? null;
  const manifestableArtifacts = artifacts.filter(
    (artifact) =>
      artifact.refType !== "manifest" &&
      zeroGManifestableProofArtifactSchema.safeParse(artifact).success,
  );

  if (manifestableArtifacts.length === 0 && !manifestArtifact) {
    return null;
  }

  return manifestBuilder.build({
    environment,
    run,
    artifacts: manifestableArtifacts,
    manifestArtifact,
    createdAt:
      manifestArtifact?.createdAt ??
      sortArtifacts(artifacts).at(-1)?.createdAt ??
      run.updatedAt,
  });
};

const buildProofSummary = (run: Run, artifacts: ProofArtifact[]) =>
  ({
    runId: run.id,
    manifestRefId:
      artifacts.find((artifact) => artifact.refType === "manifest")?.id ?? null,
    finalSignalId: run.finalSignalId,
    finalIntelId: run.finalIntelId,
    artifactCount: artifacts.length,
    storageCount: artifacts.filter((artifact) =>
      ["kv_state", "log_entry", "log_bundle", "file_artifact"].includes(
        artifact.refType,
      ),
    ).length,
    computeCount: artifacts.filter((artifact) =>
      ["compute_job", "compute_result"].includes(artifact.refType),
    ).length,
    chainCount: artifacts.filter((artifact) => artifact.refType === "chain_proof")
      .length,
    postCount: artifacts.filter((artifact) =>
      ["post_payload", "post_result"].includes(artifact.refType),
    ).length,
    createdAt:
      sortArtifacts(artifacts).at(-1)?.createdAt ??
      run.completedAt ??
      run.updatedAt,
  }) satisfies ProofSummary;

const buildProofDetail = (run: Run, artifacts: ProofArtifact[], environment: string) => {
  const sortedArtifacts = sortArtifacts(artifacts);

  return {
    run,
    proofBundle: {
      runId: run.id,
      manifestRefId:
        sortedArtifacts.find((artifact) => artifact.refType === "manifest")?.id ?? null,
      artifactRefs: sortedArtifacts,
    },
    artifacts: sortedArtifacts,
    manifest: buildManifest(run, sortedArtifacts, environment),
  };
};

export const createProofFeedController =
  (env: Pick<BackendEnv, "supabase" | "nodeEnv">) =>
  async (req: Request, res: Response) => {
    const limit = parseLimit(req.query.limit, 20);

    if (!isPersistenceConfigured(env)) {
      res.status(503).json({
        success: false,
        error: "Proofs require a configured Supabase persistence backend.",
      });
      return;
    }

    const repositories = createRepositories(env);
    const runs = await repositories.runs.listRecentRuns(limit);

    if (!runs.ok) {
      res.status(500).json({ success: false, error: runs.error.message });
      return;
    }

    const proofs = await Promise.all(
      runs.value.map(async (run) => ({
        run,
        artifacts: await repositories.zeroGRefs.listByRunId(run.id),
      })),
    );

    for (const entry of proofs) {
      if (!entry.artifacts.ok) {
        res.status(500).json({
          success: false,
          error: entry.artifacts.error.message,
        });
        return;
      }
    }

    res.json({
      success: true,
      data: {
        items: proofs.map((entry) =>
          buildProofSummary(
            entry.run,
            entry.artifacts.ok ? entry.artifacts.value : [],
          ),
        ),
        nextCursor: null,
      },
    });
  };

export const createProofDetailController =
  (env: Pick<BackendEnv, "supabase" | "nodeEnv">) =>
  async (req: Request, res: Response) => {
    const runId = typeof req.params.runId === "string" ? req.params.runId : "";

    if (!isPersistenceConfigured(env)) {
      res.status(503).json({
        success: false,
        error: "Proof detail requires a configured Supabase persistence backend.",
      });
      return;
    }

    const repositories = createRepositories(env);
    const [run, artifacts] = await Promise.all([
      repositories.runs.findRunById(runId),
      repositories.zeroGRefs.listByRunId(runId),
    ]);

    if (!run.ok) {
      res.status(500).json({ success: false, error: run.error.message });
      return;
    }

    if (!artifacts.ok) {
      res.status(500).json({ success: false, error: artifacts.error.message });
      return;
    }

    if (!run.value) {
      res.status(404).json({ success: false, error: "Run not found." });
      return;
    }

    res.json({
      success: true,
      data: buildProofDetail(run.value, artifacts.value, env.nodeEnv),
    });
  };
