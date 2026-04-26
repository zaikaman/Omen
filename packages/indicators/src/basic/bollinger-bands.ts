import { z } from "zod";

import { calculateSma, movingAverageInputSchema } from "./moving-averages.js";

export const bollingerBandsInputSchema = movingAverageInputSchema.extend({
  period: z.number().int().min(2).default(20),
  standardDeviationMultiplier: z.number().positive().default(2),
});

export const bollingerBandsResultSchema = z.object({
  period: z.number().int().min(2),
  middle: z.number(),
  upper: z.number(),
  lower: z.number(),
  bandwidth: z.number().min(0),
  position: z.enum([
    "above_upper",
    "below_lower",
    "upper_half",
    "lower_half",
    "middle",
  ]),
});

export const calculateBollingerBands = (
  input: z.input<typeof bollingerBandsInputSchema>,
) => {
  const parsed = bollingerBandsInputSchema.parse(input);

  if (parsed.values.length < parsed.period) {
    throw new Error("Bollinger Bands require at least `period` values.");
  }

  const middleBand = calculateSma({
    values: parsed.values,
    period: parsed.period,
  });
  const window = parsed.values.slice(-parsed.period);
  const variance =
    window.reduce(
      (sum, value) => sum + (value - middleBand.latest) ** 2,
      0,
    ) / parsed.period;
  const standardDeviation = Math.sqrt(variance);
  const upper = middleBand.latest + standardDeviation * parsed.standardDeviationMultiplier;
  const lower = middleBand.latest - standardDeviation * parsed.standardDeviationMultiplier;
  const latestPrice = parsed.values[parsed.values.length - 1] ?? middleBand.latest;

  return bollingerBandsResultSchema.parse({
    period: parsed.period,
    middle: middleBand.latest,
    upper,
    lower,
    bandwidth: upper - lower,
    position:
      latestPrice > upper
        ? "above_upper"
        : latestPrice < lower
          ? "below_lower"
          : latestPrice > middleBand.latest
            ? "upper_half"
            : latestPrice < middleBand.latest
              ? "lower_half"
              : "middle",
  });
};

export type BollingerBandsResult = z.infer<typeof bollingerBandsResultSchema>;
