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

  it("builds a publishable intel report when mocked evidence is supplied directly", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createIntelAgent({ llmClient: null });

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

  it("suppresses duplicate intel when a similar report was published recently", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createIntelAgent({
      llmClient: {
        completeJson: async () => ({
          topic: "AVAX market intel",
          insight: "Layer-1 rotation kept AVAX on the watchlist despite the signal reject.",
          importance_score: 8,
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
            topic: "AVAX market intel",
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

    const result = await agent.invoke(
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
    );

    expect(result.action).toBe("skip");
    expect(result.report).toBeNull();
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
          mode: "mocked",
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
    const parsedPrompt = JSON.parse(capturedUserPrompt) as {
      instruction: string;
      recent_posts?: Array<{ text?: string }>;
      market_data?: unknown[];
    };

    expect(result.action).toBe("ready");
    expect(parsedPrompt.recent_posts?.[0]?.text).toBe(
      "privacy coins wake as btc/eth range; thin liquidity could spark a move",
    );
    expect(parsedPrompt.market_data).toEqual([]);
    expect(capturedUseResponsesApi).toBeUndefined();
    expect(capturedTools).toBeUndefined();
    expect(parsedPrompt.instruction).toMatch(/built-in X search/i);
    expect(parsedPrompt.instruction).toMatch(/only the high-signal X accounts/i);
    expect(parsedPrompt.instruction).toMatch(/Do not build intel from CoinGecko/i);
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
          mode: "mocked",
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
