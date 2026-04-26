import { describe, expect, it } from "vitest";

import { createInitialSwarmState, createResearchAgent } from "../src/index.js";

describe("research agent", () => {
  const run = {
    id: "run-1",
    mode: "mocked" as const,
    status: "queued" as const,
    marketBias: "LONG" as const,
    startedAt: null,
    completedAt: null,
    triggeredBy: "scheduler" as const,
    activeCandidateCount: 1,
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

  it("builds a normalized research bundle with researched candidate state", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createResearchAgent();

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-1",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        candidate: {
          id: "candidate-btc-1",
          symbol: "BTC",
          reason: "Momentum and narrative alignment",
          directionHint: "LONG",
          status: "pending",
          sourceUniverse: "BTC,ETH,SOL",
          dedupeKey: "BTC",
          missingDataNotes: [],
        },
      },
      state,
    );

    expect(result.candidate.status).toBe("researched");
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.narrativeSummary.length).toBeGreaterThan(0);
    expect(
      result.evidence.some((item) =>
        ["market", "fundamental", "sentiment", "catalyst"].includes(item.category),
      ),
    ).toBe(true);
  });
});
