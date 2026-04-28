import type { z } from "zod";
import { z as zod } from "zod";

import {
  BinanceMarketService,
  BirdeyeMarketService,
  CoinGeckoMarketService,
  CoinMarketCapMarketService,
  DefiLlamaMarketService,
} from "@omen/market-data";
import { getTradeableToken } from "@omen/shared";
import { intelInputSchema, intelOutputSchema } from "../contracts/intel.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import {
  type EvidenceItem,
  type IntelReport,
  type RecentIntelHistoryItem,
  type SwarmState,
} from "../framework/state.js";
import { OpenAiCompatibleJsonClient } from "../llm/openai-compatible-client.js";
import { resolveModelProfileForRole } from "../llm/model-routing.js";
import { buildIntelSystemPrompt } from "../prompts/intel/system.js";

const intelAgentOptionsSchema = zod.object({
  llmClient: zod.custom<OpenAiCompatibleJsonClient>().nullable().optional(),
  binance: zod.custom<BinanceMarketService>().optional(),
  birdeye: zod.custom<BirdeyeMarketService>().optional(),
  coinGecko: zod.custom<CoinGeckoMarketService>().optional(),
  coinMarketCap: zod.custom<CoinMarketCapMarketService>().optional(),
  defiLlama: zod.custom<DefiLlamaMarketService>().optional(),
});

const templateIntelSchema = zod.object({
  topic: zod.string().min(1),
  insight: zod.string().min(1),
  importance_score: zod.number().int().min(1).max(10),
});

const templateDefiProtocols = [
  "aave",
  "lido",
  "ethena",
  "pendle",
  "jito",
  "kamino",
  "hyperliquid",
  "uniswap",
  "curve-dex",
  "morpho-blue",
];

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

const rawProviderListPatterns = [
  /^coingecko trending tokens:/i,
  /^birdeye trending tokens:/i,
  /^top watched movers:/i,
  /^coingecko top gainers:/i,
  /^defillama top chain tvl:/i,
];

const narrativeCategoryLabels: Record<string, string> = {
  ai: "AI",
  defi: "DeFi",
  ecosystem: "ecosystem",
  gaming: "gaming",
  infrastructure: "infrastructure",
  layer2: "L2",
  major: "majors",
  meme: "meme",
  other: "altcoin",
};

const isRawProviderListEvidence = (item: EvidenceItem) =>
  rawProviderListPatterns.some((pattern) => pattern.test(item.summary.trim()));

const templateEvidenceRank = (item: EvidenceItem) => {
  if (item.structuredData.source === "intel-research") {
    return 0;
  }

  if (
    item.category === "catalyst" ||
    item.category === "fundamental" ||
    item.category === "liquidity"
  ) {
    return 1;
  }

  if (item.category === "sentiment" && !isRawProviderListEvidence(item)) {
    return 2;
  }

  if (item.category === "market") {
    return 3;
  }

  return isRawProviderListEvidence(item) ? 5 : 4;
};

const sortTemplateEvidence = (evidence: EvidenceItem[]) =>
  [...evidence].sort((left, right) => templateEvidenceRank(left) - templateEvidenceRank(right));

const summarizeEvidence = (evidence: EvidenceItem[]) =>
  sortTemplateEvidence(evidence)
    .slice(0, 4)
    .map((item) => item.summary.replace(/\s+/g, " ").trim())
    .join(" ");

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

const toTemplateEvidence = (
  evidence: EvidenceItem[],
  options: { includeDirectFixtures?: boolean } = {},
) =>
  evidence.filter(
    (item) =>
      isIntelOwnedEvidence(item) ||
      (options.includeDirectFixtures === true &&
        (item.category === "fundamental" ||
          item.category === "catalyst" ||
          item.category === "sentiment" ||
          item.category === "liquidity")),
  );

const extractSymbols = (evidence: EvidenceItem[]) => [
  ...new Set(
    evidence
      .flatMap((item) => {
        const symbol = item.structuredData.symbol;
        const symbols = item.structuredData.symbols;

        return [
          ...(typeof symbol === "string" ? [symbol] : []),
          ...(Array.isArray(symbols) ? symbols : []),
        ];
      })
      .filter((symbol): symbol is string => typeof symbol === "string" && symbol.length > 0)
      .map((symbol) => symbol.toUpperCase())
      .filter((symbol) => symbol !== "MARKET" && symbol !== "MACRO"),
  ),
];

const titleFromTopic = (topic: string) =>
  stripIntelBoilerplate(topic)
    .replace(/^skip$/i, "SKIP")
    .trim();

const toDollarSymbol = (symbol: string) => `$${symbol.replace(/^\$/, "").toUpperCase()}`;

const buildDominantNarrative = (symbols: string[]) => {
  const grouped = new Map<string, string[]>();

  for (const symbol of [...new Set(symbols.map((value) => value.toUpperCase()))]) {
    const category = getTradeableToken(symbol)?.category;

    if (!category || category === "other") {
      continue;
    }

    grouped.set(category, [...(grouped.get(category) ?? []), symbol]);
  }

  const [category, categorySymbols] =
    [...grouped.entries()].sort((left, right) => right[1].length - left[1].length)[0] ?? [];

  if (!category || !categorySymbols || categorySymbols.length < 2) {
    return null;
  }

  return {
    category,
    label: narrativeCategoryLabels[category] ?? category,
    symbols: categorySymbols.slice(0, 5),
  };
};

const buildNarrativeSynthesisEvidence = (input: {
  trendingSymbols: string[];
  gainerSymbols: string[];
  moverSymbols: string[];
}): EvidenceItem | null => {
  const narrative = buildDominantNarrative([
    ...input.trendingSymbols,
    ...input.gainerSymbols,
    ...input.moverSymbols,
  ]);

  if (narrative === null) {
    return null;
  }

  const gainerOverlap = input.gainerSymbols
    .map((symbol) => symbol.toUpperCase())
    .filter((symbol) => narrative.symbols.includes(symbol));
  const moverOverlap = input.moverSymbols
    .map((symbol) => symbol.toUpperCase())
    .filter((symbol) => narrative.symbols.includes(symbol));
  const liquidityText =
    gainerOverlap.length > 0 || moverOverlap.length > 0
      ? ` Liquidity confirmation is starting to show through ${[
          ...new Set([...gainerOverlap, ...moverOverlap]),
        ]
          .slice(0, 4)
          .map(toDollarSymbol)
          .join(", ")}.`
      : " Liquidity confirmation still needs follow-through.";

  return {
    category: "catalyst",
    summary: `${narrative.label} narrative attention is clustering around ${narrative.symbols
      .map(toDollarSymbol)
      .join(", ")} across live trend feeds.${liquidityText}`,
    sourceLabel: "Omen Intel Synthesis",
    sourceUrl: null,
    structuredData: {
      source: "intel-research",
      narrativeCategory: narrative.category,
      symbols: narrative.symbols,
      capturedAt: new Date().toISOString(),
    },
  };
};

const normalizeComparableText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const isWithinLastHours = (timestamp: string, hours: number) => {
  const parsed = Date.parse(timestamp);

  if (Number.isNaN(parsed)) {
    return false;
  }

  return Date.now() - parsed <= hours * 60 * 60 * 1000;
};

const isDuplicateIntelReport = (input: {
  report: IntelReport;
  recentHistory: RecentIntelHistoryItem[];
}) => {
  const reportTitle = normalizeComparableText(input.report.title);
  const reportTopic = normalizeComparableText(input.report.topic);
  const reportSymbols = new Set(input.report.symbols.map((symbol) => symbol.toUpperCase()));

  return input.recentHistory.some((item) => {
    if (!isWithinLastHours(item.timestamp, 24)) {
      return false;
    }

    const sameTitle = normalizeComparableText(item.title) === reportTitle;
    const sameTopic = normalizeComparableText(item.topic) === reportTopic;
    const sameCategoryAndSymbol =
      item.category === input.report.category &&
      item.symbols.some((symbol) => reportSymbols.has(symbol.toUpperCase()));

    return sameTitle || sameTopic || sameCategoryAndSymbol;
  });
};

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

  const symbols = extractSymbols(input.evidence);
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
      "Premium editorial crypto market intelligence cover art",
      `focused on ${symbols.length > 0 ? symbols.join(", ") : title}`,
      "cinematic cyberpunk trading desk, data streams, institutional research terminal",
      "sharp composition, high contrast, no text, no logos, 16:9",
    ].join(", "),
  };
};

const deriveTemplateIntel = (evidence: EvidenceItem[]): z.infer<typeof templateIntelSchema> => {
  const templateEvidence = evidence;
  const evidenceSummary = stripIntelBoilerplate(summarizeEvidence(templateEvidence));

  if (!evidenceSummary) {
    return {
      topic: "SKIP",
      insight: "Not enough value",
      importance_score: 1,
    };
  }

  const first = sortTemplateEvidence(templateEvidence)[0];
  const topic = first
    ? stripIntelBoilerplate(first.summary)
        .replace(/:\s.*$/, "")
        .trim()
    : "Crypto Market Rotation";

  return {
    topic: titleFromTopic(topic) || "Crypto Market Rotation",
    insight: trimToLength(evidenceSummary, 900),
    importance_score: 7,
  };
};

export class IntelAgentFactory {
  private readonly llmClient: OpenAiCompatibleJsonClient | null;

  private readonly binance: BinanceMarketService;

  private readonly birdeye: BirdeyeMarketService;

  private readonly coinGecko: CoinGeckoMarketService;

  private readonly coinMarketCap: CoinMarketCapMarketService;

  private readonly defiLlama: DefiLlamaMarketService;

  constructor(input: zod.input<typeof intelAgentOptionsSchema> = {}) {
    const parsed = intelAgentOptionsSchema.parse(input);
    this.llmClient =
      parsed.llmClient ?? OpenAiCompatibleJsonClient.fromEnv(resolveModelProfileForRole("intel"));
    this.binance = parsed.binance ?? new BinanceMarketService();
    this.birdeye = parsed.birdeye ?? new BirdeyeMarketService();
    this.coinGecko = parsed.coinGecko ?? new CoinGeckoMarketService();
    this.coinMarketCap = parsed.coinMarketCap ?? new CoinMarketCapMarketService();
    this.defiLlama = parsed.defiLlama ?? new DefiLlamaMarketService();
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
    const fallbackReport = templateIntelToReport({
      template: deriveTemplateIntel(templateEvidence),
      evidence: templateEvidence,
    });
    const prompt = buildIntelSystemPrompt({
      runId: parsed.context.runId,
      hasCandidates: false,
      hasThesis: false,
      reviewDecision: null,
    });

    if (this.llmClient === null) {
      const dedupedFallback =
        fallbackReport &&
        isDuplicateIntelReport({
          report: fallbackReport,
          recentHistory: parsed.recentIntelHistory,
        })
          ? null
          : fallbackReport;

      return intelOutputSchema.parse({
        action: dedupedFallback === null ? "skip" : "ready",
        report: dedupedFallback,
        skipReason: fallbackReport !== null && dedupedFallback === null ? "recent_duplicate" : null,
      });
    }

    try {
      const response = await this.llmClient.completeJson({
        schema: templateIntelSchema,
        systemPrompt: prompt,
        userPrompt: JSON.stringify(
          {
            bias: parsed.bias,
            market_data: templateEvidence.map((item) => ({
              category: item.category,
              summary: item.summary,
              sourceLabel: item.sourceLabel,
              sourceUrl: item.sourceUrl,
              structuredData: item.structuredData,
            })),
            recently_covered_topics: parsed.recentIntelHistory.slice(0, 10).map((item) => ({
              title: item.title,
              topic: item.topic,
              category: item.category,
              symbols: item.symbols,
              timestamp: item.timestamp,
            })),
            recent_posts: parsed.recentPostContext.slice(0, 10).map((post) => ({
              kind: post.kind,
              text: post.text,
              status: post.status,
              publishedUrl: post.publishedUrl,
              signalId: post.signalId,
              intelId: post.intelId,
              timestamp: post.timestamp,
            })),
            instruction: [
              "Return exactly the template intel shape: topic, insight, importance_score.",
              'If importance_score is below 7, set topic to "SKIP" and insight to "Not enough value".',
              "Do not use thesis, critic review, chart vision, publisher notes, or trade-gating context.",
              "Avoid repeating recently covered topics unless the new evidence materially changes the thesis.",
              "Avoid repeating recent_posts; use their exact text to keep the new intel distinct from what was already published.",
              "Prefer specific rotations, TVL/liquidity changes, major movers, and narrative divergences over generic market commentary.",
            ].join(" "),
          },
          null,
          2,
        ),
      });
      const normalizedReport = templateIntelToReport({
        template: response,
        evidence: templateEvidence,
      });

      if (normalizedReport !== null) {
        if (
          isDuplicateIntelReport({
            report: normalizedReport,
            recentHistory: parsed.recentIntelHistory,
          })
        ) {
          return intelOutputSchema.parse({
            action: "skip",
            report: null,
            skipReason: "recent_duplicate",
          });
        }

        return intelOutputSchema.parse({
          report: normalizedReport,
          action: "ready",
          skipReason: null,
        });
      }

      if (fallbackReport !== null) {
        if (
          isDuplicateIntelReport({
            report: fallbackReport,
            recentHistory: parsed.recentIntelHistory,
          })
        ) {
          return intelOutputSchema.parse({
            action: "skip",
            report: null,
            skipReason: "recent_duplicate",
          });
        }

        return intelOutputSchema.parse({
          report: fallbackReport,
          action: "ready",
          skipReason: null,
        });
      }

      return intelOutputSchema.parse({
        action: "skip",
        report: null,
        skipReason: "not_enough_value",
      });
    } catch {
      // Fall back to deterministic intel shaping.
    }

    const dedupedFallback =
      fallbackReport &&
      isDuplicateIntelReport({
        report: fallbackReport,
        recentHistory: parsed.recentIntelHistory,
      })
        ? null
        : fallbackReport;

    return intelOutputSchema.parse({
      action: dedupedFallback === null ? "skip" : "ready",
      report: dedupedFallback,
      skipReason: fallbackReport !== null && dedupedFallback === null ? "recent_duplicate" : null,
    });
  }

  private toTemplateStyleInput(
    input: z.infer<typeof intelInputSchema>,
  ): z.infer<typeof intelInputSchema> {
    return intelInputSchema.parse({
      ...input,
      candidates: [],
      evidence: toTemplateEvidence(input.evidence, {
        includeDirectFixtures: input.context.mode === "mocked",
      }),
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

    if (parsed.context.mode === "mocked") {
      return parsed;
    }

    const existingEvidence = [
      ...parsed.evidence,
      ...(await this.collectTemplateMarketEvidence(state)),
    ];

    return intelInputSchema.parse({
      ...parsed,
      evidence: existingEvidence,
    });
  }

  private async collectTemplateMarketEvidence(state: SwarmState): Promise<EvidenceItem[]> {
    const symbols = state.config.marketUniverse.slice(0, 6);
    const evidence: EvidenceItem[] = [];

    const [
      binanceSnapshots,
      coinGeckoMovers,
      coinGeckoTrending,
      coinGeckoGainers,
      birdeyeTrending,
      cmcBitcoin,
      defiChains,
      defiProtocols,
      defiProtocolStats,
      defiYieldPools,
    ] = await Promise.all([
      this.binance.getSnapshots(symbols).catch(() => null),
      this.coinGecko.getTopMovers(symbols).catch(() => null),
      typeof this.coinGecko.getTrending === "function"
        ? this.coinGecko.getTrending().catch(() => null)
        : Promise.resolve(null),
      typeof this.coinGecko.getTopGainersLosers === "function"
        ? this.coinGecko.getTopGainersLosers(15).catch(() => null)
        : Promise.resolve(null),
      typeof this.birdeye.getTrendingTokens === "function"
        ? this.birdeye.getTrendingTokens(10).catch(() => null)
        : Promise.resolve(null),
      typeof this.coinMarketCap.getPriceWithChange === "function"
        ? this.coinMarketCap.getPriceWithChange("BTC").catch(() => null)
        : Promise.resolve(null),
      typeof this.defiLlama.getGlobalTVL === "function"
        ? this.defiLlama.getGlobalTVL(5).catch(() => null)
        : Promise.resolve(null),
      this.defiLlama.getProtocolLeaderboard(templateDefiProtocols).catch(() => null),
      typeof this.defiLlama.getProtocolStats === "function"
        ? this.defiLlama.getProtocolStats(5).catch(() => null)
        : Promise.resolve(null),
      typeof this.defiLlama.getYieldPools === "function"
        ? this.defiLlama.getYieldPools(20).catch(() => null)
        : Promise.resolve(null),
    ]);
    const coinGeckoTrendingTokens =
      coinGeckoTrending?.ok && coinGeckoTrending.value.length > 0
        ? coinGeckoTrending.value.slice(0, 10)
        : [];
    const birdeyeTrendingTokens =
      birdeyeTrending?.ok && birdeyeTrending.value.length > 0
        ? birdeyeTrending.value.slice(0, 10)
        : [];
    const moverSnapshots = coinGeckoMovers?.ok
      ? coinGeckoMovers.value.filter((snapshot) => snapshot.change24hPercent !== null).slice(0, 5)
      : [];
    const gainerSnapshots =
      coinGeckoGainers?.ok && coinGeckoGainers.value.length > 0
        ? coinGeckoGainers.value
            .filter((snapshot) => snapshot.change24hPercent !== null)
            .slice(0, 10)
        : [];
    const narrativeSynthesis = buildNarrativeSynthesisEvidence({
      trendingSymbols: [...coinGeckoTrendingTokens, ...birdeyeTrendingTokens].map(
        (token) => token.symbol,
      ),
      gainerSymbols: gainerSnapshots.map((snapshot) => snapshot.symbol),
      moverSymbols: moverSnapshots.map((snapshot) => snapshot.symbol),
    });

    if (narrativeSynthesis !== null) {
      evidence.push(narrativeSynthesis);
    }

    if (cmcBitcoin?.ok) {
      evidence.push({
        category: "market",
        summary: `BTC market context from CoinMarketCap: price ${cmcBitcoin.value.price.toLocaleString("en-US", { maximumFractionDigits: 2 })}, 24h change ${cmcBitcoin.value.change24hPercent?.toFixed(2) ?? "n/a"}%.`,
        sourceLabel: "CoinMarketCap",
        sourceUrl: null,
        structuredData: {
          source: "intel-market-data",
          symbol: "BTC",
          price: cmcBitcoin.value.price,
          change24hPercent: cmcBitcoin.value.change24hPercent,
          capturedAt: cmcBitcoin.value.capturedAt,
        },
      });
    }

    if (binanceSnapshots?.ok) {
      for (const snapshot of binanceSnapshots.value.slice(0, 6)) {
        evidence.push({
          category: "market",
          summary: `${snapshot.symbol} trades at ${snapshot.price.toLocaleString("en-US", {
            maximumFractionDigits: snapshot.price >= 1 ? 4 : 8,
          })} with 24h change ${snapshot.change24hPercent?.toFixed(2) ?? "n/a"}%, volume ${snapshot.volume24h?.toLocaleString("en-US", { maximumFractionDigits: 0 }) ?? "n/a"}, funding ${snapshot.fundingRate ?? "n/a"}, and open interest ${snapshot.openInterest?.toLocaleString("en-US", { maximumFractionDigits: 0 }) ?? "n/a"}.`,
          sourceLabel: "Binance",
          sourceUrl: null,
          structuredData: {
            source: "intel-market-data",
            symbol: snapshot.symbol,
            price: snapshot.price,
            change24hPercent: snapshot.change24hPercent,
            volume24h: snapshot.volume24h,
            fundingRate: snapshot.fundingRate,
            openInterest: snapshot.openInterest,
            capturedAt: snapshot.capturedAt,
          },
        });
      }
    }

    if (moverSnapshots.length > 0) {
      evidence.push({
        category: "liquidity",
        summary: `Top watched movers: ${moverSnapshots
          .map(
            (snapshot) =>
              `${snapshot.symbol} ${snapshot.change24hPercent?.toFixed(2) ?? "n/a"}% on ${snapshot.volume24h?.toLocaleString("en-US", { maximumFractionDigits: 0 }) ?? "n/a"} volume`,
          )
          .join("; ")}.`,
        sourceLabel: "CoinGecko",
        sourceUrl: null,
        structuredData: {
          source: "intel-market-data",
          symbols: moverSnapshots.map((snapshot) => snapshot.symbol),
          capturedAt: new Date().toISOString(),
        },
      });
    }

    if (coinGeckoTrendingTokens.length > 0) {
      evidence.push({
        category: "sentiment",
        summary: `CoinGecko trending tokens: ${coinGeckoTrendingTokens
          .map(
            (token) =>
              `${token.symbol}${token.rank !== null ? ` rank ${token.rank.toString()}` : ""}`,
          )
          .join("; ")}.`,
        sourceLabel: "CoinGecko",
        sourceUrl: null,
        structuredData: {
          source: "intel-market-data",
          symbols: coinGeckoTrendingTokens.map((token) => token.symbol),
          capturedAt: new Date().toISOString(),
        },
      });
    }

    if (gainerSnapshots.length > 0) {
      evidence.push({
        category: "liquidity",
        summary: `CoinGecko top gainers: ${gainerSnapshots
          .map(
            (snapshot) =>
              `${snapshot.symbol} ${snapshot.change24hPercent?.toFixed(2) ?? "n/a"}% on ${snapshot.volume24h?.toLocaleString("en-US", { maximumFractionDigits: 0 }) ?? "n/a"} volume`,
          )
          .join("; ")}.`,
        sourceLabel: "CoinGecko",
        sourceUrl: null,
        structuredData: {
          source: "intel-market-data",
          symbols: gainerSnapshots.map((snapshot) => snapshot.symbol),
          capturedAt: new Date().toISOString(),
        },
      });
    }

    if (birdeyeTrendingTokens.length > 0) {
      evidence.push({
        category: "sentiment",
        summary: `Birdeye trending tokens: ${birdeyeTrendingTokens
          .map(
            (token) =>
              `${token.symbol}${token.chain ? ` on ${token.chain}` : ""}${token.volume24h !== null ? `, ${token.volume24h.toLocaleString("en-US", { maximumFractionDigits: 0 })} 24h volume` : ""}`,
          )
          .join("; ")}.`,
        sourceLabel: "Birdeye",
        sourceUrl: null,
        structuredData: {
          source: "intel-market-data",
          symbols: birdeyeTrendingTokens.map((token) => token.symbol),
          chains: birdeyeTrendingTokens.map((token) => token.chain).filter(Boolean),
          capturedAt: new Date().toISOString(),
        },
      });
    }

    if (defiChains?.ok && defiChains.value.length > 0) {
      evidence.push({
        category: "liquidity",
        summary: `DeFiLlama top chain TVL: ${defiChains.value
          .map(
            (chain) =>
              `${chain.name} $${chain.tvlUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
          )
          .join("; ")}.`,
        sourceLabel: "DeFiLlama",
        sourceUrl: null,
        structuredData: {
          source: "intel-market-data",
          chains: defiChains.value.map((chain) => chain.name),
          capturedAt: new Date().toISOString(),
        },
      });
    }

    if (defiProtocols?.ok) {
      const growingProtocols = defiProtocols.value
        .filter(
          (snapshot) =>
            snapshot.tvlChange1dPercent !== null || snapshot.tvlChange7dPercent !== null,
        )
        .sort(
          (left, right) =>
            (right.tvlChange7dPercent ?? right.tvlChange1dPercent ?? -Infinity) -
            (left.tvlChange7dPercent ?? left.tvlChange1dPercent ?? -Infinity),
        )
        .slice(0, 5);

      if (growingProtocols.length > 0) {
        evidence.push({
          category: "fundamental",
          summary: `DeFi TVL rotation: ${growingProtocols
            .map(
              (snapshot) =>
                `${snapshot.protocol} on ${snapshot.chain} has $${snapshot.tvlUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })} TVL, ${snapshot.tvlChange1dPercent?.toFixed(2) ?? "n/a"}% 1d and ${snapshot.tvlChange7dPercent?.toFixed(2) ?? "n/a"}% 7d`,
            )
            .join("; ")}.`,
          sourceLabel: "DeFiLlama",
          sourceUrl: null,
          structuredData: {
            source: "intel-market-data",
            protocols: growingProtocols.map((snapshot) => snapshot.protocol),
            chains: growingProtocols.map((snapshot) => snapshot.chain),
            capturedAt: new Date().toISOString(),
          },
        });
      }
    }

    if (defiProtocolStats?.ok && defiProtocolStats.value.length > 0) {
      evidence.push({
        category: "fundamental",
        summary: `DeFiLlama fastest-growing protocols: ${defiProtocolStats.value
          .map(
            (protocol) =>
              `${protocol.name}${protocol.chain ? ` on ${protocol.chain}` : ""} has $${protocol.tvlUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })} TVL and ${protocol.tvlChange1dPercent?.toFixed(2) ?? "n/a"}% 1d change`,
          )
          .join("; ")}.`,
        sourceLabel: "DeFiLlama",
        sourceUrl: null,
        structuredData: {
          source: "intel-market-data",
          protocols: defiProtocolStats.value.map((protocol) => protocol.name),
          chains: defiProtocolStats.value.map((protocol) => protocol.chain).filter(Boolean),
          capturedAt: new Date().toISOString(),
        },
      });
    }

    if (defiYieldPools?.ok && defiYieldPools.value.length > 0) {
      const pools = defiYieldPools.value.slice(0, 8);
      evidence.push({
        category: "liquidity",
        summary: `DeFiLlama high-yield pools: ${pools
          .map(
            (pool) =>
              `${pool.project} ${pool.symbol} on ${pool.chain}: ${pool.apy.toFixed(2)}% APY with $${pool.tvlUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })} TVL`,
          )
          .join("; ")}.`,
        sourceLabel: "DeFiLlama",
        sourceUrl: null,
        structuredData: {
          source: "intel-market-data",
          protocols: pools.map((pool) => pool.project),
          chains: pools.map((pool) => pool.chain),
          capturedAt: new Date().toISOString(),
        },
      });
    }

    return evidence;
  }
}

export const createIntelAgent = (input: zod.input<typeof intelAgentOptionsSchema> = {}) =>
  new IntelAgentFactory(input).createDefinition();
