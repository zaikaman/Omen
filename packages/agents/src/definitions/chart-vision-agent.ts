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
import {
  ChartImageService,
  type ChartImageResult,
} from "../services/chart-image-service.js";

const chartVisionAgentOptionsSchema = z.object({
  marketData: z.custom<BinanceMarketService>().optional(),
  chartImageService: z.custom<ChartImageService>().optional(),
  visionClient: z.custom<OpenAiCompatibleVisionClient>().nullable().optional(),
});

const chartVisionAnalysisSchema = z.preprocess(
  (value) => {
    if (
      value &&
      typeof value === "object" &&
      !("summary" in value) &&
      "chartSummary" in value
    ) {
      return {
        ...value,
        summary: (value as { chartSummary?: unknown }).chartSummary,
      };
    }

    return value;
  },
  z.object({
    frames: z
      .array(
        z.object({
          timeframe: z.enum(["15m", "1h", "4h"]),
          analysis: z.string().min(1),
        }),
      )
      .min(1),
    summary: z.string().min(1),
  }),
);
type ChartVisionAnalysis = z.infer<typeof chartVisionAnalysisSchema>;

const TIMEFRAMES = [
  { timeframe: "15m", limit: 96 },
  { timeframe: "1h", limit: 96 },
  { timeframe: "4h", limit: 90 },
] as const;
const MAX_CHART_VISION_ATTEMPTS = 3;

type RenderedChartFrame = {
  timeframe: "15m" | "1h" | "4h";
  image: ChartImageResult;
  candles: MarketCandle[];
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
    this.visionClient =
      "visionClient" in input
        ? (parsed.visionClient ?? null)
        : OpenAiCompatibleVisionClient.fromEnv();
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

    const renderedFrames: RenderedChartFrame[] = [];

    for (const frame of availableFrames) {
      renderedFrames.push({
        timeframe: frame.timeframe,
        image: await this.chartImageService.generateCandlestickChart({
          symbol,
          timeframe: frame.timeframe,
          candles: frame.candles,
        }),
        candles: frame.candles,
      });
    }

    const modelAnalysis = await this.inspectWithVisionModel({
      symbol,
      directionHint: parsed.candidate.directionHint,
      renderedFrames,
    });
    const frames = renderedFrames.map((frame) => {
      const matchingAnalysis = modelAnalysis?.frames.find(
        (entry) => entry.timeframe === frame.timeframe,
      );
      if (!matchingAnalysis) {
        throw new Error(`Chart vision model did not return analysis for ${frame.timeframe}.`);
      }

      return chartVisionFrameSchema.parse({
        timeframe: frame.timeframe,
        analysis: matchingAnalysis.analysis,
        chartDescription: frame.image.description,
        imageMimeType: frame.image.mimeType,
        imageWidth: frame.image.width,
        imageHeight: frame.image.height,
      });
    });
    const chartSummary = modelAnalysis.summary;

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
      throw new Error("Chart vision analysis requires a configured vision LLM client.");
    }

    const expectedTimeframes = input.renderedFrames.map((frame) => frame.timeframe);
    const baseUserPrompt = JSON.stringify(
      {
        symbol: input.symbol,
        directionHint: input.directionHint,
        frames: input.renderedFrames.map((frame) => ({
          timeframe: frame.timeframe,
          chartDescription: frame.image.description,
          candleCount: frame.candles.length,
          latestClose: frame.candles.at(-1)?.close ?? null,
        })),
        requiredTimeframes: expectedTimeframes,
        instruction:
          "Analyze the supplied chart images in order and return one short analysis for every required timeframe plus one cross-timeframe summary for the downstream analyst.",
      },
      null,
      2,
    );
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_CHART_VISION_ATTEMPTS; attempt += 1) {
      const userPrompt =
        attempt === 1
          ? baseUserPrompt
          : [
              baseUserPrompt,
              "",
              `PREVIOUS ATTEMPT ${String(attempt - 1)} FAILED.`,
              `Error: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
              `Return exactly one frame analysis for each required timeframe: ${expectedTimeframes.join(", ")}.`,
              "Return only valid JSON with top-level frames and summary.",
            ].join("\n");

      try {
        const analysis = await this.visionClient.completeJson<ChartVisionAnalysis>({
          schema: chartVisionAnalysisSchema,
          systemPrompt: buildChartVisionSystemPrompt({
            symbol: input.symbol,
            directionHint: input.directionHint,
            timeframes: expectedTimeframes,
          }),
          userPrompt,
          images: input.renderedFrames.map((frame) => ({
            base64: frame.image.base64,
            mimeType: frame.image.mimeType,
          })),
        });
        const returnedTimeframes = new Set(analysis.frames.map((frame) => frame.timeframe));
        const missingTimeframes = expectedTimeframes.filter(
          (timeframe) => !returnedTimeframes.has(timeframe),
        );

        if (missingTimeframes.length > 0) {
          throw new Error(
            `Chart vision model did not return analysis for ${missingTimeframes.join(", ")}.`,
          );
        }

        return analysis;
      } catch (error) {
        lastError = error;

        if (attempt >= MAX_CHART_VISION_ATTEMPTS) {
          throw new Error(
            `Chart vision model analysis failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }

    throw new Error("Chart vision model analysis failed.");
  }
}

export const createChartVisionAgent = (
  input: z.input<typeof chartVisionAgentOptionsSchema> = {},
) => new ChartVisionAgentFactory(input).createDefinition();
