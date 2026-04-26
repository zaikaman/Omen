import { z } from "zod";

import {
  createProviderFailure,
  createProviderSuccess,
  marketSnapshotSchema,
  type MarketSnapshot,
  type ProviderResult,
} from "../types.js";

export const coinGeckoAdapterConfigSchema = z.object({
  baseUrl: z.string().url().default("https://api.coingecko.com/api/v3"),
  apiKey: z.string().min(1).optional(),
  requestTimeoutMs: z.number().int().min(1).default(10_000),
});

export type CoinGeckoAdapterConfig = z.infer<typeof coinGeckoAdapterConfigSchema>;

export class CoinGeckoAdapter {
  private readonly config: CoinGeckoAdapterConfig;

  constructor(config: Partial<CoinGeckoAdapterConfig> = {}) {
    this.config = coinGeckoAdapterConfigSchema.parse({
      apiKey: config.apiKey ?? this.resolveApiKeyFromEnv(),
      ...config,
    });
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

  private resolveApiKeyFromEnv() {
    if (process.env.COINGECKO_API_KEY?.trim()) {
      return process.env.COINGECKO_API_KEY;
    }

    for (let index = 1; index <= 10; index += 1) {
      const key = process.env[`COINGECKO_API_KEY_${index.toString()}`];

      if (typeof key === "string" && key.trim()) {
        return key;
      }
    }

    return undefined;
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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    try {
      const url = new URL("/coins/markets", this.config.baseUrl);
      url.searchParams.set("vs_currency", "usd");
      url.searchParams.set("symbols", symbol.toLowerCase());
      url.searchParams.set("price_change_percentage", "24h");

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(this.config.apiKey ? { "x-cg-pro-api-key": this.config.apiKey } : {}),
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

      const payload = (await response.json()) as unknown;

      if (!Array.isArray(payload)) {
        return {
          ok: false,
          error: new Error("CoinGecko returned a non-array JSON payload."),
          status: response.status,
        };
      }

      return {
        ok: true,
        value: payload.filter(
          (entry): entry is Record<string, unknown> =>
            !!entry && typeof entry === "object" && !Array.isArray(entry),
        ),
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
