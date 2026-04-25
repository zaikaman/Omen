import { z } from "zod";

import {
  NewsAdapter,
  type NewsAdapterConfig,
  type NewsSearchInput,
} from "./news-adapter.js";
import {
  assetNarrativeSchema,
  createProviderFailure,
  createProviderSuccess,
  type AssetNarrative,
  type ProviderResult,
} from "../types.js";

export const macroContextRequestSchema = z.object({
  focus: z.string().min(1),
});

export class TavilyMarketResearchService {
  private readonly adapter: NewsAdapter;

  constructor(config: Partial<NewsAdapterConfig> = {}) {
    this.adapter = new NewsAdapter(config);
  }

  async getNarratives(
    input: NewsSearchInput,
  ): Promise<ProviderResult<AssetNarrative[]>> {
    return this.adapter.searchNarratives(input);
  }

  async getMacroContext(
    input: z.input<typeof macroContextRequestSchema>,
  ): Promise<ProviderResult<AssetNarrative[]>> {
    const parsed = macroContextRequestSchema.parse(input);
    const narratives = await this.adapter.searchNarratives({
      query: `${parsed.focus} macro context`,
      symbol: "MACRO",
    });

    if (!narratives.ok) {
      return narratives;
    }

    return createProviderSuccess({
      provider: "news",
      value: narratives.value.map((narrative, index) =>
        assetNarrativeSchema.parse({
          ...narrative,
          title:
            index === 0
              ? `Macro context for ${parsed.focus}`
              : narrative.title,
        }),
      ),
      notes: ["Prepared macro-context narrative bundle from the research adapter shell."],
    });
  }

  async getSymbolResearchBundle(input: {
    symbol: string;
    query: string;
  }): Promise<
    ProviderResult<{
      symbol: string;
      narratives: AssetNarrative[];
      macroContext: AssetNarrative[];
    }>
  > {
    const [narratives, macroContext] = await Promise.all([
      this.getNarratives({
        symbol: input.symbol,
        query: input.query,
      }),
      this.getMacroContext({
        focus: input.symbol,
      }),
    ]);

    if (!narratives.ok) {
      return createProviderFailure({
        provider: "news",
        code: "NEWS_NARRATIVE_BUNDLE_FAILED",
        message: narratives.error.message,
        retryable: narratives.error.retryable,
      });
    }

    if (!macroContext.ok) {
      return createProviderFailure({
        provider: "news",
        code: "NEWS_MACRO_CONTEXT_FAILED",
        message: macroContext.error.message,
        retryable: macroContext.error.retryable,
      });
    }

    return createProviderSuccess({
      provider: "news",
      value: {
        symbol: input.symbol.toUpperCase(),
        narratives: narratives.value,
        macroContext: macroContext.value,
      },
      notes: ["Prepared symbol research bundle with narrative and macro-context sections."],
    });
  }
}
