import {
  BinanceMarketService,
  CoinGeckoMarketService,
  assetNarrativeSchema,
  marketSnapshotSchema,
  type AssetNarrative,
  type MarketSnapshot,
} from "@omen/market-data";
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
      return deriveMarketBias(parsed);
    }

    const snapshots = await this.collectSnapshots(state.config.marketUniverse);
    const narratives: AssetNarrative[] = [];

    const llmResult = await this.analyzeWithModel({
      snapshots,
      narratives,
      state,
    });

    if (llmResult !== null) {
      return llmResult;
    }

    return deriveMarketBias({
      ...parsed,
      snapshots,
      narratives,
    });
  }

  private async collectSnapshots(universe: string[]): Promise<MarketSnapshot[]> {
    const targets = universe.slice(0, 5);
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

    return Array.from(bySymbol.values());
  }

  private async analyzeWithModel(input: {
    snapshots: MarketSnapshot[];
    narratives: AssetNarrative[];
    state: SwarmState;
  }) {
    if (this.llmClient === null) {
      return null;
    }

    try {
      return await this.llmClient.completeJson({
        schema: marketBiasAgentOutputSchema,
        systemPrompt: buildMarketBiasSystemPrompt({
          universe: input.state.config.marketUniverse,
          snapshotCount: input.snapshots.length,
          narrativeCount: input.narratives.length,
        }),
        userPrompt: JSON.stringify(
          {
            marketUniverse: input.state.config.marketUniverse,
            snapshots: input.snapshots.map((snapshot) => ({
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
              "Determine one overall market bias for the next swarm cycle. Keep the reasoning compact but explicit about whether market and narrative signals aligned or conflicted.",
          },
          null,
          2,
        ),
      });
    } catch {
      return null;
    }
  }

}

export const createMarketBiasAgent = (
  input: z.input<typeof marketBiasServiceOptionsSchema> = {},
) => new MarketBiasAgentFactory(input).createDefinition();

export type MarketBiasAgentInput = z.infer<typeof marketBiasAgentInputSchema>;
export type MarketBiasAgentOutput = z.infer<typeof marketBiasAgentOutputSchema>;
