import { describe, expect, it } from "vitest";

import { formatIntelPost, formatSignalPost } from "./post-formatter.js";

describe("post formatter", () => {
  it("formats intel in the compact Rogue-style feed shape", () => {
    const post = formatIntelPost({
      title: "crypto market rotation watch",
      summary:
        "Crypto news: Pepeto announces investment growth while the Bitcoin price prediction bulls targets $150,000 - markets.businessinsider.com: Crypto news: Pepeto whale activity surges while the Bitcoin price prediction holds bullish after massive accumulation. Rotation is still thin but liquidity is improving.",
      symbols: ["BTC", "PEPETO"],
      topic: "BTC liquidity rotation",
    });

    expect(post.text.length).toBeLessThanOrEqual(280);
    expect(post.text).toMatch(/^crypto market rotation watch \$BTC \$PEPETO\n\n- /);
    expect(post.text).toContain("\nwatch $BTC / $PEPETO if btc liquidity rotation gets follow-through");
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
    expect(post.text).toContain("breakout reclaim + momentum expansion");
    expect(post.text).toContain("#bitcoin");
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
});
