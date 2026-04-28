import { z } from "zod";

import {
  cmcQuoteSchema,
  createProviderFailure,
  createProviderSuccess,
  type CmcQuote,
  type ProviderResult,
} from "../types.js";
import { ApiKeyRotator, resolveNumberedApiKeys } from "../utils/api-key-rotator.js";

export const coinMarketCapAdapterConfigSchema = z.object({
  baseUrl: z.string().url().default("https://pro-api.coinmarketcap.com/v1"),
  apiKey: z.string().min(1).optional(),
  apiKeys: z.array(z.string().min(1)).default([]),
  requestTimeoutMs: z.number().int().min(1).default(10_000),
});

export type CoinMarketCapAdapterConfig = z.infer<typeof coinMarketCapAdapterConfigSchema>;

export class CoinMarketCapAdapter {
  private readonly config: CoinMarketCapAdapterConfig;

  private readonly apiKeys: ApiKeyRotator;

  constructor(config: Partial<CoinMarketCapAdapterConfig> = {}) {
    this.config = coinMarketCapAdapterConfigSchema.parse({
      apiKey: config.apiKey ?? process.env.CMC_API_KEY,
      apiKeys: config.apiKeys ?? resolveNumberedApiKeys("CMC_API_KEY"),
      ...config,
    });
    this.apiKeys = new ApiKeyRotator([this.config.apiKey, ...this.config.apiKeys]);
  }

  async getPriceWithChange(symbol: string): Promise<ProviderResult<CmcQuote>> {
    const normalized = symbol.trim().toUpperCase();
    if (!normalized) {
      return createProviderFailure({
        provider: "coinmarketcap",
        code: "CMC_INVALID_SYMBOL",
        message: "A symbol is required for CoinMarketCap quotes.",
        retryable: false,
      });
    }

    const result = await this.requestJson("/cryptocurrency/quotes/latest", {
      symbol: normalized,
      convert: "USD",
    });

    if (!result.ok) {
      return createProviderFailure({
        provider: "coinmarketcap",
        code: "CMC_QUOTE_REQUEST_FAILED",
        message: result.error.message,
        retryable: true,
        sourceStatus: result.status,
      });
    }

    const data =
      result.value && typeof result.value === "object" && !Array.isArray(result.value)
        ? (result.value as Record<string, unknown>).data
        : null;
    const symbolEntry =
      data && typeof data === "object" && !Array.isArray(data)
        ? (data as Record<string, unknown>)[normalized]
        : null;
    const coin = Array.isArray(symbolEntry) ? symbolEntry[0] : symbolEntry;
    const quote =
      coin && typeof coin === "object" && !Array.isArray(coin)
        ? (coin as Record<string, unknown>).quote
        : null;
    const usd =
      quote && typeof quote === "object" && !Array.isArray(quote)
        ? (quote as Record<string, unknown>).USD
        : null;

    if (!usd || typeof usd !== "object" || Array.isArray(usd)) {
      return createProviderFailure({
        provider: "coinmarketcap",
        code: "CMC_SYMBOL_NOT_FOUND",
        message: `CoinMarketCap returned no USD quote for ${normalized}.`,
        retryable: false,
        sourceStatus: 404,
      });
    }

    return createProviderSuccess({
      provider: "coinmarketcap",
      value: cmcQuoteSchema.parse({
        symbol: normalized,
        price: this.parseNumber((usd as Record<string, unknown>).price),
        change24hPercent: this.parseNullableNumber(
          (usd as Record<string, unknown>).percent_change_24h,
        ),
        capturedAt: new Date().toISOString(),
      }),
      notes: [`Fetched CoinMarketCap quote for ${normalized}.`],
    });
  }

  private parseNumber(value: unknown) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`CoinMarketCap returned a non-numeric value: ${String(value)}`);
    }
    return parsed;
  }

  private parseNullableNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private async requestJson(
    path: string,
    params: Record<string, string>,
  ): Promise<
    | { ok: true; value: unknown; status: number }
    | { ok: false; error: Error; status: number | null }
  > {
    const apiKey = this.apiKeys.next();
    if (!apiKey) {
      return {
        ok: false,
        error: new Error("CoinMarketCap API key is required."),
        status: null,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    try {
      const url = new URL(`${this.config.baseUrl.replace(/\/$/, "")}${path}`);
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-CMC_PRO_API_KEY": apiKey,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          ok: false,
          error: new Error(
            `CoinMarketCap request failed with HTTP ${response.status.toString()}.`,
          ),
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
        error: error instanceof Error ? error : new Error("CoinMarketCap request failed."),
        status: null,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
