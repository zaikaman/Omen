import type { SwarmState } from "@omen/agents";
import {
  ZeroGClientAdapter,
  ZeroGLogStore,
  ZeroGReportSynthesis,
  ZeroGStateStore,
  type ZeroGAdapterConfig,
} from "@omen/zero-g";
import type { ProofArtifact } from "@omen/shared";

export type ZeroGPublisherResult = {
  checkpointArtifact: ProofArtifact;
  logArtifact: ProofArtifact | null;
  computeArtifact: ProofArtifact | null;
  computeOutput: string | null;
  computeError: string | null;
  artifacts: ProofArtifact[];
};

export class ZeroGPublisher {
  private readonly stateStore: ZeroGStateStore;

  private readonly logStore: ZeroGLogStore;

  private readonly reportSynthesis: ZeroGReportSynthesis;

  constructor(config: ZeroGAdapterConfig) {
    const adapter = new ZeroGClientAdapter(config);
    this.stateStore = new ZeroGStateStore(adapter);
    this.logStore = new ZeroGLogStore(adapter);
    this.reportSynthesis = new ZeroGReportSynthesis(adapter);
  }

  async publishRunArtifacts(input: {
    environment: string;
    state: SwarmState;
    checkpointLabel: string;
    logStream?: string;
    logUploadsEnabled?: boolean;
    reportPrompt?: string | null;
    reportModel?: string;
  }): Promise<ZeroGPublisherResult> {
    const checkpointArtifact = await this.requireArtifact(
      this.stateStore.writeRunCheckpoint({
        environment: input.environment,
        runId: input.state.run.id,
        checkpointLabel: input.checkpointLabel,
        state: input.state,
        signalId: input.state.run.finalSignalId,
        intelId: input.state.run.finalIntelId,
        metadata: {
          status: input.state.run.status,
        },
      }),
    );
    const artifacts = [checkpointArtifact];
    let logArtifact: ProofArtifact | null = null;

    if (input.logUploadsEnabled) {
      const appendedLog = await this.logStore.appendRunLog({
        environment: input.environment,
        runId: input.state.run.id,
        stream: input.logStream ?? "runtime-trace",
        content: input.state.notes.length > 0 ? input.state.notes : ["run-completed"],
        signalId: input.state.run.finalSignalId,
        intelId: input.state.run.finalIntelId,
        metadata: {
          noteCount: input.state.notes.length,
          errorCount: input.state.errors.length,
        },
      });

      if (appendedLog.ok) {
        logArtifact = appendedLog.value;
        artifacts.push(appendedLog.value);
      }
    }

    if (!input.reportPrompt) {
      return {
        checkpointArtifact,
        logArtifact,
        computeArtifact: null,
        computeOutput: null,
        computeError: null,
        artifacts,
      };
    }

    const computeResult = await this.reportSynthesis.synthesizeRunReport({
      runId: input.state.run.id,
      prompt: input.reportPrompt,
      model: input.reportModel,
      signalId: input.state.run.finalSignalId,
      intelId: input.state.run.finalIntelId,
      metadata: {
        outcomeType: input.state.run.outcome?.outcomeType ?? "unknown",
      },
    });

    if (!computeResult.ok) {
      return {
        checkpointArtifact,
        logArtifact,
        computeArtifact: null,
        computeOutput: null,
        computeError: computeResult.error.message,
        artifacts,
      };
    }

    artifacts.push(computeResult.value.artifact);

    return {
      checkpointArtifact,
      logArtifact,
      computeArtifact: computeResult.value.artifact,
      computeOutput: computeResult.value.output,
      computeError: null,
      artifacts,
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
