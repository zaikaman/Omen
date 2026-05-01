import { describe, expect, it } from "vitest";

import {
  buildOmenNodeInput,
  createInitialSwarmState,
  createOmenGraphFactory,
  resolveNextOmenNodeKey,
  type SwarmCheckpoint,
  type SwarmCheckpointStore,
} from "../src/index.js";

class InMemoryCheckpointStore implements SwarmCheckpointStore {
  private readonly checkpoints: SwarmCheckpoint[] = [];

  async save(checkpoint: SwarmCheckpoint) {
    this.checkpoints.push(checkpoint);
  }

  async loadLatest(input: { runId: string; threadId: string }) {
    return (
      [...this.checkpoints]
        .filter(
          (checkpoint) =>
            checkpoint.runId === input.runId && checkpoint.threadId === input.threadId,
        )
        .at(-1) ?? null
    );
  }

  async listByRun(runId: string) {
    return this.checkpoints.filter((checkpoint) => checkpoint.runId === runId);
  }
}

describe("omen graph factory", () => {
  const run = {
    id: "run-graph-1",
    mode: "live" as const,
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

  it("assembles the default node order with publisher as terminal", () => {
    const factory = createOmenGraphFactory();
    const graph = factory.createSwarmGraph();

    expect(graph.entryNodeKey).toBe("market-bias-agent");
    expect(graph.terminalNodeKeys).toEqual(["publisher-agent"]);
    expect(graph.nodes.map((node) => node.key)).toEqual([
      "market-bias-agent",
      "scanner-agent",
      "research-agent",
      "chart-vision-agent",
      "analyst-agent",
      "critic-agent",
      "intel-agent",
      "generator-agent",
      "writer-agent",
      "memory-agent",
      "publisher-agent",
    ]);
  });

  it("runs the graph and persists checkpoints through the publisher terminal step", async () => {
    const checkpointStore = new InMemoryCheckpointStore();
    const factory = createOmenGraphFactory();
    const runtime = factory.createRuntime({
      checkpointStore,
      runtimeName: "test-runtime",
      nodeInvoker: async ({ nodeKey, state }) => {
        if (nodeKey === "market-bias-agent") {
          return {
            marketBias: "LONG",
            reasoning: "Fixture market bias from model-backed path.",
            confidence: 88,
          };
        }

        if (nodeKey === "scanner-agent") {
          return {
            marketBias: "LONG",
            candidates: [
              {
                id: "candidate-btc-1",
                symbol: "BTC",
                reason: "Fixture scanner candidate.",
                directionHint: "LONG",
                status: "pending",
                sourceUniverse: "BTC,ETH,SOL",
                dedupeKey: "BTC",
                missingDataNotes: [],
              },
            ],
            rejectedSymbols: ["ETH", "SOL"],
          };
        }

        if (nodeKey === "research-agent") {
          const candidate = state.activeCandidates[0];

          if (!candidate) {
            return null;
          }

          return {
            candidate: {
              ...candidate,
              status: "researched",
            },
            evidence: [
              {
                category: "market",
                summary: "BTC fixture evidence stayed constructive.",
                sourceLabel: "Fixture Market",
                sourceUrl: null,
                structuredData: { symbol: "BTC" },
              },
            ],
            narrativeSummary: "BTC fixture research stayed constructive.",
            chartVisionSummary: null,
            missingDataNotes: [],
          };
        }

        if (nodeKey === "chart-vision-agent") {
          const candidate = state.activeCandidates[0];

          if (!candidate) {
            return null;
          }

          return {
            candidate,
            frames: [
              {
                timeframe: "1h",
                analysis: "Fixture chart structure remains constructive.",
                chartDescription: "Fixture chart image.",
                imageMimeType: "image/png",
                imageWidth: 1,
                imageHeight: 1,
              },
            ],
            chartSummary: "Fixture chart vision confirms the candidate.",
            evidence: [
              {
                category: "chart",
                summary: "Fixture chart evidence stayed constructive.",
                sourceLabel: "Fixture Chart",
                sourceUrl: null,
                structuredData: { timeframe: "1h" },
              },
            ],
            missingDataNotes: [],
          };
        }

        if (nodeKey === "analyst-agent") {
          const candidate = state.activeCandidates[0];

          if (!candidate) {
            return null;
          }

          return {
            thesis: {
              candidateId: candidate.id,
              asset: candidate.symbol,
              direction: candidate.directionHint === "LONG" ? "LONG" : "SHORT",
              confidence: 90,
              orderType: "limit",
              tradingStyle: "swing_trade",
              expectedDuration: "1-3 days",
              currentPrice: 100,
              entryPrice: 99,
              targetPrice: 112,
              stopLoss: 95,
              riskReward: 3,
              whyNow: "Test thesis clears the critic quality gate.",
              confluences: ["Momentum aligns", "Risk/reward clears threshold"],
              uncertaintyNotes: "Fixture-only thesis.",
              missingDataNotes: "No missing fixture data.",
            },
            analystNotes: ["fixture-analyst-output"],
          };
        }

        if (nodeKey === "critic-agent") {
          const thesis = state.thesisDrafts.at(-1);

          if (!thesis) {
            return null;
          }

          return {
            review: {
              candidateId: thesis.candidateId,
              decision: "approved",
              objections: [],
              forcedOutcomeReason: null,
            },
            blockingReasons: [],
          };
        }

        if (nodeKey === "intel-agent") {
          return {
            action: "ready",
            report: {
              topic: "Fixture BTC market intel",
              insight: "Fixture intel stayed constructive enough to publish.",
              importanceScore: 8,
              category: "market_update",
              title: "Fixture BTC Market Intel",
              summary: "Fixture BTC market intel remained publishable.",
              confidence: 80,
              symbols: ["BTC"],
              imagePrompt: null,
            },
            skipReason: null,
          };
        }

        if (nodeKey === "generator-agent") {
          return {
            content: {
              topic: "Fixture BTC market intel",
              tweetText: "fixture btc market intel\n\n- model-backed content remained publishable",
              blogPost: "# Fixture BTC Market Intel\n\n## Executive Summary\nFixture content.",
              imagePrompt: "Fixture visual prompt without text.",
              formattedContent:
                "fixture btc market intel\n\n- model-backed content remained publishable",
              logMessage: "INTEL LOCKED: fixture.",
            },
          };
        }

        if (nodeKey === "writer-agent") {
          return {
            article: {
              headline: "Fixture BTC Market Intel",
              tldr: "Fixture BTC market intel remained publishable.",
              content: "### ON-CHAIN\nFixture article body.\n\n### The Edge\nFixture article edge.",
            },
          };
        }

        if (nodeKey === "publisher-agent") {
          return {
            outcome: "approved",
            packet: {
              drafts: [
                {
                  kind: "signal_alert",
                  headline: "BTC fixture signal",
                  summary: "BTC fixture signal approved.",
                  text: "BTC fixture signal approved.",
                },
              ],
              approvedReview: state.criticReviews.at(-1) ?? null,
            },
            drafts: [
              {
                kind: "signal_alert",
                headline: "BTC fixture signal",
                summary: "BTC fixture signal approved.",
                text: "BTC fixture signal approved.",
              },
            ],
          };
        }

        return null;
      },
    });

    const finalState = await runtime.invoke({
      threadId: "thread-graph-1",
      initialState: createInitialSwarmState({ run, config }),
    });
    const checkpoints = await checkpointStore.listByRun(run.id);

    expect(finalState.run.status).toBe("completed");
    expect(finalState.run.currentCheckpointRefId).not.toBeNull();
    expect(finalState.run.outcome).not.toBeNull();
    expect(finalState.publisherDrafts.length).toBeGreaterThan(0);
    expect(checkpoints.map((checkpoint) => checkpoint.step)).toContain("memory-agent");
    expect(checkpoints.at(-1)?.step).toBe("publisher-agent");
  });

  it("skips scanner and routes directly to intel when market bias is not directional", () => {
    const baseState = createInitialSwarmState({ run, config });

    expect(
      resolveNextOmenNodeKey("market-bias-agent", {
        ...baseState,
        run: {
          ...baseState.run,
          marketBias: "NEUTRAL",
        },
      }),
    ).toBe("intel-agent");

    expect(
      resolveNextOmenNodeKey("market-bias-agent", {
        ...baseState,
        run: {
          ...baseState.run,
          marketBias: "UNKNOWN",
        },
      }),
    ).toBe("intel-agent");

    expect(
      resolveNextOmenNodeKey("market-bias-agent", {
        ...baseState,
        run: {
          ...baseState.run,
          marketBias: "LONG",
        },
      }),
    ).toBe("scanner-agent");
  });

  it("starts intel from a clean brief instead of rejected trade context", () => {
    const state = createInitialSwarmState({ run, config });
    const input = buildOmenNodeInput({
      nodeKey: "intel-agent",
      state: {
        ...state,
        activeCandidates: [
          {
            id: "candidate-etc-1",
            symbol: "ETC",
            reason: "Scanner watchlist candidate.",
            directionHint: "WATCHLIST",
            status: "researched",
            sourceUniverse: "ETC,ATOM,TRX",
            dedupeKey: "ETC",
            missingDataNotes: [],
          },
        ],
        evidenceItems: [
          {
            category: "market",
            summary: "ETC spot snapshot recorded 8.31.",
            sourceLabel: "Binance",
            sourceUrl: null,
            structuredData: { symbol: "ETC" },
          },
        ],
        chartVisionSummaries: ["ETC 1h chart shows trend is leaning downward."],
        thesisDrafts: [
          {
            candidateId: "candidate-etc-1",
            asset: "ETC",
            direction: "NONE",
            confidence: 62,
            orderType: null,
            tradingStyle: null,
            expectedDuration: null,
            currentPrice: null,
            entryPrice: null,
            targetPrice: null,
            stopLoss: null,
            riskReward: null,
            whyNow: "ETC did not form an executable trade setup.",
            confluences: ["Mixed structure"],
            uncertaintyNotes: "No trade.",
            missingDataNotes: "No additional missing-data flags.",
          },
        ],
        criticReviews: [
          {
            candidateId: "candidate-etc-1",
            decision: "rejected",
            objections: [],
            forcedOutcomeReason: "The thesis failed the minimum quality gate.",
          },
        ],
      },
      threadId: "thread-graph-1",
    });

    expect(input).toMatchObject({
      candidates: [],
      evidence: [],
      chartVisionSummary: null,
      thesis: null,
      review: null,
    });
  });
});
