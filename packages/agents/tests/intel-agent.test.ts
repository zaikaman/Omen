import { describe, expect, it } from "vitest";

import { createInitialSwarmState, createIntelAgent } from "../src/index.js";

describe("intel agent", () => {
  const run = {
    id: "run-intel-1",
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

  it("builds a publishable intel report when a signal is rejected", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createIntelAgent();

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-intel-1",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        bias: {
          marketBias: "LONG",
          reasoning: "Risk appetite improved and majors stayed green.",
          confidence: 74,
        },
        candidates: [
          {
            id: "candidate-avax-1",
            symbol: "AVAX",
            reason: "Relative strength in layer-1 rotation.",
            directionHint: "WATCHLIST",
            status: "researched",
            sourceUniverse: "AVAX,SOL,ETH",
            dedupeKey: "AVAX",
            missingDataNotes: [],
          },
        ],
        evidence: [
          {
            category: "market",
            summary: "AVAX spot snapshot recorded 9.42 with stable funding and constructive flow.",
            sourceLabel: "Binance",
            sourceUrl: null,
            structuredData: {},
          },
          {
            category: "sentiment",
            summary:
              "Layer-1 rotation chatter kept AVAX on watchlists despite the failed trade setup.",
            sourceLabel: "Market Desk",
            sourceUrl: null,
            structuredData: {},
          },
        ],
        chartVisionSummary:
          "15m and 1h stayed constructive, while 4h remained range-bound near resistance.",
        thesis: {
          candidateId: "candidate-avax-1",
          asset: "AVAX",
          direction: "WATCHLIST",
          confidence: 72,
          orderType: null,
          tradingStyle: null,
          expectedDuration: null,
          currentPrice: 9.42,
          entryPrice: null,
          targetPrice: null,
          stopLoss: null,
          riskReward: null,
          whyNow: "Momentum improved but did not clear the signal bar.",
          confluences: ["Relative strength", "Constructive chart posture"],
          uncertaintyNotes: "Higher-timeframe confirmation is still incomplete.",
          missingDataNotes: "No additional missing-data flags.",
        },
        review: {
          candidateId: "candidate-avax-1",
          decision: "rejected",
          objections: ["Signal confidence stayed below threshold"],
          forcedOutcomeReason: "Good context, not enough for a trade call.",
        },
        recentIntelHistory: [],
      },
      state,
    );

    expect(result.action).toBe("ready");
    expect(result.report?.title).toContain("AVAX");
    expect(result.report?.importanceScore).toBeGreaterThanOrEqual(7);
    expect(result.report?.summary).not.toMatch(/failed the signal gate/i);
  });

  it("suppresses duplicate intel when a similar report was published recently", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createIntelAgent({
      llmClient: {
        completeJson: async () => ({
          action: "ready" as const,
          report: {
            topic: "AVAX market setup fallback",
            insight: "Layer-1 rotation kept AVAX on the watchlist despite the signal reject.",
            importanceScore: 8,
            category: "token_watch" as const,
            title: "AVAX market intel",
            summary: "AVAX rotation remains worth tracking.",
            confidence: 71,
            symbols: ["AVAX"],
          },
          skipReason: null,
        }),
      } as never,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-intel-2",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        bias: null,
        candidates: [],
        evidence: [],
        chartVisionSummary: null,
        thesis: null,
        review: null,
        recentIntelHistory: [
          {
            title: "AVAX market intel",
            topic: "AVAX market setup fallback",
            category: "token_watch",
            symbols: ["AVAX"],
            timestamp: new Date().toISOString(),
          },
        ],
      },
      state,
    );

    expect(result.action).toBe("skip");
    expect(result.report).toBeNull();
    expect(result.skipReason).toBe("recent_duplicate");
  });
});
