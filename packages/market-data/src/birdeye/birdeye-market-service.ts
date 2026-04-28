import { BirdeyeAdapter, type BirdeyeAdapterConfig } from "./birdeye-adapter.js";
import type { ProviderResult, TrendingToken } from "../types.js";

export class BirdeyeMarketService {
  private readonly adapter: BirdeyeAdapter;

  constructor(config: Partial<BirdeyeAdapterConfig> = {}) {
    this.adapter = new BirdeyeAdapter(config);
  }

  async getTrendingTokens(
    limit = 10,
    chain?: string,
  ): Promise<ProviderResult<TrendingToken[]>> {
    return this.adapter.getTrendingTokens(limit, chain);
  }
}
