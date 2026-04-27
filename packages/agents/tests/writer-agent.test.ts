import { describe, expect, it } from "vitest";

import { createInitialSwarmState, createWriterAgent } from "../src/index.js";

describe("writer agent", () => {
  const run = {
    id: "run-writer-1",
    mode: "mocked" as const,
    status: "queued" as const,
    marketBias: "NEUTRAL" as const,
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

  it("creates a long-form article fallback from a compact intel report", async () => {
    const agent = createWriterAgent({ llmClient: null });
    const state = createInitialSwarmState({ run, config });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-writer-1",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        report: {
          topic: "AI infrastructure rotation",
          insight:
            "AI-linked infrastructure tokens kept absorbing mindshare while majors stayed range-bound.",
          importanceScore: 8,
          category: "narrative_shift",
          title: "AI Infrastructure Names Keep Absorbing Attention",
          summary:
            "Omen detected sustained attention rotation into AI-linked infrastructure tokens.",
          confidence: 84,
          symbols: ["TAO", "RNDR", "AKT"],
          imagePrompt: null,
        },
        evidence: [
          {
            category: "sentiment",
            summary: "Mindshare rose across AI infrastructure names.",
            sourceLabel: "Market Desk",
            sourceUrl: null,
            structuredData: {},
          },
        ],
      },
      state,
    );

    expect(result.article.headline).toContain("AI Infrastructure");
    expect(result.article.tldr).toContain("Omen detected");
    expect(result.article.content).toContain("### The Edge");
    expect(result.article.content).toContain("Mindshare rose");
  });

  it("keeps broad-market intel articles from repeating the preview summary", async () => {
    const agent = createWriterAgent({ llmClient: null });
    const state = createInitialSwarmState({ run, config });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-writer-market",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        report: {
          topic: "crypto market narratives",
          insight:
            "Markets BusinessInsider reported that Bitcoin price targets are moving higher while ETF flows keep macro risk on the desk. The useful read is a broad-market liquidity shift, not a token-specific trade.",
          importanceScore: 7,
          category: "market_update",
          title: "market market intel",
          summary:
            "Fresh market intelligence scan found a context worth tracking. Markets BusinessInsider reported that Bitcoin price targets are moving higher while ETF flows keep macro risk on the desk.",
          confidence: 62,
          symbols: [],
          imagePrompt: null,
        },
        evidence: [
          {
            category: "catalyst",
            summary:
              "Bitcoin price targets are moving higher while ETF flows keep macro risk active.",
            sourceLabel: "Markets Insider",
            sourceUrl: "https://markets.businessinsider.com/example",
            structuredData: {},
          },
        ],
      },
      state,
    );

    expect(result.article.headline).not.toMatch(/market market/i);
    expect(result.article.tldr.length).toBeLessThanOrEqual(320);
    expect(result.article.tldr).not.toMatch(/Fresh market intelligence scan/i);
    expect(result.article.content).toContain("### ON-CHAIN");
    expect(result.article.content).not.toContain(`\n${result.article.tldr}\n`);
    expect(result.article.content).not.toContain("### Executive Summary");
  });
});
