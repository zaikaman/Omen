import { z } from "zod";

import {
  assetNarrativeSchema,
  createProviderFailure,
  createProviderSuccess,
  type AssetNarrative,
  type ProviderResult,
} from "../types.js";

export const newsAdapterConfigSchema = z.object({
  baseUrl: z.string().url().default("https://api.tavily.example"),
  apiKey: z.string().min(1).optional(),
  requestTimeoutMs: z.number().int().min(1).default(10_000),
});

export const newsSearchInputSchema = z.object({
  query: z.string().min(1),
  symbol: z.string().min(1).optional(),
});

export type NewsAdapterConfig = z.infer<typeof newsAdapterConfigSchema>;
export type NewsSearchInput = z.infer<typeof newsSearchInputSchema>;

export class NewsAdapter {
  private readonly config: NewsAdapterConfig;

  constructor(config: Partial<NewsAdapterConfig> = {}) {
    this.config = newsAdapterConfigSchema.parse(config);
  }

  async searchNarratives(
    input: z.input<typeof newsSearchInputSchema>,
  ): Promise<ProviderResult<AssetNarrative[]>> {
    const parsed = newsSearchInputSchema.parse(input);

    if (!parsed.query.trim()) {
      return createProviderFailure({
        provider: "news",
        code: "NEWS_INVALID_QUERY",
        message: "A query is required for narrative research.",
        retryable: false,
      });
    }

    const narrative = assetNarrativeSchema.parse({
      symbol: parsed.symbol?.toUpperCase() ?? "MARKET",
      title: `Narrative placeholder for ${parsed.query}`,
      summary:
        "Research adapter shell is ready. Real search-backed narrative retrieval lands in the service phase.",
      sentiment: "neutral",
      source: "news",
      sourceUrl: null,
      capturedAt: new Date().toISOString(),
    });

    return createProviderSuccess({
      provider: "news",
      value: [narrative],
      notes: [
        `Adapter shell initialized for ${this.config.baseUrl}; real Tavily-style research integration lands in the service phase.`,
      ],
    });
  }
}
