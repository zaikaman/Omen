import type { OpenAiCompatibleJsonClient } from "../src/llm/openai-compatible-client.js";
import { describe, expect, it } from "vitest";

import {
  createInitialSwarmState,
  createMarketBiasAgent,
  createScannerAgent,
} from "../src/index.js";

describe("scanner definitions", () => {
  const run = {
    id: "run-1",
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
    marketUniverse: ["BTC", "ETH", "SOL", "ARB"],
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

  it("derives market bias from market snapshots and narratives", async () => {
    const agent = createMarketBiasAgent();
    const state = createInitialSwarmState({ run, config });
    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-1",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        snapshots: [
          {
            symbol: "BTC",
            provider: "binance",
            price: 100000,
            change24hPercent: 3.4,
            volume24h: null,
            fundingRate: null,
            openInterest: null,
            candles: [],
            capturedAt: "2026-04-25T08:00:00.000Z",
          },
        ],
        narratives: [
          {
            symbol: "BTC",
            title: "Momentum builds",
            summary: "Spot-led strength continues.",
            sentiment: "bullish",
            source: "news",
            sourceUrl: null,
            capturedAt: "2026-04-25T08:00:00.000Z",
          },
        ],
      },
      state,
    );

    expect(result.marketBias).toBe("LONG");
    expect(result.confidence).toBeGreaterThan(50);
  });

  it("uses the scanner model path for market bias when a client is provided", async () => {
    const agent = createMarketBiasAgent({
      llmClient: {
        completeJson: async () => ({
          marketBias: "SHORT" as const,
          reasoning:
            "Majors weakened together and the supplied narrative set leaned risk-off.",
          confidence: 77,
        }),
      } as unknown as OpenAiCompatibleJsonClient,
    });
    const state = createInitialSwarmState({ run, config });
    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-1",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        snapshots: [],
        narratives: [],
      },
      state,
    );

    expect(result.marketBias).toBe("SHORT");
    expect(result.reasoning).toContain("risk-off");
  });

  it("selects at most three candidates aligned with the current market bias", async () => {
    const agent = createScannerAgent();
    const state = createInitialSwarmState({ run, config });
    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-1",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        bias: {
          marketBias: "LONG",
          reasoning: "Broad majors are breaking higher.",
          confidence: 82,
        },
        universe: ["BTC", "ETH", "SOL", "ARB", "LINK"],
      },
      state,
    );

    expect(result.marketBias).toBe("LONG");
    expect(result.candidates.length).toBeLessThanOrEqual(3);
    expect(result.candidates.every((candidate) => candidate.directionHint === "LONG")).toBe(
      true,
    );
    expect((result.rejectedSymbols ?? []).length).toBeGreaterThan(0);
  });

  it("uses the scanner model path when a client is provided", async () => {
    const agent = createScannerAgent({
      llmClient: {
        completeJson: async () => ({
          candidates: [
            {
              symbol: "SOL",
              reason: "SOL kept the strongest relative 24h change with supportive momentum.",
              directionHint: "LONG" as const,
            },
          ],
          rejectedSymbols: ["BTC", "ETH"],
        }),
      } as unknown as OpenAiCompatibleJsonClient,
    });
    const state = createInitialSwarmState({ run, config });
    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-1",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        bias: {
          marketBias: "LONG",
          reasoning: "Broad majors are breaking higher.",
          confidence: 82,
        },
        universe: ["BTC", "ETH", "SOL"],
      },
      state,
    );

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.symbol).toBe("SOL");
    expect(result.candidates[0]?.reason).toContain("strongest relative");
  });
});
