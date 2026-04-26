import {
  computeProofRecordSchema,
  err,
  ok,
  type ComputeProofRecord,
  type ProofArtifact,
  type Result,
} from "@omen/shared";
import type { RepositoryError, ZeroGRefsRepository } from "@omen/db";

export class ComputeProofRecorder {
  constructor(private readonly repository: ZeroGRefsRepository) {}

  async record(
    artifact: ProofArtifact,
    output: string,
  ): Promise<Result<ComputeProofRecord, RepositoryError | Error>> {
    if (!artifact.compute) {
      return err(new Error("Compute proof recorder requires a compute-backed artifact."));
    }

    const recorded = await this.repository.createRef(artifact);

    if (!recorded.ok) {
      return recorded;
    }

    if (!recorded.value.compute) {
      return err(new Error("Recorded compute artifact lost its compute metadata."));
    }

    return ok(
      computeProofRecordSchema.parse({
        artifactId: recorded.value.id,
        runId: recorded.value.runId,
        signalId: recorded.value.signalId,
        intelId: recorded.value.intelId,
        stage:
          typeof recorded.value.metadata.stage === "string" &&
          (recorded.value.metadata.stage === "adjudication" ||
            recorded.value.metadata.stage === "report_synthesis")
            ? recorded.value.metadata.stage
            : "unknown",
        provider: recorded.value.compute.provider,
        model: recorded.value.compute.model,
        jobId: recorded.value.compute.jobId,
        requestHash: recorded.value.compute.requestHash,
        responseHash: recorded.value.compute.responseHash,
        verificationMode: recorded.value.compute.verificationMode,
        locator: recorded.value.locator,
        outputPreview: output.slice(0, 240),
        recordedAt: recorded.value.createdAt,
      }),
    );
  }
}
