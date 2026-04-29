import { z } from "zod";

import { getTradeableToken } from "@omen/shared";

import {
  createProviderFailure,
  createProviderSuccess,
  marketSnapshotSchema,
  type MarketSnapshot,
  type ProviderResult,
  trendingTokenSchema,
  type TrendingToken,
} from "../types.js";
import { ApiKeyRotator, resolveNumberedApiKeys } from "../utils/api-key-rotator.js";

export const coinGeckoAdapterConfigSchema = z.object({
  baseUrl: z.string().url().default("https://api.coingecko.com/api/v3"),
  apiKey: z.string().min(1).optional(),
  apiKeys: z.array(z.string().min(1)).default([]),
  requestTimeoutMs: z.number().int().min(1).default(10_000),
});

export type CoinGeckoAdapterConfig = z.infer<typeof coinGeckoAdapterConfigSchema>;

export class CoinGeckoAdapter {
  private readonly config: CoinGeckoAdapterConfig;

  private readonly apiKeys: ApiKeyRotator;

  constructor(config: Partial<CoinGeckoAdapterConfig> = {}) {
    this.config = coinGeckoAdapterConfigSchema.parse({
      apiKey: config.apiKey ?? process.env.COINGECKO_API_KEY,
      apiKeys: config.apiKeys ?? resolveNumberedApiKeys("COINGECKO_API_KEY"),
      ...config,
    });
    this.apiKeys = new ApiKeyRotator([
      this.config.apiKey,
      ...this.config.apiKeys,
    ]);
  }

  async getAssetSnapshot(symbol: string): Promise<ProviderResult<MarketSnapshot>> {
    const normalized = symbol.trim().toUpperCase();

    if (!normalized) {
      return createProviderFailure({
        provider: "coingecko",
        code: "COINGECKO_INVALID_SYMBOL",
        message: "A symbol is required for CoinGecko asset snapshots.",
        retryable: false,
      });
    }

    const result = await this.requestMarkets(normalized);

    if (!result.ok) {
      return createProviderFailure({
        provider: "coingecko",
        code: "COINGECKO_MARKETS_REQUEST_FAILED",
        message: result.error.message,
        retryable: true,
        sourceStatus: result.status,
      });
    }

    const market = result.value[0];

    if (!market) {
      return createProviderFailure({
        provider: "coingecko",
        code: "COINGECKO_SYMBOL_NOT_FOUND",
        message: `CoinGecko returned no market rows for ${normalized}.`,
        retryable: false,
        sourceStatus: 404,
      });
    }

    return createProviderSuccess({
      provider: "coingecko",
      value: marketSnapshotSchema.parse({
        symbol: normalized,
        provider: "coingecko",
        price: this.parseNumber(market.current_price),
        change24hPercent: this.parseNullableNumber(market.price_change_percentage_24h),
        volume24h: this.parseNullableNumber(market.total_volume),
        fundingRate: null,
        openInterest: null,
        candles: [],
        capturedAt: new Date().toISOString(),
      }),
      notes: [`Fetched live CoinGecko market snapshot for ${normalized}.`],
    });
  }

  async getTrending(): Promise<ProviderResult<TrendingToken[]>> {
    const result = await this.requestJson("/search/trending", {});

    if (!result.ok) {
      return createProviderFailure({
        provider: "coingecko",
        code: "COINGECKO_TRENDING_REQUEST_FAILED",
        message: result.error.message,
        retryable: true,
        sourceStatus: result.status,
      });
    }

    const payload =
      result.value && typeof result.value === "object" && !Array.isArray(result.value)
        ? (result.value as Record<string, unknown>)
        : {};
    const coins = Array.isArray(payload.coins)
      ? payload.coins.filter(
          (entry): entry is Record<string, unknown> =>
            !!entry && typeof entry === "object" && !Array.isArray(entry),
        )
      : [];

    return createProviderSuccess({
      provider: "coingecko",
      value: coins
        .map((entry) =>
          entry.item && typeof entry.item === "object" && !Array.isArray(entry.item)
            ? (entry.item as Record<string, unknown>)
            : entry,
        )
        .map((item) =>
          trendingTokenSchema.parse({
            name: String(item.name ?? item.symbol ?? "unknown"),
            symbol: String(item.symbol ?? item.name ?? "UNKNOWN").toUpperCase(),
            rank: this.parseNullableNumber(item.market_cap_rank),
            chain: null,
            address: null,
            volume24h: null,
            source: "coingecko",
            capturedAt: new Date().toISOString(),
          }),
        ),
      notes: ["Fetched CoinGecko trending tokens."],
    });
  }

  async getTopGainersLosers(limit = 20): Promise<ProviderResult<MarketSnapshot[]>> {
    const result = await this.requestMarketsByParams({
      vs_currency: "usd",
      order: "price_change_percentage_24h_desc",
      per_page: limit.toString(),
      page: "1",
      sparkline: "false",
      price_change_percentage: "24h",
    });

    if (!result.ok) {
      return createProviderFailure({
        provider: "coingecko",
        code: "COINGECKO_GAINERS_REQUEST_FAILED",
        message: result.error.message,
        retryable: true,
        sourceStatus: result.status,
      });
    }

    return createProviderSuccess({
      provider: "coingecko",
      value: result.value.map((market) =>
        marketSnapshotSchema.parse({
          symbol: String(market.symbol ?? "UNKNOWN").toUpperCase(),
          provider: "coingecko",
          price: this.parseNumber(market.current_price),
          change24hPercent: this.parseNullableNumber(market.price_change_percentage_24h),
          volume24h: this.parseNullableNumber(market.total_volume),
          fundingRate: null,
          openInterest: null,
          candles: [],
          capturedAt: new Date().toISOString(),
        }),
      ),
      notes: ["Fetched CoinGecko top gainers/losers view."],
    });
  }

  private parseNumber(value: unknown) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      throw new Error(`CoinGecko returned a non-numeric value: ${String(value)}`);
    }

    return parsed;
  }

  private parseNullableNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private async requestMarkets(symbol: string): Promise<
    | { ok: true; value: Record<string, unknown>[]; status: number }
    | { ok: false; error: Error; status: number | null }
  > {
    const coingeckoId = getTradeableToken(symbol)?.coingeckoId;

    return this.requestMarketsByParams({
      vs_currency: "usd",
      ...(coingeckoId ? { ids: coingeckoId } : { symbols: symbol.toLowerCase() }),
      price_change_percentage: "24h",
    });
  }

  private async requestMarketsByParams(params: Record<string, string>): Promise<
    | { ok: true; value: Record<string, unknown>[]; status: number }
    | { ok: false; error: Error; status: number | null }
  > {
    const result = await this.requestJson("/coins/markets", params);

    if (!result.ok) {
      return result;
    }

    if (!Array.isArray(result.value)) {
      return {
        ok: false,
        error: new Error("CoinGecko returned a non-array JSON payload."),
        status: result.status,
      };
    }

    return {
      ok: true,
      value: result.value.filter(
        (entry): entry is Record<string, unknown> =>
          !!entry && typeof entry === "object" && !Array.isArray(entry),
      ),
      status: result.status,
    };
  }

  private async requestJson(
    path: string,
    params: Record<string, string>,
  ): Promise<
    | { ok: true; value: unknown; status: number }
    | { ok: false; error: Error; status: number | null }
  > {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    try {
      const url = new URL(`${this.config.baseUrl.replace(/\/$/, "")}${path}`);
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
      const apiKey = this.apiKeys.next();
      if (apiKey) {
        url.searchParams.set("x_cg_demo_api_key", apiKey);
      }
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          ok: false,
          error: new Error(`CoinGecko request failed with HTTP ${response.status.toString()}.`),
          status: response.status,
        };
      }

      return {
        ok: true,
        value: (await response.json()) as unknown,
        status: response.status,
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error : new Error("CoinGecko request failed."),
        status: null,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
