import { describe, expect, it } from "vitest";

import { createGeneratorAgent, createInitialSwarmState } from "../src/index.js";

describe("generator agent", () => {
  const run = {
    id: "run-generator-1",
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

  it("formats template-style intel assets", async () => {
    const agent = createGeneratorAgent({ llmClient: null });
    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-generator-1",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        report: {
          topic: "SUI TVL Surge",
          insight:
            "SUI TVL is accelerating while active wallets rise and liquidity rotates from ETH pools.",
          importanceScore: 8,
          category: "narrative_shift",
          title: "SUI TVL Surge",
          summary:
            "SUI TVL blasts higher as lending yields attract new liquidity. Active wallets are rising and ETH pool flows are rotating.",
          confidence: 80,
          symbols: ["SUI", "ETH"],
          imagePrompt: null,
        },
        evidence: [],
      },
      createInitialSwarmState({ run, config }),
    );

    expect(result.content.tweetText ?? "").toContain("sui tvl surge");
    expect(result.content.tweetText ?? "").toContain("- ");
    expect((result.content.tweetText ?? "").length).toBeLessThanOrEqual(280);
    expect(result.content.blogPost).toContain("## Executive Summary");
    expect(result.content.imagePrompt).toContain("$SUI");
  });
});
