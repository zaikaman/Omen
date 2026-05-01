import type { OpenAiCompatibleJsonClient } from "../src/llm/openai-compatible-client.js";
import { describe, expect, it } from "vitest";
import {
  createProviderSuccess,
  type BinanceMarketService,
  type CoinGeckoMarketService,
  type CoinMarketCapMarketService,
  type MarketCandle,
} from "@omen/market-data";

import { createAnalystAgent, createInitialSwarmState } from "../src/index.js";

describe("analyst agent", () => {
  const run = {
    id: "run-1",
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

  const createAnalystLlmClient = (output: unknown) =>
    ({
      config: {
        apiKey: "test-key",
        baseUrl: "https://example.com/v1",
        model: "test-reasoner",
        timeoutMs: 30_000,
      },
      completeJson: async () => output,
    }) as unknown as OpenAiCompatibleJsonClient;

  it("turns a research bundle into a structured thesis draft", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createAnalystAgent({
      llmClient: createAnalystLlmClient({
        thesis: {
          candidateId: "ignored-by-sanitizer",
          asset: "ignored-by-sanitizer",
          direction: "LONG",
          confidence: 88,
          orderType: "market",
          tradingStyle: "day_trade",
          expectedDuration: "8-16 hours",
          currentPrice: 65000,
          entryPrice: 65000,
          targetPrice: 72000,
          stopLoss: 62000,
          riskReward: 2.6,
          whyNow: "BTC reclaimed local range highs with enough confirmation.",
          confluences: ["Range reclaim", "Constructive sentiment"],
          uncertaintyNotes: "Funding data was estimated from fallback inputs.",
          missingDataNotes: "Funding data was estimated from fallback inputs.",
        },
        analystNotes: ["Model fixture preferred the breakout path."],
      }),
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-1",
          mode: "live",
          triggeredBy: "scheduler",
        },
        research: {
          candidate: {
            id: "candidate-btc-1",
            symbol: "BTC",
            reason: "Momentum and narrative alignment",
            directionHint: "LONG",
            status: "researched",
            sourceUniverse: "BTC,ETH,SOL",
            dedupeKey: "BTC",
            missingDataNotes: [],
          },
          evidence: [
            {
              category: "market",
              summary: "BTC reclaimed local range highs with positive 24h momentum.",
              sourceLabel: "Binance",
              sourceUrl: null,
              structuredData: {
                price: 65000,
                change24hPercent: 2.4,
              },
            },
            {
              category: "technical",
              summary: "Breakout structure held above prior resistance on the 4H chart.",
              sourceLabel: "Omen Indicators",
              sourceUrl: null,
              structuredData: {},
            },
            {
              category: "sentiment",
              summary: "Narrative flow stayed constructive around majors.",
              sourceLabel: "News",
              sourceUrl: null,
              structuredData: {},
            },
          ],
          narrativeSummary:
            "Narrative follow-through supported the breakout instead of fading it immediately.",
          missingDataNotes: ["Funding data was estimated from fallback inputs."],
        },
      },
      state,
    );

    expect(result.thesis.asset).toBe("BTC");
    expect(["LONG", "SHORT", "WATCHLIST", "NONE"]).toContain(result.thesis.direction);
    expect(result.thesis.confidence).toBeGreaterThan(0);
    expect((result.thesis.confluences ?? []).length).toBeGreaterThan(0);
    expect((result.analystNotes ?? []).length).toBeGreaterThan(0);
    expect(result.thesis.orderType).toBe("market");
    expect(result.thesis.tradingStyle).toBe("day_trade");
    expect(result.thesis.expectedDuration).toBe("8-16 hours");
    expect(result.thesis.currentPrice).toBeGreaterThan(0);
    expect(result.thesis.entryPrice).toBe(result.thesis.currentPrice);
    expect(result.thesis.targetPrice).toBeGreaterThan(result.thesis.entryPrice ?? 0);
    expect(result.thesis.stopLoss).toBeLessThan(result.thesis.entryPrice ?? 0);
  });

  it("uses the reasoning model path when a client is provided", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createAnalystAgent({
      llmClient: {
        config: {
          apiKey: "test-key",
          baseUrl: "https://example.com/v1",
          model: "test-reasoner",
          timeoutMs: 30_000,
        },
        completeJson: async () => ({
          thesis: {
            candidateId: "ignored-by-sanitizer",
            asset: "ignored-by-sanitizer",
            direction: "LONG" as const,
            confidence: 88,
            orderType: "limit" as const,
            tradingStyle: "day_trade" as const,
            expectedDuration: "6-12 hours",
            currentPrice: 65000,
            entryPrice: 64850,
            targetPrice: 69600,
            stopLoss: 62500,
            riskReward: 2.8,
            whyNow: "BTC held trend support while spot momentum stayed constructive.",
            confluences: ["Trend support held", "Momentum stayed constructive"],
            uncertaintyNotes: "Macro follow-through still matters.",
            missingDataNotes: "No additional missing-data flags.",
          },
          analystNotes: ["Model preferred the higher-conviction path."],
        }),
      } as unknown as OpenAiCompatibleJsonClient,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-1",
          mode: "live",
          triggeredBy: "scheduler",
        },
        research: {
          candidate: {
            id: "candidate-btc-1",
            symbol: "BTC",
            reason: "Momentum and narrative alignment",
            directionHint: "LONG",
            status: "researched",
            sourceUniverse: "BTC,ETH,SOL",
            dedupeKey: "BTC",
            missingDataNotes: [],
          },
          evidence: [
            {
              category: "market",
              summary: "BTC reclaimed local range highs with positive 24h momentum.",
              sourceLabel: "Binance",
              sourceUrl: null,
              structuredData: {
                price: 65000,
              },
            },
          ],
          narrativeSummary: "Momentum stayed constructive.",
          missingDataNotes: [],
        },
      },
      state,
    );

    expect(result.thesis.candidateId).toBe("candidate-btc-1");
    expect(result.thesis.asset).toBe("BTC");
    expect(result.thesis.orderType).toBe("limit");
    expect(result.thesis.entryPrice).toBe(64850);
    expect((result.analystNotes ?? []).some((note) => note.includes("test-reasoner"))).toBe(true);
  });

  it("normalizes common model thesis shape mistakes before strict validation", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createAnalystAgent({
      llmClient: {
        config: {
          apiKey: "test-key",
          baseUrl: "https://example.com/v1",
          model: "test-reasoner",
          timeoutMs: 30_000,
        },
        completeJson: async () => ({
          thesis: {
            candidateId: "ignored-by-sanitizer",
            asset: "ignored-by-sanitizer",
            direction: "long",
            orderType: "LIMIT",
            tradingStyle: "DAY_TRADING",
            expectedDuration: "8-16 hours",
            currentPrice: "100",
            entryPrice: "99",
            targetPrice: "108",
            stopLoss: "95",
            riskReward: "3",
            whyNow: "AVAX is holding a constructive pullback setup.",
            confluences: "Pullback held above local support",
            uncertaintyNotes: ["ETF flow follow-through still needs confirmation."],
            missingDataNotes: ["No additional missing-data flags."],
          },
          analystNotes: "Model returned loose enum casing.",
        }),
      } as unknown as OpenAiCompatibleJsonClient,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-normalize-model",
          mode: "live",
          triggeredBy: "scheduler",
        },
        research: {
          candidate: {
            id: "candidate-avax-1",
            symbol: "AVAX",
            reason: "Testing model output normalization.",
            directionHint: "LONG",
            status: "researched",
            sourceUniverse: "AVAX",
            dedupeKey: "AVAX",
            missingDataNotes: [],
          },
          evidence: [
            {
              category: "market",
              summary: "AVAX outperformed the market with constructive momentum.",
              sourceLabel: "Binance",
              sourceUrl: null,
              structuredData: {
                price: 100,
                currentPrice: 100,
              },
            },
            {
              category: "technical",
              summary: "AVAX held local support with an upward chart lean.",
              sourceLabel: "Omen Indicators",
              sourceUrl: null,
              structuredData: {},
            },
          ],
          narrativeSummary: "AVAX remains constructive.",
          missingDataNotes: [],
        },
      },
      state,
    );

    expect(result.thesis.candidateId).toBe("candidate-avax-1");
    expect(result.thesis.asset).toBe("AVAX");
    expect(result.thesis.orderType).toBe("limit");
    expect(result.thesis.tradingStyle).toBe("day_trade");
    expect(result.thesis.missingDataNotes).toBe("No additional missing-data flags.");
    expect(result.thesis.uncertaintyNotes).toBe(
      "ETF flow follow-through still needs confirmation.",
    );
    expect(result.thesis.confidence).toBeGreaterThan(0);
    expect(result.analystNotes).toEqual(
      expect.arrayContaining(["Model returned loose enum casing."]),
    );
  });

  it("rejects stale market-order entries that drift away from current price", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createAnalystAgent({
      llmClient: {
        config: {
          apiKey: "test-key",
          baseUrl: "https://example.com/v1",
          model: "test-reasoner",
          timeoutMs: 30_000,
        },
        completeJson: async () => ({
          thesis: {
            candidateId: "ignored-by-sanitizer",
            asset: "ignored-by-sanitizer",
            direction: "LONG" as const,
            confidence: 90,
            orderType: "market" as const,
            tradingStyle: "day_trade" as const,
            expectedDuration: "6-12 hours",
            currentPrice: 100,
            entryPrice: 95,
            targetPrice: 110,
            stopLoss: 91,
            riskReward: 3.75,
            whyNow: "BTC has immediate momentum, but the market entry is stale.",
            confluences: ["Momentum stayed constructive", "Trend support held"],
            uncertaintyNotes: "Market entry must be live.",
            missingDataNotes: "No additional missing-data flags.",
          },
          analystNotes: ["Model returned a stale market entry."],
        }),
      } as unknown as OpenAiCompatibleJsonClient,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-stale-market",
          mode: "live",
          triggeredBy: "scheduler",
        },
        research: {
          candidate: {
            id: "candidate-btc-stale",
            symbol: "BTC",
            reason: "Testing market entry validation.",
            directionHint: "LONG",
            status: "researched",
            sourceUniverse: "BTC",
            dedupeKey: "BTC",
            missingDataNotes: [],
          },
          evidence: [
            {
              category: "market",
              summary: "BTC spot snapshot recorded 100 with positive momentum.",
              sourceLabel: "Binance",
              sourceUrl: null,
              structuredData: {
                price: 100,
                currentPrice: 100,
              },
            },
            {
              category: "technical",
              summary: "BTC momentum stayed constructive above trend support.",
              sourceLabel: "Omen Indicators",
              sourceUrl: null,
              structuredData: {},
            },
          ],
          narrativeSummary: "Momentum stayed constructive.",
          missingDataNotes: [],
        },
      },
      state,
    );

    expect(result.thesis.direction).toBe("NONE");
    expect(result.thesis.entryPrice).toBeNull();
    expect(result.thesis.whyNow).toContain("Market order entry is more than 1% away");
  });

  it("normalizes model watchlist output to NONE for live no-trade outcomes", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createAnalystAgent({
      llmClient: createAnalystLlmClient({
        thesis: {
          candidateId: "ignored-by-sanitizer",
          asset: "ignored-by-sanitizer",
          direction: "WATCHLIST",
          confidence: 82,
          orderType: null,
          tradingStyle: null,
          expectedDuration: null,
          currentPrice: 1.52,
          entryPrice: null,
          targetPrice: null,
          stopLoss: null,
          riskReward: 0,
          whyNow: "PENDLE is interesting but should stay on watchlist at resistance.",
          confluences: ["Momentum is strong", "Price is at resistance"],
          uncertaintyNotes: "No executable entry yet.",
          missingDataNotes: "No additional missing-data flags.",
        },
        analystNotes: ["Model tried to return watchlist."],
      }),
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-watchlist-normalize",
          mode: "live",
          triggeredBy: "scheduler",
        },
        research: {
          candidate: {
            id: "candidate-pendle-watchlist",
            symbol: "PENDLE",
            reason: "Testing disabled watchlist mode.",
            directionHint: "LONG",
            status: "researched",
            sourceUniverse: "PENDLE",
            dedupeKey: "PENDLE",
            missingDataNotes: [],
          },
          evidence: [
            {
              category: "market",
              summary: "PENDLE is up strongly but near immediate resistance.",
              sourceLabel: "Binance",
              sourceUrl: null,
              structuredData: { price: 1.52 },
            },
            {
              category: "chart",
              summary: "Price is near resistance with mixed continuation.",
              sourceLabel: "Chart Vision",
              sourceUrl: null,
              structuredData: {},
            },
          ],
          narrativeSummary: "PENDLE is not executable at resistance.",
          missingDataNotes: [],
        },
      },
      state,
    );

    expect(result.thesis.direction).toBe("NONE");
    expect(result.thesis.orderType).toBeNull();
    expect(result.thesis.entryPrice).toBeNull();
    expect(result.thesis.whyNow.toLowerCase()).not.toContain("watchlist");
    expect(result.analystNotes.join(" ").toLowerCase()).not.toContain("watchlist");
  });

  it("preserves a far executable limit entry on the retry pass", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createAnalystAgent({
      llmClient: {
        config: {
          apiKey: "test-key",
          baseUrl: "https://example.com/v1",
          model: "test-reasoner",
          timeoutMs: 30_000,
        },
        completeJson: async () => ({
          thesis: {
            candidateId: "ignored-by-sanitizer",
            asset: "ignored-by-sanitizer",
            direction: "LONG" as const,
            confidence: 92,
            orderType: "limit" as const,
            tradingStyle: "day_trade" as const,
            expectedDuration: "8-16 hours",
            currentPrice: 1.51,
            entryPrice: 1.28,
            targetPrice: 1.58,
            stopLoss: 1.23,
            riskReward: 6,
            whyNow: "PENDLE has momentum and the pullback limit entry remains valid.",
            confluences: ["Momentum", "Chart", "Narrative"],
            uncertaintyNotes: "Entry must be executable.",
            missingDataNotes: "No additional missing-data flags.",
          },
          analystNotes: ["Model retried the critic issue."],
        }),
      } as unknown as OpenAiCompatibleJsonClient,
    });

    const previousThesis = {
      candidateId: "candidate-pendle-1",
      asset: "PENDLE",
      direction: "LONG" as const,
      confidence: 92,
      orderType: "limit" as const,
      tradingStyle: "day_trade" as const,
      expectedDuration: "8-16 hours",
      currentPrice: 1.51,
      entryPrice: 1.28,
      targetPrice: 1.58,
      stopLoss: 1.23,
      riskReward: 6,
      whyNow: "Initial thesis used a far pullback.",
      confluences: ["Momentum", "Chart", "Narrative"],
      uncertaintyNotes: "Entry may be stale.",
      missingDataNotes: "No additional missing-data flags.",
    };

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-repair",
          mode: "live",
          triggeredBy: "scheduler",
        },
        research: {
          candidate: {
            id: "candidate-pendle-1",
            symbol: "PENDLE",
            reason: "Testing repair path.",
            directionHint: "LONG",
            status: "researched",
            sourceUniverse: "PENDLE",
            dedupeKey: "PENDLE",
            missingDataNotes: [],
          },
          evidence: [
            {
              category: "market",
              summary: "PENDLE trades at 1.51.",
              sourceLabel: "Binance",
              sourceUrl: null,
              structuredData: { currentPrice: 1.51, price: 1.51 },
            },
            {
              category: "technical",
              summary: "Momentum is constructive near resistance.",
              sourceLabel: "Analyzer",
              sourceUrl: null,
              structuredData: {},
            },
          ],
          narrativeSummary: "Momentum stayed constructive.",
          missingDataNotes: [],
        },
        repairContext: {
          attemptNumber: 1,
          previousThesis,
          review: {
            candidateId: "candidate-pendle-1",
            decision: "rejected",
            objections: ["Prior critic requested execution review."],
            forcedOutcomeReason: "Execution math needs review.",
            repairable: true,
            repairInstructions: ["Keep the entry executable without using forbidden stop-entry mechanics."],
          },
        },
      },
      state,
    );

    expect(result.thesis.orderType).toBe("limit");
    expect(result.thesis.entryPrice).toBe(1.28);
    expect(result.thesis.stopLoss).toBeLessThan(result.thesis.entryPrice ?? 0);
    expect(result.analystNotes.join(" ")).toContain("Repair attempt 1");
  });

  it("derives a short thesis from downward chart language without a direction hint", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createAnalystAgent({
      llmClient: createAnalystLlmClient({
        thesis: {
          candidateId: "ignored-by-sanitizer",
          asset: "ignored-by-sanitizer",
          direction: "SHORT",
          confidence: 87,
          orderType: "limit",
          tradingStyle: "day_trade",
          expectedDuration: "8-16 hours",
          currentPrice: 83.83,
          entryPrice: 84,
          targetPrice: 78,
          stopLoss: 87,
          riskReward: 2,
          whyNow: "SOL has an actionable downside setup from downward chart language.",
          confluences: ["Lower lows", "Weak relative performance"],
          uncertaintyNotes: "Continuation needs confirmation.",
          missingDataNotes: "No additional missing-data flags.",
        },
        analystNotes: ["Model fixture derived the short setup."],
      }),
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-short",
          mode: "live",
          triggeredBy: "scheduler",
        },
        research: {
          candidate: {
            id: "candidate-sol-1",
            symbol: "SOL",
            reason: "Underperforming in a short-biased tape.",
            directionHint: null,
            status: "researched",
            sourceUniverse: "BTC,ETH,SOL",
            dedupeKey: "SOL",
            missingDataNotes: [],
          },
          evidence: [
            {
              category: "market",
              summary: "SOL spot snapshot recorded 83.83 with 24h change -3.11%.",
              sourceLabel: "Binance",
              sourceUrl: null,
              structuredData: {
                price: 83.83,
              },
            },
            {
              category: "chart",
              summary:
                "SOL 1h chart shows trend is leaning downward with lower lows and confirming volume.",
              sourceLabel: "Chart Vision",
              sourceUrl: null,
              structuredData: {},
            },
          ],
          narrativeSummary: "SOL remains weak relative to majors.",
          missingDataNotes: [],
        },
      },
      state,
    );

    expect(result.thesis.direction).toBe("SHORT");
    expect(result.thesis.entryPrice).not.toBeNull();
    expect(result.thesis.targetPrice).not.toBeNull();
    expect(result.thesis.stopLoss).not.toBeNull();
    expect(result.thesis.whyNow).toMatch(/actionable/i);
  });

  it("uses the template-style analyzer tools during live enrichment", async () => {
    const liveRun = { ...run, mode: "live" as const };
    const state = createInitialSwarmState({ run: liveRun, config: { ...config, mode: "live" } });
    const calls: string[] = [];
    const candles = Array.from({ length: 120 }, (_, index): MarketCandle => {
      const close = 100 + index * 0.1;

      return {
        timestamp: new Date(Date.UTC(2026, 3, 25, index)).toISOString(),
        open: close - 0.2,
        high: close + 0.8,
        low: close - 0.8,
        close,
        volume: 1_000 + index,
      };
    });
    const agent = createAnalystAgent({
      llmClient: createAnalystLlmClient({
        thesis: {
          candidateId: "ignored-by-sanitizer",
          asset: "ignored-by-sanitizer",
          direction: "LONG",
          confidence: 89,
          orderType: "limit",
          tradingStyle: "day_trade",
          expectedDuration: "8-16 hours",
          currentPrice: 112,
          entryPrice: 111,
          targetPrice: 120,
          stopLoss: 107,
          riskReward: 2.25,
          whyNow: "Analyzer TA and market chart 1H structure support a live setup.",
          confluences: ["Analyzer TA constructive", "1H structure held"],
          uncertaintyNotes: "Needs continued volume confirmation.",
          missingDataNotes: "No additional missing-data flags.",
        },
        analystNotes: ["technical analyzer TA confirmed by market chart"],
      }),
      marketData: {
        getSnapshot: async () => {
          calls.push("get_token_price/binance_snapshot");

          return createProviderSuccess({
            provider: "binance",
            value: {
              symbol: "SOL",
              provider: "binance",
              price: 112,
              change24hPercent: 2.1,
              volume24h: 10_000_000,
              fundingRate: 0.0001,
              openInterest: 500_000_000,
              candles: [],
              capturedAt: "2026-04-28T00:00:00.000Z",
            },
          });
        },
        getCandles: async (input: { interval?: "15m" | "1h" | "4h" | "1d" }) => {
          const interval = input.interval ?? "1h";
          calls.push(`get_market_chart/${interval}`);

          return createProviderSuccess({
            provider: "binance",
            value: candles,
          });
        },
      } as unknown as BinanceMarketService,
      coinMarketCap: {
        getPriceWithChange: async () => {
          calls.push("get_token_price/coinmarketcap_quote");

          return createProviderSuccess({
            provider: "coinmarketcap",
            value: {
              symbol: "SOL",
              price: 112.2,
              change24hPercent: 2.3,
              capturedAt: "2026-04-28T00:00:00.000Z",
            },
          });
        },
      } as unknown as CoinMarketCapMarketService,
      coinGecko: {
        getAssetSnapshot: async () => {
          calls.push("get_fundamental_analysis/coingecko_snapshot");

          return createProviderSuccess({
            provider: "coingecko",
            value: {
              symbol: "SOL",
              provider: "coingecko",
              price: 112.1,
              change24hPercent: 2.2,
              volume24h: 9_000_000,
              fundingRate: null,
              openInterest: null,
              candles: [],
              capturedAt: "2026-04-28T00:00:00.000Z",
            },
          });
        },
      } as unknown as CoinGeckoMarketService,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: liveRun.id,
          threadId: "thread-live",
          mode: "live",
          triggeredBy: "scheduler",
        },
        research: {
          candidate: {
            id: "candidate-sol-live",
            symbol: "SOL",
            reason: "Testing live analyzer enrichment.",
            directionHint: "LONG",
            status: "researched",
            sourceUniverse: "SOL",
            dedupeKey: "SOL",
            missingDataNotes: [],
          },
          evidence: [
            {
              category: "market",
              summary: "SOL scanner context requires analyst confirmation.",
              sourceLabel: "Scanner",
              sourceUrl: null,
              structuredData: {},
            },
          ],
          narrativeSummary: "Initial scanner context.",
          missingDataNotes: [],
        },
      },
      state,
    );

    expect(calls).toEqual(
      expect.arrayContaining([
        "get_token_price/binance_snapshot",
        "get_token_price/coinmarketcap_quote",
        "get_market_chart/15m",
        "get_market_chart/1h",
        "get_market_chart/4h",
        "get_fundamental_analysis/coingecko_snapshot",
      ]),
    );
    expect(result.analystNotes?.join(" ")).toContain("technical");
    expect(result.thesis.whyNow).toMatch(/analyzer TA|market chart|1H structure/i);
    expect(result.evidence.map((item) => item.sourceLabel)).toEqual(
      expect.arrayContaining(["Binance", "CoinMarketCap", "CoinGecko"]),
    );
    expect(
      result.evidence.find((item) => item.sourceLabel === "Binance")?.structuredData.currentPrice,
    ).toBe(112);
  });
});
