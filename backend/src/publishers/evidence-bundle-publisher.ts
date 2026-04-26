import type { SwarmState } from "@omen/agents";
import {
  ZeroGClientAdapter,
  ZeroGFileStore,
  type ZeroGAdapterConfig,
} from "@omen/zero-g";
import type { ProofArtifact } from "@omen/shared";

type ChartRenderInput = {
  name: string;
  contentType: string;
  bytes: Uint8Array;
  metadata?: Record<string, unknown>;
};

export type EvidenceBundlePublishResult = {
  evidenceBundleArtifact: ProofArtifact;
  chartArtifacts: ProofArtifact[];
  artifacts: ProofArtifact[];
};

export class EvidenceBundlePublisher {
  private readonly fileStore: ZeroGFileStore;

  constructor(config: ZeroGAdapterConfig) {
    this.fileStore = new ZeroGFileStore(new ZeroGClientAdapter(config));
  }

  async publish(input: {
    environment: string;
    state: SwarmState;
    chartRenders?: ChartRenderInput[];
  }): Promise<EvidenceBundlePublishResult> {
    const chartArtifacts = await Promise.all(
      (input.chartRenders ?? []).map((chart) =>
        this.requireArtifact(
          this.fileStore.publishRunBundle({
            environment: input.environment,
            runId: input.state.run.id,
            signalId: input.state.run.finalSignalId,
            intelId: input.state.run.finalIntelId,
            segments: ["evidence-bundles", "charts"],
            bundle: chart.name,
            contentType: chart.contentType,
            bytes: chart.bytes,
            metadata: {
              label: `chart-render:${chart.name}`,
              artifactType: "chart_render",
              ...chart.metadata,
            },
          }),
        ),
      ),
    );
    const evidencePayload = {
      run: {
        id: input.state.run.id,
        status: input.state.run.status,
        marketBias: input.state.run.marketBias,
        finalSignalId: input.state.run.finalSignalId,
        finalIntelId: input.state.run.finalIntelId,
      },
      candidates: input.state.activeCandidates,
      evidenceItems: input.state.evidenceItems,
      chartArtifacts: chartArtifacts.map((artifact) => ({
        id: artifact.id,
        locator: artifact.locator,
        key: artifact.key,
      })),
      notes: input.state.notes,
      errors: input.state.errors,
    };
    const evidenceBundleArtifact = await this.requireArtifact(
      this.fileStore.publishRunBundle({
        environment: input.environment,
        runId: input.state.run.id,
        signalId: input.state.run.finalSignalId,
        intelId: input.state.run.finalIntelId,
        segments: ["evidence-bundles"],
        bundle: "evidence-pack.json",
        contentType: "application/json",
        bytes: JSON.stringify(evidencePayload, null, 2),
        metadata: {
          label: "evidence-pack",
          artifactType: "evidence_pack",
          chartCount: chartArtifacts.length,
          evidenceCount: input.state.evidenceItems.length,
        },
      }),
    );

    return {
      evidenceBundleArtifact,
      chartArtifacts,
      artifacts: [...chartArtifacts, evidenceBundleArtifact],
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
