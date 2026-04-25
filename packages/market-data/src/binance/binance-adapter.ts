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

    return createProviderSuccess({
      provider: "binance",
      value: marketSnapshotSchema.parse({
        symbol: normalized,
        provider: "binance",
        price: 0,
        change24hPercent: null,
        volume24h: null,
        fundingRate: null,
        openInterest: null,
        candles: [],
        capturedAt: new Date().toISOString(),
      }),
      notes: [
        `Adapter shell initialized for ${this.config.baseUrl}; real Binance integration lands in the service phase.`,
      ],
    });
  }
}
