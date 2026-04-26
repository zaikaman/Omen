import { BinanceMarketService, type MarketCandle } from "@omen/market-data";
import { z } from "zod";

import {
  chartVisionFrameSchema,
  chartVisionInputSchema,
  chartVisionOutputSchema,
} from "../contracts/chart-vision.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import { evidenceItemSchema, type SwarmState } from "../framework/state.js";
import { OpenAiCompatibleVisionClient } from "../llm/openai-compatible-vision-client.js";
import { buildChartVisionSystemPrompt } from "../prompts/chart-vision/system.js";
import { ChartImageService } from "../services/chart-image-service.js";

const chartVisionAgentOptionsSchema = z.object({
  marketData: z.custom<BinanceMarketService>().optional(),
  chartImageService: z.custom<ChartImageService>().optional(),
  visionClient: z.custom<OpenAiCompatibleVisionClient>().nullable().optional(),
});

const chartVisionAnalysisSchema = z.object({
  frames: z
    .array(
      z.object({
        timeframe: z.enum(["15m", "1h", "4h"]),
        analysis: z.string().min(1),
      }),
    )
    .min(1),
  summary: z.string().min(1),
});

const TIMEFRAMES = [
  { timeframe: "15m", limit: 96 },
  { timeframe: "1h", limit: 96 },
  { timeframe: "4h", limit: 90 },
] as const;

const summarizeCandlesFallback = (
  symbol: string,
  timeframe: "15m" | "1h" | "4h",
  candles: MarketCandle[],
) => {
  const first = candles[0]?.close ?? 0;
  const last = candles.at(-1)?.close ?? 0;
  const highest = Math.max(...candles.map((candle) => candle.high));
  const lowest = Math.min(...candles.map((candle) => candle.low));
  const direction =
    last > first * 1.01
      ? "trend is leaning upward"
      : last < first * 0.99
        ? "trend is leaning downward"
        : "price is ranging";

  return `${symbol.toUpperCase()} ${timeframe} chart shows ${direction}, with visible range between ${lowest.toFixed(2)} and ${highest.toFixed(2)} and the latest close near ${last.toFixed(2)}.`;
};

const buildChartEvidence = (input: {
  symbol: string;
  timeframe: "15m" | "1h" | "4h";
  analysis: string;
  description: string;
}) =>
  evidenceItemSchema.parse({
    category: "chart",
    summary: `${input.symbol.toUpperCase()} ${input.timeframe} chart: ${input.analysis}`,
    sourceLabel: "Chart Vision",
    sourceUrl: null,
    structuredData: {
      symbol: input.symbol.toUpperCase(),
      timeframe: input.timeframe,
      chartDescription: input.description,
    },
  });

export class ChartVisionAgentFactory {
  private readonly marketData: BinanceMarketService;

  private readonly chartImageService: ChartImageService;

  private readonly visionClient: OpenAiCompatibleVisionClient | null;

  constructor(input: z.input<typeof chartVisionAgentOptionsSchema> = {}) {
    const parsed = chartVisionAgentOptionsSchema.parse(input);
    this.marketData = parsed.marketData ?? new BinanceMarketService();
    this.chartImageService = parsed.chartImageService ?? new ChartImageService();
    this.visionClient = parsed.visionClient ?? OpenAiCompatibleVisionClient.fromEnv();
  }

  createDefinition(): RuntimeNodeDefinition<
    z.input<typeof chartVisionInputSchema>,
    z.input<typeof chartVisionOutputSchema>
  > {
    return {
      key: "chart-vision-agent",
      role: "chart_vision",
      inputSchema: chartVisionInputSchema,
      outputSchema: chartVisionOutputSchema,
      invoke: async (input, state) => this.inspect(input, state),
    };
  }

  private async inspect(
    input: z.input<typeof chartVisionInputSchema>,
    state: SwarmState,
  ) {
    void state;
    const parsed = chartVisionInputSchema.parse(input);
    const symbol = parsed.candidate.symbol.toUpperCase();
    const candlesByFrame = await Promise.all(
      TIMEFRAMES.map(async (frame) => {
        const candles = await this.marketData.getCandles({
          symbol,
          interval: frame.timeframe,
          limit: frame.limit,
        });

        if (!candles.ok) {
          return {
            timeframe: frame.timeframe,
            candles: null,
            error: candles.error.message,
          };
        }

        return {
          timeframe: frame.timeframe,
          candles: candles.value,
          error: null,
        };
      }),
    );
    const missingDataNotes = candlesByFrame
      .filter((frame) => frame.candles === null)
      .map(
        (frame) =>
          `Chart candles missing for ${symbol} ${frame.timeframe}: ${frame.error ?? "unknown error"}`,
      );
    const availableFrames = candlesByFrame.filter(
      (frame): frame is { timeframe: "15m" | "1h" | "4h"; candles: MarketCandle[]; error: null } =>
        frame.candles !== null,
    );

    if (availableFrames.length === 0) {
      return chartVisionOutputSchema.parse({
        candidate: parsed.candidate,
        frames: [
          chartVisionFrameSchema.parse({
            timeframe: "1h",
            analysis: `${symbol} chart vision was unavailable because no candle data could be loaded.`,
            chartDescription: `${symbol} chart images could not be generated.`,
            imageMimeType: "image/png",
            imageWidth: 1,
            imageHeight: 1,
          }),
        ],
        chartSummary: `${symbol} chart confirmation unavailable due to missing candles.`,
        evidence: [
          buildChartEvidence({
            symbol,
            timeframe: "1h",
            analysis: `${symbol} chart confirmation unavailable due to missing candles.`,
            description: `${symbol} chart images could not be generated.`,
          }),
        ],
        missingDataNotes,
      });
    }

    const renderedFrames = await Promise.all(
      availableFrames.map(async (frame) => ({
        timeframe: frame.timeframe,
        image: await this.chartImageService.generateCandlestickChart({
          symbol,
          timeframe: frame.timeframe,
          candles: frame.candles,
        }),
        candles: frame.candles,
      })),
    );

    const modelAnalysis = await this.inspectWithVisionModel({
      symbol,
      directionHint: parsed.candidate.directionHint,
      renderedFrames,
    });
    const frames = renderedFrames.map((frame) => {
      const matchingAnalysis = modelAnalysis?.frames.find(
        (entry) => entry.timeframe === frame.timeframe,
      );
      const analysis =
        matchingAnalysis?.analysis ??
        summarizeCandlesFallback(symbol, frame.timeframe, frame.candles);

      return chartVisionFrameSchema.parse({
        timeframe: frame.timeframe,
        analysis,
        chartDescription: frame.image.description,
        imageMimeType: frame.image.mimeType,
        imageWidth: frame.image.width,
        imageHeight: frame.image.height,
      });
    });
    const chartSummary =
      modelAnalysis?.summary ??
      frames.map((frame) => `${frame.timeframe}: ${frame.analysis}`).join(" ");

    return chartVisionOutputSchema.parse({
      candidate: parsed.candidate,
      frames,
      chartSummary,
      evidence: frames.map((frame) =>
        buildChartEvidence({
          symbol,
          timeframe: frame.timeframe,
          analysis: frame.analysis,
          description: frame.chartDescription,
        }),
      ),
      missingDataNotes,
    });
  }

  private async inspectWithVisionModel(input: {
    symbol: string;
    directionHint: "LONG" | "SHORT" | "WATCHLIST" | null;
    renderedFrames: Array<{
      timeframe: "15m" | "1h" | "4h";
      image: {
        base64: string;
        mimeType: string;
        width: number;
        height: number;
        description: string;
      };
      candles: MarketCandle[];
    }>;
  }) {
    if (this.visionClient === null) {
      return null;
    }

    try {
      return await this.visionClient.completeJson({
        schema: chartVisionAnalysisSchema,
        systemPrompt: buildChartVisionSystemPrompt({
          symbol: input.symbol,
          directionHint: input.directionHint,
          timeframes: input.renderedFrames.map((frame) => frame.timeframe),
        }),
        userPrompt: JSON.stringify(
          {
            symbol: input.symbol,
            directionHint: input.directionHint,
            frames: input.renderedFrames.map((frame) => ({
              timeframe: frame.timeframe,
              chartDescription: frame.image.description,
              candleCount: frame.candles.length,
              latestClose: frame.candles.at(-1)?.close ?? null,
            })),
            instruction:
              "Analyze the supplied chart images in order and return one short analysis per timeframe plus one cross-timeframe summary for the downstream analyst.",
          },
          null,
          2,
        ),
        images: input.renderedFrames.map((frame) => ({
          base64: frame.image.base64,
          mimeType: frame.image.mimeType,
        })),
      });
    } catch {
      return null;
    }
  }
}

export const createChartVisionAgent = (
  input: z.input<typeof chartVisionAgentOptionsSchema> = {},
) => new ChartVisionAgentFactory(input).createDefinition();
