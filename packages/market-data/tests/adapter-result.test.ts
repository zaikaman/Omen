import { describe, expect, it } from "vitest";

import {
  BinanceAdapter,
  BinanceMarketService,
  CoinGeckoMarketService,
  DefiLlamaMarketService,
  TavilyMarketResearchService,
  createProviderFailure,
  createProviderSuccess,
} from "../src/index.js";

describe("market-data provider results", () => {
  it("creates typed success and failure result unions", () => {
    const success = createProviderSuccess({
      provider: "binance",
      value: { symbol: "BTC" },
    });
    const failure = createProviderFailure({
      provider: "news",
      code: "NEWS_DOWN",
      message: "provider unavailable",
      retryable: true,
    });

    expect(success.ok).toBe(true);
    expect(success.health.available).toBe(true);
    expect(failure.ok).toBe(false);
    expect(failure.health.degraded).toBe(true);
  });

  it("returns a placeholder market snapshot for the adapter shell", async () => {
    const adapter = new BinanceAdapter();
    const result = await adapter.getMarketSnapshot("btc");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.symbol).toBe("BTC");
      expect(result.value.provider).toBe("binance");
    }
  });

  it("builds normalized market snapshot and movers service views", async () => {
    const binance = new BinanceMarketService();
    const coinGecko = new CoinGeckoMarketService();

    const snapshots = await binance.getSnapshots(["btc", "eth"]);
    const movers = await coinGecko.getTopMovers(["btc", "eth"]);

    expect(snapshots.ok).toBe(true);
    if (snapshots.ok) {
      expect(snapshots.value).toHaveLength(2);
    }

    expect(movers.ok).toBe(true);
    if (movers.ok) {
      expect(movers.value).toHaveLength(2);
    }
  });

  it("builds normalized protocol and research service views", async () => {
    const defiLlama = new DefiLlamaMarketService();
    const research = new TavilyMarketResearchService();

    const protocols = await defiLlama.getProtocolLeaderboard(["aave", "uniswap"]);
    const bundle = await research.getSymbolResearchBundle({
      symbol: "TAO",
      query: "ai infrastructure rotation",
    });

    expect(protocols.ok).toBe(true);
    if (protocols.ok) {
      expect(protocols.value).toHaveLength(2);
    }

    expect(bundle.ok).toBe(true);
    if (bundle.ok) {
      expect(bundle.value.symbol).toBe("TAO");
      expect(bundle.value.narratives.length).toBeGreaterThan(0);
      expect(bundle.value.macroContext.length).toBeGreaterThan(0);
    }
  });
});
