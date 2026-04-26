import type { OpenAiCompatibleJsonClient } from "../src/llm/openai-compatible-client.js";
import { describe, expect, it } from "vitest";

import { createCriticAgent, createInitialSwarmState } from "../src/index.js";

describe("critic agent", () => {
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

  it("approves a thesis that clears the hard quality gates", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createCriticAgent();

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-1",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        evaluation: {
          thesis: {
            candidateId: "candidate-btc-1",
            asset: "BTC",
            direction: "LONG",
            confidence: 90,
            riskReward: 2.6,
            whyNow: "Momentum and market structure aligned.",
            confluences: ["Breakout held", "Funding stayed controlled"],
            uncertaintyNotes: "Macro risk remains.",
            missingDataNotes: "No additional missing-data flags.",
          },
          evidence: [
            {
              category: "market",
              summary: "BTC reclaimed local highs.",
              sourceLabel: "Binance",
              sourceUrl: null,
              structuredData: {},
            },
            {
              category: "technical",
              summary: "Structure stayed above resistance.",
              sourceLabel: "Indicators",
              sourceUrl: null,
              structuredData: {},
            },
          ],
        },
      },
      state,
    );

    expect(result.review.decision).toBe("approved");
    expect(result.blockingReasons).toEqual([]);
  });

  it("rejects a thesis that fails the hard quality gates", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createCriticAgent();

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-1",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        evaluation: {
          thesis: {
            candidateId: "candidate-sol-1",
            asset: "SOL",
            direction: "LONG",
            confidence: 61,
            riskReward: 1.2,
            whyNow: "Setup exists but remains weak.",
            confluences: ["One partial signal"],
            uncertaintyNotes: "Conviction is incomplete.",
            missingDataNotes: "Funding and liquidity inputs are missing.",
          },
          evidence: [
            {
              category: "market",
              summary: "SOL bounced modestly.",
              sourceLabel: "Binance",
              sourceUrl: null,
              structuredData: {},
            },
          ],
        },
      },
      state,
    );

    expect(["watchlist_only", "rejected"]).toContain(result.review.decision);
    expect((result.blockingReasons ?? []).length).toBeGreaterThan(0);
  });

  it("keeps the hard gate authoritative even when the model is too optimistic", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createCriticAgent({
      llmClient: {
        completeJson: async () => ({
          review: {
            candidateId: "candidate-sol-1",
            decision: "approved" as const,
            objections: [],
            forcedOutcomeReason: null,
          },
          blockingReasons: [],
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
        evaluation: {
          thesis: {
            candidateId: "candidate-sol-1",
            asset: "SOL",
            direction: "LONG",
            confidence: 61,
            riskReward: 1.2,
            whyNow: "Setup exists but remains weak.",
            confluences: ["One partial signal"],
            uncertaintyNotes: "Conviction is incomplete.",
            missingDataNotes: "Funding and liquidity inputs are missing.",
          },
          evidence: [
            {
              category: "market",
              summary: "SOL bounced modestly.",
              sourceLabel: "Binance",
              sourceUrl: null,
              structuredData: {},
            },
          ],
        },
      },
      state,
    );

    expect(["watchlist_only", "rejected"]).toContain(result.review.decision);
    expect((result.blockingReasons ?? []).length).toBeGreaterThan(0);
  });
});
