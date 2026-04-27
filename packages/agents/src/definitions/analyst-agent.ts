import {
  BinanceMarketService,
  CoinGeckoMarketService,
  TavilyMarketResearchService,
  type MarketCandle,
} from "@omen/market-data";
import type { z } from "zod";
import { z as zod } from "zod";

import { analystInputSchema, analystOutputSchema } from "../contracts/analyst.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import {
  evidenceItemSchema,
  type EvidenceItem,
  type SwarmState,
  thesisDraftSchema,
} from "../framework/state.js";
import { OpenAiCompatibleJsonClient } from "../llm/openai-compatible-client.js";
import { resolveModelProfileForRole } from "../llm/model-routing.js";
import { buildAnalystSystemPrompt } from "../prompts/analyst/system.js";

const analystAgentOptionsSchema = zod.object({
  marketData: zod.custom<BinanceMarketService>().optional(),
  coinGecko: zod.custom<CoinGeckoMarketService>().optional(),
  marketResearch: zod.custom<TavilyMarketResearchService>().optional(),
  llmClient: zod.custom<OpenAiCompatibleJsonClient>().nullable().optional(),
});

const categoryWeight: Record<EvidenceItem["category"], number> = {
  market: 8,
  technical: 9,
  liquidity: 6,
  funding: 7,
  fundamental: 6,
  catalyst: 5,
  sentiment: 4,
  chart: 8,
};

const directionFromResearch = (
  directionHint: z.infer<typeof analystInputSchema>["research"]["candidate"]["directionHint"],
  evidence: EvidenceItem[],
) => {
  if (directionHint) {
    return directionHint;
  }

  const bullishSignals = evidence.filter((item) =>
    /bullish|breakout|strength|reclaim|positive/i.test(item.summary),
  ).length;
  const bearishSignals = evidence.filter((item) =>
    /bearish|breakdown|weakness|rejection|negative/i.test(item.summary),
  ).length;

  if (bullishSignals > bearishSignals) {
    return "LONG";
  }

  if (bearishSignals > bullishSignals) {
    return "SHORT";
  }

  return "WATCHLIST";
};

const buildConfluences = (evidence: EvidenceItem[]) =>
  evidence
    .filter((item) => item.category === "technical" || item.category === "chart")
    .concat(evidence.filter((item) => item.category !== "technical" && item.category !== "chart"))
    .slice(0, 4)
    .map((item) => normalizeConfluence(item.summary))
    .filter((entry, index, array) => array.indexOf(entry) === index);

const normalizeConfluence = (summary: string) =>
  summary.replace(/\s+/g, " ").trim().replace(/\.$/, "");

const roundTradingPrice = (value: number) => {
  if (value >= 1_000) {
    return Number(value.toFixed(0));
  }

  if (value >= 1) {
    return Number(value.toFixed(2));
  }

  if (value >= 0.01) {
    return Number(value.toFixed(4));
  }

  return Number(value.toFixed(8));
};

const extractCurrentPrice = (evidence: EvidenceItem[]) => {
  for (const item of evidence) {
    const candidate = item.structuredData.price ?? item.structuredData.currentPrice;

    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
  }

  return null;
};

const extractStructuredNumber = (evidence: EvidenceItem[], keys: string[]) => {
  for (const item of evidence) {
    for (const key of keys) {
      const candidate = item.structuredData[key];

      if (typeof candidate === "number" && Number.isFinite(candidate)) {
        return candidate;
      }
    }
  }

  return null;
};

const calculateRiskReward = (input: {
  direction: "LONG" | "SHORT";
  entryPrice: number;
  targetPrice: number;
  stopLoss: number;
}) => {
  const risk = Math.abs(input.entryPrice - input.stopLoss);
  const reward = Math.abs(input.targetPrice - input.entryPrice);

  if (risk <= 0 || reward <= 0) {
    return null;
  }

  return Number((reward / risk).toFixed(2));
};

const validateTemplateTradeRules = (input: {
  direction: "LONG" | "SHORT" | "WATCHLIST" | "NONE";
  currentPrice: number | null;
  entryPrice: number | null;
  stopLoss: number | null;
  riskReward: number | null;
}) => {
  const violations: string[] = [];

  if (input.direction !== "LONG" && input.direction !== "SHORT") {
    return violations;
  }

  if (input.currentPrice !== null && input.entryPrice !== null) {
    if (input.direction === "LONG" && input.entryPrice > input.currentPrice) {
      violations.push(
        "LONG entry would be above current price, which implies a forbidden buy-stop entry.",
      );
    }

    if (input.direction === "SHORT" && input.entryPrice < input.currentPrice) {
      violations.push(
        "SHORT entry would be below current price, which implies a forbidden sell-stop entry.",
      );
    }
  }

  if (input.entryPrice !== null && input.stopLoss !== null) {
    const stopDistance =
      input.direction === "LONG"
        ? (input.entryPrice - input.stopLoss) / input.entryPrice
        : (input.stopLoss - input.entryPrice) / input.entryPrice;

    if (stopDistance < 0.03) {
      violations.push("Stop loss is less than 3% from entry.");
    }
  }

  if ((input.riskReward ?? 0) < 2) {
    violations.push("Risk/reward is below 1:2.");
  }

  return violations;
};

const estimateRiskReward = (
  direction: "LONG" | "SHORT" | "WATCHLIST" | "NONE",
  evidence: EvidenceItem[],
) => {
  if (direction !== "LONG" && direction !== "SHORT") {
    return null;
  }

  const technicalCount = evidence.filter(
    (item) => item.category === "technical" || item.category === "chart",
  ).length;

  return Number((2 + technicalCount * 0.35).toFixed(2));
};

const estimateConfidence = (input: {
  direction: "LONG" | "SHORT" | "WATCHLIST" | "NONE";
  evidence: EvidenceItem[];
  missingDataNotes: string[];
}) => {
  const evidenceScore = input.evidence.reduce(
    (sum, item) => sum + categoryWeight[item.category],
    0,
  );
  const confidence =
    input.direction === "LONG" || input.direction === "SHORT"
      ? 55 + evidenceScore - input.missingDataNotes.length * 4
      : 50 + Math.floor(evidenceScore / 3) - input.missingDataNotes.length * 4;

  return Math.max(
    45,
    Math.min(input.direction === "LONG" || input.direction === "SHORT" ? 92 : 82, confidence),
  );
};

const summarizeWhyNow = (symbol: string, evidence: EvidenceItem[], narrativeSummary: string) => {
  const leadEvidence = evidence
    .slice(0, 2)
    .map((item) => item.summary)
    .join(" ");

  return `${symbol} is actionable because ${leadEvidence} ${narrativeSummary}`.trim();
};

const deriveTradeSetup = (input: {
  direction: "LONG" | "SHORT" | "WATCHLIST" | "NONE";
  confidence: number;
  riskReward: number | null;
  confluences: string[];
  evidence: EvidenceItem[];
}) => {
  if ((input.direction !== "LONG" && input.direction !== "SHORT") || input.riskReward === null) {
    return {
      orderType: null,
      tradingStyle: null,
      expectedDuration: null,
      currentPrice: null,
      entryPrice: null,
      targetPrice: null,
      stopLoss: null,
    } as const;
  }

  const currentPrice = extractCurrentPrice(input.evidence);
  const supportLevel = extractStructuredNumber(input.evidence, [
    "support",
    "supportLevel",
    "rangeLow",
    "valueAreaLow",
  ]);
  const resistanceLevel = extractStructuredNumber(input.evidence, [
    "resistance",
    "resistanceLevel",
    "rangeHigh",
    "valueAreaHigh",
  ]);

  if (currentPrice === null) {
    return {
      orderType: "market" as const,
      tradingStyle:
        input.confidence >= 90 && input.confluences.length >= 3
          ? ("swing_trade" as const)
          : ("day_trade" as const),
      expectedDuration:
        input.confidence >= 90 && input.confluences.length >= 3 ? "2-5 days" : "8-16 hours",
      currentPrice: null,
      entryPrice: null,
      targetPrice: null,
      stopLoss: null,
    } as const;
  }

  const tradingStyle =
    input.confidence >= 90 && input.confluences.length >= 3 ? "swing_trade" : "day_trade";
  const expectedDuration = tradingStyle === "swing_trade" ? "2-5 days" : "8-16 hours";
  const stopDistancePercent = tradingStyle === "swing_trade" ? 0.05 : 0.035;
  const supportEntry =
    input.direction === "LONG" && supportLevel !== null && supportLevel <= currentPrice
      ? supportLevel
      : null;
  const resistanceEntry =
    input.direction === "SHORT" && resistanceLevel !== null && resistanceLevel >= currentPrice
      ? resistanceLevel
      : null;
  const entryPrice = supportEntry ?? resistanceEntry ?? currentPrice;
  const stopLoss =
    input.direction === "LONG"
      ? Math.min(
          entryPrice * (1 - stopDistancePercent),
          supportLevel === null ? Infinity : supportLevel * 0.995,
        )
      : Math.max(
          entryPrice * (1 + stopDistancePercent),
          resistanceLevel === null ? -Infinity : resistanceLevel * 1.005,
        );
  const riskPerUnit = Math.abs(entryPrice - stopLoss);
  const targetPrice =
    input.direction === "LONG"
      ? entryPrice + riskPerUnit * input.riskReward
      : entryPrice - riskPerUnit * input.riskReward;

  return {
    orderType: entryPrice === currentPrice ? ("market" as const) : ("limit" as const),
    tradingStyle,
    expectedDuration,
    currentPrice: roundTradingPrice(currentPrice),
    entryPrice: roundTradingPrice(entryPrice),
    targetPrice: roundTradingPrice(targetPrice),
    stopLoss: roundTradingPrice(stopLoss),
  } as const;
};

const enforceTemplateTradeRules = (thesis: z.infer<typeof thesisDraftSchema>) => {
  const violations = validateTemplateTradeRules({
    direction: thesis.direction,
    currentPrice: thesis.currentPrice,
    entryPrice: thesis.entryPrice,
    stopLoss: thesis.stopLoss,
    riskReward:
      thesis.direction === "LONG" || thesis.direction === "SHORT"
        ? thesis.entryPrice !== null && thesis.targetPrice !== null && thesis.stopLoss !== null
          ? calculateRiskReward({
              direction: thesis.direction,
              entryPrice: thesis.entryPrice,
              targetPrice: thesis.targetPrice,
              stopLoss: thesis.stopLoss,
            })
          : thesis.riskReward
        : thesis.riskReward,
  });

  if (violations.length === 0) {
    return thesis;
  }

  return thesisDraftSchema.parse({
    ...thesis,
    direction: "NONE",
    confidence: Math.min(thesis.confidence, 84),
    orderType: null,
    tradingStyle: null,
    expectedDuration: null,
    entryPrice: null,
    targetPrice: null,
    stopLoss: null,
    riskReward: null,
    whyNow: `${thesis.asset} was rejected by analyst template validation: ${violations.join(" ")}`,
    uncertaintyNotes: `${thesis.uncertaintyNotes} Template validation rejected the actionable setup.`,
  });
};

const calculateCandleTechnicalSummary = (candles: MarketCandle[]) => {
  const closes = candles.map((candle) => candle.close);
  const latest = candles[candles.length - 1];
  const previous = candles[Math.max(0, candles.length - 8)];
  const recent = candles.slice(-24);
  const support = Math.min(...recent.map((candle) => candle.low));
  const resistance = Math.max(...recent.map((candle) => candle.high));
  const avgVolume =
    recent.reduce((sum, candle) => sum + candle.volume, 0) / Math.max(recent.length, 1);
  const latestVolume = latest.volume;
  const momentumPercent = ((latest.close - previous.close) / previous.close) * 100;
  const rangePosition =
    resistance === support ? 0.5 : (latest.close - support) / (resistance - support);
  const bias =
    momentumPercent > 0.5 && rangePosition < 0.75
      ? "bullish"
      : momentumPercent < -0.5 && rangePosition > 0.25
        ? "bearish"
        : "mixed";

  return {
    latest,
    support,
    resistance,
    avgVolume,
    latestVolume,
    momentumPercent,
    rangePosition,
    bias,
  };
};

const buildTechnicalEvidence = (symbol: string, candles: MarketCandle[]): EvidenceItem | null => {
  if (candles.length < 20) {
    return null;
  }

  const summary = calculateCandleTechnicalSummary(candles);
  const volumeNote =
    summary.latestVolume >= summary.avgVolume
      ? "volume is confirming"
      : "volume is below its recent average";

  return evidenceItemSchema.parse({
    category: "technical",
    summary: `${symbol} 1H structure is ${summary.bias}; price is ${summary.rangePosition < 0.35 ? "near support" : summary.rangePosition > 0.65 ? "near resistance" : "mid-range"} with ${summary.momentumPercent.toFixed(2)}% momentum over the recent lookback and ${volumeNote}.`,
    sourceLabel: "Binance OHLCV",
    sourceUrl: null,
    structuredData: {
      symbol,
      support: summary.support,
      resistance: summary.resistance,
      currentPrice: summary.latest.close,
      price: summary.latest.close,
      momentumPercent: summary.momentumPercent,
      rangePosition: summary.rangePosition,
      volumeConfirming: summary.latestVolume >= summary.avgVolume,
      candleCount: candles.length,
    },
  });
};

const appendUniqueEvidence = (evidence: EvidenceItem[], item: EvidenceItem) => {
  const duplicate = evidence.some(
    (existing) =>
      existing.category === item.category &&
      existing.sourceLabel === item.sourceLabel &&
      existing.summary === item.summary,
  );

  if (!duplicate) {
    evidence.push(item);
  }
};

const mergeChartVisionSummary = (narrativeSummary: string, chartVisionSummary: string | null) =>
  chartVisionSummary && chartVisionSummary.trim().length > 0
    ? `${narrativeSummary} Chart confirmation: ${chartVisionSummary.trim()}`
    : narrativeSummary;

const summarizeUncertainty = (missingDataNotes: string[], evidence: EvidenceItem[]) => {
  if (missingDataNotes.length > 0) {
    return missingDataNotes.join(" ");
  }

  const softEvidenceCount = evidence.filter(
    (item) => item.category === "sentiment" || item.category === "catalyst",
  ).length;

  if (softEvidenceCount > 0) {
    return "Narrative and sentiment evidence contributed to conviction, so follow-through still needs confirmation from live market structure.";
  }

  return "No material uncertainty flags were raised beyond normal market volatility.";
};

export const deriveAnalystThesis = (input: z.input<typeof analystInputSchema>) => {
  const parsed = analystInputSchema.parse(input);
  const direction = directionFromResearch(
    parsed.research.candidate.directionHint,
    parsed.research.evidence,
  );
  const confluences = buildConfluences(parsed.research.evidence);
  const riskReward = estimateRiskReward(direction, parsed.research.evidence);
  const confidence = estimateConfidence({
    direction,
    evidence: parsed.research.evidence,
    missingDataNotes: parsed.research.missingDataNotes,
  });
  const tradeSetup = deriveTradeSetup({
    direction,
    confidence,
    riskReward,
    confluences,
    evidence: parsed.research.evidence,
  });
  const prompt = buildAnalystSystemPrompt({
    symbol: parsed.research.candidate.symbol,
    directionHint: parsed.research.candidate.directionHint,
    evidenceCount: parsed.research.evidence.length,
  });

  const thesis = enforceTemplateTradeRules(
    thesisDraftSchema.parse({
      candidateId: parsed.research.candidate.id,
      asset: parsed.research.candidate.symbol,
      direction:
        direction === "WATCHLIST" && confidence < 60
          ? "WATCHLIST"
          : direction === "WATCHLIST"
            ? "NONE"
            : direction,
      confidence,
      orderType: tradeSetup.orderType,
      tradingStyle: tradeSetup.tradingStyle,
      expectedDuration: tradeSetup.expectedDuration,
      currentPrice: tradeSetup.currentPrice,
      entryPrice: tradeSetup.entryPrice,
      targetPrice: tradeSetup.targetPrice,
      stopLoss: tradeSetup.stopLoss,
      riskReward,
      whyNow: summarizeWhyNow(
        parsed.research.candidate.symbol,
        parsed.research.evidence,
        mergeChartVisionSummary(
          parsed.research.narrativeSummary,
          parsed.research.chartVisionSummary,
        ),
      ),
      confluences,
      uncertaintyNotes: summarizeUncertainty(
        parsed.research.missingDataNotes,
        parsed.research.evidence,
      ),
      missingDataNotes:
        parsed.research.missingDataNotes.length > 0
          ? parsed.research.missingDataNotes.join(" ")
          : "No additional missing-data flags.",
    }),
  );

  return analystOutputSchema.parse({
    thesis,
    analystNotes: [
      `Prompt shell: ${prompt}`,
      `Evidence categories: ${parsed.research.evidence.map((item) => item.category).join(", ")}`,
      ...(parsed.research.chartVisionSummary
        ? [`Chart vision: ${parsed.research.chartVisionSummary}`]
        : []),
    ],
  });
};

export class AnalystAgentFactory {
  private readonly marketData: BinanceMarketService;

  private readonly coinGecko: CoinGeckoMarketService;

  private readonly marketResearch: TavilyMarketResearchService;

  private readonly llmClient: OpenAiCompatibleJsonClient | null;

  constructor(input: zod.input<typeof analystAgentOptionsSchema> = {}) {
    const parsed = analystAgentOptionsSchema.parse(input);
    this.marketData = parsed.marketData ?? new BinanceMarketService();
    this.coinGecko = parsed.coinGecko ?? new CoinGeckoMarketService();
    this.marketResearch = parsed.marketResearch ?? new TavilyMarketResearchService();
    this.llmClient =
      parsed.llmClient ?? OpenAiCompatibleJsonClient.fromEnv(resolveModelProfileForRole("analyst"));
  }

  createDefinition(): RuntimeNodeDefinition<
    z.input<typeof analystInputSchema>,
    z.input<typeof analystOutputSchema>
  > {
    return {
      key: "analyst-agent",
      role: "analyst",
      inputSchema: analystInputSchema,
      outputSchema: analystOutputSchema,
      invoke: async (input, state) => this.analyze(input, state),
    };
  }

  private async analyze(input: z.input<typeof analystInputSchema>, state: SwarmState) {
    const parsed = analystInputSchema.parse(input);
    const enrichedInput = await this.enrichInputWithAnalystTools(parsed, state);
    const fallback = deriveAnalystThesis(enrichedInput);

    if (this.llmClient === null) {
      return fallback;
    }

    try {
      const prompt = buildAnalystSystemPrompt({
        symbol: enrichedInput.research.candidate.symbol,
        directionHint: enrichedInput.research.candidate.directionHint,
        evidenceCount: enrichedInput.research.evidence.length,
      });
      const response = await this.llmClient.completeJson({
        schema: analystOutputSchema,
        systemPrompt: prompt,
        userPrompt: JSON.stringify(
          {
            candidate: enrichedInput.research.candidate,
            narrativeSummary: enrichedInput.research.narrativeSummary,
            chartVisionSummary: enrichedInput.research.chartVisionSummary,
            chartVisionTimeframes: enrichedInput.research.chartVisionTimeframes,
            missingDataNotes: enrichedInput.research.missingDataNotes,
            evidence: enrichedInput.research.evidence,
            instruction:
              "Return one thesis draft only. Keep candidateId equal to the candidate id and asset equal to the candidate symbol. Obey the template analyzer hard rules: only market/limit orders, LONG entry at or below current price, SHORT entry at or above current price, stop at least 3% from entry, and risk/reward at least 1:2.",
          },
          null,
          2,
        ),
      });

      const mergedThesis = enforceTemplateTradeRules(
        thesisDraftSchema.parse({
          ...fallback.thesis,
          ...response.thesis,
          candidateId: enrichedInput.research.candidate.id,
          asset: enrichedInput.research.candidate.symbol.toUpperCase(),
        }),
      );

      return analystOutputSchema.parse({
        ...response,
        thesis: mergedThesis,
        analystNotes: [
          ...(response.analystNotes ?? []),
          `Model-backed analyst path: ${this.llmClient.config.model}`,
        ],
      });
    } catch {
      return fallback;
    }
  }

  private async enrichInputWithAnalystTools(
    input: z.input<typeof analystInputSchema>,
    state: SwarmState,
  ): Promise<z.input<typeof analystInputSchema>> {
    const parsed = analystInputSchema.parse(input);

    if (parsed.context.mode === "mocked") {
      return parsed;
    }

    const symbol = parsed.research.candidate.symbol.toUpperCase();
    const evidence = [...parsed.research.evidence];
    const missingDataNotes = [...parsed.research.missingDataNotes];
    const categories = new Set(evidence.map((item) => item.category));
    const toolNotes: string[] = [];

    if (!categories.has("market") && state.config.providers.binance.enabled) {
      const snapshot = await this.marketData.getSnapshot(symbol);

      if (snapshot.ok) {
        appendUniqueEvidence(
          evidence,
          evidenceItemSchema.parse({
            category: "market",
            summary: `${symbol} Binance futures snapshot recorded ${snapshot.value.price.toFixed(2)} with 24h change ${snapshot.value.change24hPercent?.toFixed(2) ?? "n/a"}%, funding ${snapshot.value.fundingRate?.toFixed(4) ?? "n/a"}, and open interest ${snapshot.value.openInterest?.toLocaleString("en-US") ?? "n/a"}.`,
            sourceLabel: "Binance",
            sourceUrl: null,
            structuredData: {
              symbol,
              price: snapshot.value.price,
              currentPrice: snapshot.value.price,
              change24hPercent: snapshot.value.change24hPercent,
              volume24h: snapshot.value.volume24h,
              fundingRate: snapshot.value.fundingRate,
              openInterest: snapshot.value.openInterest,
              capturedAt: snapshot.value.capturedAt,
            },
          }),
        );
        toolNotes.push("get_token_price/binance_snapshot");
      } else {
        missingDataNotes.push(`Analyst market snapshot missing: ${snapshot.error.message}`);
      }
    }

    if (!categories.has("technical") && state.config.providers.binance.enabled) {
      const candles = await this.marketData.getCandles({
        symbol,
        interval: "1h",
        limit: 96,
      });

      if (candles.ok) {
        const technicalEvidence = buildTechnicalEvidence(symbol, candles.value);

        if (technicalEvidence !== null) {
          appendUniqueEvidence(evidence, technicalEvidence);
          toolNotes.push("get_technical_analysis/binance_ohlcv");
        }
      } else {
        missingDataNotes.push(`Analyst technical candles missing: ${candles.error.message}`);
      }
    }

    if (!categories.has("fundamental") && state.config.providers.coinGecko.enabled) {
      const asset = await this.coinGecko.getAssetSnapshot(symbol);

      if (asset.ok) {
        appendUniqueEvidence(
          evidence,
          evidenceItemSchema.parse({
            category: "fundamental",
            summary: `${symbol} CoinGecko snapshot shows price ${asset.value.price.toFixed(4)}, 24h volume ${asset.value.volume24h?.toLocaleString("en-US") ?? "n/a"}, and 24h change ${asset.value.change24hPercent?.toFixed(2) ?? "n/a"}%.`,
            sourceLabel: "CoinGecko",
            sourceUrl: null,
            structuredData: {
              symbol,
              price: asset.value.price,
              currentPrice: asset.value.price,
              change24hPercent: asset.value.change24hPercent,
              volume24h: asset.value.volume24h,
              capturedAt: asset.value.capturedAt,
            },
          }),
        );
        toolNotes.push("get_fundamental_analysis/coingecko_snapshot");
      } else {
        missingDataNotes.push(`Analyst CoinGecko snapshot missing: ${asset.error.message}`);
      }
    }

    if (
      !categories.has("sentiment") &&
      !categories.has("catalyst") &&
      state.config.providers.news.enabled
    ) {
      const narratives = await this.marketResearch.getSymbolResearchBundle({
        symbol,
        query: `${symbol} crypto news catalyst sentiment futures`,
      });

      if (narratives.ok) {
        for (const narrative of narratives.value.narratives.slice(0, 2)) {
          appendUniqueEvidence(
            evidence,
            evidenceItemSchema.parse({
              category: narrative.sentiment === "neutral" ? "catalyst" : "sentiment",
              summary: `${narrative.title}: ${narrative.summary}`,
              sourceLabel: narrative.source,
              sourceUrl: narrative.sourceUrl,
              structuredData: {
                symbol,
                sentiment: narrative.sentiment,
                capturedAt: narrative.capturedAt,
              },
            }),
          );
        }
        toolNotes.push("search_tavily/news_sentiment");
      } else {
        missingDataNotes.push(`Analyst news search missing: ${narratives.error.message}`);
      }
    }

    return analystInputSchema.parse({
      ...parsed,
      research: {
        ...parsed.research,
        evidence,
        narrativeSummary:
          toolNotes.length > 0
            ? `${parsed.research.narrativeSummary} Analyst tool enrichment used: ${toolNotes.join(", ")}.`
            : parsed.research.narrativeSummary,
        missingDataNotes,
      },
    });
  }
}

export const createAnalystAgent = (input: zod.input<typeof analystAgentOptionsSchema> = {}) =>
  new AnalystAgentFactory(input).createDefinition();
