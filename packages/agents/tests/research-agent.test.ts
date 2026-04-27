import type { BinanceMarketService, DefiLlamaMarketService } from "@omen/market-data";
import type { OpenAiCompatibleJsonClient } from "../src/llm/openai-compatible-client.js";
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

  it("skips protocol lookup for symbols without a mapped DeFiLlama protocol slug", async () => {
    const state = createInitialSwarmState({ run, config });
    let protocolLookups = 0;
    const agent = createResearchAgent({
      marketData: {
        getSnapshot: async () => ({
          ok: true,
          value: {
            symbol: "BTC",
            provider: "binance",
            price: 65000,
            change24hPercent: 2.4,
            volume24h: 100000000,
            fundingRate: 0.005,
            openInterest: 250000000,
            candles: [],
            capturedAt: "2026-04-25T08:00:00.000Z",
          },
        }),
      } as unknown as BinanceMarketService,
      protocolData: {
        getProtocolSnapshot: async () => {
          protocolLookups += 1;
          throw new Error("protocol lookup should not be called for BTC");
        },
      } as unknown as DefiLlamaMarketService,
    });

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

    expect(protocolLookups).toBe(0);
    expect(
      (result.missingDataNotes ?? []).some((note) => note.startsWith("Protocol snapshot missing:")),
    ).toBe(false);
  });

  it("uses the model-backed synthesis path when a client is provided", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createResearchAgent({
      marketData: {
        getSnapshot: async () => ({
          ok: true,
          value: {
            symbol: "BTC",
            provider: "binance",
            price: 102345,
            change24hPercent: 4.2,
            volume24h: 123456789,
            fundingRate: 0.01,
            openInterest: 555000000,
            candles: [],
            capturedAt: "2026-04-25T08:00:00.000Z",
          },
        }),
      } as unknown as BinanceMarketService,
      protocolData: {
        getProtocolSnapshot: async () => ({
          ok: true,
          value: {
            protocol: "Bitcoin",
            chain: "bitcoin",
            category: "store-of-value",
            tvlUsd: 900000000,
            tvlChange1dPercent: 1.2,
            tvlChange7dPercent: 5.4,
            sourceUrl: "https://defillama.com/protocol/bitcoin",
            capturedAt: "2026-04-25T08:00:00.000Z",
          },
        }),
      } as unknown as DefiLlamaMarketService,
      llmClient: {
        completeJson: async () => ({
          evidence: [
            {
              category: "market" as const,
              summary:
                "BTC outperformed the local major set with positive spot momentum and stable funding.",
              sourceLabel: "Binance",
              sourceUrl: null,
              structuredData: {
                symbol: "BTC",
              },
            },
            {
              category: "sentiment" as const,
              summary: "ETF-flow headlines kept the tone constructive rather than euphoric.",
              sourceLabel: "News",
              sourceUrl: "https://example.com/etf-flows",
              structuredData: {
                symbol: "BTC",
              },
            },
          ],
          narrativeSummary:
            "BTC remained market-led, with spot strength confirmed by steady bullish flow headlines.",
          missingDataNotes: [],
        }),
      } as unknown as OpenAiCompatibleJsonClient,
    });

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
    expect(result.narrativeSummary).toContain("spot strength confirmed");
    expect(result.evidence[0]?.structuredData).not.toHaveProperty("prompt");
    expect(result.evidence.some((item) => item.summary.includes("ETF-flow headlines"))).toBe(true);
  });
});
