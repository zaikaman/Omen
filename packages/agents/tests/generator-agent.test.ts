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
    expect((result.content.tweetText ?? "").length).toBeLessThanOrEqual(270);
    expect(result.content.blogPost).toContain("## Executive Summary");
    expect(result.content.imagePrompt).toContain("directly tied to this intel thesis");
    expect(result.content.imagePrompt).toContain("lending yields attract new liquidity");
    expect(result.content.imagePrompt).toContain("narrative shift");
    expect(result.content.imagePrompt).toContain("strictly no text");
    expect(result.content.imagePrompt).toContain("no ticker symbols");
    expect(result.content.imagePrompt).not.toContain("$SUI");
  });

  it("falls back when model tweet output is generic headline spam", async () => {
    const agent = createGeneratorAgent({
      llmClient: {
        completeJson: async () => ({
          topic: "SUI TVL Surge",
          tweetText:
            "crypto news: pepeto announces investment growth while the bitcoin price prediction bulls targets $150,000",
          blogPost: "# SUI TVL Surge\n\n## Executive Summary\nSUI is rotating.",
          imagePrompt: "Cyberpunk SUI liquidity rotation cover art.",
          formattedContent:
            "crypto news: pepeto announces investment growth while the bitcoin price prediction bulls targets $150,000",
          logMessage: "INTEL LOCKED: SUI rotation.",
        }),
      } as never,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-generator-low-signal",
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

    expect(result.content.tweetText).toContain("- ");
    expect(result.content.tweetText).toContain("$SUI");
    expect(result.content.tweetText).not.toMatch(/pepeto|price prediction/i);
  });

  it("falls back when model tweet output is cut off mid-thought", async () => {
    const agent = createGeneratorAgent({
      llmClient: {
        completeJson: async () => ({
          topic: "Bitcoin Pressure",
          tweetText:
            "bitcoin pressure and institutional signals\n\n- bitcoin has broken below $76,000 amid broader underperformance narratives, with high-signal chatter highlighting eth's 5-year lag versus nvda and cautious positioning from traders like pentosh1 awaiting",
          blogPost: "# Bitcoin Pressure\n\n## Executive Summary\nBTC is weak.",
          imagePrompt: "Cyberpunk BTC pressure cover art.",
          formattedContent:
            "bitcoin pressure and institutional signals\n\n- bitcoin has broken below $76,000 amid broader underperformance narratives, with high-signal chatter highlighting eth's 5-year lag versus nvda and cautious positioning from traders like pentosh1 awaiting",
          logMessage: "INTEL LOCKED: BTC pressure.",
        }),
      } as never,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-generator-truncated",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        report: {
          topic: "Bitcoin Pressure",
          insight:
            "Bitcoin has broken below $76,000 while high-signal accounts frame the move as a patience trade. Institutional optimism remains in the background through stablecoin and regulatory headlines.",
          importanceScore: 7,
          category: "market_update",
          title: "Bitcoin Pressure and Institutional Signals",
          summary:
            "Bitcoin has broken below $76,000 while traders wait for higher-timeframe reclaim levels. Regulatory and stablecoin adoption headlines are still constructive.",
          confidence: 70,
          symbols: ["BTC", "ETH"],
          imagePrompt: null,
        },
        evidence: [],
      },
      createInitialSwarmState({ run, config }),
    );

    expect(result.content.tweetText).toContain("- ");
    expect(result.content.tweetText).not.toMatch(/\bawaiting$/i);
    expect((result.content.tweetText ?? "").length).toBeLessThanOrEqual(270);
  });

  it("asks the model to retry when generated tweet text is over 270 characters", async () => {
    const calls: string[] = [];
    const tooLongTweet = [
      "l2 launchpad momentum: fluent blend + pump.fun pump surge",
      "",
      "- fresh ethereum l2 mainnet activation for fluent with $50m day-one liquidity and expanding ecosystem incentives that keep stretching this line",
      "- concurrently, $PUMP maintains heavy birdeye trending and volume as the market rotates into launchpad narratives",
      "",
      "watch $BLEND $PUMP $BTC if confirmation follows",
    ].join("\n");
    const validTweet = [
      "l2 launchpad momentum: fluent blend + pump.fun surge",
      "",
      "- fluent launches ethereum l2 mainnet with $50m day-one liquidity",
      "- $PUMP keeps birdeye trend + launchpad volume while majors range",
      "",
      "watch $BLEND $PUMP $BTC if confirmation follows",
    ].join("\n");
    const agent = createGeneratorAgent({
      llmClient: {
        completeJson: async (input: { userPrompt: string }) => {
          calls.push(input.userPrompt);

          return {
            topic: "L2 Launchpad Momentum",
            tweetText: calls.length === 1 ? tooLongTweet : validTweet,
            blogPost: "# L2 Launchpad Momentum\n\n## Executive Summary\nLaunchpads are rotating.",
            imagePrompt: "Cyberpunk launchpad liquidity cover art.",
            formattedContent: "l2 launchpad momentum",
            logMessage: "INTEL LOCKED: launchpads.",
          };
        },
      } as never,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-generator-retry-too-long",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        report: {
          topic: "L2 Launchpad Momentum",
          insight:
            "Fluent launched its Ethereum L2 mainnet with reported day-one liquidity while PUMP stayed high in launchpad attention.",
          importanceScore: 8,
          category: "narrative_shift",
          title: "L2 Launchpad Momentum",
          summary:
            "Fluent launched its Ethereum L2 mainnet with reported day-one liquidity. PUMP stayed high in launchpad attention while majors ranged.",
          confidence: 80,
          symbols: ["BLEND", "PUMP", "BTC"],
          imagePrompt: null,
        },
        evidence: [],
      },
      createInitialSwarmState({ run, config }),
    );

    expect(tooLongTweet.length).toBeGreaterThan(270);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toContain("Previous tweet failed validation");
    expect(result.content.tweetText).toBe(validTweet);
    expect(result.content.tweetText ?? "").toHaveLength(validTweet.length);
    expect((result.content.tweetText ?? "").length).toBeLessThanOrEqual(270);
  });

  it("falls back when model tweet repeats the same bullet", async () => {
    const agent = createGeneratorAgent({
      llmClient: {
        completeJson: async () => ({
          topic: "Bitcoin Policy Bid",
          tweetText:
            "bitcoin testing support\n\n- btc slipped under $76k while policy tailwinds build\n- btc slipped under $76k while policy tailwinds build",
          blogPost: "# Bitcoin Policy Bid\n\n## Executive Summary\nBTC is mixed.",
          imagePrompt: "Cyberpunk Bitcoin policy cover art.",
          formattedContent:
            "bitcoin testing support\n\n- btc slipped under $76k while policy tailwinds build\n- btc slipped under $76k while policy tailwinds build",
          logMessage: "INTEL LOCKED: BTC policy bid.",
        }),
      } as never,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-generator-repeated",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        report: {
          topic: "Bitcoin Policy Bid",
          insight:
            "Policy tailwinds are building while Bitcoin tests key support, creating a tension between short-term weakness and institutional demand.",
          importanceScore: 8,
          category: "macro",
          title: "Bitcoin Policy Bid",
          summary:
            "Policy tailwinds are building while Bitcoin tests key support. Institutional demand can absorb weakness if liquidity follows.",
          confidence: 80,
          symbols: ["BTC"],
          imagePrompt: null,
        },
        evidence: [],
      },
      createInitialSwarmState({ run, config }),
    );

    expect(result.content.tweetText).toContain("- ");
    expect(result.content.tweetText).not.toMatch(/btc slipped under \$76k.*btc slipped under \$76k/is);
  });

  it("falls back when model tweet has no closing take", async () => {
    const agent = createGeneratorAgent({
      llmClient: {
        completeJson: async () => ({
          topic: "Pharos Coinbase Catalyst",
          tweetText:
            "pharos $PROS coinbase listing catalyst\n\n- pharos network is trending after a coinbase spot listing",
          blogPost: "# Pharos Coinbase Catalyst\n\n## Executive Summary\nPROS is rotating.",
          imagePrompt: "Cyberpunk Pharos listing cover art.",
          formattedContent:
            "pharos $PROS coinbase listing catalyst\n\n- pharos network is trending after a coinbase spot listing",
          logMessage: "INTEL LOCKED: PROS listing.",
        }),
      } as never,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-generator-no-closing-take",
          mode: "mocked",
          triggeredBy: "scheduler",
        },
        report: {
          topic: "Pharos Coinbase Catalyst",
          insight:
            "Pharos gained liquidity attention after Coinbase opened spot trading while majors stayed range-bound.",
          importanceScore: 7,
          category: "narrative_shift",
          title: "Pharos Coinbase Catalyst",
          summary:
            "Pharos gained liquidity attention after Coinbase opened spot trading. The setup is useful only if attention and volume persist.",
          confidence: 70,
          symbols: ["PROS"],
          imagePrompt: null,
        },
        evidence: [],
      },
      createInitialSwarmState({ run, config }),
    );

    expect(result.content.tweetText ?? "").toContain("watch $PROS");
    expect(
      (result.content.tweetText ?? "").split("\n").filter((line) => line.startsWith("- ")).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("wraps model image prompts with the intel thesis and no-text constraints", async () => {
    const agent = createGeneratorAgent({
      llmClient: {
        completeJson: async () => ({
          topic: "SUI TVL Surge",
          tweetText:
            "sui tvl keeps pressing higher\n\n- lending yields pulled in new liquidity\n- wallets kept expanding\n\nwatch confirmation before chasing",
          blogPost: "# SUI TVL Surge\n\n## Executive Summary\nSUI is rotating.",
          imagePrompt: "Big glowing $SUI logo with the words SUI TVL Surge on a trading screen.",
          formattedContent: "sui tvl keeps pressing higher",
          logMessage: "INTEL LOCKED: SUI rotation.",
        }),
      } as never,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-generator-image-prompt",
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

    expect(result.content.imagePrompt).toContain("directly tied to this intel thesis");
    expect(result.content.imagePrompt).toContain("lending yields attract new liquidity");
    expect(result.content.imagePrompt).toContain("strictly no text");
    expect(result.content.imagePrompt).toContain("no logos");
    expect(result.content.imagePrompt).toContain("no ticker symbols");
    expect(result.content.imagePrompt).not.toContain("$SUI");
    expect(result.content.imagePrompt).not.toMatch(/with the words/i);
  });
});
