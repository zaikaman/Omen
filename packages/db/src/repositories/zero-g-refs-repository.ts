import {
  err,
  ok,
  proofArtifactSchema,
  type ProofArtifact,
  type Result,
} from "@omen/shared";

import {
  BaseRepository,
  type RepositoryError,
} from "./base-repository.js";
import type { OmenSupabaseClient } from "../client/supabase.js";

type ZeroGRefRow = {
  id: string;
  run_id: string;
  signal_id: string | null;
  intel_id: string | null;
  ref_type: ProofArtifact["refType"];
  key: string | null;
  locator: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

type ZeroGRefInsert = {
  id?: string;
  run_id: string;
  signal_id?: string | null;
  intel_id?: string | null;
  ref_type: ProofArtifact["refType"];
  key?: string | null;
  locator: string;
  metadata: Record<string, unknown>;
  created_at?: string;
};

const toProofArtifact = (row: ZeroGRefRow): ProofArtifact =>
  proofArtifactSchema.parse({
    id: row.id,
    runId: row.run_id,
    signalId: row.signal_id,
    intelId: row.intel_id,
    refType: row.ref_type,
    key: row.key,
    locator: row.locator,
    metadata: row.metadata,
    compute:
      row.ref_type === "compute_job" || row.ref_type === "compute_result"
        ? ("compute" in row.metadata ? row.metadata.compute : null)
        : null,
    createdAt: row.created_at,
  });

const toInsertRow = (artifact: ProofArtifact): ZeroGRefInsert => ({
  id: artifact.id,
  run_id: artifact.runId,
  signal_id: artifact.signalId,
  intel_id: artifact.intelId,
  ref_type: artifact.refType,
  key: artifact.key,
  locator: artifact.locator,
  metadata: artifact.compute
    ? {
        ...artifact.metadata,
        compute: artifact.compute,
      }
    : artifact.metadata,
  created_at: artifact.createdAt,
});

export class ZeroGRefsRepository extends BaseRepository<
  ZeroGRefRow,
  ZeroGRefInsert
> {
  constructor(client: OmenSupabaseClient) {
    super(client, "zero_g_refs");
  }

  async createRef(
    artifact: ProofArtifact,
  ): Promise<Result<ProofArtifact, RepositoryError>> {
    const inserted = await this.insertOne(toInsertRow(artifact));

    if (!inserted.ok) {
      return inserted;
    }

    return ok(toProofArtifact(inserted.value));
  }

  async listByRunId(
    runId: string,
    limit = 200,
  ): Promise<Result<ProofArtifact[], RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("run_id", runId)
      .order("created_at", { ascending: true })
      .limit(limit)
      .returns<ZeroGRefRow[]>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok((data ?? []).map((row) => toProofArtifact(row)));
  }

  async findManifestRef(
    runId: string,
  ): Promise<Result<ProofArtifact | null, RepositoryError>> {
    const { data, error } = await this.table()
      .select("*")
      .eq("run_id", runId)
      .eq("ref_type", "manifest")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<ZeroGRefRow>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok(data ? toProofArtifact(data) : null);
  }

  async listByLinkedRecord(input: {
    signalId?: string;
    intelId?: string;
  }): Promise<Result<ProofArtifact[], RepositoryError>> {
    const query = this.table().select("*").order("created_at", { ascending: true });

    if (input.signalId) {
      query.eq("signal_id", input.signalId);
    }

    if (input.intelId) {
      query.eq("intel_id", input.intelId);
    }

    const { data, error } = await query.returns<ZeroGRefRow[]>();

    if (error) {
      return err({
        code: error.code,
        details: error.details,
        hint: error.hint,
        message: error.message,
      });
    }

    return ok((data ?? []).map((row) => toProofArtifact(row)));
  }
}
