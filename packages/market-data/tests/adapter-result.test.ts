import { afterEach, describe, expect, it, vi } from "vitest";

import {
  BinanceAdapter,
  BinanceMarketService,
  BirdeyeMarketService,
  CoinGeckoMarketService,
  CoinMarketCapMarketService,
  DefiLlamaMarketService,
  ApiKeyRotator,
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

  it("rotates API keys round-robin", () => {
    const rotator = new ApiKeyRotator(["one", "two", undefined, "three"]);

    expect(rotator.size).toBe(3);
    expect(rotator.next()).toBe("one");
    expect(rotator.next()).toBe("two");
    expect(rotator.next()).toBe("three");
    expect(rotator.next()).toBe("one");
  });

  it("returns a live-shaped market snapshot from the Binance adapter", async () => {
    let requestedTickerUrl = "";

    vi.stubGlobal(
      "fetch",
      async (input: string | URL) =>
        ({
          ok: true,
          status: 200,
          json: async () => {
            const url = input.toString();

            if (url.includes("/ticker/24hr")) {
              requestedTickerUrl = url;
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

    expect(requestedTickerUrl).toContain("symbol=BTCUSDT");
  });

  it("uses template Binance mappings for special meme symbols", async () => {
    let requestedTickerUrl = "";

    vi.stubGlobal(
      "fetch",
      async (input: string | URL) =>
        ({
          ok: true,
          status: 200,
          json: async () => {
            const url = input.toString();

            if (url.includes("/ticker/24hr")) {
              requestedTickerUrl = url;
              return {
                lastPrice: "0.00123",
                priceChangePercent: "4.5",
                quoteVolume: "25000000",
              };
            }

            if (url.includes("/premiumIndex")) {
              return {
                lastFundingRate: "0.0002",
              };
            }

            return {
              openInterest: "1250000",
            };
          },
        }) as Response,
    );

    const adapter = new BinanceAdapter();
    const result = await adapter.getMarketSnapshot("pepe");

    expect(result.ok).toBe(true);
    expect(requestedTickerUrl).toContain("symbol=1000PEPEUSDT");
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

  it("builds template-style CoinGecko, Birdeye, and CMC views", async () => {
    const requestedHeaders: Array<Record<string, string>> = [];
    vi.stubGlobal(
      "fetch",
      async (input: string | URL, init?: RequestInit) =>
        ({
          ok: true,
          status: 200,
          json: async () => {
            const url = input.toString();
            requestedHeaders.push((init?.headers ?? {}) as Record<string, string>);

            if (url.includes("token_trending")) {
              return {
                success: true,
                data: {
                  tokens: [
                    {
                      name: "Test Token",
                      symbol: "TEST",
                      rank: 1,
                      chain: "solana",
                      address: "abc",
                      volume24hUSD: 123000,
                    },
                  ],
                },
              };
            }

            if (url.includes("coinmarketcap")) {
              return {
                data: {
                  BTC: [
                    {
                      quote: {
                        USD: {
                          price: 65000,
                          percent_change_24h: 2.5,
                        },
                      },
                    },
                  ],
                },
              };
            }

            if (url.includes("search/trending")) {
              return {
                coins: [
                  {
                    item: {
                      name: "Solana",
                      symbol: "SOL",
                      market_cap_rank: 6,
                    },
                  },
                ],
              };
            }

            return [
              {
                symbol: "sol",
                current_price: 100,
                price_change_percentage_24h: 12.3,
                total_volume: 1000000,
              },
            ];
          },
        }) as Response,
    );

    const coinGecko = new CoinGeckoMarketService({ apiKeys: ["cg-1", "cg-2"] });
    const birdeye = new BirdeyeMarketService({ apiKeys: ["be-1", "be-2"] });
    const coinMarketCap = new CoinMarketCapMarketService({ apiKeys: ["cmc-1", "cmc-2"] });

    const [trending, gainers, birdeyeTrending, btc] = await Promise.all([
      coinGecko.getTrending(),
      coinGecko.getTopGainersLosers(),
      birdeye.getTrendingTokens(),
      coinMarketCap.getPriceWithChange("BTC"),
    ]);

    expect(trending.ok).toBe(true);
    expect(gainers.ok).toBe(true);
    expect(birdeyeTrending.ok).toBe(true);
    expect(btc.ok).toBe(true);
    expect(requestedHeaders.some((headers) => headers["X-API-KEY"] === "be-1")).toBe(true);
    expect(requestedHeaders.some((headers) => headers["X-CMC_PRO_API_KEY"] === "cmc-1")).toBe(true);
  });

  it("builds normalized protocol service views", async () => {
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

            return {};
          },
        }) as Response,
    );

    const defiLlama = new DefiLlamaMarketService();

    const protocols = await defiLlama.getProtocolLeaderboard(["aave", "uniswap"]);

    expect(protocols.ok).toBe(true);
    if (protocols.ok) {
      expect(protocols.value).toHaveLength(2);
    }
  });
});
