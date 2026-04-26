import { afterEach, describe, expect, it, vi } from "vitest";

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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("returns a live-shaped market snapshot from the Binance adapter", async () => {
    vi.stubGlobal(
      "fetch",
      async (input: string | URL) =>
        ({
          ok: true,
          status: 200,
          json: async () => {
            const url = input.toString();

            if (url.includes("/ticker/24hr")) {
              return {
                lastPrice: "65000",
                priceChangePercent: "3.2",
                quoteVolume: "120000000",
              };
            }

            if (url.includes("/premiumIndex")) {
              return {
                lastFundingRate: "0.0005",
              };
            }

            return {
              openInterest: "4500000",
            };
          },
        }) as Response,
    );

    const adapter = new BinanceAdapter();
    const result = await adapter.getMarketSnapshot("btc");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.symbol).toBe("BTC");
      expect(result.value.provider).toBe("binance");
      expect(result.value.price).toBe(65000);
    }
  });

  it("builds normalized market snapshot and movers service views", async () => {
    vi.stubGlobal(
      "fetch",
      async (input: string | URL) =>
        ({
          ok: true,
          status: 200,
          json: async () => {
            const url = input.toString();

            if (url.includes("api.binance.com")) {
              return {
                lastPrice: "65000",
                priceChangePercent: "3.2",
                quoteVolume: "120000000",
              };
            }

            if (url.includes("premiumIndex")) {
              return {
                lastFundingRate: "0.0005",
              };
            }

            if (url.includes("openInterest")) {
              return {
                openInterest: "4500000",
              };
            }

            return [
              {
                current_price: 64000,
                price_change_percentage_24h: 2.1,
                total_volume: 1000000,
              },
            ];
          },
        }) as Response,
    );

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
    vi.stubGlobal(
      "fetch",
      async (input: string | URL) =>
        ({
          ok: true,
          status: 200,
          json: async () => {
            const url = input.toString();

            if (url.includes("api.llama.fi")) {
              return {
                name: "Aave",
                chain: "Ethereum",
                tvl: 15000000000,
                change_1d: 1.5,
                change_7d: 6.2,
                category: "Lending",
              };
            }

            return {
              results: [
                {
                  title: "AI infrastructure rotation strengthens",
                  content: "Investors remain bullish on AI infrastructure leaders.",
                  url: "https://example.com/story",
                },
              ],
            };
          },
        }) as Response,
    );
    process.env.TAVILY_API_KEY = "test-key";

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
