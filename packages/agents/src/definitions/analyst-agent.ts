import {
  BinanceMarketService,
  CoinGeckoMarketService,
  CoinMarketCapMarketService,
  type MarketCandle,
} from "@omen/market-data";
import {
  assessMultiTimeframeAlignment,
  calculateMacd,
  calculateRsi,
  detectSupportResistance,
} from "@omen/indicators";
import { getTradeableToken } from "@omen/shared";
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
  coinMarketCap: zod.custom<CoinMarketCapMarketService>().optional(),
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
    /bullish|breakout|strength|reclaim|positive|leaning upward|uptrend|higher highs|accumulation|oversold bounce/i.test(
      item.summary,
    ),
  ).length;
  const bearishSignals = evidence.filter((item) =>
    /bearish|breakdown|weakness|rejection|negative|leaning downward|downtrend|lower lows|distribution|underperform|selloff/i.test(
      item.summary,
    ),
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
    .filter((item) => item.category === "technical" || item.category === "chart")
    .concat(evidence.filter((item) => item.category !== "technical" && item.category !== "chart"))
    .slice(0, 2)
    .map((item) => item.summary)
    .join(" ");

  return `${symbol} is actionable because ${leadEvidence} ${narrativeSummary}`.trim();
};

const summarizeNoTrade = (
  symbol: string,
  direction: "WATCHLIST" | "NONE",
  evidence: EvidenceItem[],
  narrativeSummary: string,
) => {
  const leadEvidence = evidence
    .filter((item) => item.category === "technical" || item.category === "chart")
    .concat(evidence.filter((item) => item.category !== "technical" && item.category !== "chart"))
    .slice(0, 2)
    .map((item) => item.summary)
    .join(" ");

  return `${symbol} did not form an executable trade setup. Direction resolved to ${direction}; ${leadEvidence} ${narrativeSummary}`.trim();
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

const calculateAtr = (candles: MarketCandle[], period = 14) => {
  if (candles.length < period + 1) {
    return null;
  }

  const trueRanges = candles.slice(1).map((candle, index) => {
    const previousClose = candles[index]?.close ?? candle.close;

    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - previousClose),
      Math.abs(candle.low - previousClose),
    );
  });
  const recentRanges = trueRanges.slice(-period);
  const atr =
    recentRanges.reduce((sum, trueRange) => sum + trueRange, 0) /
    Math.max(recentRanges.length, 1);
  const latest = candles[candles.length - 1];

  if (!latest || latest.close <= 0) {
    return null;
  }

  return {
    value: atr,
    percent: (atr / latest.close) * 100,
  };
};

const safeRsi = (closes: number[]) => {
  try {
    return calculateRsi({ values: closes, period: 14 });
  } catch {
    return null;
  }
};

const safeMacd = (closes: number[]) => {
  try {
    return calculateMacd({ values: closes });
  } catch {
    return null;
  }
};

const trendFromCandles = (candles: MarketCandle[]) => {
  if (candles.length < 8) {
    return { trend: "neutral" as const, confidence: 40 };
  }

  const latest = candles[candles.length - 1];
  const previous = candles[Math.max(0, candles.length - 8)];

  if (!latest || !previous || previous.close <= 0) {
    return { trend: "neutral" as const, confidence: 40 };
  }

  const changePercent = ((latest.close - previous.close) / previous.close) * 100;
  const magnitude = Math.min(95, Math.max(45, 45 + Math.abs(changePercent) * 10));

  if (changePercent > 0.25) {
    return { trend: "bullish" as const, confidence: magnitude };
  }

  if (changePercent < -0.25) {
    return { trend: "bearish" as const, confidence: magnitude };
  }

  return { trend: "neutral" as const, confidence: 50 };
};

const buildMarketChartEvidence = (
  symbol: string,
  candles: MarketCandle[],
  timeframe: string,
): EvidenceItem | null => {
  if (candles.length < 8) {
    return null;
  }

  const latest = candles[candles.length - 1];
  const first = candles[0];
  const highs = candles.map((candle) => candle.high);
  const lows = candles.map((candle) => candle.low);

  if (!latest || !first || first.close <= 0) {
    return null;
  }

  const changePercent = ((latest.close - first.close) / first.close) * 100;
  const rangeHigh = Math.max(...highs);
  const rangeLow = Math.min(...lows);
  const rangePosition =
    rangeHigh === rangeLow ? 0.5 : (latest.close - rangeLow) / (rangeHigh - rangeLow);

  return evidenceItemSchema.parse({
    category: "chart",
    summary: `${symbol} ${timeframe} market chart shows ${changePercent.toFixed(2)}% move across ${candles.length.toString()} candles; price sits ${rangePosition < 0.35 ? "near range support" : rangePosition > 0.65 ? "near range resistance" : "mid-range"}.`,
    sourceLabel: "Analyzer Market Chart",
    sourceUrl: null,
    structuredData: {
      symbol,
      timeframe,
      currentPrice: latest.close,
      price: latest.close,
      rangeHigh,
      rangeLow,
      rangePosition,
      changePercent,
      candles: candles.length,
    },
  });
};

const buildAdvancedTechnicalEvidence = (
  symbol: string,
  candlesByTimeframe: Partial<Record<"15m" | "1h" | "4h", MarketCandle[]>>,
): EvidenceItem | null => {
  const primaryCandles = candlesByTimeframe["1h"] ?? candlesByTimeframe["4h"] ?? candlesByTimeframe["15m"];

  if (!primaryCandles || primaryCandles.length < 30) {
    return null;
  }

  const closes = primaryCandles.map((candle) => candle.close);
  const latest = primaryCandles[primaryCandles.length - 1];
  const rsi = safeRsi(closes);
  const macd = safeMacd(closes);
  const atr = calculateAtr(primaryCandles);
  const levels = detectSupportResistance({ candles: primaryCandles.slice(-80), levels: 3 });
  const timeframeInputs = (Object.entries(candlesByTimeframe) as Array<
    ["15m" | "1h" | "4h", MarketCandle[] | undefined]
  >)
    .filter((entry): entry is ["15m" | "1h" | "4h", MarketCandle[]] => !!entry[1]?.length)
    .map(([timeframe, candles]) => ({
      timeframe,
      ...trendFromCandles(candles),
    }));
  const mtf =
    timeframeInputs.length >= 2
      ? assessMultiTimeframeAlignment({ timeframes: timeframeInputs })
      : null;
  const nearestSupport = levels.supports
    .filter((level) => !latest || level.price <= latest.close)
    .sort((left, right) => right.price - left.price)[0] ?? levels.supports[0] ?? null;
  const nearestResistance = levels.resistances
    .filter((level) => !latest || level.price >= latest.close)
    .sort((left, right) => left.price - right.price)[0] ?? levels.resistances[0] ?? null;
  const confluences = [
    rsi?.state === "oversold" || rsi?.state === "overbought" ? "rsi_extreme" : null,
    macd?.bias && macd.bias !== "neutral" ? "macd_bias" : null,
    mtf && mtf.dominantTrend !== "neutral" && mtf.confidence >= 50 ? "mtf_alignment" : null,
    nearestSupport ? "support_level" : null,
    nearestResistance ? "resistance_level" : null,
    atr && atr.percent >= 1 ? "tradable_atr" : null,
  ].filter((entry): entry is string => entry !== null);
  const dominantTrend = mtf?.dominantTrend ?? macd?.bias ?? "neutral";

  return evidenceItemSchema.parse({
    category: "technical",
    summary: `${symbol} analyzer TA is ${dominantTrend}; RSI ${rsi?.latest.toFixed(1) ?? "n/a"} (${rsi?.state ?? "n/a"}), MACD ${macd?.bias ?? "n/a"}, MTF alignment ${mtf ? `${mtf.confidence.toFixed(0)}% ${mtf.dominantTrend}` : "n/a"}, with ${confluences.length.toString()} confluences and ATR ${atr?.percent.toFixed(2) ?? "n/a"}%.`,
    sourceLabel: "Analyzer Technical Stack",
    sourceUrl: null,
    structuredData: {
      symbol,
      currentPrice: latest?.close ?? null,
      price: latest?.close ?? null,
      support: nearestSupport?.price ?? null,
      supportTouches: nearestSupport?.touches ?? null,
      resistance: nearestResistance?.price ?? null,
      resistanceTouches: nearestResistance?.touches ?? null,
      rsi14: rsi?.latest ?? null,
      rsiState: rsi?.state ?? null,
      macdBias: macd?.bias ?? null,
      macdHistogram: macd?.histogram ?? null,
      atr: atr?.value ?? null,
      atrPercent: atr?.percent ?? null,
      mtfAlignmentScore: mtf?.confidence ?? null,
      mtfDominantTrend: mtf?.dominantTrend ?? null,
      alignedTimeframes: mtf?.alignedTimeframes ?? [],
      conflictingTimeframes: mtf?.conflictingTimeframes ?? [],
      confluenceCount: confluences.length,
      confluences,
      dataSource: "binance",
    },
  });
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
      whyNow:
        direction === "LONG" || direction === "SHORT"
          ? summarizeWhyNow(
              parsed.research.candidate.symbol,
              parsed.research.evidence,
              mergeChartVisionSummary(
                parsed.research.narrativeSummary,
                parsed.research.chartVisionSummary,
              ),
            )
          : summarizeNoTrade(
              parsed.research.candidate.symbol,
              direction,
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

  private readonly coinMarketCap: CoinMarketCapMarketService;

  private readonly llmClient: OpenAiCompatibleJsonClient | null;

  constructor(input: zod.input<typeof analystAgentOptionsSchema> = {}) {
    const parsed = analystAgentOptionsSchema.parse(input);
    this.marketData = parsed.marketData ?? new BinanceMarketService();
    this.coinGecko = parsed.coinGecko ?? new CoinGeckoMarketService();
    this.coinMarketCap = parsed.coinMarketCap ?? new CoinMarketCapMarketService();
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
    const tradeableToken = getTradeableToken(symbol);
    const coingeckoId = tradeableToken?.coingeckoId ?? symbol.toLowerCase();
    const evidence = [...parsed.research.evidence];
    const missingDataNotes = [...parsed.research.missingDataNotes];
    const toolNotes: string[] = [];

    toolNotes.push(
      tradeableToken
        ? `get_coingecko_id/${coingeckoId}`
        : `get_coingecko_id/${coingeckoId}/unverified`,
    );

    if (state.config.providers.binance.enabled) {
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

    if (state.config.providers.coinGecko.enabled) {
      const cmcQuote =
        typeof this.coinMarketCap.getPriceWithChange === "function"
          ? await this.coinMarketCap.getPriceWithChange(symbol)
          : null;

      if (cmcQuote?.ok) {
        appendUniqueEvidence(
          evidence,
          evidenceItemSchema.parse({
            category: "market",
            summary: `${symbol} CoinMarketCap live quote recorded ${cmcQuote.value.price.toFixed(4)} with 24h change ${cmcQuote.value.change24hPercent?.toFixed(2) ?? "n/a"}%.`,
            sourceLabel: "CoinMarketCap",
            sourceUrl: null,
            structuredData: {
              symbol,
              coingeckoId,
              price: cmcQuote.value.price,
              currentPrice: cmcQuote.value.price,
              change24hPercent: cmcQuote.value.change24hPercent,
              capturedAt: cmcQuote.value.capturedAt,
            },
          }),
        );
        toolNotes.push("get_token_price/coinmarketcap_quote");
      } else if (cmcQuote && !cmcQuote.ok) {
        missingDataNotes.push(`Analyst CMC quote missing: ${cmcQuote.error.message}`);
      }
    }

    if (state.config.providers.binance.enabled) {
      const [candles15m, candles1h, candles4h] = await Promise.all([
        this.marketData.getCandles({ symbol, interval: "15m", limit: 96 }),
        this.marketData.getCandles({ symbol, interval: "1h", limit: 120 }),
        this.marketData.getCandles({ symbol, interval: "4h", limit: 120 }),
      ]);
      const candlesByTimeframe: Partial<Record<"15m" | "1h" | "4h", MarketCandle[]>> = {};

      if (candles15m.ok) {
        candlesByTimeframe["15m"] = candles15m.value;
      } else {
        missingDataNotes.push(`Analyst 15m candles missing: ${candles15m.error.message}`);
      }

      if (candles1h.ok) {
        candlesByTimeframe["1h"] = candles1h.value;
      } else {
        missingDataNotes.push(`Analyst 1h candles missing: ${candles1h.error.message}`);
      }

      if (candles4h.ok) {
        candlesByTimeframe["4h"] = candles4h.value;
      } else {
        missingDataNotes.push(`Analyst 4h candles missing: ${candles4h.error.message}`);
      }

      const primaryCandles = candlesByTimeframe["1h"] ?? candlesByTimeframe["4h"] ?? candlesByTimeframe["15m"];

      if (primaryCandles) {
        const technicalEvidence = buildTechnicalEvidence(symbol, primaryCandles);
        const advancedTechnicalEvidence = buildAdvancedTechnicalEvidence(symbol, candlesByTimeframe);
        const chartEvidence = buildMarketChartEvidence(
          symbol,
          primaryCandles,
          candlesByTimeframe["1h"] ? "1h" : candlesByTimeframe["4h"] ? "4h" : "15m",
        );

        if (technicalEvidence !== null) {
          appendUniqueEvidence(evidence, technicalEvidence);
        }

        if (advancedTechnicalEvidence !== null) {
          appendUniqueEvidence(evidence, advancedTechnicalEvidence);
        }

        if (chartEvidence !== null) {
          appendUniqueEvidence(evidence, chartEvidence);
        }

        toolNotes.push("get_market_chart/binance_ohlcv");
        toolNotes.push("get_technical_analysis/analyzer_stack");
      }
    }

    if (state.config.providers.coinGecko.enabled) {
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
              coingeckoId,
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
