import { assetNarrativeSchema, marketSnapshotSchema } from "@omen/market-data";
import { z } from "zod";

import { biasDecisionSchema, orchestrationContextSchema } from "../contracts/common.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import type { SwarmState } from "../framework/state.js";

export const marketBiasAgentInputSchema = z.object({
  context: orchestrationContextSchema,
  snapshots: z.array(marketSnapshotSchema).default([]),
  narratives: z.array(assetNarrativeSchema).default([]),
});

export const marketBiasAgentOutputSchema = biasDecisionSchema;

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

export const createMarketBiasAgent = (): RuntimeNodeDefinition<
  z.input<typeof marketBiasAgentInputSchema>,
  z.output<typeof marketBiasAgentOutputSchema>
> => ({
  key: "market-bias-agent",
  role: "market_bias",
  inputSchema: marketBiasAgentInputSchema,
  outputSchema: marketBiasAgentOutputSchema,
  async invoke(input: z.input<typeof marketBiasAgentInputSchema>, state: SwarmState) {
    void state;
    return deriveMarketBias(input);
  },
});

export type MarketBiasAgentInput = z.infer<typeof marketBiasAgentInputSchema>;
export type MarketBiasAgentOutput = z.infer<typeof marketBiasAgentOutputSchema>;
