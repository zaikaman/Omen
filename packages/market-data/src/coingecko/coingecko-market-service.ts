import { z } from "zod";

import {
  CoinGeckoAdapter,
  type CoinGeckoAdapterConfig,
} from "./coingecko-adapter.js";
import {
  createProviderFailure,
  createProviderSuccess,
  type MarketSnapshot,
  type ProviderResult,
  type TrendingToken,
} from "../types.js";

export const coinGeckoSnapshotsRequestSchema = z.object({
  symbols: z.array(z.string().min(1)).min(1),
});

export class CoinGeckoMarketService {
  private readonly adapter: CoinGeckoAdapter;

  constructor(config: Partial<CoinGeckoAdapterConfig> = {}) {
    this.adapter = new CoinGeckoAdapter(config);
  }

  async getAssetSnapshot(
    symbol: string,
  ): Promise<ProviderResult<MarketSnapshot>> {
    return this.adapter.getAssetSnapshot(symbol);
  }

  async getAssetSnapshots(
    symbols: string[],
  ): Promise<ProviderResult<MarketSnapshot[]>> {
    const parsed = coinGeckoSnapshotsRequestSchema.parse({ symbols });
    const results = await Promise.all(
      parsed.symbols.map((symbol) => this.adapter.getAssetSnapshot(symbol)),
    );
    const snapshots: MarketSnapshot[] = [];
    const failures: string[] = [];

    for (const result of results) {
      if (!result.ok) {
        failures.push(`${result.error.code}: ${result.error.message}`);
        continue;
      }

      snapshots.push(result.value);
    }

    if (snapshots.length === 0) {
      return createProviderFailure({
        provider: "coingecko",
        code: "COINGECKO_SNAPSHOT_BATCH_FAILED",
        message: `Failed to fetch CoinGecko snapshots in the requested batch: ${failures.join("; ")}`,
        retryable: results.some((item) => !item.ok && item.error.retryable),
        notes: failures,
      });
    }

    return createProviderSuccess({
      provider: "coingecko",
      value: snapshots,
      notes: [
        `Prepared ${snapshots.length.toString()} CoinGecko asset snapshots.`,
        ...failures.map((failure) => `Skipped CoinGecko snapshot: ${failure}`),
      ],
    });
  }

  async getTopMovers(
    symbols: string[],
  ): Promise<ProviderResult<MarketSnapshot[]>> {
    const snapshots = await this.getAssetSnapshots(symbols);

    if (!snapshots.ok) {
      return snapshots;
    }

    const sorted = [...snapshots.value].sort(
      (left, right) => (right.change24hPercent ?? -Infinity) - (left.change24hPercent ?? -Infinity),
    );

    return createProviderSuccess({
      provider: "coingecko",
      value: sorted,
      notes: ["Prepared CoinGecko movers view ordered by 24h change."],
    });
  }

  async getTrending(): Promise<ProviderResult<TrendingToken[]>> {
    return this.adapter.getTrending();
  }

  async getTopGainersLosers(limit = 20): Promise<ProviderResult<MarketSnapshot[]>> {
    return this.adapter.getTopGainersLosers(limit);
  }
}
