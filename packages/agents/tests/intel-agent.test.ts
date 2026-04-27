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

  it("uses fresh market research for live intel instead of only failed trade evidence", async () => {
    const liveRun = {
      ...run,
      mode: "live" as const,
    };
    const liveConfig = {
      ...config,
      mode: "live" as const,
    };
    const state = createInitialSwarmState({ run: liveRun, config: liveConfig });
    const agent = createIntelAgent({
      llmClient: null,
      marketResearch: {
        getSymbolResearchBundle: async () => ({
          ok: true as const,
          provider: "news",
          value: {
            symbol: "SOL",
            narratives: [
              {
                symbol: "SOL",
                title: "Solana market narrative shifts",
                summary:
                  "High-signal market accounts are discussing Solana weakness as liquidity rotates out of beta L1 trades.",
                sentiment: "bearish" as const,
                source: "Tavily",
                sourceUrl: null,
                capturedAt: new Date().toISOString(),
              },
            ],
            macroContext: [],
          },
          health: {
            provider: "news",
            available: true,
            degraded: false,
            checkedAt: new Date().toISOString(),
            notes: [],
          },
        }),
      } as never,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: liveRun.id,
          threadId: "thread-intel-live",
          mode: "live",
          triggeredBy: "scheduler",
        },
        bias: {
          marketBias: "SHORT",
          reasoning: "Risk-off tape with majors weak.",
          confidence: 83,
        },
        candidates: [
          {
            id: "candidate-sol-1",
            symbol: "SOL",
            reason: "SOL underperformed in a short-biased tape.",
            directionHint: null,
            status: "researched",
            sourceUniverse: "BTC,ETH,SOL",
            dedupeKey: "SOL",
            missingDataNotes: [],
          },
        ],
        evidence: [
          {
            category: "market",
            summary: "SOL spot snapshot recorded 83.83 with 24h change -3.11%.",
            sourceLabel: "Binance",
            sourceUrl: null,
            structuredData: {},
          },
        ],
        chartVisionSummary: "SOL 1h chart shows trend is leaning downward.",
        thesis: {
          candidateId: "candidate-sol-1",
          asset: "SOL",
          direction: "NONE",
          confidence: 63,
          orderType: null,
          tradingStyle: null,
          expectedDuration: null,
          currentPrice: null,
          entryPrice: null,
          targetPrice: null,
          stopLoss: null,
          riskReward: null,
          whyNow: "SOL did not form an executable trade setup.",
          confluences: ["Market snapshot only"],
          uncertaintyNotes: "No trade levels.",
          missingDataNotes: "No additional missing-data flags.",
        },
        review: {
          candidateId: "candidate-sol-1",
          decision: "rejected",
          objections: [],
          forcedOutcomeReason: "The thesis failed the minimum quality gate.",
        },
        recentIntelHistory: [],
      },
      state,
    );

    expect(result.action).toBe("ready");
    expect(result.report?.importanceScore).toBeGreaterThanOrEqual(7);
    expect(result.report?.summary).toMatch(/Solana market narrative shifts/i);
  });

  it("can start a live intel scan from a clean market brief", async () => {
    const liveRun = {
      ...run,
      mode: "live" as const,
      marketBias: "NEUTRAL" as const,
    };
    const liveConfig = {
      ...config,
      mode: "live" as const,
    };
    const state = createInitialSwarmState({ run: liveRun, config: liveConfig });
    const calls: Array<{ symbol: string; query: string }> = [];
    const agent = createIntelAgent({
      llmClient: null,
      marketResearch: {
        getSymbolResearchBundle: async (input: { symbol: string; query: string }) => {
          calls.push(input);
          return {
            ok: true as const,
            provider: "news",
            value: {
              symbol: input.symbol,
              narratives: [
                {
                  symbol: input.symbol,
                  title: "Crypto market narratives reset",
                  summary:
                    "High-signal accounts are focused on broad liquidity conditions and fresh narrative rotation.",
                  sentiment: "neutral" as const,
                  source: "Tavily",
                  sourceUrl: null,
                  capturedAt: new Date().toISOString(),
                },
              ],
              macroContext: [],
            },
            health: {
              provider: "news",
              available: true,
              degraded: false,
              checkedAt: new Date().toISOString(),
              notes: [],
            },
          };
        },
      } as never,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: liveRun.id,
          threadId: "thread-intel-clean",
          mode: "live",
          triggeredBy: "scheduler",
        },
        bias: {
          marketBias: "NEUTRAL",
          reasoning: "Market bias stayed neutral.",
          confidence: 67,
        },
        candidates: [],
        evidence: [],
        chartVisionSummary: null,
        thesis: null,
        review: null,
        recentIntelHistory: [],
      },
      state,
    );

    expect(calls).toEqual([
      {
        symbol: "MARKET",
        query:
          "crypto market narratives today high signal accounts WatcherGuru Pentosh1 Cointelegraph",
      },
    ]);
    expect(result.action).toBe("ready");
    expect(result.report?.summary).toMatch(/Crypto market narratives reset/i);
    expect(result.report?.summary).not.toMatch(/trade cleared|trade setup|ETC spot/i);
  });
});
