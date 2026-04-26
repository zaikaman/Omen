import { z } from "zod";

export const priceSeriesSchema = z.array(z.number().finite()).min(2);

export const movingAverageInputSchema = z.object({
  values: priceSeriesSchema,
  period: z.number().int().min(2),
});

export const movingAverageSeriesPointSchema = z.object({
  index: z.number().int().min(0),
  value: z.number(),
});

export const smaResultSchema = z.object({
  period: z.number().int().min(2),
  latest: z.number(),
  slope: z.number(),
  series: z.array(movingAverageSeriesPointSchema),
});

export const emaResultSchema = z.object({
  period: z.number().int().min(2),
  latest: z.number(),
  slope: z.number(),
  multiplier: z.number(),
  series: z.array(movingAverageSeriesPointSchema),
});

export const calculateSma = (
  input: z.input<typeof movingAverageInputSchema>,
) => {
  const parsed = movingAverageInputSchema.parse(input);

  if (parsed.values.length < parsed.period) {
    throw new Error("SMA requires at least `period` values.");
  }

  const series = parsed.values.slice(parsed.period - 1).map((_, offset) => {
    const window = parsed.values.slice(offset, offset + parsed.period);
    const value = window.reduce((sum, entry) => sum + entry, 0) / parsed.period;

    return movingAverageSeriesPointSchema.parse({
      index: offset + parsed.period - 1,
      value,
    });
  });

  const latest = series[series.length - 1]?.value ?? 0;
  const previous = series[series.length - 2]?.value ?? latest;

  return smaResultSchema.parse({
    period: parsed.period,
    latest,
    slope: latest - previous,
    series,
  });
};

export const calculateEma = (
  input: z.input<typeof movingAverageInputSchema>,
) => {
  const parsed = movingAverageInputSchema.parse(input);

  if (parsed.values.length < parsed.period) {
    throw new Error("EMA requires at least `period` values.");
  }

  const multiplier = 2 / (parsed.period + 1);
  const seed =
    parsed.values.slice(0, parsed.period).reduce((sum, entry) => sum + entry, 0) /
    parsed.period;

  const series: Array<z.infer<typeof movingAverageSeriesPointSchema>> = [
    movingAverageSeriesPointSchema.parse({
      index: parsed.period - 1,
      value: seed,
    }),
  ];

  let previous = seed;

  for (let index = parsed.period; index < parsed.values.length; index += 1) {
    const current = (parsed.values[index] - previous) * multiplier + previous;
    previous = current;

    series.push(
      movingAverageSeriesPointSchema.parse({
        index,
        value: current,
      }),
    );
  }

  const latest = series[series.length - 1]?.value ?? seed;
  const prior = series[series.length - 2]?.value ?? latest;

  return emaResultSchema.parse({
    period: parsed.period,
    latest,
    slope: latest - prior,
    multiplier,
    series,
  });
};

export type PriceSeries = z.infer<typeof priceSeriesSchema>;
export type MovingAverageSeriesPoint = z.infer<typeof movingAverageSeriesPointSchema>;
export type SmaResult = z.infer<typeof smaResultSchema>;
export type EmaResult = z.infer<typeof emaResultSchema>;
