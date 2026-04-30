import { describe, expect, it } from "vitest";

import { createInitialSwarmState, createWriterAgent } from "../src/index.js";

const buildModelArticle = (input: {
  headline: string;
  tldr: string;
  content: string;
}) => ({
  article: {
    headline: input.headline,
    tldr: input.tldr,
    content: [
      input.content,
      "",
      "### Flow Read",
      "The live model keeps the article grounded in the supplied report and evidence. ".repeat(8),
      "",
      "### Risk",
      "The setup still needs confirmation from liquidity, positioning, and follow-through before it can become a trade. ".repeat(8),
    ].join("\n"),
  },
});

describe("writer agent", () => {
  const run = {
    id: "run-writer-1",
    mode: "live" as const,
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

  it("fails closed when the writer model is unavailable", async () => {
    const agent = createWriterAgent({ llmClient: null });
    const state = createInitialSwarmState({ run, config });

    await expect(
      agent.invoke(
        {
          context: {
            runId: run.id,
            threadId: "thread-writer-1",
            mode: "live",
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
      ),
    ).rejects.toThrow("Writer article generation requires a configured LLM client.");
  });

  it("keeps broad-market intel articles from repeating the preview summary", async () => {
    const agent = createWriterAgent({
      llmClient: {
        completeJson: async () =>
          buildModelArticle({
            headline: "Crypto Market Narratives",
            tldr:
              "Bitcoin price targets are moving higher while ETF flows keep macro risk on the desk.",
            content:
              "### ON-CHAIN\nBitcoin price targets are moving higher while ETF flows keep macro risk active. ".repeat(
                8,
              ),
          }),
      } as never,
    });
    const state = createInitialSwarmState({ run, config });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-writer-market",
          mode: "live",
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

  it("does not promote generator blog scaffolding as the final article fallback", async () => {
    const agent = createWriterAgent({
      llmClient: {
        completeJson: async () =>
          buildModelArticle({
            headline: "Bitcoin Pressure and Institutional Signals",
            tldr:
              "Bitcoin weakness is colliding with constructive regulatory and stablecoin adoption signals.",
            content:
              "### ON-CHAIN\nBitcoin has broken below key support while institutional adoption headlines keep the longer-term setup alive.\n\n### The Edge\nThe model article is built from the current intel report rather than generator scaffolding. ".repeat(
                6,
              ),
          }),
      } as never,
    });
    const state = createInitialSwarmState({ run, config });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-writer-generator-blog",
          mode: "live",
          triggeredBy: "scheduler",
        },
        report: {
          topic: "Bitcoin pressure",
          insight:
            "Bitcoin has broken below $76,000 while institutional adoption headlines keep the longer-term setup alive.",
          importanceScore: 7,
          category: "market_update",
          title: "Bitcoin Pressure and Institutional Signals",
          summary:
            "Bitcoin weakness is colliding with constructive regulatory and stablecoin adoption signals.",
          confidence: 70,
          symbols: [],
          imagePrompt: null,
        },
        evidence: [],
        generatedContent: {
          topic: "Bitcoin Pressure and Institutional Signals",
          tweetText: "bitcoin pressure is rising\n\n- btc broke below $76k",
          blogPost:
            "# Bitcoin Pressure and Institutional Signals\n\n## Executive Summary\nGeneric recap.\n\n## Market Impact\nThis is market intelligence, not an automatic trade instruction.\n\n## Verdict\ncrypto stays on watch while the narrative remains active.",
          imagePrompt: "Cyberpunk BTC cover art.",
          formattedContent: "bitcoin pressure is rising",
          logMessage: "INTEL LOCKED: BTC pressure.",
        },
      },
      state,
    );

    expect(result.article.content).toContain("### ON-CHAIN");
    expect(result.article.content).toContain("### The Edge");
    expect(result.article.content).not.toContain("## Executive Summary");
    expect(result.article.content).not.toContain(
      "This is market intelligence, not an automatic trade instruction.",
    );
    expect(result.article.content).not.toContain(
      "crypto stays on watch while the narrative remains active.",
    );
  });
});
