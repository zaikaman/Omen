import { z } from "zod";

import {
  createProviderFailure,
  createProviderSuccess,
  trendingTokenSchema,
  type ProviderResult,
  type TrendingToken,
} from "../types.js";
import { ApiKeyRotator, resolveNumberedApiKeys } from "../utils/api-key-rotator.js";

export const birdeyeAdapterConfigSchema = z.object({
  baseUrl: z.string().url().default("https://public-api.birdeye.so"),
  apiKey: z.string().min(1).optional(),
  apiKeys: z.array(z.string().min(1)).default([]),
  requestTimeoutMs: z.number().int().min(1).default(10_000),
});

export type BirdeyeAdapterConfig = z.infer<typeof birdeyeAdapterConfigSchema>;

export class BirdeyeAdapter {
  private readonly config: BirdeyeAdapterConfig;

  private readonly apiKeys: ApiKeyRotator;

  constructor(config: Partial<BirdeyeAdapterConfig> = {}) {
    this.config = birdeyeAdapterConfigSchema.parse({
      apiKey: config.apiKey ?? process.env.BIRDEYE_API_KEY,
      apiKeys: config.apiKeys ?? resolveNumberedApiKeys("BIRDEYE_API_KEY"),
      ...config,
    });
    this.apiKeys = new ApiKeyRotator([this.config.apiKey, ...this.config.apiKeys]);
  }

  async getTrendingTokens(
    limit = 10,
    chain?: string,
  ): Promise<ProviderResult<TrendingToken[]>> {
    const result = await this.requestJson("/defi/token_trending", {
      sort_by: "rank",
      sort_type: "asc",
      offset: "0",
      limit: limit.toString(),
    }, chain);

    if (!result.ok) {
      return createProviderFailure({
        provider: "birdeye",
        code: "BIRDEYE_TRENDING_REQUEST_FAILED",
        message: result.error.message,
        retryable: true,
        sourceStatus: result.status,
      });
    }

    const data =
      result.value && typeof result.value === "object" && !Array.isArray(result.value)
        ? (result.value as Record<string, unknown>).data
        : null;
    const tokens =
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      Array.isArray((data as Record<string, unknown>).tokens)
        ? ((data as Record<string, unknown>).tokens as unknown[]).filter(
            (entry): entry is Record<string, unknown> =>
              !!entry && typeof entry === "object" && !Array.isArray(entry),
          )
        : [];

    return createProviderSuccess({
      provider: "birdeye",
      value: tokens.map((token) =>
        trendingTokenSchema.parse({
          name: String(token.name ?? token.symbol ?? "unknown"),
          symbol: String(token.symbol ?? token.name ?? "UNKNOWN").toUpperCase(),
          rank: this.parseNullableNumber(token.rank),
          chain: typeof token.chain === "string" ? token.chain : chain ? this.mapChain(chain) : null,
          address: typeof token.address === "string" ? token.address : null,
          volume24h: this.parseNullableNumber(token.volume24hUSD ?? token.volume24h),
          source: "birdeye",
          capturedAt: new Date().toISOString(),
        }),
      ),
      notes: ["Fetched Birdeye trending tokens."],
    });
  }

  private mapChain(chain: string) {
    const mappings: Record<string, string> = {
      bnb: "bsc",
      binance: "bsc",
      "binance-smart-chain": "bsc",
      "arbitrum-one": "arbitrum",
      "polygon-pos": "polygon",
      "optimistic-ethereum": "optimism",
    };

    return mappings[chain.toLowerCase()] ?? chain.toLowerCase();
  }

  private parseNullableNumber(value: unknown) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private async requestJson(
    path: string,
    params: Record<string, string>,
    chain?: string,
  ): Promise<
    | { ok: true; value: unknown; status: number }
    | { ok: false; error: Error; status: number | null }
  > {
    const apiKey = this.apiKeys.next();
    if (!apiKey) {
      return {
        ok: false,
        error: new Error("Birdeye API key is required."),
        status: null,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    try {
      const url = new URL(path, this.config.baseUrl);
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "X-API-KEY": apiKey,
          ...(chain ? { "x-chain": this.mapChain(chain) } : {}),
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          ok: false,
          error: new Error(`Birdeye request failed with HTTP ${response.status.toString()}.`),
          status: response.status,
        };
      }

      return {
        ok: true,
        value: (await response.json()) as unknown,
        status: response.status,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error : new Error("Birdeye request failed."),
        status: null,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
