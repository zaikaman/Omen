import { z } from "zod";

export const timeframeAlignmentInputSchema = z.object({
  timeframes: z
    .array(
      z.object({
        timeframe: z.string().min(1),
        trend: z.enum(["bullish", "bearish", "neutral"]),
        confidence: z.number().min(0).max(100),
      }),
    )
    .min(2),
});

export const timeframeAlignmentResultSchema = z.object({
  dominantTrend: z.enum(["bullish", "bearish", "neutral"]),
  alignedTimeframes: z.array(z.string().min(1)),
  conflictingTimeframes: z.array(z.string().min(1)),
  confidence: z.number().min(0).max(100),
});

export const assessMultiTimeframeAlignment = (
  input: z.input<typeof timeframeAlignmentInputSchema>,
) => {
  const parsed = timeframeAlignmentInputSchema.parse(input);
  const scores = parsed.timeframes.reduce(
    (accumulator, timeframe) => {
      if (timeframe.trend === "bullish") {
        accumulator.bullish += timeframe.confidence;
      } else if (timeframe.trend === "bearish") {
        accumulator.bearish += timeframe.confidence;
      } else {
        accumulator.neutral += timeframe.confidence;
      }

      return accumulator;
    },
    { bullish: 0, bearish: 0, neutral: 0 },
  );

  const dominantTrend =
    scores.bullish > scores.bearish && scores.bullish >= scores.neutral
      ? "bullish"
      : scores.bearish > scores.bullish && scores.bearish >= scores.neutral
        ? "bearish"
        : "neutral";

  const alignedTimeframes = parsed.timeframes
    .filter((timeframe) => timeframe.trend === dominantTrend)
    .map((timeframe) => timeframe.timeframe);
  const conflictingTimeframes = parsed.timeframes
    .filter((timeframe) => timeframe.trend !== dominantTrend)
    .map((timeframe) => timeframe.timeframe);
  const totalConfidence = parsed.timeframes.reduce(
    (sum, timeframe) => sum + timeframe.confidence,
    0,
  );
  const dominantConfidence =
    dominantTrend === "bullish"
      ? scores.bullish
      : dominantTrend === "bearish"
        ? scores.bearish
        : scores.neutral;

  return timeframeAlignmentResultSchema.parse({
    dominantTrend,
    alignedTimeframes,
    conflictingTimeframes,
    confidence: totalConfidence === 0 ? 0 : (dominantConfidence / totalConfidence) * 100,
  });
};

export type TimeframeAlignmentResult = z.infer<typeof timeframeAlignmentResultSchema>;
