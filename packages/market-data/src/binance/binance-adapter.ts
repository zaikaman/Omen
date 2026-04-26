import { z } from "zod";

import {
  createProviderFailure,
  createProviderSuccess,
  marketSnapshotSchema,
  type MarketSnapshot,
  type ProviderResult,
} from "../types.js";

export const binanceAdapterConfigSchema = z.object({
  baseUrl: z.string().url().default("https://api.binance.com"),
  futuresBaseUrl: z.string().url().default("https://fapi.binance.com"),
  requestTimeoutMs: z.number().int().min(1).default(10_000),
});

export type BinanceAdapterConfig = z.infer<typeof binanceAdapterConfigSchema>;

export class BinanceAdapter {
  private readonly config: BinanceAdapterConfig;

  constructor(config: Partial<BinanceAdapterConfig> = {}) {
    this.config = binanceAdapterConfigSchema.parse(config);
  }

  async getMarketSnapshot(symbol: string): Promise<ProviderResult<MarketSnapshot>> {
    const normalized = symbol.trim().toUpperCase();

    if (!normalized) {
      return createProviderFailure({
        provider: "binance",
        code: "BINANCE_INVALID_SYMBOL",
        message: "A symbol is required for Binance market snapshots.",
        retryable: false,
      });
    }

    const marketSymbol = this.normalizeMarketSymbol(normalized);
    const [ticker, funding, openInterest] = await Promise.all([
      this.requestJson(`/api/v3/ticker/24hr?symbol=${encodeURIComponent(marketSymbol)}`),
      this.requestJson(
        `${this.config.futuresBaseUrl}/fapi/v1/premiumIndex?symbol=${encodeURIComponent(marketSymbol)}`,
      ),
      this.requestJson(
        `${this.config.futuresBaseUrl}/fapi/v1/openInterest?symbol=${encodeURIComponent(marketSymbol)}`,
      ),
    ]);

    if (!ticker.ok) {
      return createProviderFailure({
        provider: "binance",
        code: "BINANCE_TICKER_REQUEST_FAILED",
        message: ticker.error.message,
        retryable: true,
        sourceStatus: ticker.status,
      });
    }

    return createProviderSuccess({
      provider: "binance",
      value: marketSnapshotSchema.parse({
        symbol: normalized,
        provider: "binance",
        price: this.parseNumber(ticker.value.lastPrice),
        change24hPercent: this.parseNullableNumber(ticker.value.priceChangePercent),
        volume24h: this.parseNullableNumber(ticker.value.quoteVolume),
        fundingRate: funding.ok ? this.parseNullableNumber(funding.value.lastFundingRate) : null,
        openInterest: openInterest.ok
          ? this.parseNullableNumber(openInterest.value.openInterest)
          : null,
        candles: [],
        capturedAt: new Date().toISOString(),
      }),
      notes: [`Fetched live Binance snapshot for ${marketSymbol}.`],
    });
  }

  private normalizeMarketSymbol(symbol: string) {
    if (symbol.endsWith("USDT") || symbol.endsWith("USD")) {
      return symbol;
    }

    return `${symbol}USDT`;
  }

  private parseNumber(value: unknown) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      throw new Error(`Binance returned a non-numeric value: ${String(value)}`);
    }

    return parsed;
  }

  private parseNullableNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private async requestJson(pathOrUrl: string): Promise<
    | { ok: true; value: Record<string, unknown>; status: number }
    | { ok: false; error: Error; status: number | null }
  > {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    try {
      const url = pathOrUrl.startsWith("http")
        ? pathOrUrl
        : `${this.config.baseUrl.replace(/\/$/, "")}${pathOrUrl}`;
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
          error: new Error(`Binance request failed with HTTP ${response.status.toString()}.`),
          status: response.status,
        };
      }

      const payload = (await response.json()) as unknown;

      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return {
          ok: false,
          error: new Error("Binance returned a non-object JSON payload."),
          status: response.status,
        };
      }

      return {
        ok: true,
        value: payload as Record<string, unknown>,
        status: response.status,
      };
    } catch (error) {
      return {
        ok: false,
        error:
          error instanceof Error ? error : new Error("Binance request failed."),
        status: null,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
