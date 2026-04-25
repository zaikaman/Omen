import { z } from "zod";

import {
  createProviderFailure,
  createProviderSuccess,
  protocolSnapshotSchema,
  type ProtocolSnapshot,
  type ProviderResult,
} from "../types.js";

export const defiLlamaAdapterConfigSchema = z.object({
  baseUrl: z.string().url().default("https://api.llama.fi"),
  requestTimeoutMs: z.number().int().min(1).default(10_000),
});

export type DefiLlamaAdapterConfig = z.infer<typeof defiLlamaAdapterConfigSchema>;

export class DefiLlamaAdapter {
  private readonly config: DefiLlamaAdapterConfig;

  constructor(config: Partial<DefiLlamaAdapterConfig> = {}) {
    this.config = defiLlamaAdapterConfigSchema.parse(config);
  }

  async getProtocolSnapshot(protocol: string): Promise<ProviderResult<ProtocolSnapshot>> {
    const normalized = protocol.trim();

    if (!normalized) {
      return createProviderFailure({
        provider: "defillama",
        code: "DEFILLAMA_INVALID_PROTOCOL",
        message: "A protocol identifier is required for DeFiLlama snapshots.",
        retryable: false,
      });
    }

    return createProviderSuccess({
      provider: "defillama",
      value: protocolSnapshotSchema.parse({
        protocol: normalized,
        chain: "unknown",
        tvlUsd: 0,
        tvlChange1dPercent: null,
        tvlChange7dPercent: null,
        category: null,
        sourceUrl: null,
        capturedAt: new Date().toISOString(),
      }),
      notes: [
        `Adapter shell initialized for ${this.config.baseUrl}; protocol TVL and narrative enrichment land in the service phase.`,
      ],
    });
  }
}
