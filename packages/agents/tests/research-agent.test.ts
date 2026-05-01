import type { OpenAiCompatibleJsonClient } from "../src/llm/openai-compatible-client.js";
import { describe, expect, it } from "vitest";

import { createInitialSwarmState, createResearchAgent } from "../src/index.js";

describe("research agent", () => {
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

  it("builds a normalized research bundle with researched candidate state", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createResearchAgent({
      llmClient: {
        completeJson: async () => ({
          evidence: [
            {
              category: "sentiment" as const,
              summary: "BTC showed constructive live narrative momentum.",
              sourceLabel: "Model search",
              sourceUrl: null,
              structuredData: { symbol: "BTC" },
            },
          ],
          narrativeSummary: "BTC showed constructive live narrative momentum.",
          missingDataNotes: [],
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
        candidate: {
          id: "candidate-btc-1",
          symbol: "BTC",
          reason: "Momentum and narrative alignment",
          directionHint: "LONG",
          status: "pending",
          sourceUniverse: "BTC,ETH,SOL",
          dedupeKey: "BTC",
          missingDataNotes: [],
        },
      },
      state,
    );

    expect(result.candidate.status).toBe("researched");
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.narrativeSummary.length).toBeGreaterThan(0);
    expect(
      result.evidence.some((item) =>
        ["market", "fundamental", "sentiment", "catalyst"].includes(item.category),
      ),
    ).toBe(true);
  });

  it("does not call market-data or protocol providers from the research node", async () => {
    const state = createInitialSwarmState({ run, config });
    let marketLookups = 0;
    let protocolLookups = 0;
    const agent = createResearchAgent({
      marketData: {
        getSnapshot: async () => {
          marketLookups += 1;
          throw new Error("market lookup should not be called from research");
        },
      },
      protocolData: {
        getProtocolSnapshot: async () => {
          protocolLookups += 1;
          throw new Error("protocol lookup should not be called from research");
        },
      },
      llmClient: {
        completeJson: async ({ userPrompt }: { userPrompt: string }) => {
          const parsed = JSON.parse(userPrompt) as Record<string, unknown>;

          expect(parsed).toHaveProperty("candidate");
          expect(parsed).toHaveProperty("injectedEvidence");
          expect(parsed).not.toHaveProperty("snapshot");
          expect(parsed).not.toHaveProperty("protocolSnapshot");

          return {
            evidence: [
              {
                category: "sentiment" as const,
                summary: "BTC search context stayed constructive without local provider calls.",
                sourceLabel: "Model search",
                sourceUrl: null,
                structuredData: { symbol: "BTC" },
              },
            ],
            narrativeSummary: "BTC remained usable without local market or protocol calls.",
            missingDataNotes: [],
          };
        },
      } as unknown as OpenAiCompatibleJsonClient,
    } as unknown as Parameters<typeof createResearchAgent>[0]);

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-1",
          mode: "live",
          triggeredBy: "scheduler",
        },
        candidate: {
          id: "candidate-btc-1",
          symbol: "BTC",
          reason: "Momentum and narrative alignment",
          directionHint: "LONG",
          status: "pending",
          sourceUniverse: "BTC,ETH,SOL",
          dedupeKey: "BTC",
          missingDataNotes: [],
        },
      },
      state,
    );

    expect(result.candidate.status).toBe("researched");
    expect(marketLookups).toBe(0);
    expect(protocolLookups).toBe(0);
    expect(
      (result.missingDataNotes ?? []).some((note) => note.startsWith("Protocol snapshot missing:")),
    ).toBe(false);
  });

  it("passes injected evidence into the research prompt", async () => {
    const state = createInitialSwarmState({ run, config });
    state.evidenceItems.push({
      category: "market",
      summary: "AAVE was already flagged upstream by scanner evidence.",
      sourceLabel: "scanner-agent",
      sourceUrl: null,
      structuredData: { symbol: "AAVE" },
    });

    const agent = createResearchAgent({
      llmClient: {
        completeJson: async ({ userPrompt }: { userPrompt: string }) => {
          const parsed = JSON.parse(userPrompt) as Record<string, unknown> & {
            injectedEvidence: unknown[];
            missingDataNotes: string[];
          };

          expect(parsed.injectedEvidence).toHaveLength(1);

          return {
            evidence: [
              {
                category: "catalyst" as const,
                summary: "AAVE research used injected scanner and chart context only.",
                sourceLabel: "Injected context",
                sourceUrl: null,
                structuredData: { symbol: "AAVE" },
              },
            ],
            narrativeSummary: "AAVE research stayed based on injected context and model search.",
            missingDataNotes: parsed.missingDataNotes,
          };
        },
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
        candidate: {
          id: "candidate-aave-1",
          symbol: "AAVE",
          reason: "Momentum and DeFi narrative alignment",
          directionHint: "LONG",
          status: "pending",
          sourceUniverse: "AAVE,UNI,LDO",
          dedupeKey: "AAVE",
          missingDataNotes: ["Upstream scanner did not include fresh news."],
        },
      },
      state,
    );

    expect(result.candidate.status).toBe("researched");
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.missingDataNotes).toContain("Upstream scanner did not include fresh news.");
  });

  it("uses the model-backed synthesis path when a client is provided", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createResearchAgent({
      llmClient: {
        completeJson: async () => ({
          evidence: [
            {
              category: "sentiment" as const,
              summary: "ETF-flow headlines kept the tone constructive rather than euphoric.",
              sourceLabel: "News",
              sourceUrl: "https://example.com/etf-flows",
              structuredData: {
                symbol: "BTC",
              },
            },
          ],
          narrativeSummary:
            "BTC remained market-led, with spot strength confirmed by steady bullish flow headlines.",
          missingDataNotes: [],
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
        candidate: {
          id: "candidate-btc-1",
          symbol: "BTC",
          reason: "Momentum and narrative alignment",
          directionHint: "LONG",
          status: "pending",
          sourceUniverse: "BTC,ETH,SOL",
          dedupeKey: "BTC",
          missingDataNotes: [],
        },
      },
      state,
    );

    expect(result.candidate.status).toBe("researched");
    expect(result.narrativeSummary).toContain("spot strength confirmed");
    expect(result.evidence[0]?.structuredData).not.toHaveProperty("prompt");
    expect(result.evidence.some((item) => item.summary.includes("ETF-flow headlines"))).toBe(true);
  });

  it("filters model-sourced executable market data out of research evidence", async () => {
    const state = createInitialSwarmState({ run, config });
    const agent = createResearchAgent({
      llmClient: {
        completeJson: async () => ({
          evidence: [
            {
              category: "market" as const,
              summary: "PENDLE is trading near $3.85 according to an unverified web result.",
              sourceLabel: "CoinGecko",
              sourceUrl: null,
              structuredData: {
                symbol: "PENDLE",
                price: 3.85,
                currentPrice: 3.85,
              },
            },
            {
              category: "sentiment" as const,
              summary: "Traders are discussing PENDLE strength without requiring execution data.",
              sourceLabel: "X",
              sourceUrl: null,
              structuredData: {
                symbol: "PENDLE",
              },
            },
          ],
          narrativeSummary: "PENDLE sentiment stayed constructive.",
          missingDataNotes: [],
        }),
      } as unknown as OpenAiCompatibleJsonClient,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-filter-market-evidence",
          mode: "live",
          triggeredBy: "scheduler",
        },
        candidate: {
          id: "candidate-pendle-1",
          symbol: "PENDLE",
          reason: "Testing model market evidence filtering.",
          directionHint: "LONG",
          status: "pending",
          sourceUniverse: "PENDLE",
          dedupeKey: "PENDLE",
          missingDataNotes: [],
        },
      },
      state,
    );

    expect(result.evidence).toHaveLength(1);
    expect(result.evidence[0]?.category).toBe("sentiment");
    expect(result.evidence[0]?.structuredData).not.toHaveProperty("price");
    expect(result.missingDataNotes.join(" ")).toContain("discarded 1 model-sourced");
  });
});
