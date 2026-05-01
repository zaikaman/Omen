import type { OpenAiCompatibleJsonClient } from "../src/llm/openai-compatible-client.js";
import { describe, expect, it } from "vitest";

import { createCriticAgent, createInitialSwarmState } from "../src/index.js";

describe("critic agent", () => {
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

  it("approves a thesis that clears the hard quality gates", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createCriticAgent({
      llmClient: {
        completeJson: async () => ({
          review: {
            candidateId: "candidate-btc-1",
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
          mode: "live",
          triggeredBy: "scheduler",
        },
        evaluation: {
          thesis: {
            candidateId: "candidate-btc-1",
            asset: "BTC",
            direction: "LONG",
            confidence: 90,
            orderType: "market",
            tradingStyle: "day_trade",
            expectedDuration: "8-16 hours",
            currentPrice: 65000,
            entryPrice: 65000,
            targetPrice: 71890,
            stopLoss: 62350,
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
          mode: "live",
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

  it("marks far executable entries as repairable instead of terminally rejecting them", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createCriticAgent({
      llmClient: {
        completeJson: async () => ({
          review: {
            candidateId: "candidate-pendle-1",
            decision: "rejected" as const,
            objections: ["Entry is too far below the live market for a day trade."],
            forcedOutcomeReason: "Execution math needs repair.",
            repairable: true,
            repairInstructions: ["Move the entry closer to current price or downgrade."],
          },
          blockingReasons: ["Entry is too far below current price."],
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
        evaluation: {
          thesis: {
            candidateId: "candidate-pendle-1",
            asset: "PENDLE",
            direction: "LONG",
            confidence: 92,
            orderType: "limit",
            tradingStyle: "day_trade",
            expectedDuration: "8-16 hours",
            currentPrice: 1.51,
            entryPrice: 1.28,
            targetPrice: 1.58,
            stopLoss: 1.23,
            riskReward: 6,
            whyNow: "Momentum is constructive but entry is far from current price.",
            confluences: ["Momentum", "Chart structure", "Narrative"],
            uncertaintyNotes: "Entry needs repair.",
            missingDataNotes: "No additional missing-data flags.",
          },
          evidence: [
            {
              category: "market",
              summary: "PENDLE is trading near 1.51.",
              sourceLabel: "Binance",
              sourceUrl: null,
              structuredData: { currentPrice: 1.51 },
            },
            {
              category: "technical",
              summary: "Price is near resistance after a momentum move.",
              sourceLabel: "Analyzer",
              sourceUrl: null,
              structuredData: {},
            },
          ],
        },
      },
      state,
    );

    expect(result.review.decision).toBe("rejected");
    expect(result.review.repairable).toBe(true);
    expect(result.review.repairInstructions.length).toBeGreaterThan(0);
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
          mode: "live",
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

  it("normalizes model watchlist decisions to rejected", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createCriticAgent({
      llmClient: {
        completeJson: async () => ({
          review: {
            candidateId: "candidate-pendle-1",
            decision: "watchlist_only" as const,
            objections: ["No executable entry near resistance."],
            forcedOutcomeReason: "No clean trade setup.",
            repairable: false,
            repairInstructions: [],
          },
          blockingReasons: ["No executable entry near resistance."],
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
        evaluation: {
          thesis: {
            candidateId: "candidate-pendle-1",
            asset: "PENDLE",
            direction: "NONE",
            confidence: 82,
            orderType: null,
            tradingStyle: null,
            expectedDuration: null,
            currentPrice: 1.52,
            entryPrice: null,
            targetPrice: null,
            stopLoss: null,
            riskReward: 0,
            whyNow: "PENDLE is interesting but not executable.",
            confluences: ["Momentum is strong", "Price is at resistance"],
            uncertaintyNotes: "No executable entry yet.",
            missingDataNotes: "No additional missing-data flags.",
          },
          evidence: [
            {
              category: "market",
              summary: "PENDLE is up strongly but near immediate resistance.",
              sourceLabel: "Binance",
              sourceUrl: null,
              structuredData: {},
            },
          ],
        },
      },
      state,
    );

    expect(result.review.decision).toBe("rejected");
  });

  it("keeps approved deterministic gates approved even when the model is too cautious", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createCriticAgent({
      llmClient: {
        completeJson: async () => ({
          review: {
            candidateId: "candidate-btc-1",
            decision: "rejected" as const,
            objections: ["Model is cautious about resistance nearby."],
            forcedOutcomeReason: "Resistance may slow follow-through.",
            repairable: false,
            repairInstructions: [],
          },
          blockingReasons: ["Resistance may slow follow-through."],
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
        evaluation: {
          thesis: {
            candidateId: "candidate-btc-1",
            asset: "BTC",
            direction: "LONG",
            confidence: 90,
            orderType: "market",
            tradingStyle: "day_trade",
            expectedDuration: "8-16 hours",
            currentPrice: 65000,
            entryPrice: 65000,
            targetPrice: 71890,
            stopLoss: 62350,
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
    expect(result.review.objections).toContain("Model is cautious about resistance nearby.");
    expect(result.blockingReasons).toEqual([]);
  });
});
