import { z } from "zod";

import { getBinanceSymbol } from "@omen/shared";

import {
  createProviderFailure,
  createProviderSuccess,
  marketCandleSchema,
  marketSnapshotSchema,
  type MarketCandle,
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
      this.requestJson(
        `${this.config.futuresBaseUrl}/fapi/v1/ticker/24hr?symbol=${encodeURIComponent(marketSymbol)}`,
      ),
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

  async getCandles(input: {
    symbol: string;
    interval: "15m" | "1h" | "4h" | "1d";
    limit: number;
  }): Promise<ProviderResult<MarketCandle[]>> {
    const normalized = input.symbol.trim().toUpperCase();

    if (!normalized) {
      return createProviderFailure({
        provider: "binance",
        code: "BINANCE_INVALID_SYMBOL",
        message: "A symbol is required for Binance candles.",
        retryable: false,
      });
    }

    const marketSymbol = this.normalizeMarketSymbol(normalized);
    const klines = await this.requestJsonArray(
      `${this.config.futuresBaseUrl}/fapi/v1/klines?symbol=${encodeURIComponent(marketSymbol)}&interval=${encodeURIComponent(input.interval)}&limit=${encodeURIComponent(input.limit.toString())}`,
    );

    if (!klines.ok) {
      return createProviderFailure({
        provider: "binance",
        code: "BINANCE_KLINES_REQUEST_FAILED",
        message: klines.error.message,
        retryable: true,
        sourceStatus: klines.status,
      });
    }

    const candles = klines.value
      .map((entry) => {
        if (!Array.isArray(entry) || entry.length < 6) {
          return null;
        }

        return marketCandleSchema.parse({
          timestamp: new Date(Number(entry[0])).toISOString(),
          open: this.parseNumber(entry[1]),
          high: this.parseNumber(entry[2]),
          low: this.parseNumber(entry[3]),
          close: this.parseNumber(entry[4]),
          volume: this.parseNumber(entry[5]),
        });
      })
      .filter((entry): entry is MarketCandle => entry !== null);

    return createProviderSuccess({
      provider: "binance",
      value: candles,
      notes: [
        `Fetched ${candles.length.toString()} live Binance ${input.interval} candles for ${marketSymbol}.`,
      ],
    });
  }

  private normalizeMarketSymbol(symbol: string) {
    const mappedSymbol = getBinanceSymbol(symbol);

    if (mappedSymbol) {
      return mappedSymbol;
    }

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

  private async requestJsonArray(pathOrUrl: string): Promise<
    | { ok: true; value: unknown[]; status: number }
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

      if (!Array.isArray(payload)) {
        return {
          ok: false,
          error: new Error("Binance returned a non-array JSON payload."),
          status: response.status,
        };
      }

      return {
        ok: true,
        value: payload,
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
