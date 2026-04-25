import { z } from "zod";

import { BinanceAdapter, type BinanceAdapterConfig } from "./binance-adapter.js";
import {
  createProviderFailure,
  createProviderSuccess,
  marketCandleSchema,
  type MarketCandle,
  type MarketSnapshot,
  type ProviderResult,
} from "../types.js";

export const binanceSnapshotRequestSchema = z.object({
  symbol: z.string().min(1),
});

export const binanceSnapshotsRequestSchema = z.object({
  symbols: z.array(z.string().min(1)).min(1),
});

export const binanceCandlesRequestSchema = z.object({
  symbol: z.string().min(1),
  interval: z.enum(["15m", "1h", "4h", "1d"]).default("1h"),
  limit: z.number().int().min(1).max(200).default(24),
});

export class BinanceMarketService {
  private readonly adapter: BinanceAdapter;

  constructor(config: Partial<BinanceAdapterConfig> = {}) {
    this.adapter = new BinanceAdapter(config);
  }

  async getSnapshot(
    symbol: string,
  ): Promise<ProviderResult<MarketSnapshot>> {
    return this.adapter.getMarketSnapshot(symbol);
  }

  async getSnapshots(
    symbols: string[],
  ): Promise<ProviderResult<MarketSnapshot[]>> {
    const parsed = binanceSnapshotsRequestSchema.parse({ symbols });
    const results = await Promise.all(
      parsed.symbols.map((symbol) => this.adapter.getMarketSnapshot(symbol)),
    );
    const snapshots: MarketSnapshot[] = [];

    for (const result of results) {
      if (!result.ok) {
        return createProviderFailure({
          provider: "binance",
          code: "BINANCE_SNAPSHOT_BATCH_FAILED",
          message: `Failed to fetch Binance snapshots in the requested batch: ${result.error.message}`,
          retryable: result.error.retryable,
          notes: results.map((item) =>
            item.ok
              ? `Snapshot ready for ${item.value.symbol}.`
              : `${item.error.code}: ${item.error.message}`,
          ),
        });
      }

      snapshots.push(result.value);
    }

    return createProviderSuccess({
      provider: "binance",
      value: snapshots,
      notes: [`Prepared ${snapshots.length.toString()} Binance market snapshots.`],
    });
  }

  async getCandles(
    input: z.input<typeof binanceCandlesRequestSchema>,
  ): Promise<ProviderResult<MarketCandle[]>> {
    const parsed = binanceCandlesRequestSchema.parse(input);
    const snapshot = await this.adapter.getMarketSnapshot(parsed.symbol);

    if (!snapshot.ok) {
      return createProviderFailure({
        provider: "binance",
        code: snapshot.error.code,
        message: snapshot.error.message,
        retryable: snapshot.error.retryable,
        sourceStatus: snapshot.error.sourceStatus,
      });
    }

    const basePrice = snapshot.value.price || 100;
    const candles = Array.from({ length: parsed.limit }, (_, index) =>
      marketCandleSchema.parse({
        timestamp: new Date(
          Date.now() - (parsed.limit - index) * this.intervalToMs(parsed.interval),
        ).toISOString(),
        open: basePrice,
        high: basePrice,
        low: basePrice,
        close: basePrice,
        volume: 0,
      }),
    );

    return createProviderSuccess({
      provider: "binance",
      value: candles,
      notes: [
        `Generated ${parsed.limit.toString()} placeholder ${parsed.interval} candles for ${parsed.symbol.toUpperCase()}.`,
      ],
    });
  }

  async getFundingSnapshots(
    symbols: string[],
  ): Promise<
    ProviderResult<Array<Pick<MarketSnapshot, "symbol" | "fundingRate" | "openInterest" | "capturedAt">>>
  > {
    const snapshots = await this.getSnapshots(symbols);

    if (!snapshots.ok) {
      return snapshots;
    }

    return createProviderSuccess({
      provider: "binance",
      value: snapshots.value.map((snapshot) => ({
        symbol: snapshot.symbol,
        fundingRate: snapshot.fundingRate,
        openInterest: snapshot.openInterest,
        capturedAt: snapshot.capturedAt,
      })),
      notes: ["Prepared Binance funding/open-interest view from normalized snapshots."],
    });
  }

  private intervalToMs(interval: z.infer<typeof binanceCandlesRequestSchema>["interval"]) {
    switch (interval) {
      case "15m":
        return 15 * 60 * 1000;
      case "4h":
        return 4 * 60 * 60 * 1000;
      case "1d":
        return 24 * 60 * 60 * 1000;
      case "1h":
      default:
        return 60 * 60 * 1000;
    }
  }
}
