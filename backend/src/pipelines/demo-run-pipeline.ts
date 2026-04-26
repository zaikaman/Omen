import {
  createOmenGraphFactory,
  type GraphFactory,
  type SwarmCheckpoint,
  type SwarmCheckpointStore,
  type SwarmState,
} from "@omen/agents";
import { TRADEABLE_SYMBOLS, type RuntimeMode } from "@omen/shared";

import type { SchedulerTaskContext } from "../scheduler/hourly-scheduler";

const createDemoRuntimeConfig = (mode: RuntimeMode): SwarmState["config"] => ({
  id: "default",
  mode,
  marketUniverse: TRADEABLE_SYMBOLS,
  qualityThresholds: {
    minConfidence: 85,
    minRiskReward: 2,
    minConfluences: 2,
  },
  providers: {
    axl: { enabled: true, required: true },
    zeroGStorage: { enabled: true, required: true },
    zeroGCompute: { enabled: true, required: false },
    binance: { enabled: true, required: false },
    coinGecko: { enabled: true, required: false },
    defiLlama: { enabled: true, required: false },
    news: { enabled: true, required: false },
    twitterapi: { enabled: true, required: false },
  },
  paperTradingEnabled: true,
  testnetExecutionEnabled: false,
  mainnetExecutionEnabled: false,
  postToXEnabled: true,
  scanIntervalMinutes: 60,
  updatedAt: new Date().toISOString(),
});

const createDemoRun = (input: SchedulerTaskContext): SwarmState["run"] => ({
  id: input.runId,
  mode: input.mode.mode,
  status: "queued",
  marketBias: "UNKNOWN",
  startedAt: null,
  completedAt: null,
  triggeredBy: input.trigger === "interval" ? "scheduler" : "system",
  activeCandidateCount: 0,
  currentCheckpointRefId: null,
  finalSignalId: null,
  finalIntelId: null,
  failureReason: null,
  outcome: null,
  configSnapshot: {
    runtimeMode: input.mode.mode,
    schedulerLabel: input.mode.label,
    triggeredAt: input.triggeredAt,
  },
  createdAt: input.triggeredAt,
  updatedAt: input.triggeredAt,
});

class InMemoryCheckpointStore implements SwarmCheckpointStore {
  private readonly checkpoints: SwarmCheckpoint[] = [];

  async save(checkpoint: SwarmCheckpoint) {
    this.checkpoints.push(checkpoint);
  }

  async loadLatest(input: { runId: string; threadId: string }) {
    const matches = this.checkpoints.filter(
      (checkpoint) =>
        checkpoint.runId === input.runId && checkpoint.threadId === input.threadId,
    );

    return matches.length > 0 ? matches[matches.length - 1] ?? null : null;
  }

  async listByRun(runId: string) {
    return this.checkpoints.filter((checkpoint) => checkpoint.runId === runId);
  }
}

export type DemoRunPipelineResult = {
  runId: string;
  completedAt: string;
  checkpointCount: number;
  outcomeType: NonNullable<SwarmState["run"]["outcome"]>["outcomeType"];
  finalState: SwarmState;
};

export type DemoRunPipeline = {
  run(request: SchedulerTaskContext): Promise<DemoRunPipelineResult>;
};

export class DefaultDemoRunPipeline implements DemoRunPipeline {
  constructor(
    private readonly input: {
      graphFactory?: GraphFactory;
      checkpointStoreFactory?: () => SwarmCheckpointStore;
    } = {},
  ) {}

  async run(request: SchedulerTaskContext): Promise<DemoRunPipelineResult> {
    const graphFactory = this.input.graphFactory ?? createOmenGraphFactory();
    const checkpointStore =
      this.input.checkpointStoreFactory?.() ?? new InMemoryCheckpointStore();
    const runtime = graphFactory.createRuntime({
      checkpointStore,
      runtimeName: "backend-demo-run-pipeline",
    });
    const finalState = await runtime.invoke({
      threadId: `${request.runId}:thread`,
      initialState: graphFactory.createInitialState({
        run: createDemoRun(request),
        config: createDemoRuntimeConfig(request.mode.mode),
      }),
    });
    const checkpoints = await checkpointStore.listByRun(request.runId);
    const outcome = finalState.run.outcome ?? {
      outcomeType: "no_conviction" as const,
      summary: "The swarm completed without a persisted outcome.",
      signalId: null,
      intelId: null,
    };

    return {
      runId: request.runId,
      completedAt: finalState.run.completedAt ?? new Date().toISOString(),
      checkpointCount: checkpoints.length,
      outcomeType: outcome.outcomeType,
      finalState,
    };
  }
}
