import {
  computeProofSchema,
  ok,
  proofArtifactSchema,
  type ComputeProof,
  type ProofArtifact,
  type Result,
} from "@omen/shared";
import { z } from "zod";

import type { ZeroGAdapter } from "../adapters/zero-g-adapter.js";

export const zeroGAdjudicationInputSchema = z.object({
  runId: z.string().min(1),
  thesis: z.string().min(1),
  evidence: z.array(z.string().min(1)).min(1),
  priorDecision: z.string().min(1).nullable().optional(),
  prompt: z.string().min(1).optional(),
  model: z.string().min(1).default("glm-4.5-air"),
  signalId: z.string().min(1).nullable().optional(),
  intelId: z.string().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type ZeroGAdjudicationInput = z.infer<typeof zeroGAdjudicationInputSchema>;

export type ZeroGAdjudicationResult = {
  output: string;
  proof: ComputeProof;
  artifact: ProofArtifact;
  decisionHint: "approved" | "rejected" | "watchlist_only" | "unknown";
};

const inferDecisionHint = (
  output: string,
): ZeroGAdjudicationResult["decisionHint"] => {
  const normalized = output.toLowerCase();

  if (normalized.includes("watchlist")) {
    return "watchlist_only";
  }

  if (normalized.includes("reject")) {
    return "rejected";
  }

  if (normalized.includes("approve")) {
    return "approved";
  }

  return "unknown";
};

const buildPrompt = (input: ZeroGAdjudicationInput) =>
  [
    "You are the final adjudication step for the Omen swarm.",
    "Return a concise verdict with explicit reasoning grounded only in the supplied thesis and evidence.",
    "Verdict must be one of: approved, rejected, watchlist_only.",
    `Run ID: ${input.runId}`,
    `Prior Decision: ${input.priorDecision ?? "none"}`,
    "Thesis:",
    input.thesis,
    "Evidence:",
    ...input.evidence.map((item, index) => `${index + 1}. ${item}`),
  ].join("\n");

export class ZeroGAdjudication {
  constructor(private readonly adapter: ZeroGAdapter) {}

  async adjudicate(
    input: z.input<typeof zeroGAdjudicationInputSchema>,
  ): Promise<Result<ZeroGAdjudicationResult, Error>> {
    const parsed = zeroGAdjudicationInputSchema.parse(input);
    const computed = await this.adapter.requestCompute({
      model: parsed.model,
      prompt: parsed.prompt ?? buildPrompt(parsed),
      metadata: {
        runId: parsed.runId,
        stage: "adjudication",
        priorDecision: parsed.priorDecision ?? null,
        ...parsed.metadata,
      },
    });

    if (!computed.ok) {
      return computed;
    }

    const proof = computeProofSchema.parse({
      provider: computed.value.provider,
      model: computed.value.model,
      jobId: computed.value.jobId,
      requestHash: computed.value.requestHash,
      responseHash: computed.value.responseHash,
      verificationMode: computed.value.verificationMode,
    });
    const artifact = proofArtifactSchema.parse({
      id: `${parsed.runId}:${computed.value.jobId}:adjudication`,
      runId: parsed.runId,
      signalId: parsed.signalId ?? null,
      intelId: parsed.intelId ?? null,
      refType: "compute_result",
      key: `runs/${parsed.runId}/compute/${computed.value.jobId}/adjudication`,
      locator: `0g://compute/${computed.value.jobId}/adjudication`,
      metadata: {
        stage: "adjudication",
        thesisLength: parsed.thesis.length,
        evidenceCount: parsed.evidence.length,
        priorDecision: parsed.priorDecision ?? null,
        ...parsed.metadata,
      },
      compute: proof,
      createdAt: new Date().toISOString(),
    });

    return ok({
      output: computed.value.output,
      proof,
      artifact,
      decisionHint: inferDecisionHint(computed.value.output),
    });
  }
}
