import type { z } from "zod";
import { z as zod } from "zod";
import {
  BirdeyeMarketService,
  CoinGeckoMarketService,
  DefiLlamaMarketService,
  type DefiChainSnapshot,
  type DefiProtocolStat,
  type DefiYieldPool,
  type MarketSnapshot,
  type TrendingToken,
} from "@omen/market-data";

import { intelInputSchema, intelOutputSchema } from "../contracts/intel.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import {
  type EvidenceItem,
  type IntelReport,
  type RecentIntelHistoryItem,
  type RecentPostContextItem,
  type SwarmState,
} from "../framework/state.js";
import { OpenAiCompatibleJsonClient } from "../llm/openai-compatible-client.js";
import { resolveModelProfileForRole } from "../llm/model-routing.js";
import { buildIntelSystemPrompt } from "../prompts/intel/system.js";

const intelAgentOptionsSchema = zod.object({
  llmClient: zod.custom<OpenAiCompatibleJsonClient>().nullable().optional(),
  coinGecko: zod.custom<CoinGeckoMarketService>().optional(),
  birdeye: zod.custom<BirdeyeMarketService>().optional(),
  defiLlama: zod.custom<DefiLlamaMarketService>().optional(),
});

const normalizeImportanceScore = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return value;
  }

  const normalized = value > 10 ? value / 10 : value;

  return Math.min(10, Math.max(1, Math.round(normalized)));
};

type TemplateIntel = {
  topic: string;
  insight: string;
  importance_score: number;
};

const templateIntelSchema: zod.ZodType<TemplateIntel, zod.ZodTypeDef, unknown> = zod.object({
  topic: zod.string().min(1),
  insight: zod.string().min(1),
  importance_score: zod.preprocess(normalizeImportanceScore, zod.number().int().min(1).max(10)),
});

const lowSignalNarrativePatterns = [
  /\bcrypto news\b/i,
  /\bprice prediction\b/i,
  /\bbest crypto to buy\b/i,
  /\bpresale\b/i,
  /\bico\b/i,
  /\bannounces investment growth\b/i,
  /\bmassive accumulation pepeto\b/i,
  /\bpepeto\b/i,
  /\bsponsored\b/i,
  /\bpress release\b/i,
];

const trimToLength = (value: string, maxLength: number) => {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const trimmed = normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd();
  const boundary = Math.max(trimmed.lastIndexOf("."), trimmed.lastIndexOf(";"));

  if (boundary >= Math.floor(maxLength * 0.55)) {
    return trimmed.slice(0, boundary + 1);
  }

  const wordBoundary = trimmed.lastIndexOf(" ");
  return `${trimmed.slice(0, wordBoundary > 0 ? wordBoundary : trimmed.length).trimEnd()}...`;
};

const stripIntelBoilerplate = (value: string) =>
  value
    .replace(/fresh market intelligence scan found a context worth tracking\.?\s*/gi, "")
    .replace(/no actionable trade cleared the threshold,\s*/gi, "")
    .replace(/but the market context may still be worth tracking\.?\s*/gi, "")
    .replace(/\bmarket market intel\b/gi, "crypto market intel")
    .replace(/\s+/g, " ")
    .trim();

const isLowSignalNarrativeText = (value: string) =>
  lowSignalNarrativePatterns.some((pattern) => pattern.test(value));

const isGenericIntelTopic = (topic: string) => {
  const normalized = topic.trim().toLowerCase();

  return (
    normalized === "coingecko trending tokens" ||
    normalized === "birdeye trending tokens" ||
    normalized === "top watched movers" ||
    normalized === "coingecko top gainers" ||
    normalized === "defillama top chain tvl" ||
    normalized === "crypto news" ||
    normalized === "market update" ||
    normalized === "crypto market update" ||
    normalized === "crypto market intel" ||
    normalized.length < 8
  );
};

const isIntelOwnedEvidence = (item: EvidenceItem) =>
  item.structuredData.source === "intel-market-data" ||
  item.structuredData.source === "intel-research";

const toTemplateEvidence = (evidence: EvidenceItem[]) =>
  evidence.filter((item) => isIntelOwnedEvidence(item));

const extractSymbols = (text: string) => [
  ...new Set(
    [
      ...text.matchAll(/\$([A-Za-z][A-Za-z0-9_]{1,9})\b/g),
      ...text.matchAll(/\(([A-Z][A-Z0-9_]{1,9})\)/g),
      ...text.matchAll(/\b(BTC|ETH|SOL|SUI|ZEC|DASH|ZEN|MON|HYPE|XPL|AAVE|TAO|DOGE|XRP|BNB)\b/g),
    ]
      .map((match) => match[1])
      .map((symbol) => symbol.toUpperCase())
      .filter((symbol) => symbol !== "MARKET" && symbol !== "MACRO"),
  ),
];

const escapePromptRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceImagePromptSymbolMentions = (value: string, symbols: readonly string[]) =>
  symbols.reduce(
    (result, symbol) =>
      result.replace(
        new RegExp(`\\$?\\b${escapePromptRegExp(symbol.replace(/^\$/, ""))}\\b`, "gi"),
        "an unmarked digital asset",
      ),
    value,
  );

const titleFromTopic = (topic: string) =>
  stripIntelBoilerplate(topic)
    .replace(/^skip$/i, "SKIP")
    .trim();

const templateIntelToReport = (input: {
  template: z.infer<typeof templateIntelSchema>;
  evidence: EvidenceItem[];
}): IntelReport | null => {
  const topic = titleFromTopic(input.template.topic);
  const insight = stripIntelBoilerplate(input.template.insight);

  if (
    /^skip$/i.test(topic) ||
    isGenericIntelTopic(topic) ||
    isLowSignalNarrativeText(`${topic} ${insight}`) ||
    /not enough value/i.test(insight) ||
    input.template.importance_score < 7
  ) {
    return null;
  }

  const symbols = extractSymbols(`${topic} ${insight}`);
  const title = topic.length > 0 ? topic : "Crypto Market Rotation";
  const category =
    symbols.length > 1 ? "narrative_shift" : symbols.length === 1 ? "token_watch" : "market_update";

  return {
    topic: title,
    insight,
    importanceScore: input.template.importance_score,
    category,
    title,
    summary: trimToLength(insight, 360),
    confidence: Math.min(95, Math.max(60, input.template.importance_score * 10)),
    symbols,
    imagePrompt: [
      "strictly visual-only full-bleed scene with no title card, no banner, no header strip, no lower third, no text panel, no article layout, no news card, no readable or pseudo-readable text",
      "single cinematic visual-only market-intelligence scene, not a poster, not an infographic, not a presentation slide, not a webpage, not an article thumbnail",
      "relevant, distinct, creative visual metaphor; vary the setting, subject, scale, materials, lighting, camera angle, and mood for each report; suitable styles include cinematic realism, surreal physical scenes, speculative architecture, macro material studies, symbolic environments, industrial systems, orbital scenes, underwater scenes, landscapes, or other fitting non-textual imagery",
      `depict ${replaceImagePromptSymbolMentions(title, symbols)
        .replace(/\$[A-Za-z0-9_]+/g, "an unmarked digital asset")
        .toLowerCase()} as visual metaphor only`,
      `the scene should be driven by ${trimToLength(replaceImagePromptSymbolMentions(insight, symbols).replace(/\$[A-Za-z0-9_]+/g, "an unmarked digital asset"), 180).toLowerCase()}`,
      symbols.length > 0
        ? "depict the specific named-asset thesis as a visual story with unmarked competing forces, changing momentum, capital rotation, and risk/attention pressure matching the report"
        : "depict the specific market thesis through macro pressure, liquidity depth, narrative attention, and risk rotation matching the report",
      symbols.length > 0
        ? "represent the tracked crypto assets as separate unmarked forces, materials, structures, weather systems, vessels, energy sources, or ecosystems; make them visually distinguishable without symbols or writing"
        : "represent broad crypto market narrative through institutional liquidity, macro pressure, social attention, risk rotation, and tension between buyers and sellers without symbols or writing",
      "avoid defaulting to a neon trading-room, holographic chart, dashboard wall, or generic light-trail market grid; pick a fresh composition tied to this report",
      "realistic lighting, strong depth, clear focal subject, sharp composition, 16:9",
      "no words, no letters, no numbers, no captions, no labels, no logos, no brand marks, no watermarks, no signatures, no ticker symbols, no charts with axes or legends, no dashboard UI, no screens, no monitors, no terminal windows, no documents, no posters, no signs, no coins with markings",
    ].join(", "),
  };
};

const formatSignedPercent = (value: number | null) =>
  value === null ? "n/a" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;

const topTrendingSymbols = (tokens: TrendingToken[], limit: number) =>
  tokens
    .slice(0, limit)
    .map(
      (token) =>
        `${token.symbol.toUpperCase()}${token.rank === null ? "" : ` rank ${token.rank.toString()}`}`,
    )
    .join("; ");

const topMoversSummary = (snapshots: MarketSnapshot[], limit: number) =>
  snapshots
    .slice(0, limit)
    .map(
      (snapshot) =>
        `${snapshot.symbol.toUpperCase()} ${formatSignedPercent(snapshot.change24hPercent)}`,
    )
    .join("; ");

const protocolStatsSummary = (protocols: DefiProtocolStat[], limit: number) =>
  protocols
    .slice(0, limit)
    .map(
      (protocol) =>
        `${protocol.name}${protocol.chain ? ` on ${protocol.chain}` : ""} TVL $${Math.round(protocol.tvlUsd).toLocaleString("en-US")} 1d ${formatSignedPercent(protocol.tvlChange1dPercent)}`,
    )
    .join("; ");

const yieldPoolsSummary = (pools: DefiYieldPool[], limit: number) =>
  pools
    .slice(0, limit)
    .map(
      (pool) =>
        `${pool.project} ${pool.symbol} on ${pool.chain} APY ${pool.apy.toFixed(2)}% TVL $${Math.round(pool.tvlUsd).toLocaleString("en-US")}`,
    )
    .join("; ");

const chainTvlSummary = (chains: DefiChainSnapshot[], limit: number) =>
  chains
    .slice(0, limit)
    .map((chain) => `${chain.name} TVL $${Math.round(chain.tvlUsd).toLocaleString("en-US")}`)
    .join("; ");

const buildTemplateMarketData = (evidence: EvidenceItem[]) => {
  const findItems = (provider: string, kind: string) =>
    evidence
      .filter(
        (item) =>
          item.structuredData.source === "intel-market-data" &&
          item.structuredData.provider === provider &&
          item.structuredData.kind === kind,
      )
      .flatMap((item) =>
        Array.isArray(item.structuredData.items) ? item.structuredData.items : [],
      );

  return {
    global_market_context: {
      bitcoin:
        findItems("coingecko", "global_market_context").find(
          (item) =>
            typeof item === "object" && item !== null && "symbol" in item && item.symbol === "BTC",
        ) ?? null,
    },
    trending_coingecko: findItems("coingecko", "trending"),
    trending_birdeye: findItems("birdeye", "trending"),
    top_gainers: findItems("coingecko", "top_movers"),
    defi_tvl_top_chains: findItems("defillama", "chain_tvl"),
    defi_top_growing_protocols: findItems("defillama", "protocol_stats"),
  };
};

const buildTemplateIntelUserPrompt = (input: {
  marketData: ReturnType<typeof buildTemplateMarketData>;
  recentPosts: RecentPostContextItem[];
  recentHistory: RecentIntelHistoryItem[];
}) => {
  const recentPosts = input.recentPosts
    .filter((post) => post.kind === "intel_summary" && post.status === "posted")
    .slice(0, 10)
    .map((post) => ({
      kind: post.kind,
      text: post.text,
      status: post.status,
      publishedUrl: post.publishedUrl,
      signalId: post.signalId,
      intelId: post.intelId,
      timestamp: post.timestamp,
    }));
  const recentTopics = input.recentHistory
    .slice(0, 5)
    .map((item) => item.title || item.topic)
    .filter((topic) => topic.trim().length > 0);

  return [
    `Analyze this market data and generate an intel report: ${JSON.stringify(input.marketData, null, 2)}`,
    "",
    "RECENTLY POSTED CONTENT (Avoid repeating these):",
    JSON.stringify(recentPosts, null, 2),
    "",
    `AVOID these recently covered topics: ${recentTopics.join(", ")}`,
  ].join("\n");
};

const buildSearchOnlyIntelRetryPrompt = (input: {
  recentPosts: RecentPostContextItem[];
  recentHistory: RecentIntelHistoryItem[];
}) => {
  const recentPosts = input.recentPosts
    .filter((post) => post.kind === "intel_summary" && post.status === "posted")
    .slice(0, 10)
    .map((post) => ({
      kind: post.kind,
      text: post.text,
      status: post.status,
      publishedUrl: post.publishedUrl,
      signalId: post.signalId,
      intelId: post.intelId,
      timestamp: post.timestamp,
    }));
  const recentTopics = input.recentHistory
    .slice(0, 5)
    .map((item) => item.title || item.topic)
    .filter((topic) => topic.trim().length > 0);

  return [
    "The previous intel pass returned SKIP / Not enough value. Treat that as an error for this run.",
    "",
    "Search X (Twitter) and the web directly for a current crypto market intel report.",
    "Prioritize recent posts or commentary from these accounts: WatcherGuru, agentcookiefun, DeFiTracer, cryptogoos, aantonop, AshCrypto, CryptoCred, Trader_XO, Pentosh1, JacobCryptoBury, danheld, maxkeiser, cryptorover, Cointelegraph, CryptoCobain.",
    "Find the strongest recent narrative, catalyst, liquidity shift, policy development, or market-structure point. Return the best available intel even if it is a watch item rather than a trade.",
    "",
    "RECENTLY POSTED CONTENT (Avoid repeating these):",
    JSON.stringify(recentPosts, null, 2),
    "",
    `AVOID these recently covered topics: ${recentTopics.join(", ")}`,
  ].join("\n");
};

export class IntelAgentFactory {
  private readonly coinGecko: CoinGeckoMarketService;

  private readonly birdeye: BirdeyeMarketService;

  private readonly defiLlama: DefiLlamaMarketService;

  private readonly llmClient: OpenAiCompatibleJsonClient | null;

  constructor(input: zod.input<typeof intelAgentOptionsSchema> = {}) {
    const parsed = intelAgentOptionsSchema.parse(input);
    this.coinGecko = parsed.coinGecko ?? new CoinGeckoMarketService();
    this.birdeye = parsed.birdeye ?? new BirdeyeMarketService();
    this.defiLlama = parsed.defiLlama ?? new DefiLlamaMarketService();
    this.llmClient =
      parsed.llmClient ?? OpenAiCompatibleJsonClient.fromEnv(resolveModelProfileForRole("intel"));
  }

  createDefinition(): RuntimeNodeDefinition<
    z.input<typeof intelInputSchema>,
    z.input<typeof intelOutputSchema>
  > {
    return {
      key: "intel-agent",
      role: "intel",
      inputSchema: intelInputSchema,
      outputSchema: intelOutputSchema,
      invoke: async (input, state) => this.generateIntel(input, state),
    };
  }

  private async generateIntel(input: z.input<typeof intelInputSchema>, state: SwarmState) {
    const parsed = await this.enrichInputWithIntelResearch(
      this.toTemplateStyleInput(intelInputSchema.parse(input)),
      state,
    );
    const templateEvidence = parsed.evidence;
    const prompt = buildIntelSystemPrompt({
      runId: parsed.context.runId,
      hasCandidates: false,
      hasThesis: false,
      reviewDecision: null,
    });

    if (this.llmClient === null) {
      throw new Error("Intel generation requires a configured LLM client.");
    }

    try {
      const marketData = buildTemplateMarketData(templateEvidence);
      const userPrompts = [
        buildTemplateIntelUserPrompt({
          marketData,
          recentPosts: parsed.recentPostContext,
          recentHistory: parsed.recentIntelHistory,
        }),
        buildSearchOnlyIntelRetryPrompt({
          recentPosts: parsed.recentPostContext,
          recentHistory: parsed.recentIntelHistory,
        }),
      ];
      let normalizedReport: IntelReport | null = null;

      for (const userPrompt of userPrompts) {
        const response = await this.llmClient.completeJson<TemplateIntel>({
          schema: templateIntelSchema,
          systemPrompt: prompt,
          userPrompt,
        });

        normalizedReport = templateIntelToReport({
          template: response,
          evidence: templateEvidence,
        });

        if (normalizedReport !== null) {
          break;
        }
      }

      if (normalizedReport !== null) {
        return intelOutputSchema.parse({
          report: normalizedReport,
          action: "ready",
          skipReason: null,
        });
      }

      return intelOutputSchema.parse({
        action: "skip",
        report: null,
        skipReason: "not_enough_value",
      });
    } catch (error) {
      throw new Error(
        `Intel generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private toTemplateStyleInput(
    input: z.infer<typeof intelInputSchema>,
  ): z.infer<typeof intelInputSchema> {
    return intelInputSchema.parse({
      ...input,
      candidates: [],
      evidence: toTemplateEvidence(input.evidence),
      chartVisionSummary: null,
      thesis: null,
      review: null,
    });
  }

  private async enrichInputWithIntelResearch(
    input: z.infer<typeof intelInputSchema>,
    state: SwarmState,
  ): Promise<z.infer<typeof intelInputSchema>> {
    const parsed = intelInputSchema.parse(input);

    if (parsed.evidence.some(isIntelOwnedEvidence)) {
      return parsed;
    }

    if (this.llmClient === null) {
      throw new Error("Intel research enrichment requires a configured LLM client.");
    }

    const evidence = await this.collectIntelMarketLeads(state);

    return intelInputSchema.parse({
      ...parsed,
      evidence,
    });
  }

  private async collectIntelMarketLeads(state: SwarmState): Promise<EvidenceItem[]> {
    const evidence: EvidenceItem[] = [];
    const append = (item: EvidenceItem) => {
      if (item.summary.trim().length > 0) {
        evidence.push(item);
      }
    };

    const [
      bitcoinContext,
      coinGeckoTrending,
      coinGeckoGainers,
      birdeyeTrending,
      defiProtocols,
      defiYields,
      defiChains,
    ] = await Promise.allSettled([
      state.config.providers.coinGecko.enabled
        ? this.coinGecko.getAssetSnapshot("BTC")
        : Promise.resolve(null),
      state.config.providers.coinGecko.enabled
        ? this.coinGecko.getTrending()
        : Promise.resolve(null),
      state.config.providers.coinGecko.enabled
        ? this.coinGecko.getTopGainersLosers(12)
        : Promise.resolve(null),
      this.birdeye.getTrendingTokens(10),
      state.config.providers.defiLlama.enabled
        ? this.defiLlama.getProtocolStats(8)
        : Promise.resolve(null),
      state.config.providers.defiLlama.enabled
        ? this.defiLlama.getYieldPools(12)
        : Promise.resolve(null),
      state.config.providers.defiLlama.enabled
        ? this.defiLlama.getGlobalTVL(6)
        : Promise.resolve(null),
    ]);

    if (bitcoinContext.status === "fulfilled" && bitcoinContext.value?.ok) {
      append({
        category: "market",
        summary: `Global market context from Bitcoin: BTC ${formatSignedPercent(bitcoinContext.value.value.change24hPercent)} over 24h with volume ${bitcoinContext.value.value.volume24h === null ? "n/a" : `$${Math.round(bitcoinContext.value.value.volume24h).toLocaleString("en-US")}`}.`,
        sourceLabel: "CoinGecko BTC market context",
        sourceUrl: "https://www.coingecko.com/en/coins/bitcoin",
        structuredData: {
          source: "intel-market-data",
          provider: "coingecko",
          kind: "global_market_context",
          symbols: ["BTC"],
          items: [
            {
              symbol: "BTC",
              price: bitcoinContext.value.value.price,
              change_24h: bitcoinContext.value.value.change24hPercent,
              volume24h: bitcoinContext.value.value.volume24h,
              capturedAt: bitcoinContext.value.value.capturedAt,
            },
          ],
        },
      });
    }

    if (coinGeckoTrending.status === "fulfilled" && coinGeckoTrending.value?.ok) {
      append({
        category: "sentiment",
        summary: `Market search lead from CoinGecko trending: ${topTrendingSymbols(coinGeckoTrending.value.value, 10)}. Use this only as a lead for X/web research, not as standalone intel.`,
        sourceLabel: "CoinGecko trending",
        sourceUrl: "https://www.coingecko.com/en/discover",
        structuredData: {
          source: "intel-market-data",
          provider: "coingecko",
          kind: "trending",
          symbols: coinGeckoTrending.value.value.map((token) => token.symbol.toUpperCase()),
          items: coinGeckoTrending.value.value.map((token) => ({
            name: token.name,
            symbol: token.symbol.toUpperCase(),
            rank: token.rank,
          })),
        },
      });
    }

    if (coinGeckoGainers.status === "fulfilled" && coinGeckoGainers.value?.ok) {
      append({
        category: "market",
        summary: `Market search lead from CoinGecko movers: ${topMoversSummary(coinGeckoGainers.value.value, 8)}. Confirm the narrative with high-signal X/web sources before writing intel.`,
        sourceLabel: "CoinGecko top movers",
        sourceUrl: "https://www.coingecko.com/en/crypto-gainers-losers",
        structuredData: {
          source: "intel-market-data",
          provider: "coingecko",
          kind: "top_movers",
          symbols: coinGeckoGainers.value.value.map((snapshot) => snapshot.symbol.toUpperCase()),
          items: coinGeckoGainers.value.value.map((snapshot) => ({
            symbol: snapshot.symbol.toUpperCase(),
            change_24h: snapshot.change24hPercent,
          })),
        },
      });
    }

    if (birdeyeTrending.status === "fulfilled" && birdeyeTrending.value?.ok) {
      append({
        category: "sentiment",
        summary: `Market search lead from Birdeye trending tokens: ${topTrendingSymbols(birdeyeTrending.value.value, 10)}. Use this only to guide X/web research.`,
        sourceLabel: "Birdeye trending",
        sourceUrl: "https://birdeye.so",
        structuredData: {
          source: "intel-market-data",
          provider: "birdeye",
          kind: "trending",
          symbols: birdeyeTrending.value.value.map((token) => token.symbol.toUpperCase()),
          items: birdeyeTrending.value.value.map((token) => ({
            name: token.name,
            symbol: token.symbol.toUpperCase(),
            rank: token.rank,
            volume24h: token.volume24h,
          })),
        },
      });
    }

    if (defiProtocols.status === "fulfilled" && defiProtocols.value?.ok) {
      append({
        category: "liquidity",
        summary: `DeFi search lead from protocol TVL changes: ${protocolStatsSummary(defiProtocols.value.value, 8)}. Connect this to high-signal account commentary before publishing.`,
        sourceLabel: "DeFiLlama protocol stats",
        sourceUrl: "https://defillama.com/protocols",
        structuredData: {
          source: "intel-market-data",
          provider: "defillama",
          kind: "protocol_stats",
          symbols: defiProtocols.value.value
            .map((protocol) => protocol.symbol?.toUpperCase())
            .filter((symbol): symbol is string => Boolean(symbol)),
          items: defiProtocols.value.value.map((protocol) => ({
            name: protocol.name,
            symbol: protocol.symbol?.toUpperCase() ?? null,
            chain: protocol.chain,
            tvlUsd: protocol.tvlUsd,
            tvlChange1dPercent: protocol.tvlChange1dPercent,
            category: protocol.category,
          })),
        },
      });
    }

    if (defiYields.status === "fulfilled" && defiYields.value?.ok) {
      append({
        category: "liquidity",
        summary: `DeFi search lead from yield pools: ${yieldPoolsSummary(defiYields.value.value, 8)}. Treat yields as a lead and verify the narrative externally.`,
        sourceLabel: "DeFiLlama yield pools",
        sourceUrl: "https://defillama.com/yields",
        structuredData: {
          source: "intel-market-data",
          provider: "defillama",
          kind: "yield_pools",
          symbols: defiYields.value.value.map((pool) => pool.symbol.toUpperCase()),
          items: defiYields.value.value.map((pool) => ({
            project: pool.project,
            symbol: pool.symbol.toUpperCase(),
            chain: pool.chain,
            apy: pool.apy,
            tvlUsd: pool.tvlUsd,
          })),
        },
      });
    }

    if (defiChains.status === "fulfilled" && defiChains.value?.ok) {
      append({
        category: "liquidity",
        summary: `DeFi search lead from chain TVL: ${chainTvlSummary(defiChains.value.value, 6)}. Use this only as context for live narrative research.`,
        sourceLabel: "DeFiLlama chain TVL",
        sourceUrl: "https://defillama.com/chains",
        structuredData: {
          source: "intel-market-data",
          provider: "defillama",
          kind: "chain_tvl",
          symbols: defiChains.value.value
            .map((chain) => chain.tokenSymbol?.toUpperCase())
            .filter((symbol): symbol is string => Boolean(symbol)),
          items: defiChains.value.value.map((chain) => ({
            name: chain.name,
            tvlUsd: chain.tvlUsd,
            tokenSymbol: chain.tokenSymbol?.toUpperCase() ?? null,
          })),
        },
      });
    }

    return evidence.slice(0, 6);
  }
}

export const createIntelAgent = (input: zod.input<typeof intelAgentOptionsSchema> = {}) =>
  new IntelAgentFactory(input).createDefinition();
