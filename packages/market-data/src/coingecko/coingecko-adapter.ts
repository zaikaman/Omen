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
    this.config = coinGeckoAdapterConfigSchema.parse(config);
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

    return createProviderSuccess({
      provider: "coingecko",
      value: marketSnapshotSchema.parse({
        symbol: normalized,
        provider: "coingecko",
        price: 0,
        change24hPercent: null,
        volume24h: null,
        fundingRate: null,
        openInterest: null,
        candles: [],
        capturedAt: new Date().toISOString(),
      }),
      notes: [
        `Adapter shell initialized for ${this.config.baseUrl}; pricing and metadata fetches land in the service phase.`,
      ],
    });
  }
}
