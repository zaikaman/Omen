import { describe, expect, it } from "vitest";

import { createInitialSwarmState, createIntelAgent } from "../src/index.js";

describe("intel agent", () => {
  const run = {
    id: "run-intel-1",
    mode: "live" as const,
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
    mode: "live" as const,
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

  it("builds a publishable intel report when mocked evidence is supplied directly", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createIntelAgent({
      llmClient: {
        completeJson: async () => ({
          topic: "High-throughput infra momentum",
          insight:
            "High-throughput infra momentum is building as XPL, MON, and HYPE gain social and on-chain chatter.",
          importance_score: 8,
        }),
      } as never,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-intel-1",
          mode: "live",
          triggeredBy: "scheduler",
        },
        bias: {
          marketBias: "LONG",
          reasoning: "Risk appetite improved and majors stayed green.",
          confidence: 74,
        },
        candidates: [],
        evidence: [
          {
            category: "sentiment",
            summary:
              "High-throughput infra momentum is building as XPL, MON, and HYPE gain social and on-chain chatter.",
            sourceLabel: "Market Desk",
            sourceUrl: null,
            structuredData: {
              symbols: ["XPL", "MON", "HYPE"],
            },
          },
        ],
        chartVisionSummary: null,
        thesis: null,
        review: null,
        recentIntelHistory: [],
      },
      state,
    );

    expect(result.action).toBe("ready");
    expect(result.report?.importanceScore).toBeGreaterThanOrEqual(7);
    expect(result.report?.summary).toMatch(/high-throughput infra/i);
  });

  it("passes recently covered topics as avoid-context without hard-blocking the model report", async () => {
    const state = createInitialSwarmState({ run, config });
    let capturedUserPrompt = "";
    const agent = createIntelAgent({
      llmClient: {
        completeJson: async ({ userPrompt }: { userPrompt: string }) => {
          capturedUserPrompt = userPrompt;

          return {
            topic: "AVAX market intel",
            insight: "Layer-1 rotation kept AVAX on the watchlist despite the signal reject.",
            importance_score: 8,
          };
        },
      } as never,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-intel-2",
          mode: "live",
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
            topic: "AVAX market intel",
            category: "token_watch",
            symbols: ["AVAX"],
            timestamp: new Date().toISOString(),
          },
        ],
      },
      state,
    );

    expect(result.action).toBe("ready");
    expect(result.report?.title).toBe("AVAX market intel");
    expect(capturedUserPrompt).toContain("AVOID these recently covered topics: AVAX market intel");
  });

  it("does not synthesize live intel from raw token feeds when no model is available", async () => {
    const liveRun = {
      ...run,
      mode: "live" as const,
    };
    const liveConfig = {
      ...config,
      mode: "live" as const,
    };
    const state = createInitialSwarmState({ run: liveRun, config: liveConfig });
    const agent = createIntelAgent({ llmClient: null });

    await expect(
      agent.invoke(
        {
          context: {
            runId: liveRun.id,
            threadId: "thread-intel-clean",
            mode: "live",
            triggeredBy: "scheduler",
          },
          bias: null,
          candidates: [],
          evidence: [],
          chartVisionSummary: null,
          thesis: null,
          review: null,
          recentIntelHistory: [],
        },
        state,
      ),
    ).rejects.toThrow("Intel research enrichment requires a configured LLM client.");
  });

  it("passes recent post context while asking the model to use built-in X search", async () => {
    const state = createInitialSwarmState({ run, config });
    let capturedUserPrompt = "";
    let capturedUseResponsesApi: unknown = "missing";
    let capturedTools: unknown = "missing";
    const agent = createIntelAgent({
      llmClient: {
        completeJson: async ({
          userPrompt,
          useResponsesApi,
          tools,
        }: {
          userPrompt: string;
          useResponsesApi?: unknown;
          tools?: unknown;
        }) => {
          capturedUserPrompt = userPrompt;
          capturedUseResponsesApi = useResponsesApi;
          capturedTools = tools;

          return {
            topic: "Privacy coin rotation",
            insight:
              "High-signal accounts are connecting privacy coin strength to policy chatter and institutional compliance demand.",
            importance_score: 8,
          };
        },
      } as never,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-intel-x-search",
          mode: "live",
          triggeredBy: "scheduler",
        },
        bias: null,
        candidates: [],
        evidence: [],
        chartVisionSummary: null,
        thesis: null,
        review: null,
        recentIntelHistory: [],
        recentPostContext: [
          {
            kind: "intel_summary",
            text: "privacy coins wake as btc/eth range; thin liquidity could spark a move",
            status: "posted",
            publishedUrl: "https://x.com/i/web/status/123",
            signalId: null,
            intelId: "intel-privacy",
            timestamp: "2026-04-25T08:00:00.000Z",
          },
        ],
      },
      state,
    );
    expect(result.action).toBe("ready");
    expect(capturedUserPrompt).toContain("Analyze this market data and generate an intel report");
    expect(capturedUserPrompt).toContain("RECENTLY POSTED CONTENT (Avoid repeating these):");
    expect(capturedUserPrompt).toContain(
      "privacy coins wake as btc/eth range; thin liquidity could spark a move",
    );
    expect(capturedUserPrompt).toContain("AVOID these recently covered topics:");
    expect(capturedUseResponsesApi).toBeUndefined();
    expect(capturedTools).toBeUndefined();
  });

  it("collects live market leads before asking the model to research intel", async () => {
    const liveRun = {
      ...run,
      mode: "live" as const,
    };
    const liveConfig = {
      ...config,
      mode: "live" as const,
    };
    const state = createInitialSwarmState({ run: liveRun, config: liveConfig });
    let capturedUserPrompt = "";
    const agent = createIntelAgent({
      coinGecko: {
        getAssetSnapshot: async () => ({
          ok: true,
          provider: "coingecko",
          value: {
            symbol: "BTC",
            provider: "coingecko",
            price: 76000,
            change24hPercent: -1.2,
            volume24h: 25_000_000_000,
            fundingRate: null,
            openInterest: null,
            candles: [],
            capturedAt: new Date().toISOString(),
          },
          health: {
            provider: "coingecko",
            available: true,
            degraded: false,
            checkedAt: new Date().toISOString(),
            notes: [],
          },
        }),
        getTrending: async () => ({
          ok: true,
          provider: "coingecko",
          value: [
            {
              name: "Zcash",
              symbol: "ZEC",
              rank: 50,
              chain: null,
              address: null,
              volume24h: null,
              source: "coingecko",
              capturedAt: new Date().toISOString(),
            },
          ],
          health: {
            provider: "coingecko",
            available: true,
            degraded: false,
            checkedAt: new Date().toISOString(),
            notes: [],
          },
        }),
        getTopGainersLosers: async () => ({
          ok: true,
          provider: "coingecko",
          value: [],
          health: {
            provider: "coingecko",
            available: true,
            degraded: false,
            checkedAt: new Date().toISOString(),
            notes: [],
          },
        }),
      } as never,
      birdeye: {
        getTrendingTokens: async () => ({
          ok: true,
          provider: "birdeye",
          value: [],
          health: {
            provider: "birdeye",
            available: true,
            degraded: false,
            checkedAt: new Date().toISOString(),
            notes: [],
          },
        }),
      } as never,
      defiLlama: {
        getProtocolStats: async () => ({
          ok: true,
          provider: "defillama",
          value: [],
          health: {
            provider: "defillama",
            available: true,
            degraded: false,
            checkedAt: new Date().toISOString(),
            notes: [],
          },
        }),
        getYieldPools: async () => ({
          ok: true,
          provider: "defillama",
          value: [],
          health: {
            provider: "defillama",
            available: true,
            degraded: false,
            checkedAt: new Date().toISOString(),
            notes: [],
          },
        }),
        getGlobalTVL: async () => ({
          ok: true,
          provider: "defillama",
          value: [],
          health: {
            provider: "defillama",
            available: true,
            degraded: false,
            checkedAt: new Date().toISOString(),
            notes: [],
          },
        }),
      } as never,
      llmClient: {
        completeJson: async ({ userPrompt }: { userPrompt: string }) => {
          capturedUserPrompt = userPrompt;

          return {
            topic: "Privacy coin policy bid",
            insight:
              "High-signal accounts are connecting privacy coin strength to policy chatter and institutional demand for compliant shielded infrastructure.",
            importance_score: 8,
          };
        },
      } as never,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: liveRun.id,
          threadId: "thread-intel-live-leads",
          mode: "live",
          triggeredBy: "scheduler",
        },
        bias: null,
        candidates: [],
        evidence: [],
        chartVisionSummary: null,
        thesis: null,
        review: null,
        recentIntelHistory: [],
        recentPostContext: [],
      },
      state,
    );
    expect(result.action).toBe("ready");
    expect(capturedUserPrompt).toContain("trending_coingecko");
    expect(capturedUserPrompt).toContain('"symbol": "ZEC"');
    expect(capturedUserPrompt).toContain("RECENTLY POSTED CONTENT");
  });

  it("passes recent post context as avoid-context without suppressing the model report", async () => {
    const state = createInitialSwarmState({ run, config });
    let capturedUserPrompt = "";
    const agent = createIntelAgent({
      llmClient: {
        completeJson: async ({ userPrompt }: { userPrompt: string }) => {
          capturedUserPrompt = userPrompt;

          return {
            topic: "Bitcoin pressure and institutional signals",
            insight:
              "Bitcoin has broken below $76,000 while high-signal chatter highlights ETH's five-year lag versus NVDA and cautious positioning from Pentosh1.",
            importance_score: 8,
          };
        },
      } as never,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-intel-recent-post-dupe",
          mode: "live",
          triggeredBy: "scheduler",
        },
        bias: null,
        candidates: [],
        evidence: [],
        chartVisionSummary: null,
        thesis: null,
        review: null,
        recentIntelHistory: [],
        recentPostContext: [
          {
            kind: "intel_summary",
            text: "bitcoin pressure and institutional signals\n\n- bitcoin has broken below $76,000 amid broader underperformance narratives, with high-signal chatter highlighting eth's 5-year lag versus nvda and cautious positioning from traders like pentosh1",
            status: "posted",
            publishedUrl: "https://x.com/i/web/status/456",
            signalId: null,
            intelId: "intel-bitcoin-pressure",
            timestamp: new Date().toISOString(),
          },
        ],
      },
      state,
    );

    expect(result.action).toBe("ready");
    expect(result.report?.title).toBe("Bitcoin pressure and institutional signals");
    expect(capturedUserPrompt).toContain("RECENTLY POSTED CONTENT (Avoid repeating these):");
    expect(capturedUserPrompt).toContain("bitcoin pressure and institutional signals");
  });

  it("retries with an X search prompt when the first intel pass returns not enough value", async () => {
    const state = createInitialSwarmState({ run, config });
    const capturedPrompts: string[] = [];
    const agent = createIntelAgent({
      llmClient: {
        completeJson: async ({ userPrompt }: { userPrompt: string }) => {
          capturedPrompts.push(userPrompt);

          if (capturedPrompts.length === 1) {
            return {
              topic: "SKIP",
              insight: "Not enough value",
              importance_score: 4,
            };
          }

          return {
            topic: "Privacy coin policy bid",
            insight:
              "High-signal accounts are connecting privacy coin strength to policy chatter and renewed demand for shielded infrastructure.",
            importance_score: 8,
          };
        },
      } as never,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-intel-retry",
          mode: "live",
          triggeredBy: "scheduler",
        },
        bias: null,
        candidates: [],
        evidence: [],
        chartVisionSummary: null,
        thesis: null,
        review: null,
        recentIntelHistory: [],
        recentPostContext: [],
      },
      state,
    );

    expect(result.action).toBe("ready");
    expect(result.report?.title).toBe("Privacy coin policy bid");
    expect(capturedPrompts).toHaveLength(2);
    expect(capturedPrompts[1]).toContain("Treat that as an error");
    expect(capturedPrompts[1]).toContain("Prioritize recent posts or commentary");
  });

  it("rejects generic low-signal news even when the model scores it highly", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createIntelAgent({
      llmClient: {
        completeJson: async () => ({
          topic: "Crypto News",
          insight:
            "Crypto News: Pepeto Announces Investment Growth While the Bitcoin Price Prediction Bulls Targets $150,000.",
          importance_score: 8,
        }),
      } as never,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-intel-low-signal",
          mode: "live",
          triggeredBy: "scheduler",
        },
        bias: null,
        candidates: [],
        evidence: [
          {
            category: "sentiment",
            summary:
              "Crypto News: Pepeto Announces Investment Growth While the Bitcoin Price Prediction Bulls Targets $150,000.",
            sourceLabel: "markets.businessinsider.com",
            sourceUrl: "https://markets.businessinsider.com/news/currencies/example",
            structuredData: {},
          },
        ],
        chartVisionSummary: null,
        thesis: null,
        review: null,
        recentIntelHistory: [],
      },
      state,
    );

    expect(result.action).toBe("skip");
    expect(result.report).toBeNull();
    expect(result.skipReason).toBe("not_enough_value");
  });
});
