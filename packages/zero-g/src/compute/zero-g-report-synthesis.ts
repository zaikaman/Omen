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

export const zeroGReportSynthesisInputSchema = z.object({
  runId: z.string().min(1),
  prompt: z.string().min(1),
  model: z.string().min(1).default("glm-4.5-air"),
  signalId: z.string().min(1).nullable().optional(),
  intelId: z.string().min(1).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export type ZeroGReportSynthesisInput = z.infer<
  typeof zeroGReportSynthesisInputSchema
>;

export type ZeroGReportSynthesisResult = {
  output: string;
  proof: ComputeProof;
  artifact: ProofArtifact;
};

export class ZeroGReportSynthesis {
  constructor(private readonly adapter: ZeroGAdapter) {}

  async synthesizeRunReport(
    input: z.input<typeof zeroGReportSynthesisInputSchema>,
  ): Promise<Result<ZeroGReportSynthesisResult, Error>> {
    const parsed = zeroGReportSynthesisInputSchema.parse(input);
    const computed = await this.adapter.requestCompute({
      model: parsed.model,
      prompt: parsed.prompt,
      metadata: {
        runId: parsed.runId,
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
      id: `${parsed.runId}:${computed.value.jobId}:compute`,
      runId: parsed.runId,
      signalId: parsed.signalId ?? null,
      intelId: parsed.intelId ?? null,
      refType: "compute_result",
      key: `runs/${parsed.runId}/compute/${computed.value.jobId}`,
      locator: `0g://compute/${computed.value.jobId}`,
      metadata: {
        promptLength: parsed.prompt.length,
        ...parsed.metadata,
      },
      compute: proof,
      createdAt: new Date().toISOString(),
    });

    return ok({
      output: computed.value.output,
      proof,
      artifact,
    });
  }
}
