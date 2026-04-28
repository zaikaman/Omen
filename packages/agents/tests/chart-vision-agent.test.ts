import type { BinanceMarketService, MarketCandle } from "@omen/market-data";
import { describe, expect, it } from "vitest";

import {
  OpenAiCompatibleVisionClient,
  type OpenAiCompatibleVisionClient as OpenAiCompatibleVisionClientType,
} from "../src/llm/openai-compatible-vision-client.js";
import { createChartVisionAgent, createInitialSwarmState } from "../src/index.js";

const buildCandles = (intervalMinutes: number): MarketCandle[] =>
  Array.from({ length: 96 }, (_, index) => {
    const base = 100 + index * 0.6;
    const open = base;
    const close = base + (index % 3 === 0 ? 1.2 : 0.4);
    const high = Math.max(open, close) + 0.8;
    const low = Math.min(open, close) - 0.7;

    return {
      timestamp: new Date(
        Date.UTC(2026, 3, 25, 0, 0, 0) + index * intervalMinutes * 60_000,
      ).toISOString(),
      open,
      high,
      low,
      close,
      volume: 1_000 + index * 25,
    };
  });

describe("chart vision agent", () => {
  const run = {
    id: "run-chart-vision-1",
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

  it("uses the vision model path and emits chart evidence for all configured frames", async () => {
    const state = createInitialSwarmState({ run, config });
    const framesByInterval: Record<string, MarketCandle[]> = {
      "15m": buildCandles(15),
      "1h": buildCandles(60),
      "4h": buildCandles(240).slice(0, 90),
    };
    const agent = createChartVisionAgent({
      marketData: {
        getCandles: async ({ interval }: { interval: "15m" | "1h" | "4h" }) => ({
          ok: true,
          value: framesByInterval[interval],
        }),
      } as unknown as BinanceMarketService,
      chartImageService: {
        generateCandlestickChart: async ({
          timeframe,
        }: {
          timeframe: "15m" | "1h" | "4h";
        }) => ({
          base64: Buffer.from(`chart:${timeframe}`).toString("base64"),
          mimeType: "image/png" as const,
          width: 1600,
          height: 900,
          description: `Synthetic ${timeframe} chart`,
        }),
      },
      visionClient: {
        completeJson: async () => ({
          frames: [
            {
              timeframe: "15m" as const,
              analysis: "15m shows a clean intraday continuation structure.",
            },
            {
              timeframe: "1h" as const,
              analysis: "1h is holding above the moving-average stack after a breakout.",
            },
            {
              timeframe: "4h" as const,
              analysis: "4h trend remains constructive with higher lows intact.",
            },
          ],
          summary:
            "The chart stack broadly confirms the candidate, with 1h and 4h trend support and 15m continuation.",
        }),
      } as unknown as OpenAiCompatibleVisionClientType,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-chart-vision-1",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
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
      },
      state,
    );

    expect(result.frames).toHaveLength(3);
    expect(result.chartSummary).toContain("broadly confirms");
    expect(result.evidence).toHaveLength(3);
    expect(result.evidence.every((item) => item.category === "chart")).toBe(true);
    expect(result.evidence).toMatchObject([
      { structuredData: { timeframe: "15m" } },
      { structuredData: { timeframe: "1h" } },
      { structuredData: { timeframe: "4h" } },
    ]);
    expect(result.missingDataNotes).toEqual([]);
  });

  it("falls back to deterministic chart summaries when the vision model is unavailable", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createChartVisionAgent({
      marketData: {
        getCandles: async ({ interval }: { interval: "15m" | "1h" | "4h" }) => ({
          ok: true,
          value: interval === "4h" ? buildCandles(240).slice(0, 90) : buildCandles(interval === "15m" ? 15 : 60),
        }),
      } as unknown as BinanceMarketService,
      chartImageService: {
        generateCandlestickChart: async ({
          symbol,
          timeframe,
        }: {
          symbol: string;
          timeframe: "15m" | "1h" | "4h";
        }) => ({
          base64: Buffer.from(`${symbol}:${timeframe}`).toString("base64"),
          mimeType: "image/png" as const,
          width: 1600,
          height: 900,
          description: `${symbol} ${timeframe} chart`,
        }),
      },
      visionClient: null,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-chart-vision-2",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        candidate: {
          id: "candidate-sol-1",
          symbol: "SOL",
          reason: "Strong relative momentum",
          directionHint: "LONG",
          status: "researched",
          sourceUniverse: "BTC,ETH,SOL",
          dedupeKey: "SOL",
          missingDataNotes: [],
        },
      },
      state,
    );

    expect(result.frames).toHaveLength(3);
    expect(result.frames[0]?.analysis).toContain("SOL");
    expect(result.chartSummary).toContain("15m:");
    expect(result.evidence[0]?.summary).toContain("SOL");
  });

  it("uses OpenAI reasoning env instead of scanner env for the vision client", () => {
    const client = OpenAiCompatibleVisionClient.fromEnv({
      SCANNER_API_KEY: "scanner-key",
      SCANNER_BASE_URL: "https://scanner.example/v1",
      SCANNER_MODEL: "scanner-model",
      OPENAI_API_KEY: "openai-key",
      OPENAI_BASE_URL: "https://openai.example/v1",
      OPENAI_MODEL: "openai-reasoning-model",
    } as NodeJS.ProcessEnv);

    expect(client?.config.apiKey).toBe("openai-key");
    expect(client?.config.baseUrl).toBe("https://openai.example/v1");
    expect(client?.config.model).toBe("openai-reasoning-model");
  });
});
