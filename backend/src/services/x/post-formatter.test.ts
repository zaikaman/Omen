import { describe, expect, it } from "vitest";

import { formatIntelPost, formatSignalPost } from "./post-formatter.js";

describe("post formatter", () => {
  it("formats intel in the compact Omen-style feed shape", () => {
    const post = formatIntelPost({
      title: "crypto market rotation watch",
      summary:
        "Crypto news: Pepeto announces investment growth while the Bitcoin price prediction bulls targets $150,000 - markets.businessinsider.com: Crypto news: Pepeto whale activity surges while the Bitcoin price prediction holds bullish after massive accumulation. Rotation is still thin but liquidity is improving.",
      symbols: ["BTC", "PEPETO"],
      topic: "BTC liquidity rotation",
    });

    expect(post.text.length).toBeLessThanOrEqual(280);
    expect(post.text).toMatch(/^crypto market rotation watch \$BTC \$PEPETO\n\n- /);
    expect(post.text).toContain(
      "\nwatch $BTC / $PEPETO if btc liquidity rotation gets follow-through",
    );
    expect(post.text).not.toContain("#");
    expect(post.text).not.toContain("...");
    expect(post.text).not.toContain("businessinsider.com");
  });

  it("formats signals in the template trade layout", () => {
    const post = formatSignalPost({
      asset: "BTC",
      direction: "LONG",
      confidence: 88,
      whyNow: "BTC reclaimed local resistance and volume expanded.",
      riskReward: 2.6,
      confluences: ["Breakout reclaim", "Momentum expansion"],
      tradingStyle: "day_trade",
      expectedDuration: "8-16 hours",
      entryPrice: 65000,
      targetPrice: 70980,
      stopLoss: 62725,
      orderType: "market",
    });

    expect(post.text.length).toBeLessThanOrEqual(280);
    expect(post.text).toContain("$BTC day trade");
    expect(post.text).toContain("order: market");
    expect(post.text).toContain("hold: 8-16 hours");
    expect(post.text).toContain("entry: $65,000");
    expect(post.text).toContain("target: $70,980 (+9.2%)");
    expect(post.text).toContain("stop: $62,725 (-3.5%)");
    expect(post.text).toContain("r:r: 1:2.6");
    expect(post.text).toContain("conf: 88%");
    expect(post.text).toContain("thesis: breakout reclaim + momentum expansion");
    expect(post.text).toContain("#bitcoin");
  });

  it("compresses verbose chart thesis text instead of cutting it mid-phrase", () => {
    const post = formatSignalPost({
      asset: "SOL",
      direction: "SHORT",
      confidence: 92,
      whyNow:
        "SOL is actionable because SOL 15m chart: SOL 15m chart shows trend is leaning downward, with visible range between 83.34 and 85.81 and the latest close near 83.56. SOL 1h chart: SOL 1h chart shows trend is leaning downward, with visible range between 83.34 and 88.08 and the latest close near 83.56.",
      riskReward: 4.1,
      confluences: [],
      tradingStyle: "swing_trade",
      expectedDuration: "2-5 days",
      entryPrice: 85.81,
      targetPrice: 68.22,
      stopLoss: 90.1,
      orderType: "limit",
    });

    expect(post.text.length).toBeLessThanOrEqual(280);
    expect(post.text).toContain("$SOL swing trade");
    expect(post.text).toContain("order: limit");
    expect(post.text).toContain(
      "thesis: 15m/1h trend leaning downward; range 83.34-88.08; latest close 83.56",
    );
    expect(post.text).not.toContain("with visible range");
  });

  it("uses generated intel tweet text when present", () => {
    const generatedTweetText = [
      "sui tvl blasts higher while eth liquidity rotates",
      "",
      "- lending yields pull fresh deposits",
      "- active wallets keep rising",
      "",
      "watch $SUI if flow sustains",
    ].join("\n");
    const post = formatIntelPost({
      title: "SUI TVL Surge",
      summary: "Fallback summary should not be used.",
      symbols: ["SUI"],
      generatedTweetText,
    });

    expect(post.text).toBe(generatedTweetText);
    expect(post.text.length).toBeLessThanOrEqual(280);
  });

  it("preserves generated intel tweets instead of cutting them to the provider-safe budget", () => {
    const generatedTweetText = [
      "meme launchpad capital rotation & supply shock in $PUMP",
      "",
      "- pump.fun's aggressive tokenomics overhaul--burning ~36% of circulating $PUMP supply",
      "- this coincides with $PUMP trending heavily on birdeye/coingecko alongside solana",
      "",
      "watch $PUMP $BLEND $BTC if confirmation follows",
    ].join("\n");
    const post = formatIntelPost({
      title: "PUMP supply shock",
      summary: "Fallback summary should not be used.",
      symbols: ["PUMP", "BLEND", "BTC"],
      generatedTweetText,
    });

    expect(generatedTweetText.length).toBeGreaterThan(270);
    expect(post.text).toBe(generatedTweetText);
    expect(post.text).toContain("watch $PUMP $BLEND $BTC if confirmation follows");
  });

  it("preserves under-limit generated intel tweets exactly after whitespace normalization", () => {
    const generatedTweetText = [
      "interoperability and launchpad momentum in thin liquidity",
      "",
      "- blend (fluent) surges into trending lists on coingecko and birdeye following its mainnet launch, tge.",
      "- concurrently, pump (pump.",
      "",
      "watch $MON $HYPE $BTC $ETH if confirmation follows",
    ].join("\n");
    const post = formatIntelPost({
      title: "Launchpad Momentum",
      summary: "Fallback summary should not be used.",
      symbols: ["MON", "HYPE", "BTC", "ETH"],
      generatedTweetText,
    });

    expect(generatedTweetText.length).toBeLessThanOrEqual(270);
    expect(post.text).toBe(generatedTweetText);
  });
});
