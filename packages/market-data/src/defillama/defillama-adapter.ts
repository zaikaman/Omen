import { z } from "zod";

import {
  createProviderFailure,
  createProviderSuccess,
  defiChainSnapshotSchema,
  defiProtocolStatSchema,
  defiYieldPoolSchema,
  protocolSnapshotSchema,
  type DefiChainSnapshot,
  type DefiProtocolStat,
  type DefiYieldPool,
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
        tvlUsd: this.parseProtocolTvlUsd(result.value),
        tvlChange1dPercent:
          this.parseNullableNumber(result.value.change_1d) ??
          this.parseTvlSeriesChangePercent(result.value.tvl, 1),
        tvlChange7dPercent:
          this.parseNullableNumber(result.value.change_7d) ??
          this.parseTvlSeriesChangePercent(result.value.tvl, 7),
        category: typeof result.value.category === "string" ? result.value.category : null,
        sourceUrl: `https://defillama.com/protocol/${encodeURIComponent(normalized)}`,
        capturedAt: new Date().toISOString(),
      }),
      notes: [`Fetched live DeFiLlama protocol snapshot for ${normalized}.`],
    });
  }

  async getGlobalTVL(limit = 5): Promise<ProviderResult<DefiChainSnapshot[]>> {
    const result = await this.requestJson("/v2/chains", this.config.baseUrl);

    if (!result.ok) {
      return createProviderFailure({
        provider: "defillama",
        code: "DEFILLAMA_CHAINS_REQUEST_FAILED",
        message: result.error.message,
        retryable: true,
        sourceStatus: result.status,
      });
    }

    const chains = Array.isArray(result.value)
      ? result.value.filter(
          (entry): entry is Record<string, unknown> =>
            !!entry && typeof entry === "object" && !Array.isArray(entry),
        )
      : [];

    return createProviderSuccess({
      provider: "defillama",
      value: chains
        .sort((left, right) => this.parseNumber(right.tvl) - this.parseNumber(left.tvl))
        .slice(0, limit)
        .map((chain) =>
          defiChainSnapshotSchema.parse({
            name: String(chain.name ?? "unknown"),
            tvlUsd: this.parseNumber(chain.tvl),
            tokenSymbol:
              typeof chain.tokenSymbol === "string" && chain.tokenSymbol.trim()
                ? chain.tokenSymbol
                : null,
            capturedAt: new Date().toISOString(),
          }),
        ),
      notes: ["Fetched DeFiLlama global TVL chains."],
    });
  }

  async getProtocolStats(limit = 5): Promise<ProviderResult<DefiProtocolStat[]>> {
    const result = await this.requestJson("/protocols", this.config.baseUrl);

    if (!result.ok) {
      return createProviderFailure({
        provider: "defillama",
        code: "DEFILLAMA_PROTOCOLS_REQUEST_FAILED",
        message: result.error.message,
        retryable: true,
        sourceStatus: result.status,
      });
    }

    const protocols = Array.isArray(result.value)
      ? result.value.filter(
          (entry): entry is Record<string, unknown> =>
            !!entry && typeof entry === "object" && !Array.isArray(entry),
        )
      : [];

    return createProviderSuccess({
      provider: "defillama",
      value: protocols
        .filter((protocol) => this.parseNullableNumber(protocol.tvl) !== null)
        .filter((protocol) => (this.parseNullableNumber(protocol.tvl) ?? 0) > 1_000_000)
        .sort(
          (left, right) =>
            (this.parseNullableNumber(right.change_1d) ?? -Infinity) -
            (this.parseNullableNumber(left.change_1d) ?? -Infinity),
        )
        .slice(0, limit)
        .map((protocol) =>
          defiProtocolStatSchema.parse({
            name: String(protocol.name ?? "unknown"),
            symbol:
              typeof protocol.symbol === "string" && protocol.symbol.trim()
                ? protocol.symbol
                : null,
            chain:
              typeof protocol.chain === "string" && protocol.chain.trim() ? protocol.chain : null,
            tvlUsd: this.parseNumber(protocol.tvl),
            tvlChange1dPercent: this.parseNullableNumber(protocol.change_1d),
            category:
              typeof protocol.category === "string" && protocol.category.trim()
                ? protocol.category
                : null,
            capturedAt: new Date().toISOString(),
          }),
        ),
      notes: ["Fetched DeFiLlama top-growing protocol stats."],
    });
  }

  async getYieldPools(limit = 50): Promise<ProviderResult<DefiYieldPool[]>> {
    const result = await this.requestJson("/pools", "https://yields.llama.fi");

    if (!result.ok) {
      return createProviderFailure({
        provider: "defillama",
        code: "DEFILLAMA_YIELDS_REQUEST_FAILED",
        message: result.error.message,
        retryable: true,
        sourceStatus: result.status,
      });
    }

    const data =
      result.value && typeof result.value === "object" && !Array.isArray(result.value)
        ? (result.value as Record<string, unknown>).data
        : null;
    const pools = Array.isArray(data)
      ? data.filter(
          (entry): entry is Record<string, unknown> =>
            !!entry && typeof entry === "object" && !Array.isArray(entry),
        )
      : [];

    return createProviderSuccess({
      provider: "defillama",
      value: pools
        .filter((pool) => (this.parseNullableNumber(pool.tvlUsd) ?? 0) > 500_000)
        .filter((pool) => {
          const apy = this.parseNullableNumber(pool.apy);
          return apy !== null && apy > 10 && apy < 5_000;
        })
        .sort(
          (left, right) =>
            (this.parseNullableNumber(right.apy) ?? -Infinity) -
            (this.parseNullableNumber(left.apy) ?? -Infinity),
        )
        .slice(0, limit)
        .map((pool) =>
          defiYieldPoolSchema.parse({
            chain: String(pool.chain ?? "unknown"),
            project: String(pool.project ?? "unknown"),
            symbol: String(pool.symbol ?? "unknown"),
            tvlUsd: this.parseNumber(pool.tvlUsd),
            apy: this.parseNumber(pool.apy),
            poolId: String(pool.pool ?? "unknown"),
            sourceUrl:
              typeof pool.pool === "string"
                ? `https://defillama.com/yields/pool/${encodeURIComponent(pool.pool)}`
                : null,
            capturedAt: new Date().toISOString(),
          }),
        ),
      notes: ["Fetched DeFiLlama yield pools."],
    });
  }

  private resolveChain(payload: Record<string, unknown>) {
    if (typeof payload.chain === "string" && payload.chain.trim()) {
      return payload.chain;
    }

    if (
      Array.isArray(payload.chains) &&
      payload.chains[0] &&
      typeof payload.chains[0] === "string"
    ) {
      return payload.chains[0];
    }

    const currentChainTvls =
      payload.currentChainTvls &&
      typeof payload.currentChainTvls === "object" &&
      !Array.isArray(payload.currentChainTvls)
        ? (payload.currentChainTvls as Record<string, unknown>)
        : null;

    if (currentChainTvls) {
      const topChain = Object.entries(currentChainTvls)
        .filter(
          ([chain]) => !chain.includes("-") && !["borrowed", "pool2", "staking"].includes(chain),
        )
        .map(([chain, tvl]) => ({ chain, tvl: this.parseNullableNumber(tvl) }))
        .filter((entry): entry is { chain: string; tvl: number } => entry.tvl !== null)
        .sort((left, right) => right.tvl - left.tvl)[0];

      if (topChain) {
        return topChain.chain;
      }
    }

    return "unknown";
  }

  private parseProtocolTvlUsd(payload: Record<string, unknown>) {
    const scalarTvl = this.parseNullableNumber(payload.tvl);

    if (scalarTvl !== null) {
      return scalarTvl;
    }

    const latestPoint = this.resolveLatestTvlPoint(payload.tvl);

    if (latestPoint !== null) {
      return latestPoint;
    }

    throw new Error("DeFiLlama protocol payload did not include a numeric TVL.");
  }

  private parseTvlSeriesChangePercent(value: unknown, daysBack: number) {
    if (!Array.isArray(value)) {
      return null;
    }

    const points = value
      .map((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          return null;
        }

        const record = entry as Record<string, unknown>;
        const tvl = this.parseNullableNumber(record.totalLiquidityUSD);

        if (tvl === null) {
          return null;
        }

        return {
          date: this.parseNullableNumber(record.date),
          tvl,
        };
      })
      .filter((point): point is { date: number | null; tvl: number } => point !== null)
      .sort((left, right) => (left.date ?? 0) - (right.date ?? 0));

    const latest = points.at(-1);
    const previous = points.at(-(daysBack + 1));

    if (!latest || !previous || previous.tvl === 0) {
      return null;
    }

    return ((latest.tvl - previous.tvl) / previous.tvl) * 100;
  }

  private resolveLatestTvlPoint(value: unknown) {
    if (!Array.isArray(value)) {
      return null;
    }

    for (let index = value.length - 1; index >= 0; index -= 1) {
      const entry = value[index];

      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        continue;
      }

      const tvl = this.parseNullableNumber((entry as Record<string, unknown>).totalLiquidityUSD);

      if (tvl !== null) {
        return tvl;
      }
    }

    return null;
  }

  private parseNumber(value: unknown) {
    const latestPoint = this.resolveLatestTvlPoint(value);

    if (latestPoint !== null) {
      return latestPoint;
    }

    const parsed = Number(value);

    if (!Number.isFinite(parsed)) {
      throw new Error(
        `DeFiLlama returned a non-numeric value: ${this.describeNumericValue(value)}`,
      );
    }

    return parsed;
  }

  private parseNullableNumber(value: unknown) {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private describeNumericValue(value: unknown) {
    if (Array.isArray(value)) {
      return `array(${value.length.toString()})`;
    }

    if (value && typeof value === "object") {
      return "object";
    }

    return String(value);
  }

  private async requestProtocol(
    protocol: string,
  ): Promise<
    | { ok: true; value: Record<string, unknown>; status: number }
    | { ok: false; error: Error; status: number | null }
  > {
    const result = await this.requestJson(
      `/protocol/${encodeURIComponent(protocol)}`,
      this.config.baseUrl,
    );

    if (!result.ok) {
      return result;
    }

    if (Array.isArray(result.value)) {
      return {
        ok: false,
        error: new Error("DeFiLlama returned an array payload for a protocol request."),
        status: result.status,
      };
    }

    return {
      ok: true,
      value: result.value,
      status: result.status,
    };
  }

  private async requestJson(
    path: string,
    baseUrl: string,
  ): Promise<
    | { ok: true; value: Record<string, unknown> | unknown[]; status: number }
    | { ok: false; error: Error; status: number | null }
  > {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          ok: false,
          error: new Error(`DeFiLlama request failed with HTTP ${response.status.toString()}.`),
          status: response.status,
        };
      }

      const payload = (await response.json()) as unknown;

      if (!payload || typeof payload !== "object") {
        return {
          ok: false,
          error: new Error("DeFiLlama returned an invalid JSON payload."),
          status: response.status,
        };
      }

      return {
        ok: true,
        value: payload as Record<string, unknown> | unknown[],
        status: response.status,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error("DeFiLlama request failed."),
        status: null,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
