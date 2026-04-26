import type { SwarmState } from "@omen/agents";
import {
  ZeroGClientAdapter,
  ZeroGFileStore,
  type ZeroGAdapterConfig,
} from "@omen/zero-g";
import type { ProofArtifact } from "@omen/shared";

export type ReportBundlePublishResult = {
  reportBundleArtifact: ProofArtifact;
  reportTextArtifact: ProofArtifact | null;
  artifacts: ProofArtifact[];
};

export class ReportBundlePublisher {
  private readonly fileStore: ZeroGFileStore;

  constructor(config: ZeroGAdapterConfig) {
    this.fileStore = new ZeroGFileStore(new ZeroGClientAdapter(config));
  }

  async publish(input: {
    environment: string;
    state: SwarmState;
    reportText?: string | null;
    computeArtifact?: ProofArtifact | null;
    evidenceBundleArtifact?: ProofArtifact | null;
  }): Promise<ReportBundlePublishResult> {
    const reportTextArtifact = input.reportText
      ? await this.requireArtifact(
          this.fileStore.publishRunBundle({
            environment: input.environment,
            runId: input.state.run.id,
            signalId: input.state.run.finalSignalId,
            intelId: input.state.run.finalIntelId,
            segments: ["report-bundles"],
            bundle: "final-report.md",
            contentType: "text/markdown",
            bytes: input.reportText,
            metadata: {
              label: "final-report-text",
              artifactType: "report_text",
            },
          }),
        )
      : null;
    const reportPayload = {
      run: input.state.run,
      marketBiasReasoning: input.state.marketBiasReasoning,
      thesisDrafts: input.state.thesisDrafts,
      criticReviews: input.state.criticReviews,
      publisherDrafts: input.state.publisherDrafts,
      outboundPosts: input.state.outboundPosts,
      notes: input.state.notes,
      errors: input.state.errors,
      reportTextArtifact:
        reportTextArtifact === null
          ? null
          : {
              id: reportTextArtifact.id,
              locator: reportTextArtifact.locator,
              key: reportTextArtifact.key,
            },
      computeArtifact:
        input.computeArtifact === null || input.computeArtifact === undefined
          ? null
          : {
              id: input.computeArtifact.id,
              locator: input.computeArtifact.locator,
              key: input.computeArtifact.key,
            },
      evidenceBundleArtifact:
        input.evidenceBundleArtifact === null || input.evidenceBundleArtifact === undefined
          ? null
          : {
              id: input.evidenceBundleArtifact.id,
              locator: input.evidenceBundleArtifact.locator,
              key: input.evidenceBundleArtifact.key,
            },
    };
    const reportBundleArtifact = await this.requireArtifact(
      this.fileStore.publishRunBundle({
        environment: input.environment,
        runId: input.state.run.id,
        signalId: input.state.run.finalSignalId,
        intelId: input.state.run.finalIntelId,
        segments: ["report-bundles"],
        bundle: "final-report.json",
        contentType: "application/json",
        bytes: JSON.stringify(reportPayload, null, 2),
        metadata: {
          label: "final-report-bundle",
          artifactType: "report_bundle",
          draftCount: input.state.publisherDrafts.length,
          reviewCount: input.state.criticReviews.length,
        },
      }),
    );

    return {
      reportBundleArtifact,
      reportTextArtifact,
      artifacts:
        reportTextArtifact === null
          ? [reportBundleArtifact]
          : [reportTextArtifact, reportBundleArtifact],
    };
  }

  private async requireArtifact(
    promise: Promise<{ ok: true; value: ProofArtifact } | { ok: false; error: Error }>,
  ) {
    const result = await promise;

    if (!result.ok) {
      throw result.error;
    }

    return result.value;
  }
}
