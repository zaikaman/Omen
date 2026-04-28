import { z } from "zod";

import {
  DefiLlamaAdapter,
  type DefiLlamaAdapterConfig,
} from "./defillama-adapter.js";
import {
  createProviderFailure,
  createProviderSuccess,
  type DefiChainSnapshot,
  type DefiProtocolStat,
  type DefiYieldPool,
  type ProtocolSnapshot,
  type ProviderResult,
} from "../types.js";

export const defiLlamaProtocolsRequestSchema = z.object({
  protocols: z.array(z.string().min(1)).min(1),
});

export class DefiLlamaMarketService {
  private readonly adapter: DefiLlamaAdapter;

  constructor(config: Partial<DefiLlamaAdapterConfig> = {}) {
    this.adapter = new DefiLlamaAdapter(config);
  }

  async getProtocolSnapshot(
    protocol: string,
  ): Promise<ProviderResult<ProtocolSnapshot>> {
    return this.adapter.getProtocolSnapshot(protocol);
  }

  async getProtocolSnapshots(
    protocols: string[],
  ): Promise<ProviderResult<ProtocolSnapshot[]>> {
    const parsed = defiLlamaProtocolsRequestSchema.parse({ protocols });
    const results = await Promise.all(
      parsed.protocols.map((protocol) => this.adapter.getProtocolSnapshot(protocol)),
    );
    const snapshots: ProtocolSnapshot[] = [];

    for (const result of results) {
      if (!result.ok) {
        return createProviderFailure({
          provider: "defillama",
          code: "DEFILLAMA_PROTOCOL_BATCH_FAILED",
          message: `Failed to fetch DeFiLlama protocol snapshots in the requested batch: ${result.error.message}`,
          retryable: result.error.retryable,
        });
      }

      snapshots.push(result.value);
    }

    return createProviderSuccess({
      provider: "defillama",
      value: snapshots,
      notes: [`Prepared ${snapshots.length.toString()} DeFiLlama protocol snapshots.`],
    });
  }

  async getProtocolLeaderboard(
    protocols: string[],
  ): Promise<ProviderResult<ProtocolSnapshot[]>> {
    const snapshots = await this.getProtocolSnapshots(protocols);

    if (!snapshots.ok) {
      return snapshots;
    }

    return createProviderSuccess({
      provider: "defillama",
      value: [...snapshots.value].sort((left, right) => right.tvlUsd - left.tvlUsd),
      notes: ["Prepared DeFiLlama protocol leaderboard ordered by TVL."],
    });
  }

  async getGlobalTVL(limit = 5): Promise<ProviderResult<DefiChainSnapshot[]>> {
    return this.adapter.getGlobalTVL(limit);
  }

  async getProtocolStats(limit = 5): Promise<ProviderResult<DefiProtocolStat[]>> {
    return this.adapter.getProtocolStats(limit);
  }

  async getYieldPools(limit = 50): Promise<ProviderResult<DefiYieldPool[]>> {
    return this.adapter.getYieldPools(limit);
  }
}
