import { describe, expect, it } from "vitest";

import {
  buildOmenNodeInput,
  createInitialSwarmState,
  createOmenGraphFactory,
  type SwarmCheckpoint,
  type SwarmCheckpointStore,
} from "../src/index.js";

class InMemoryCheckpointStore implements SwarmCheckpointStore {
  private readonly checkpoints: SwarmCheckpoint[] = [];

  async save(checkpoint: SwarmCheckpoint) {
    this.checkpoints.push(checkpoint);
  }

  async loadLatest(input: { runId: string; threadId: string }) {
    return (
      [...this.checkpoints]
        .filter(
          (checkpoint) =>
            checkpoint.runId === input.runId && checkpoint.threadId === input.threadId,
        )
        .at(-1) ?? null
    );
  }

  async listByRun(runId: string) {
    return this.checkpoints.filter((checkpoint) => checkpoint.runId === runId);
  }
}

describe("omen graph factory", () => {
  const run = {
    id: "run-graph-1",
    mode: "mocked" as const,
    status: "queued" as const,
    marketBias: "UNKNOWN" as const,
    startedAt: null,
    completedAt: null,
    triggeredBy: "scheduler" as const,
    activeCandidateCount: 0,
    currentCheckpointRefId: null,
    finalSignalId: null,
    finalIntelId: null,
    failureReason: null,
    outcome: null,
    configSnapshot: {},
    createdAt: "2026-04-25T08:00:00.000Z",
    updatedAt: "2026-04-25T08:00:00.000Z",
  };

  const config = {
    id: "default",
    mode: "mocked" as const,
    marketUniverse: ["BTC", "ETH", "SOL"],
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
    updatedAt: "2026-04-25T08:00:00.000Z",
  };

  it("assembles the default node order with publisher as terminal", () => {
    const factory = createOmenGraphFactory();
    const graph = factory.createSwarmGraph();

    expect(graph.entryNodeKey).toBe("market-bias-agent");
    expect(graph.terminalNodeKeys).toEqual(["publisher-agent"]);
    expect(graph.nodes.map((node) => node.key)).toEqual([
      "market-bias-agent",
      "scanner-agent",
      "research-agent",
      "chart-vision-agent",
      "analyst-agent",
      "intel-agent",
      "generator-agent",
      "writer-agent",
      "memory-agent",
      "publisher-agent",
    ]);
  });

  it("runs the graph and persists checkpoints through the publisher terminal step", async () => {
    const checkpointStore = new InMemoryCheckpointStore();
    const factory = createOmenGraphFactory();
    const runtime = factory.createRuntime({
      checkpointStore,
      runtimeName: "test-runtime",
    });

    const finalState = await runtime.invoke({
      threadId: "thread-graph-1",
      initialState: createInitialSwarmState({ run, config }),
    });
    const checkpoints = await checkpointStore.listByRun(run.id);

    expect(finalState.run.status).toBe("completed");
    expect(finalState.run.currentCheckpointRefId).not.toBeNull();
    expect(finalState.run.outcome).not.toBeNull();
    expect(finalState.publisherDrafts.length).toBeGreaterThan(0);
    expect(checkpoints.map((checkpoint) => checkpoint.step)).toContain("memory-agent");
    expect(checkpoints.at(-1)?.step).toBe("publisher-agent");
  });

  it("starts intel from a clean brief instead of rejected trade context", () => {
    const state = createInitialSwarmState({ run, config });
    const input = buildOmenNodeInput({
      nodeKey: "intel-agent",
      state: {
        ...state,
        activeCandidates: [
          {
            id: "candidate-etc-1",
            symbol: "ETC",
            reason: "Scanner watchlist candidate.",
            directionHint: "WATCHLIST",
            status: "researched",
            sourceUniverse: "ETC,ATOM,TRX",
            dedupeKey: "ETC",
            missingDataNotes: [],
          },
        ],
        evidenceItems: [
          {
            category: "market",
            summary: "ETC spot snapshot recorded 8.31.",
            sourceLabel: "Binance",
            sourceUrl: null,
            structuredData: { symbol: "ETC" },
          },
        ],
        chartVisionSummaries: ["ETC 1h chart shows trend is leaning downward."],
        thesisDrafts: [
          {
            candidateId: "candidate-etc-1",
            asset: "ETC",
            direction: "NONE",
            confidence: 62,
            orderType: null,
            tradingStyle: null,
            expectedDuration: null,
            currentPrice: null,
            entryPrice: null,
            targetPrice: null,
            stopLoss: null,
            riskReward: null,
            whyNow: "ETC did not form an executable trade setup.",
            confluences: ["Mixed structure"],
            uncertaintyNotes: "No trade.",
            missingDataNotes: "No additional missing-data flags.",
          },
        ],
        criticReviews: [
          {
            candidateId: "candidate-etc-1",
            decision: "rejected",
            objections: [],
            forcedOutcomeReason: "The thesis failed the minimum quality gate.",
          },
        ],
      },
      threadId: "thread-graph-1",
    });

    expect(input).toMatchObject({
      candidates: [],
      evidence: [],
      chartVisionSummary: null,
      thesis: null,
      review: null,
    });
  });
});
