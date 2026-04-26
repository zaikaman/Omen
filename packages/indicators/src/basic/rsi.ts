import { z } from "zod";

import { movingAverageInputSchema, priceSeriesSchema } from "./moving-averages.js";

export const rsiInputSchema = movingAverageInputSchema.extend({
  period: z.number().int().min(2).default(14),
});

export const rsiResultSchema = z.object({
  period: z.number().int().min(2),
  latest: z.number().min(0).max(100),
  state: z.enum(["overbought", "oversold", "neutral"]),
  averageGain: z.number().min(0),
  averageLoss: z.number().min(0),
});

export const calculateRsi = (input: z.input<typeof rsiInputSchema>) => {
  const parsed = rsiInputSchema.parse({
    values: priceSeriesSchema.parse(input.values),
    period: input.period ?? 14,
  });

  if (parsed.values.length <= parsed.period) {
    throw new Error("RSI requires more values than the chosen period.");
  }

  const deltas = parsed.values
    .slice(1)
    .map((value, index) => value - parsed.values[index]);
  const recent = deltas.slice(-parsed.period);

  const averageGain =
    recent.reduce((sum, delta) => sum + (delta > 0 ? delta : 0), 0) / parsed.period;
  const averageLoss =
    recent.reduce((sum, delta) => sum + (delta < 0 ? Math.abs(delta) : 0), 0) /
    parsed.period;

  const relativeStrength =
    averageLoss === 0 ? Number.POSITIVE_INFINITY : averageGain / averageLoss;
  const latest =
    averageLoss === 0 ? 100 : 100 - 100 / (1 + relativeStrength);

  return rsiResultSchema.parse({
    period: parsed.period,
    latest,
    state: latest >= 70 ? "overbought" : latest <= 30 ? "oversold" : "neutral",
    averageGain,
    averageLoss,
  });
};

export type RsiResult = z.infer<typeof rsiResultSchema>;
