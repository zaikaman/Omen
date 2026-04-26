import type { OpenAiCompatibleJsonClient } from "../src/llm/openai-compatible-client.js";
import { describe, expect, it } from "vitest";

import { createInitialSwarmState, createPublisherAgent } from "../src/index.js";

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

describe("publisher agent", () => {
  const state = createInitialSwarmState({ run, config });
  const agent = createPublisherAgent();

  it("builds a publishable packet for approved signals", async () => {
    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-1",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        thesis: {
          candidateId: "candidate-1",
          asset: "BTC",
          direction: "LONG",
          confidence: 88,
          riskReward: 2.6,
          whyNow: "BTC reclaimed local resistance and volume expanded.",
          confluences: ["Breakout reclaim", "Momentum expansion"],
          uncertaintyNotes: "Follow-through still needs confirmation.",
          missingDataNotes: "No additional missing-data flags.",
        },
        review: {
          candidateId: "candidate-1",
          decision: "approved",
          objections: [],
          forcedOutcomeReason: null,
        },
        intelSummary: null,
      },
      state,
    );

    expect(result.outcome).toBe("approved");
    expect(result.packet?.drafts).toHaveLength(1);
    expect(result.packet?.drafts[0]?.kind).toBe("signal_alert");
    expect(result.packet?.approvedReview?.decision).toBe("approved");
  });

  it("builds intel summary and thread drafts for intel-ready runs", async () => {
    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-2",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        thesis: null,
        review: null,
        intelSummary: {
          title: "ETH market update",
          summary: "ETH flows improved while majors remained range-bound.",
          confidence: 74,
        },
      },
      state,
    );

    expect(result.outcome).toBe("intel_ready");
    expect(result.packet?.drafts.map((draft) => draft.kind)).toEqual([
      "intel_summary",
      "intel_thread",
    ]);
  });

  it("keeps rejected outcomes off the publishing packet", async () => {
    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-3",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        thesis: {
          candidateId: "candidate-2",
          asset: "SOL",
          direction: "WATCHLIST",
          confidence: 59,
          riskReward: null,
          whyNow: "Momentum improved but confirmation is incomplete.",
          confluences: ["Improving breadth"],
          uncertaintyNotes: "Setup is still early.",
          missingDataNotes: "Funding confirmation is missing.",
        },
        review: {
          candidateId: "candidate-2",
          decision: "rejected",
          objections: ["Confidence is below threshold"],
          forcedOutcomeReason: null,
        },
        intelSummary: null,
      },
      state,
    );

    expect(result.outcome).toBe("rejected");
    expect(result.packet).toBeNull();
    expect((result.drafts ?? [])[0]?.kind).toBe("no_conviction");
  });

  it("uses the model-backed rewrite path when a client is provided", async () => {
    const agent = createPublisherAgent({
      llmClient: {
        completeJson: async () => ({
          drafts: [
            {
              kind: "signal_alert" as const,
              headline: "BTC long signal clears the board",
              summary: "BTC kept the strongest directional setup with approved publication status.",
              text: "BTC long signal\nConfidence: 88%\nRR 2.60\nWhy now: Momentum and structure stayed aligned.\nConfluences: Breakout reclaim; Momentum expansion",
            },
          ],
        }),
      } as unknown as OpenAiCompatibleJsonClient,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-4",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        thesis: {
          candidateId: "candidate-1",
          asset: "BTC",
          direction: "LONG",
          confidence: 88,
          riskReward: 2.6,
          whyNow: "BTC reclaimed local resistance and volume expanded.",
          confluences: ["Breakout reclaim", "Momentum expansion"],
          uncertaintyNotes: "Follow-through still needs confirmation.",
          missingDataNotes: "No additional missing-data flags.",
        },
        review: {
          candidateId: "candidate-1",
          decision: "approved",
          objections: [],
          forcedOutcomeReason: null,
        },
        intelSummary: null,
      },
      state,
    );

    expect(result.outcome).toBe("approved");
    expect(result.packet?.drafts[0]?.kind).toBe("signal_alert");
    expect(result.packet?.drafts[0]?.headline).toBe("BTC long signal clears the board");
    expect(result.packet?.approvedReview?.decision).toBe("approved");
  });
});
