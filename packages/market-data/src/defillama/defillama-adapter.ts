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

    const result = await this.requestProtocol(normalized);

    if (!result.ok) {
      return createProviderFailure({
        provider: "defillama",
        code: "DEFILLAMA_PROTOCOL_REQUEST_FAILED",
        message: result.error.message,
        retryable: true,
        sourceStatus: result.status,
      });
    }

    return createProviderSuccess({
      provider: "defillama",
      value: protocolSnapshotSchema.parse({
        protocol: String(result.value.name ?? normalized),
        chain: this.resolveChain(result.value),
        tvlUsd: this.parseNumber(result.value.tvl),
        tvlChange1dPercent: this.parseNullableNumber(result.value.change_1d),
        tvlChange7dPercent: this.parseNullableNumber(result.value.change_7d),
        category:
          typeof result.value.category === "string" ? result.value.category : null,
        sourceUrl: `${this.config.baseUrl.replace(/\/$/, "")}/protocol/${encodeURIComponent(normalized)}`,
        capturedAt: new Date().toISOString(),
      }),
      notes: [`Fetched live DeFiLlama protocol snapshot for ${normalized}.`],
    });
  }

  private resolveChain(payload: Record<string, unknown>) {
    if (typeof payload.chain === "string" && payload.chain.trim()) {
      return payload.chain;
    }

    if (Array.isArray(payload.chains) && payload.chains[0] && typeof payload.chains[0] === "string") {
      return payload.chains[0];
    }

    return "unknown";
  }

  private parseNumber(value: unknown) {
    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      throw new Error(`DeFiLlama returned a non-numeric value: ${String(value)}`);
    }

    return parsed;
  }

  private parseNullableNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private async requestProtocol(protocol: string): Promise<
    | { ok: true; value: Record<string, unknown>; status: number }
    | { ok: false; error: Error; status: number | null }
  > {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    try {
      const response = await fetch(
        `${this.config.baseUrl.replace(/\/$/, "")}/protocol/${encodeURIComponent(protocol)}`,
        {
          method: "GET",
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        return {
          ok: false,
          error: new Error(`DeFiLlama request failed with HTTP ${response.status.toString()}.`),
          status: response.status,
        };
      }

      const payload = (await response.json()) as unknown;

      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return {
          ok: false,
          error: new Error("DeFiLlama returned a non-object JSON payload."),
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
          error instanceof Error ? error : new Error("DeFiLlama request failed."),
        status: null,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
