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

    for (const result of results) {
      if (!result.ok) {
        return createProviderFailure({
          provider: "coingecko",
          code: "COINGECKO_SNAPSHOT_BATCH_FAILED",
          message: `Failed to fetch CoinGecko snapshots in the requested batch: ${result.error.message}`,
          retryable: result.error.retryable,
        });
      }

      snapshots.push(result.value);
    }

    return createProviderSuccess({
      provider: "coingecko",
      value: snapshots,
      notes: [`Prepared ${snapshots.length.toString()} CoinGecko asset snapshots.`],
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
}
