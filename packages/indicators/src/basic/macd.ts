import { z } from "zod";

import { calculateEma, priceSeriesSchema } from "./moving-averages.js";

export const macdInputSchema = z.object({
  values: priceSeriesSchema,
  fastPeriod: z.number().int().min(2).default(12),
  slowPeriod: z.number().int().min(3).default(26),
  signalPeriod: z.number().int().min(2).default(9),
});

export const macdResultSchema = z.object({
  fastPeriod: z.number().int().min(2),
  slowPeriod: z.number().int().min(3),
  signalPeriod: z.number().int().min(2),
  macdLine: z.number(),
  signalLine: z.number(),
  histogram: z.number(),
  bias: z.enum(["bullish", "bearish", "neutral"]),
});

export const calculateMacd = (input: z.input<typeof macdInputSchema>) => {
  const parsed = macdInputSchema.parse(input);

  if (parsed.fastPeriod >= parsed.slowPeriod) {
    throw new Error("MACD requires fastPeriod to be lower than slowPeriod.");
  }

  const fast = calculateEma({
    values: parsed.values,
    period: parsed.fastPeriod,
  });
  const slow = calculateEma({
    values: parsed.values,
    period: parsed.slowPeriod,
  });

  const aligned = slow.series.map((slowPoint) => {
    const fastPoint = fast.series.find((entry) => entry.index === slowPoint.index);

    return fastPoint ? fastPoint.value - slowPoint.value : null;
  });
  const macdSeries = aligned.filter((value): value is number => value !== null);

  if (macdSeries.length < parsed.signalPeriod) {
    throw new Error("MACD signal line requires enough aligned MACD values.");
  }

  const signalSeed =
    macdSeries.slice(-parsed.signalPeriod).reduce((sum, value) => sum + value, 0) /
    parsed.signalPeriod;
  const macdLine = macdSeries[macdSeries.length - 1] ?? 0;
  const histogram = macdLine - signalSeed;

  return macdResultSchema.parse({
    fastPeriod: parsed.fastPeriod,
    slowPeriod: parsed.slowPeriod,
    signalPeriod: parsed.signalPeriod,
    macdLine,
    signalLine: signalSeed,
    histogram,
    bias: histogram > 0 ? "bullish" : histogram < 0 ? "bearish" : "neutral",
  });
};

export type MacdResult = z.infer<typeof macdResultSchema>;
