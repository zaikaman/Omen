import { describe, expect, it } from "vitest";

import { createGeneratorAgent, createInitialSwarmState } from "../src/index.js";

describe("generator agent", () => {
  const run = {
    id: "run-generator-1",
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

  it("fails closed when the generator model is unavailable", async () => {
    const agent = createGeneratorAgent({ llmClient: null });

    await expect(
      agent.invoke(
        {
          context: {
            runId: run.id,
            threadId: "thread-generator-1",
            mode: "live",
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
      ),
    ).rejects.toThrow("Generator content requires a configured LLM client.");
  });

  it("preserves model tweet output without quality fallback", async () => {
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
          mode: "live",
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

    expect(result.content.tweetText).toBe(
      "crypto news: pepeto announces investment growth while the bitcoin price prediction bulls targets $150,000",
    );
  });

  it("rejects blank formatted content from the model", async () => {
    const tweetText =
      "sui tvl keeps pressing higher\n\n- lending yields pulled in new liquidity\n- wallets kept expanding\n\nwatch confirmation before chasing";
    const agent = createGeneratorAgent({
      llmClient: {
        completeJson: async () => ({
          topic: "SUI TVL Surge",
          tweetText,
          blogPost: "# SUI TVL Surge\n\n## Executive Summary\nSUI is rotating.",
          imagePrompt: "Cyberpunk SUI liquidity rotation cover art.",
          formattedContent: "",
          logMessage: "INTEL LOCKED: SUI rotation.",
        }),
      } as never,
    });

    await expect(
      agent.invoke(
        {
          context: {
            runId: run.id,
            threadId: "thread-generator-blank-formatted-content",
            mode: "live",
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
      ),
    ).rejects.toThrow("Generator LLM response did not include formattedContent.");
  });

  it("rejects object-shaped formatted content from the model", async () => {
    const tweetText =
      "sui tvl keeps pressing higher\n\n- lending yields pulled in new liquidity\n- wallets kept expanding\n\nwatch confirmation before chasing";
    const agent = createGeneratorAgent({
      llmClient: {
        completeJson: async () => ({
          topic: "SUI TVL Surge",
          tweetText,
          blogPost: "# SUI TVL Surge\n\n## Executive Summary\nSUI is rotating.",
          imagePrompt: "Cyberpunk SUI liquidity rotation cover art.",
          formattedContent: {
            tweet: tweetText,
          },
          logMessage: "INTEL LOCKED: SUI rotation.",
        }),
      } as never,
    });

    await expect(
      agent.invoke(
        {
          context: {
            runId: run.id,
            threadId: "thread-generator-object-formatted-content",
            mode: "live",
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
      ),
    ).rejects.toThrow("Generator LLM response did not include formattedContent.");
  });

  it("preserves model tweet output without truncation checks", async () => {
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
          mode: "live",
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

    expect(result.content.tweetText).toMatch(/\bawaiting$/i);
  });

  it("uses the shortener agent when the first generator tweet is too long", async () => {
    const generatorCalls: string[] = [];
    const shortenerCalls: string[] = [];
    const tooLongTweet = [
      "bitcoin pressure and institutional signals are becoming a longer form macro note",
      "",
      "- bitcoin has broken below $76,000 amid broader underperformance narratives, with high-signal chatter highlighting eth's 5-year lag versus nvda and cautious positioning from traders like pentosh1 awaiting clearer confirmation",
      "- regulatory and stablecoin headlines remain constructive but not enough to offset risk-off liquidity yet",
      "",
      "watch $BTC $ETH if macro liquidity confirms after the fed",
    ].join("\n");
    const stillTooLongTweet =
      "bitcoin pressure builds into fed week with a long desk note that still needs another compression pass because it keeps too much macro framing and policy context for a public X post\n\n- btc holds below 76k as risk appetite thins and traders wait for confirmation\n- policy tailwinds need liquidity confirmation before the market can treat them as a durable catalyst\n\nwatch $BTC $ETH if macro flows turn";
    const shortenedTweet =
      "bitcoin pressure builds into fed week\n\n- btc holds below 76k as risk appetite thins\n- policy tailwinds need liquidity confirmation\n\nwatch $BTC $ETH if macro flows turn";
    const agent = createGeneratorAgent({
      llmClient: {
        completeJson: async (input: { userPrompt: string }) => {
          generatorCalls.push(input.userPrompt);

          return {
            topic: "Bitcoin Pressure",
            tweetText: tooLongTweet,
            blogPost: "# Bitcoin Pressure\n\n## Executive Summary\nBTC is weak.",
            imagePrompt: "Cyberpunk BTC pressure cover art.",
            formattedContent: tooLongTweet,
            logMessage: "INTEL LOCKED: BTC pressure.",
          };
        },
      } as never,
      shortenerClient: {
        completeJson: async (input: { userPrompt: string }) => {
          shortenerCalls.push(input.userPrompt);

          return {
            shortenedText: shortenerCalls.length < 3 ? stillTooLongTweet : shortenedTweet,
          };
        },
      } as never,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-generator-retry-too-long",
          mode: "live",
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

    expect(tooLongTweet.length).toBeGreaterThanOrEqual(280);
    expect(stillTooLongTweet.length).toBeGreaterThan(270);
    expect(generatorCalls).toHaveLength(1);
    expect(shortenerCalls).toHaveLength(3);
    expect(shortenerCalls[0]).toContain("Shorten this over-length INTEL tweet.");
    expect(shortenerCalls[1]).toContain("still too long for X");
    expect(result.content.tweetText).toBe(shortenedTweet);
    expect(result.content.formattedContent).toBe(shortenedTweet);
    expect(result.content.tweetText ?? "").toHaveLength(shortenedTweet.length);
    expect(shortenedTweet.length).toBeLessThanOrEqual(270);
  });

  it("preserves model tweet output with broken parentheticals instead of retrying", async () => {
    const calls: string[] = [];
    const brokenTweet = [
      "interoperability and launchpad momentum in thin liquidity",
      "",
      "- blend (fluent) surges into trending lists on coingecko and birdeye following its mainnet launch, tge.",
      "- concurrently, pump (pump.",
      "",
      "watch $MON $HYPE $BTC $ETH if confirmation follows",
    ].join("\n");
    const agent = createGeneratorAgent({
      llmClient: {
        completeJson: async (input: { userPrompt: string }) => {
          calls.push(input.userPrompt);

          return {
            topic: "Launchpad Momentum",
            tweetText: brokenTweet,
            blogPost: "# Launchpad Momentum\n\n## Executive Summary\nLaunchpad flows are rotating.",
            imagePrompt: "Cyberpunk launchpad liquidity cover art.",
            formattedContent: "launchpad momentum",
            logMessage: "INTEL LOCKED: launchpads.",
          };
        },
      } as never,
    });

    const result = await agent.invoke(
      {
        context: {
          runId: run.id,
          threadId: "thread-generator-retry-broken-parenthetical",
          mode: "live",
          triggeredBy: "scheduler",
        },
        report: {
          topic: "Launchpad Momentum",
          insight:
            "Blend is trending after Fluent mainnet and TGE attention while PUMP keeps launchpad liquidity in focus.",
          importanceScore: 8,
          category: "narrative_shift",
          title: "Launchpad Momentum",
          summary:
            "Blend is trending after Fluent mainnet and TGE attention. PUMP keeps launchpad liquidity in focus while majors range.",
          confidence: 80,
          symbols: ["MON", "HYPE", "BTC", "ETH"],
          imagePrompt: null,
        },
        evidence: [],
      },
      createInitialSwarmState({ run, config }),
    );

    expect(calls).toHaveLength(1);
    expect(result.content.tweetText).toBe(brokenTweet);
  });

  it("preserves repeated model tweet lines", async () => {
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
          mode: "live",
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

    expect(result.content.tweetText).toBe(
      "bitcoin testing support\n\n- btc slipped under $76k while policy tailwinds build\n- btc slipped under $76k while policy tailwinds build",
    );
  });

  it("preserves model tweet output without a closing take", async () => {
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
          mode: "live",
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

    expect(result.content.tweetText).toBe(
      "pharos $PROS coinbase listing catalyst\n\n- pharos network is trending after a coinbase spot listing",
    );
  });

  it("wraps model image prompts with the intel thesis and no-text constraints", async () => {
    const agent = createGeneratorAgent({
      llmClient: {
        completeJson: async () => ({
          topic: "SUI TVL Surge",
          tweetText:
            "sui tvl keeps pressing higher\n\n- lending yields pulled in new liquidity\n- wallets kept expanding\n\nwatch confirmation before chasing",
          blogPost: "# SUI TVL Surge\n\n## Executive Summary\nSUI is rotating.",
          imagePrompt:
            "Big glowing $SUI logo with the words SUI TVL Surge on a trading screen, dashboard UI, chart axes, and poster typography.",
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
          mode: "live",
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

    expect(result.content.imagePrompt).toContain("PREMIUM COVER IMAGE");
    expect(result.content.imagePrompt).toContain("Financial Times, Bloomberg Markets");
    expect(result.content.imagePrompt).toContain("make it look like a $10,000 stock photo");
    expect(result.content.imagePrompt).toContain("lending yields attract new liquidity");
    expect(result.content.imagePrompt).toContain("the scene should be driven by");
    expect(result.content.imagePrompt).toContain("single sophisticated editorial cover image");
    expect(result.content.imagePrompt).toContain("capital rotation");
    expect(result.content.imagePrompt).toContain("luxury research-report cover aesthetic");
    expect(result.content.imagePrompt).toContain("no readable text");
    expect(result.content.imagePrompt).toContain("no letters");
    expect(result.content.imagePrompt).toContain("no numbers");
    expect(result.content.imagePrompt).toContain("no ticker symbols");
    expect(result.content.imagePrompt).toContain("no logos containing text");
    expect(result.content.imagePrompt).not.toContain("$SUI");
    expect(result.content.imagePrompt).not.toMatch(/with the words/i);
    expect(result.content.imagePrompt).not.toMatch(/visual thesis:/i);
    expect(result.content.imagePrompt).not.toMatch(/secondary style direction/i);
  });
});
