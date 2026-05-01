import {
  BinanceMarketService,
  CoinGeckoMarketService,
  assetNarrativeSchema,
  marketSnapshotSchema,
  type MarketCandle,
  type AssetNarrative,
  type MarketSnapshot,
} from "@omen/market-data";
import {
  assessMultiTimeframeAlignment,
  calculateBollingerBands,
  calculateEma,
  calculateMacd,
  calculateRsi,
} from "@omen/indicators";
import { z } from "zod";

import { biasDecisionSchema, orchestrationContextSchema } from "../contracts/common.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import type { SwarmState } from "../framework/state.js";
import { OpenAiCompatibleJsonClient } from "../llm/openai-compatible-client.js";
import { resolveModelProfileForRole } from "../llm/model-routing.js";
import { buildMarketBiasSystemPrompt } from "../prompts/market-bias/system.js";

export const marketBiasAgentInputSchema = z.object({
  context: orchestrationContextSchema,
  snapshots: z.array(marketSnapshotSchema).default([]),
  narratives: z.array(assetNarrativeSchema).default([]),
});

export const marketBiasAgentOutputSchema = biasDecisionSchema;

const marketBiasServiceOptionsSchema = z.object({
  binance: z.custom<BinanceMarketService>().optional(),
  coinGecko: z.custom<CoinGeckoMarketService>().optional(),
  llmClient: z.custom<OpenAiCompatibleJsonClient>().nullable().optional(),
});

type BtcTimeframeContext = {
  timeframe: "1h" | "4h" | "1d";
  candleCount: number;
  latestClose: number | null;
  changePercent: number | null;
  rsi: {
    value: number;
    state: "overbought" | "oversold" | "neutral";
  } | null;
  macd: {
    histogram: number;
    bias: "bullish" | "bearish" | "neutral";
  } | null;
  bollinger: {
    position: "above_upper" | "below_lower" | "upper_half" | "lower_half" | "middle";
    bandwidthPercent: number | null;
  } | null;
  emaTrend: "bullish" | "bearish" | "neutral";
  trendConfidence: number;
};

type MarketBreadthContext = {
  sampledSymbols: number;
  greenCount: number;
  redCount: number;
  flatCount: number;
  averageChange24hPercent: number | null;
  healthyVolumeCount: number;
  topGainers: Array<{ symbol: string; change24hPercent: number }>;
  topLosers: Array<{ symbol: string; change24hPercent: number }>;
};

type MarketBiasContext = {
  snapshots: MarketSnapshot[];
  btcTechnicals: {
    timeframes: BtcTimeframeContext[];
    multiTimeframeAlignment: {
      dominantTrend: "bullish" | "bearish" | "neutral";
      confidence: number;
      alignedTimeframes: string[];
      conflictingTimeframes: string[];
    } | null;
  };
  marketBreadth: MarketBreadthContext;
};

type MarketBiasDecision = z.output<typeof marketBiasAgentOutputSchema>;

const average = (values: number[]) =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const narrativeSentimentScore = (
  narratives: z.infer<typeof assetNarrativeSchema>[],
) =>
  narratives.reduce((score, narrative) => {
    if (narrative.sentiment === "bullish") {
      return score + 1;
    }

    if (narrative.sentiment === "bearish") {
      return score - 1;
    }

    return score;
  }, 0);

const round = (value: number, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const calculateChangePercent = (values: number[]) => {
  const first = values[0];
  const last = values[values.length - 1];

  if (!first || !last) {
    return null;
  }

  return ((last - first) / first) * 100;
};

const calculateEmaTrend = (values: number[]) => {
  if (values.length < 50) {
    return {
      trend: "neutral" as const,
      confidence: 35,
    };
  }

  const latest = values[values.length - 1] ?? 0;
  const ema20 = calculateEma({ values, period: 20 });
  const ema50 = calculateEma({ values, period: 50 });
  const bullish = latest > ema20.latest && ema20.latest > ema50.latest && ema20.slope > 0;
  const bearish = latest < ema20.latest && ema20.latest < ema50.latest && ema20.slope < 0;
  const spreadPercent = latest === 0 ? 0 : Math.abs((ema20.latest - ema50.latest) / latest) * 100;
  const slopeComponent = latest === 0 ? 0 : Math.abs(ema20.slope / latest) * 5000;
  const confidence = Math.min(90, 45 + spreadPercent * 8 + slopeComponent);

  return {
    trend: bullish ? "bullish" as const : bearish ? "bearish" as const : "neutral" as const,
    confidence: round(confidence, 1),
  };
};

const buildBtcTimeframeContext = (
  timeframe: BtcTimeframeContext["timeframe"],
  candles: MarketCandle[],
): BtcTimeframeContext => {
  const closes = candles.map((candle) => candle.close).filter(Number.isFinite);
  const latestClose = closes[closes.length - 1] ?? null;
  const emaTrend = closes.length >= 50
    ? calculateEmaTrend(closes)
    : { trend: "neutral" as const, confidence: 25 };

  const rsi =
    closes.length > 14
      ? (() => {
          const value = calculateRsi({ values: closes, period: 14 });
          return {
            value: round(value.latest, 1),
            state: value.state,
          };
        })()
      : null;
  const macd =
    closes.length >= 35
      ? (() => {
          const value = calculateMacd({ values: closes });
          return {
            histogram: round(value.histogram, 4),
            bias: value.bias,
          };
        })()
      : null;
  const bollinger =
    closes.length >= 20
      ? (() => {
          const value = calculateBollingerBands({ values: closes, period: 20 });
          return {
            position: value.position,
            bandwidthPercent: latestClose === null ? null : round((value.bandwidth / latestClose) * 100, 2),
          };
        })()
      : null;

  return {
    timeframe,
    candleCount: candles.length,
    latestClose,
    changePercent: calculateChangePercent(closes),
    rsi,
    macd,
    bollinger,
    emaTrend: emaTrend.trend,
    trendConfidence: emaTrend.confidence,
  };
};

const buildMarketBreadthContext = (snapshots: MarketSnapshot[]): MarketBreadthContext => {
  const changes = snapshots
    .map((snapshot) => ({
      symbol: snapshot.symbol.toUpperCase(),
      change24hPercent: snapshot.change24hPercent,
    }))
    .filter((entry): entry is { symbol: string; change24hPercent: number } =>
      entry.change24hPercent !== null,
    );

  return {
    sampledSymbols: snapshots.length,
    greenCount: changes.filter((entry) => entry.change24hPercent > 0.25).length,
    redCount: changes.filter((entry) => entry.change24hPercent < -0.25).length,
    flatCount: changes.filter((entry) => Math.abs(entry.change24hPercent) <= 0.25).length,
    averageChange24hPercent:
      changes.length === 0
        ? null
        : round(average(changes.map((entry) => entry.change24hPercent)), 2),
    healthyVolumeCount: snapshots.filter((snapshot) => (snapshot.volume24h ?? 0) > 0).length,
    topGainers: [...changes]
      .sort((a, b) => b.change24hPercent - a.change24hPercent)
      .slice(0, 3)
      .map((entry) => ({
        symbol: entry.symbol,
        change24hPercent: round(entry.change24hPercent, 2),
      })),
    topLosers: [...changes]
      .sort((a, b) => a.change24hPercent - b.change24hPercent)
      .slice(0, 3)
      .map((entry) => ({
        symbol: entry.symbol,
        change24hPercent: round(entry.change24hPercent, 2),
      })),
  };
};

const buildMultiTimeframeAlignment = (timeframes: BtcTimeframeContext[]) => {
  const usable = timeframes.filter((timeframe) => timeframe.candleCount >= 50);

  if (usable.length < 2) {
    return null;
  }

  const alignment = assessMultiTimeframeAlignment({
    timeframes: usable.map((timeframe) => ({
      timeframe: timeframe.timeframe,
      trend: timeframe.emaTrend,
      confidence: timeframe.trendConfidence,
    })),
  });

  return {
    dominantTrend: alignment.dominantTrend,
    confidence: round(alignment.confidence, 1),
    alignedTimeframes: alignment.alignedTimeframes,
    conflictingTimeframes: alignment.conflictingTimeframes,
  };
};

const resolveDirectionalNudge = (context: MarketBiasContext) => {
  const btcSnapshot = context.snapshots.find((snapshot) => snapshot.symbol.toUpperCase() === "BTC");
  const btcChange24h = btcSnapshot?.change24hPercent ?? null;
  const timeframeChanges = context.btcTechnicals.timeframes
    .map((timeframe) => timeframe.changePercent)
    .filter((value): value is number => value !== null);
  const averageTimeframeChange = average(timeframeChanges);
  const alignment = context.btcTechnicals.multiTimeframeAlignment;
  const breadth = context.marketBreadth;
  const greenShare =
    breadth.sampledSymbols === 0 ? 0 : breadth.greenCount / Math.max(breadth.sampledSymbols, 1);
  const redShare =
    breadth.sampledSymbols === 0 ? 0 : breadth.redCount / Math.max(breadth.sampledSymbols, 1);
  const averageBreadth = breadth.averageChange24hPercent ?? 0;

  const longScore = [
    btcChange24h !== null && btcChange24h >= 0.75,
    averageTimeframeChange >= 0.35,
    alignment?.dominantTrend === "bullish" && alignment.confidence >= 45,
    breadth.greenCount > breadth.redCount,
    greenShare >= 0.5,
    averageBreadth >= 0.25,
  ].filter(Boolean).length;
  const shortScore = [
    btcChange24h !== null && btcChange24h <= -0.75,
    averageTimeframeChange <= -0.35,
    alignment?.dominantTrend === "bearish" && alignment.confidence >= 45,
    breadth.redCount > breadth.greenCount,
    redShare >= 0.5,
    averageBreadth <= -0.25,
  ].filter(Boolean).length;

  if (longScore >= 3 && longScore >= shortScore + 2) {
    return {
      marketBias: "LONG" as const,
      confidence: Math.min(78, 56 + longScore * 4),
      reason: `Directional nudge: BTC ${btcChange24h?.toFixed(2) ?? "n/a"}% 24h, average timeframe change ${averageTimeframeChange.toFixed(2)}%, and breadth ${breadth.greenCount.toString()} green vs ${breadth.redCount.toString()} red leaned bullish enough to continue scanning.`,
    };
  }

  if (shortScore >= 3 && shortScore >= longScore + 2) {
    return {
      marketBias: "SHORT" as const,
      confidence: Math.min(78, 56 + shortScore * 4),
      reason: `Directional nudge: BTC ${btcChange24h?.toFixed(2) ?? "n/a"}% 24h, average timeframe change ${averageTimeframeChange.toFixed(2)}%, and breadth ${breadth.redCount.toString()} red vs ${breadth.greenCount.toString()} green leaned bearish enough to continue scanning.`,
    };
  }

  return null;
};

export const applyMarketBiasDirectionNudge = (input: {
  decision: MarketBiasDecision;
  context: MarketBiasContext;
}) => {
  if (input.decision.marketBias !== "NEUTRAL") {
    return marketBiasAgentOutputSchema.parse(input.decision);
  }

  const nudge = resolveDirectionalNudge(input.context);

  if (nudge === null) {
    return marketBiasAgentOutputSchema.parse(input.decision);
  }

  return marketBiasAgentOutputSchema.parse({
    marketBias: nudge.marketBias,
    confidence: Math.max(input.decision.confidence, nudge.confidence),
    reasoning: `${nudge.reason} Model initially returned NEUTRAL, but NEUTRAL would stop scanner before candidate-level validation.`,
  });
};

export const deriveMarketBias = (input: z.input<typeof marketBiasAgentInputSchema>) => {
  const parsed = marketBiasAgentInputSchema.parse(input);
  const changes = parsed.snapshots
    .map((snapshot) => snapshot.change24hPercent)
    .filter((value): value is number => value !== null);
  const priceMomentumScore = average(changes);
  const sentimentScore = narrativeSentimentScore(parsed.narratives);
  const combinedScore = priceMomentumScore + sentimentScore;

  if (parsed.snapshots.length === 0 && parsed.narratives.length === 0) {
    return marketBiasAgentOutputSchema.parse({
      marketBias: "UNKNOWN",
      reasoning:
        "No market snapshots or narratives were available, so the swarm keeps bias neutral-to-unknown until scanner evidence arrives.",
      confidence: 40,
    });
  }

  const marketBias =
    combinedScore >= 1.25
      ? "LONG"
      : combinedScore <= -1.25
        ? "SHORT"
        : "NEUTRAL";
  const confidenceBase = Math.round(
    Math.min(95, 50 + Math.abs(combinedScore) * 10 + parsed.snapshots.length * 3),
  );

  return marketBiasAgentOutputSchema.parse({
    marketBias,
    reasoning:
      marketBias === "LONG"
        ? `Bias leaned LONG from average 24h change ${priceMomentumScore.toFixed(2)}% and narrative sentiment score ${sentimentScore.toString()}.`
        : marketBias === "SHORT"
          ? `Bias leaned SHORT from average 24h change ${priceMomentumScore.toFixed(2)}% and narrative sentiment score ${sentimentScore.toString()}.`
          : `Bias stayed NEUTRAL because average 24h change ${priceMomentumScore.toFixed(2)}% and narrative sentiment score ${sentimentScore.toString()} did not break conviction thresholds.`,
    confidence: confidenceBase,
  });
};

export class MarketBiasAgentFactory {
  private readonly binance: BinanceMarketService;

  private readonly coinGecko: CoinGeckoMarketService;

  private readonly llmClient: OpenAiCompatibleJsonClient | null;

  constructor(input: z.input<typeof marketBiasServiceOptionsSchema> = {}) {
    const parsed = marketBiasServiceOptionsSchema.parse(input);
    this.binance = parsed.binance ?? new BinanceMarketService();
    this.coinGecko = parsed.coinGecko ?? new CoinGeckoMarketService();
    this.llmClient =
      parsed.llmClient ??
      OpenAiCompatibleJsonClient.fromEnv(resolveModelProfileForRole("market_bias"));
  }

  createDefinition(): RuntimeNodeDefinition<
    z.input<typeof marketBiasAgentInputSchema>,
    z.output<typeof marketBiasAgentOutputSchema>
  > {
    return {
      key: "market-bias-agent",
      role: "market_bias",
      inputSchema: marketBiasAgentInputSchema,
      outputSchema: marketBiasAgentOutputSchema,
      invoke: async (input, state) => this.analyze(input, state),
    };
  }

  private async analyze(
    input: z.input<typeof marketBiasAgentInputSchema>,
    state: SwarmState,
  ) {
    const parsed = marketBiasAgentInputSchema.parse(input);

    if (parsed.snapshots.length > 0 || parsed.narratives.length > 0) {
      return this.analyzeWithModel({
        context: await this.buildMarketBiasContext(parsed.snapshots),
        narratives: parsed.narratives,
        state,
      });
    }

    const context = await this.collectMarketBiasContext(state.config.marketUniverse);
    const narratives: AssetNarrative[] = [];

    return this.analyzeWithModel({
      context,
      narratives,
      state,
    });
  }

  private async collectMarketBiasContext(universe: string[]): Promise<MarketBiasContext> {
    const targets = universe.slice(0, 10);
    const [binanceResult, coinGeckoResult] = await Promise.all([
      this.binance.getSnapshots(targets),
      this.coinGecko.getAssetSnapshots(targets),
    ]);
    const bySymbol = new Map<string, MarketSnapshot>();

    const append = (items: MarketSnapshot[]) => {
      for (const item of items) {
        bySymbol.set(item.symbol.toUpperCase(), item);
      }
    };

    if (binanceResult.ok) {
      append(binanceResult.value);
    }

    if (coinGeckoResult.ok) {
      append(coinGeckoResult.value);
    }

    return this.buildMarketBiasContext(Array.from(bySymbol.values()));
  }

  private async buildMarketBiasContext(snapshots: MarketSnapshot[]): Promise<MarketBiasContext> {
    const [oneHour, fourHour, oneDay] = await Promise.all([
      this.binance.getCandles({ symbol: "BTC", interval: "1h", limit: 80 }),
      this.binance.getCandles({ symbol: "BTC", interval: "4h", limit: 80 }),
      this.binance.getCandles({ symbol: "BTC", interval: "1d", limit: 80 }),
    ]);
    const timeframes = [
      buildBtcTimeframeContext("1h", oneHour.ok ? oneHour.value : []),
      buildBtcTimeframeContext("4h", fourHour.ok ? fourHour.value : []),
      buildBtcTimeframeContext("1d", oneDay.ok ? oneDay.value : []),
    ];

    return {
      snapshots,
      btcTechnicals: {
        timeframes,
        multiTimeframeAlignment: buildMultiTimeframeAlignment(timeframes),
      },
      marketBreadth: buildMarketBreadthContext(snapshots),
    };
  }

  private async analyzeWithModel(input: {
    context: MarketBiasContext;
    narratives: AssetNarrative[];
    state: SwarmState;
  }) {
    if (this.llmClient === null) {
      throw new Error("Market bias derivation requires a configured LLM client.");
    }

    try {
      const decision = await this.llmClient.completeJson({
        schema: marketBiasAgentOutputSchema,
        systemPrompt: buildMarketBiasSystemPrompt({
          universe: input.state.config.marketUniverse,
          snapshotCount: input.context.snapshots.length,
          narrativeCount: input.narratives.length,
        }),
        userPrompt: JSON.stringify(
          {
            marketUniverse: input.state.config.marketUniverse,
            btcTechnicalContext: input.context.btcTechnicals,
            marketBreadth: input.context.marketBreadth,
            snapshots: input.context.snapshots.map((snapshot) => ({
              symbol: snapshot.symbol,
              price: snapshot.price,
              change24hPercent: snapshot.change24hPercent,
              volume24h: snapshot.volume24h,
              fundingRate: snapshot.fundingRate,
              openInterest: snapshot.openInterest,
              capturedAt: snapshot.capturedAt,
            })),
            narratives: input.narratives.map((narrative) => ({
              symbol: narrative.symbol,
              title: narrative.title,
              summary: narrative.summary,
              sentiment: narrative.sentiment,
              source: narrative.source,
              sourceUrl: narrative.sourceUrl,
              capturedAt: narrative.capturedAt,
            })),
            instruction:
              "Determine one overall market bias for the next swarm cycle. Start from BTC technical context, confirm with top-market breadth, then use narratives only when supplied. Keep reasoning compact but explicit about whether technicals, breadth, and narratives aligned or conflicted.",
          },
          null,
          2,
        ),
      });

      return applyMarketBiasDirectionNudge({
        decision,
        context: input.context,
      });
    } catch (error) {
      throw new Error(
        `Market bias derivation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

}

export const createMarketBiasAgent = (
  input: z.input<typeof marketBiasServiceOptionsSchema> = {},
) => new MarketBiasAgentFactory(input).createDefinition();

export type MarketBiasAgentInput = z.infer<typeof marketBiasAgentInputSchema>;
export type MarketBiasAgentOutput = z.infer<typeof marketBiasAgentOutputSchema>;
