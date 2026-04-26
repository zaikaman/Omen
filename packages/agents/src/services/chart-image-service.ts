import type { ChartConfiguration } from "chart.js";
import { z } from "zod";

import { marketCandleSchema } from "@omen/market-data";

const chartImageServiceInputSchema = z.object({
  symbol: z.string().min(1),
  timeframe: z.enum(["15m", "1h", "4h"]),
  candles: z.array(marketCandleSchema).min(20),
  width: z.number().int().min(400).default(1600),
  height: z.number().int().min(300).default(900),
});

export const chartImageResultSchema = z.object({
  base64: z.string().min(1),
  mimeType: z.literal("image/png"),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  description: z.string().min(1),
});

type ChartImageInput = z.input<typeof chartImageServiceInputSchema>;
export type ChartImageResult = z.infer<typeof chartImageResultSchema>;

const formatPrice = (value: number) => {
  if (value >= 1000) {
    return value.toFixed(0);
  }

  if (value >= 1) {
    return value.toFixed(2);
  }

  return value.toFixed(4);
};

const calculateSma = (values: number[], period: number) =>
  values.map((_, index) => {
    if (index < period - 1) {
      return null;
    }

    const slice = values.slice(index - period + 1, index + 1);
    const sum = slice.reduce((acc, value) => acc + value, 0);
    return Number((sum / period).toFixed(6));
  });

const calculateBollingerBands = (values: number[], period = 20, stdDev = 2) =>
  values.map((_, index) => {
    if (index < period - 1) {
      return null;
    }

    const slice = values.slice(index - period + 1, index + 1);
    const mean = slice.reduce((acc, value) => acc + value, 0) / period;
    const variance =
      slice.reduce((acc, value) => acc + (value - mean) ** 2, 0) / period;
    const standardDeviation = Math.sqrt(variance);

    return {
      upper: Number((mean + stdDev * standardDeviation).toFixed(6)),
      middle: Number(mean.toFixed(6)),
      lower: Number((mean - stdDev * standardDeviation).toFixed(6)),
    };
  });

const countDirectionalCandles = (
  candles: Array<z.infer<typeof marketCandleSchema>>,
) =>
  candles.reduce(
    (acc, candle) => {
      if (candle.close > candle.open) {
        acc.green += 1;
      } else if (candle.close < candle.open) {
        acc.red += 1;
      }

      return acc;
    },
    { green: 0, red: 0 },
  );

const detectChartPatterns = (
  candles: Array<z.infer<typeof marketCandleSchema>>,
  trend: "UPTREND" | "DOWNTREND" | "SIDEWAYS",
) => {
  const patterns: string[] = [];
  const recent = candles.slice(-10);
  const highs = recent.map((candle) => candle.high);
  const lows = recent.map((candle) => candle.low);
  const higherHighs = highs.every(
    (value, index) => index === 0 || value >= highs[index - 1] * 0.99,
  );
  const higherLows = lows.every(
    (value, index) => index === 0 || value >= lows[index - 1] * 0.99,
  );
  const lowerHighs = highs.every(
    (value, index) => index === 0 || value <= highs[index - 1] * 1.01,
  );
  const lowerLows = lows.every(
    (value, index) => index === 0 || value <= lows[index - 1] * 1.01,
  );

  if (higherHighs && higherLows) {
    patterns.push("higher highs and higher lows");
  }

  if (lowerHighs && lowerLows) {
    patterns.push("lower highs and lower lows");
  }

  const consolidationRange =
    ((Math.max(...highs) - Math.min(...lows)) / (recent.at(-1)?.close ?? 1)) * 100;

  if (Number.isFinite(consolidationRange) && consolidationRange < 3) {
    patterns.push("tight consolidation");
  }

  const lastThree = candles.slice(-3);
  const last = lastThree[2];
  const previous = lastThree[1];

  if (last && previous) {
    if (
      last.close > last.open &&
      previous.close < previous.open &&
      last.open < previous.close &&
      last.close > previous.open
    ) {
      patterns.push("bullish engulfing");
    }

    if (
      last.close < last.open &&
      previous.close > previous.open &&
      last.open > previous.close &&
      last.close < previous.open
    ) {
      patterns.push("bearish engulfing");
    }

    const body = Math.abs(last.close - last.open);
    const range = last.high - last.low;
    const upperWick = last.high - Math.max(last.open, last.close);
    const lowerWick = Math.min(last.open, last.close) - last.low;

    if (range > 0 && body / range < 0.1) {
      patterns.push("doji-style indecision");
    }

    if (lowerWick > body * 2 && upperWick < body * 0.5 && trend === "DOWNTREND") {
      patterns.push("hammer-style reversal");
    }

    if (upperWick > body * 2 && lowerWick < body * 0.5 && trend === "UPTREND") {
      patterns.push("shooting-star rejection");
    }
  }

  return patterns;
};

const buildChartDescription = (
  symbol: string,
  timeframe: "15m" | "1h" | "4h",
  candles: Array<z.infer<typeof marketCandleSchema>>,
) => {
  const closes = candles.map((candle) => candle.close);
  const first = closes[0] ?? 0;
  const last = closes.at(-1) ?? 0;
  const changePercent =
    first === 0 ? 0 : ((last - first) / first) * 100;
  const trend =
    changePercent > 2 ? "UPTREND" : changePercent < -2 ? "DOWNTREND" : "SIDEWAYS";
  const recent = candles.slice(-50);
  const swingHigh = Math.max(...recent.map((candle) => candle.high));
  const swingLow = Math.min(...recent.map((candle) => candle.low));
  const rangePercent = ((swingHigh - swingLow) / Math.max(swingLow, 0.000001)) * 100;
  const { green, red } = countDirectionalCandles(recent);
  const momentum =
    green > red * 1.5 ? "BULLISH" : red > green * 1.5 ? "BEARISH" : "MIXED";
  const averageVolume =
    recent.slice(0, -5).reduce((sum, candle) => sum + candle.volume, 0) /
    Math.max(1, recent.length - 5);
  const latestVolume =
    recent.slice(-5).reduce((sum, candle) => sum + candle.volume, 0) /
    Math.max(1, Math.min(5, recent.length));
  const volumeChange =
    averageVolume > 0 ? ((latestVolume - averageVolume) / averageVolume) * 100 : 0;
  const volumeLabel =
    volumeChange > 50
      ? "volume increasing significantly"
      : volumeChange > 20
        ? "volume increasing"
        : volumeChange < -30
          ? "volume fading"
          : "volume stable";
  const distanceToHigh = ((swingHigh - last) / Math.max(last, 0.000001)) * 100;
  const distanceToLow = ((last - swingLow) / Math.max(last, 0.000001)) * 100;
  const pricePosition =
    distanceToHigh < 2
      ? "near resistance"
      : distanceToLow < 2
        ? "near support"
        : distanceToHigh < distanceToLow
          ? "closer to resistance"
          : "closer to support";
  const patterns = detectChartPatterns(candles, trend);

  return [
    `${symbol.toUpperCase()} ${timeframe} chart with candlestick structure, SMA 20, SMA 50, Bollinger Bands, and volume.`,
    `Price moved from ${formatPrice(first)} to ${formatPrice(last)} (${changePercent.toFixed(2)}%), which reads as ${trend.toLowerCase()}.`,
    `Momentum is ${momentum.toLowerCase()} with ${green.toString()} green candles versus ${red.toString()} red candles across the recent window.`,
    `Swing range spans ${formatPrice(swingLow)} to ${formatPrice(swingHigh)} (${rangePercent.toFixed(2)}%), leaving price ${pricePosition}.`,
    `${volumeLabel.charAt(0).toUpperCase()}${volumeLabel.slice(1)} (${volumeChange >= 0 ? "+" : ""}${volumeChange.toFixed(0)}% versus recent average).`,
    patterns.length > 0
      ? `Visible structure includes ${patterns.join(", ")}.`
      : "No standout continuation or reversal pattern is obvious beyond the current structure.",
  ].join(" ");
};

export class ChartImageService {
  async generateCandlestickChart(
    input: ChartImageInput,
  ): Promise<ChartImageResult> {
    const parsed = chartImageServiceInputSchema.parse(input);
    const labels = parsed.candles.map((candle) =>
      new Date(candle.timestamp).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
    const closes = parsed.candles.map((candle) => candle.close);
    const highs = parsed.candles.map((candle) => candle.high);
    const lows = parsed.candles.map((candle) => candle.low);
    const volumes = parsed.candles.map((candle) => candle.volume);
    const sma20 = calculateSma(closes, 20);
    const sma50 = calculateSma(closes, 50);
    const bbands = calculateBollingerBands(closes, 20, 2);
    const textColor = "#d1d4dc";
    const gridColor = "rgba(255,255,255,0.08)";
    const candleColors = parsed.candles.map((candle) =>
      candle.close >= candle.open ? "#26a69a" : "#ef5350",
    );
    const volumeColors = parsed.candles.map((candle) =>
      candle.close >= candle.open
        ? "rgba(38,166,154,0.35)"
        : "rgba(239,83,80,0.35)",
    );
    const configuration: ChartConfiguration = {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "High",
            data: highs,
            type: "line",
            borderColor: "rgba(38,166,154,0.4)",
            pointRadius: 0,
            borderWidth: 1,
            borderDash: [4, 4],
          },
          {
            label: "Low",
            data: lows,
            type: "line",
            borderColor: "rgba(239,83,80,0.4)",
            pointRadius: 0,
            borderWidth: 1,
            borderDash: [4, 4],
          },
          {
            label: "Close",
            data: closes,
            type: "line",
            borderColor: "#58a6ff",
            backgroundColor: "transparent",
            pointRadius: 0,
            borderWidth: 2,
            tension: 0.12,
          },
          {
            label: "SMA 20",
            data: sma20,
            type: "line",
            borderColor: "#2962ff",
            backgroundColor: "transparent",
            pointRadius: 0,
            borderWidth: 2,
            tension: 0.12,
          },
          {
            label: "SMA 50",
            data: sma50,
            type: "line",
            borderColor: "#ff6d00",
            backgroundColor: "transparent",
            pointRadius: 0,
            borderWidth: 2,
            tension: 0.12,
          },
          {
            label: "BB Upper",
            data: bbands.map((band) => band?.upper ?? null),
            type: "line",
            borderColor: "rgba(33,150,243,0.7)",
            backgroundColor: "transparent",
            pointRadius: 0,
            borderWidth: 1,
            borderDash: [6, 4],
            tension: 0.12,
          },
          {
            label: "BB Lower",
            data: bbands.map((band) => band?.lower ?? null),
            type: "line",
            borderColor: "rgba(33,150,243,0.7)",
            backgroundColor: "transparent",
            pointRadius: 0,
            borderWidth: 1,
            borderDash: [6, 4],
            tension: 0.12,
          },
          {
            label: "Volume",
            data: volumes,
            type: "bar",
            yAxisID: "volume",
            backgroundColor: volumeColors,
            borderColor: candleColors,
            borderWidth: 0,
            barThickness: 4,
          },
        ],
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `${parsed.symbol.toUpperCase()}/USDT ${parsed.timeframe.toUpperCase()} Chart`,
            color: textColor,
            font: {
              size: 18,
              weight: "bold",
            },
          },
          legend: {
            display: true,
            position: "top",
            labels: {
              color: textColor,
            },
          },
        },
        scales: {
          x: {
            grid: {
              color: gridColor,
            },
            ticks: {
              color: textColor,
              maxRotation: 45,
              minRotation: 45,
              maxTicksLimit: 14,
            },
          },
          y: {
            position: "right",
            grid: {
              color: gridColor,
            },
            ticks: {
              color: textColor,
              callback: (value) =>
                typeof value === "number" ? formatPrice(value) : String(value),
            },
          },
          volume: {
            position: "left",
            display: true,
            grid: {
              display: false,
            },
            ticks: {
              color: "#787b86",
            },
          },
        },
      },
    };
    const response = await fetch("https://quickchart.io/chart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        width: parsed.width,
        height: parsed.height,
        format: "png",
        version: "4",
        backgroundColor: "#131722",
        chart: configuration,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `QuickChart render failed with HTTP ${response.status.toString()}.`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return chartImageResultSchema.parse({
      base64: buffer.toString("base64"),
      mimeType: "image/png",
      width: parsed.width,
      height: parsed.height,
      description: buildChartDescription(
        parsed.symbol,
        parsed.timeframe,
        parsed.candles,
      ),
    });
  }
}
