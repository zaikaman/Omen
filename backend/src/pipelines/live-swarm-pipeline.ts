import {
  createOmenGraphFactory,
  type GraphFactory,
  type SwarmCheckpoint,
  type SwarmCheckpointStore,
  type SwarmState,
} from "@omen/agents";

import type { BackendEnv } from "../bootstrap/env";
import type { SchedulerTaskContext } from "../scheduler/hourly-scheduler";

const DEFAULT_MARKET_UNIVERSE = ["BTC", "ETH", "SOL"] as const;
const DEFAULT_SCAN_INTERVAL_MINUTES = 60;

const hasTwitterPostingConfig = (env: BackendEnv) =>
  Boolean(
    env.twitterApi.apiKey &&
      env.twitterApi.loginCookies &&
      env.twitterApi.proxy,
  );

const createLiveRuntimeConfig = (input: {
  env: BackendEnv;
  request: SchedulerTaskContext;
  marketUniverse: string[];
  scanIntervalMinutes: number;
  postToXEnabledOverride?: boolean;
}): SwarmState["config"] => {
  const externalReadsEnabled = input.request.mode.allowsExternalReads;
  const externalWritesEnabled = input.request.mode.allowsExternalWrites;
  const postToXEnabled =
    (input.postToXEnabledOverride ?? true) &&
    externalWritesEnabled &&
    hasTwitterPostingConfig(input.env);

  return {
    id: "live-swarm-runtime",
    mode: input.request.mode.mode,
    marketUniverse: input.marketUniverse,
    qualityThresholds: {
      minConfidence: 85,
      minRiskReward: 2,
      minConfluences: 2,
    },
    providers: {
      axl: { enabled: false, required: false },
      zeroGStorage: { enabled: false, required: false },
      zeroGCompute: { enabled: false, required: false },
      binance: { enabled: externalReadsEnabled, required: false },
      coinGecko: { enabled: externalReadsEnabled, required: false },
      defiLlama: { enabled: externalReadsEnabled, required: false },
      news: {
        enabled: externalReadsEnabled && Boolean(input.env.providers.tavilyApiKey),
        required: false,
      },
      twitterapi: {
        enabled: postToXEnabled,
        required: false,
      },
    },
    paperTradingEnabled: true,
    testnetExecutionEnabled: false,
    mainnetExecutionEnabled: false,
    postToXEnabled,
    scanIntervalMinutes: input.scanIntervalMinutes,
    updatedAt: new Date().toISOString(),
  };
};

const createScheduledRun = (input: SchedulerTaskContext): SwarmState["run"] => ({
  id: input.runId,
  mode: input.mode.mode,
  status: "starting",
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

export type LiveSwarmPipelineResult = {
  runId: string;
  completedAt: string;
  checkpointCount: number;
  outcomeType: NonNullable<SwarmState["run"]["outcome"]>["outcomeType"];
  finalState: SwarmState;
};

export type LiveSwarmPipeline = {
  run(request: SchedulerTaskContext): Promise<LiveSwarmPipelineResult>;
};

export class DefaultLiveSwarmRunPipeline implements LiveSwarmPipeline {
  constructor(
    private readonly input: {
      env: BackendEnv;
      graphFactory?: GraphFactory;
      checkpointStoreFactory?: () => SwarmCheckpointStore;
      marketUniverse?: string[];
      scanIntervalMinutes?: number;
      postToXEnabledOverride?: boolean;
      runtimeName?: string;
    },
  ) {}

  async run(request: SchedulerTaskContext): Promise<LiveSwarmPipelineResult> {
    const graphFactory = this.input.graphFactory ?? createOmenGraphFactory();
    const checkpointStore =
      this.input.checkpointStoreFactory?.() ?? new InMemoryCheckpointStore();
    const runtime = graphFactory.createRuntime({
      checkpointStore,
      runtimeName: this.input.runtimeName ?? "backend-live-swarm-pipeline",
    });
    const finalState = await runtime.invoke({
      threadId: `${request.runId}:thread`,
      initialState: graphFactory.createInitialState({
        run: createScheduledRun(request),
        config: createLiveRuntimeConfig({
          env: this.input.env,
          request,
          marketUniverse: this.input.marketUniverse ?? [...DEFAULT_MARKET_UNIVERSE],
          scanIntervalMinutes:
            this.input.scanIntervalMinutes ?? DEFAULT_SCAN_INTERVAL_MINUTES,
          postToXEnabledOverride: this.input.postToXEnabledOverride,
        }),
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
