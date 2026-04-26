import { z } from "zod";

import {
  assetNarrativeSchema,
  createProviderFailure,
  createProviderSuccess,
  type AssetNarrative,
  type ProviderResult,
} from "../types.js";

export const newsAdapterConfigSchema = z.object({
  baseUrl: z.string().url().default("https://api.tavily.com"),
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
    this.config = newsAdapterConfigSchema.parse({
      apiKey: config.apiKey ?? process.env.TAVILY_API_KEY,
      ...config,
    });
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

    if (!this.config.apiKey) {
      return createProviderFailure({
        provider: "news",
        code: "NEWS_API_KEY_MISSING",
        message: "Tavily API key is required for live narrative research.",
        retryable: false,
      });
    }

    const result = await this.requestSearch(parsed);

    if (!result.ok) {
      return createProviderFailure({
        provider: "news",
        code: "NEWS_SEARCH_REQUEST_FAILED",
        message: result.error.message,
        retryable: true,
        sourceStatus: result.status,
      });
    }

    const results = Array.isArray(result.value.results)
      ? result.value.results.filter(
          (entry): entry is Record<string, unknown> =>
            !!entry && typeof entry === "object" && !Array.isArray(entry),
        )
      : [];

    const narratives = results.slice(0, 5).map((entry, index) =>
      assetNarrativeSchema.parse({
        symbol: parsed.symbol?.toUpperCase() ?? "MARKET",
        title:
          typeof entry.title === "string" && entry.title.trim()
            ? entry.title
            : `Narrative result ${index + 1}`,
        summary:
          typeof entry.content === "string" && entry.content.trim()
            ? entry.content
            : typeof entry.snippet === "string" && entry.snippet.trim()
              ? entry.snippet
              : `No summary returned for ${parsed.query}.`,
        sentiment: this.inferSentiment(
          `${String(entry.title ?? "")} ${String(entry.content ?? entry.snippet ?? "")}`,
        ),
        source:
          typeof entry.url === "string" && entry.url.includes("tavily")
            ? "tavily"
            : "news",
        sourceUrl: typeof entry.url === "string" && entry.url.startsWith("http") ? entry.url : null,
        capturedAt: new Date().toISOString(),
      }),
    );

    if (narratives.length === 0) {
      return createProviderFailure({
        provider: "news",
        code: "NEWS_NO_RESULTS",
        message: `No narrative results were returned for query "${parsed.query}".`,
        retryable: false,
        sourceStatus: 404,
      });
    }

    return createProviderSuccess({
      provider: "news",
      value: narratives,
      notes: [
        `Fetched ${narratives.length.toString()} Tavily narrative results for ${parsed.query}.`,
      ],
    });
  }

  private inferSentiment(text: string): AssetNarrative["sentiment"] {
    const normalized = text.toLowerCase();

    if (/(bullish|surge|breakout|strength|upside|positive)/i.test(normalized)) {
      return "bullish";
    }

    if (/(bearish|selloff|breakdown|weakness|downside|negative)/i.test(normalized)) {
      return "bearish";
    }

    return "neutral";
  }

  private async requestSearch(
    input: NewsSearchInput,
  ): Promise<
    | { ok: true; value: Record<string, unknown>; status: number }
    | { ok: false; error: Error; status: number | null }
  > {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);

    try {
      const response = await fetch(`${this.config.baseUrl.replace(/\/$/, "")}/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          api_key: this.config.apiKey,
          query: input.query,
          topic: "news",
          search_depth: "advanced",
          max_results: 5,
          include_answer: false,
          include_raw_content: false,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          ok: false,
          error: new Error(`Tavily request failed with HTTP ${response.status.toString()}.`),
          status: response.status,
        };
      }

      const payload = (await response.json()) as unknown;

      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return {
          ok: false,
          error: new Error("Tavily returned a non-object JSON payload."),
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
        error: error instanceof Error ? error : new Error("Tavily request failed."),
        status: null,
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
