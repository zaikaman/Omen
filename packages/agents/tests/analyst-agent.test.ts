import { describe, expect, it } from "vitest";

import { createAnalystAgent, createInitialSwarmState } from "../src/index.js";

describe("analyst agent", () => {
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

  it("turns a research bundle into a structured thesis draft", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createAnalystAgent();

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-1",
          mode: "mocked",
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
              structuredData: {},
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
  });
});
