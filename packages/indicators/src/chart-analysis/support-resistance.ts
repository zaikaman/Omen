import { z } from "zod";

export const supportResistanceCandleSchema = z.object({
  high: z.number(),
  low: z.number(),
  close: z.number(),
});

export const supportResistanceInputSchema = z.object({
  candles: z.array(supportResistanceCandleSchema).min(3),
  levels: z.number().int().min(1).max(5).default(3),
});

export const priceLevelSchema = z.object({
  price: z.number(),
  touches: z.number().int().min(1),
  type: z.enum(["support", "resistance"]),
});

export const supportResistanceResultSchema = z.object({
  supports: z.array(priceLevelSchema),
  resistances: z.array(priceLevelSchema),
});

const countTouches = (values: number[], target: number) =>
  values.reduce((count, value) => count + (Math.abs(value - target) < 1e-6 ? 1 : 0), 0);

export const detectSupportResistance = (
  input: z.input<typeof supportResistanceInputSchema>,
) => {
  const parsed = supportResistanceInputSchema.parse(input);
  const lows = [...parsed.candles.map((candle) => candle.low)].sort((a, b) => a - b);
  const highs = [...parsed.candles.map((candle) => candle.high)].sort((a, b) => b - a);

  const supports = lows.slice(0, parsed.levels).map((price) =>
    priceLevelSchema.parse({
      price,
      touches: countTouches(parsed.candles.map((candle) => candle.low), price),
      type: "support",
    }),
  );
  const resistances = highs.slice(0, parsed.levels).map((price) =>
    priceLevelSchema.parse({
      price,
      touches: countTouches(parsed.candles.map((candle) => candle.high), price),
      type: "resistance",
    }),
  );

  return supportResistanceResultSchema.parse({
    supports,
    resistances,
  });
};

export type PriceLevel = z.infer<typeof priceLevelSchema>;
export type SupportResistanceResult = z.infer<typeof supportResistanceResultSchema>;
