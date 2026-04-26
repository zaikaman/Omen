import sharp from "sharp";
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
type MarketCandle = z.infer<typeof marketCandleSchema>;

const COLORS = {
  bg: "#131722",
  grid: "#2a2e39",
  separator: "#363c4e",
  bullish: "#26a69a",
  bearish: "#ef5350",
  volumeBull: "rgba(38,166,154,0.50)",
  volumeBear: "rgba(239,83,80,0.50)",
  sma20: "#2962ff",
  sma50: "#ff6d00",
  bbLine: "#1f8eed",
  bbFill: "rgba(31,142,237,0.10)",
  text: "#d1d4dc",
  textMuted: "#787b86",
  textBright: "#ffffff",
  priceLabelText: "#ffffff",
} as const;

const escapeXml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");

const formatNumber = (value: number, digits: number) => value.toFixed(digits);

const formatPrice = (value: number) => {
  if (value >= 10000) {
    return value.toFixed(0);
  }

  if (value >= 1000) {
    return value.toFixed(1);
  }

  if (value >= 100) {
    return value.toFixed(1);
  }

  if (value >= 1) {
    return value.toFixed(2);
  }

  if (value >= 0.01) {
    return value.toFixed(4);
  }

  return value.toFixed(6);
};

const formatPriceCompact = (value: number) => {
  if (value >= 1) {
    return value.toFixed(1);
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
    return sum / period;
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
      upper: mean + stdDev * standardDeviation,
      middle: mean,
      lower: mean - stdDev * standardDeviation,
    };
  });

const calculateNiceStep = (range: number, targetSteps: number) => {
  const roughStep = range / targetSteps;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;

  if (normalized <= 1) {
    return magnitude;
  }

  if (normalized <= 2) {
    return 2 * magnitude;
  }

  if (normalized <= 5) {
    return 5 * magnitude;
  }

  return 10 * magnitude;
};

const buildLinePath = (
  xValues: number[],
  yValues: Array<number | null>,
) => {
  const commands: string[] = [];
  let started = false;

  for (let index = 0; index < xValues.length; index += 1) {
    const yValue = yValues[index];

    if (yValue === null || Number.isNaN(yValue)) {
      started = false;
      continue;
    }

    const command = started ? "L" : "M";
    commands.push(
      `${command} ${formatNumber(xValues[index], 2)} ${formatNumber(yValue, 2)}`,
    );
    started = true;
  }

  return commands.join(" ");
};

const buildBandPath = (
  xValues: number[],
  upper: Array<number | null>,
  lower: Array<number | null>,
) => {
  const top: string[] = [];
  const bottom: string[] = [];

  for (let index = 0; index < xValues.length; index += 1) {
    if (upper[index] !== null) {
      top.push(
        `${top.length === 0 ? "M" : "L"} ${formatNumber(xValues[index], 2)} ${formatNumber(upper[index]!, 2)}`,
      );
    }
  }

  for (let index = xValues.length - 1; index >= 0; index -= 1) {
    if (lower[index] !== null) {
      bottom.push(
        `L ${formatNumber(xValues[index], 2)} ${formatNumber(lower[index]!, 2)}`,
      );
    }
  }

  if (top.length === 0 || bottom.length === 0) {
    return "";
  }

  return `${top.join(" ")} ${bottom.join(" ")} Z`;
};

const countDirectionalCandles = (candles: MarketCandle[]) =>
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
  candles: MarketCandle[],
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
  candles: MarketCandle[],
) => {
  const closes = candles.map((candle) => candle.close);
  const first = closes[0] ?? 0;
  const last = closes.at(-1) ?? 0;
  const changePercent = first === 0 ? 0 : ((last - first) / first) * 100;
  const trend =
    changePercent > 2 ? "UPTREND" : changePercent < -2 ? "DOWNTREND" : "SIDEWAYS";
  const recent = candles.slice(-50);
  const swingHigh = Math.max(...recent.map((candle) => candle.high));
  const swingLow = Math.min(...recent.map((candle) => candle.low));
  const rangePercent =
    ((swingHigh - swingLow) / Math.max(swingLow, 0.000001)) * 100;
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

const formatTimestampLabel = (timestamp: string) =>
  new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

export class ChartImageService {
  async generateCandlestickChart(
    input: ChartImageInput,
  ): Promise<ChartImageResult> {
    const parsed = chartImageServiceInputSchema.parse(input);
    const candles = parsed.candles;
    const width = parsed.width;
    const height = parsed.height;
    const padding = { top: 60, right: 120, bottom: 80, left: 20 };
    const volumeHeight = 100;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight =
      height - padding.top - padding.bottom - volumeHeight - 20;

    const prices = candles.flatMap((candle) => [candle.high, candle.low]);
    let minPrice = Math.min(...prices);
    let maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;
    minPrice -= priceRange * 0.05;
    maxPrice += priceRange * 0.05;

    const volumes = candles.map((candle) => candle.volume);
    const maxVolume = Math.max(...volumes);
    const candleWidth = Math.max(3, Math.floor((chartWidth / candles.length) * 0.7));
    const candleSpacing = chartWidth / candles.length;
    const wickWidth = Math.max(1, Math.floor(candleWidth / 4));

    const priceToY = (price: number) =>
      padding.top +
      chartHeight -
      ((price - minPrice) / (maxPrice - minPrice)) * chartHeight;
    const indexToX = (index: number) =>
      padding.left + candleSpacing * index + candleSpacing / 2;
    const volumeToY = (volume: number) => {
      const volumeAreaTop = height - padding.bottom - volumeHeight;
      return volumeAreaTop + volumeHeight - (volume / maxVolume) * volumeHeight;
    };

    const xValues = candles.map((_, index) => indexToX(index));
    const closes = candles.map((candle) => candle.close);
    const sma20 = calculateSma(closes, 20);
    const sma50 = calculateSma(closes, 50);
    const bbands = calculateBollingerBands(closes, 20, 2);
    const bbUpper = bbands.map((band) =>
      band === null ? null : priceToY(band.upper),
    );
    const bbMiddle = bbands.map((band) =>
      band === null ? null : priceToY(band.middle),
    );
    const bbLower = bbands.map((band) =>
      band === null ? null : priceToY(band.lower),
    );
    const bbPath = buildBandPath(xValues, bbUpper, bbLower);

    const priceStep = calculateNiceStep(maxPrice - minPrice, 15);
    const startPrice = Math.ceil(minPrice / priceStep) * priceStep;
    const yGridLines: string[] = [];
    const yLabels: string[] = [];

    for (let price = startPrice; price <= maxPrice; price += priceStep) {
      const y = priceToY(price);
      yGridLines.push(
        `<line x1="${formatNumber(padding.left, 2)}" y1="${formatNumber(y, 2)}" x2="${formatNumber(width - padding.right, 2)}" y2="${formatNumber(y, 2)}" stroke="${COLORS.grid}" stroke-width="0.5" />`,
      );
      yLabels.push(
        `<text x="${width - padding.right + 8}" y="${y + 5}" fill="${COLORS.text}" font-family="Arial, sans-serif" font-size="13" font-weight="700">${escapeXml(formatPrice(price))}</text>`,
      );
    }

    const verticalGridLines: string[] = [];
    const timeStep = Math.max(1, Math.floor(candles.length / 10));

    for (let index = 0; index < candles.length; index += timeStep) {
      const x = indexToX(index);
      verticalGridLines.push(
        `<line x1="${formatNumber(x, 2)}" y1="${padding.top}" x2="${formatNumber(x, 2)}" y2="${height - padding.bottom}" stroke="${COLORS.grid}" stroke-width="0.5" />`,
      );
    }

    const volumeBars = candles
      .map((candle, index) => {
        const x = indexToX(index) - candleWidth / 2;
        const y = volumeToY(candle.volume);
        const barHeight = height - padding.bottom - y;
        const fill =
          candle.close >= candle.open ? COLORS.volumeBull : COLORS.volumeBear;

        return `<rect x="${formatNumber(x, 2)}" y="${formatNumber(y, 2)}" width="${formatNumber(candleWidth, 2)}" height="${formatNumber(barHeight, 2)}" fill="${fill}" />`;
      })
      .join("");

    const candlesSvg = candles
      .map((candle, index) => {
        const x = indexToX(index);
        const openY = priceToY(candle.open);
        const closeY = priceToY(candle.close);
        const highY = priceToY(candle.high);
        const lowY = priceToY(candle.low);
        const isBullish = candle.close >= candle.open;
        const color = isBullish ? COLORS.bullish : COLORS.bearish;
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(1, Math.abs(closeY - openY));

        return [
          `<line x1="${formatNumber(x, 2)}" y1="${formatNumber(highY, 2)}" x2="${formatNumber(x, 2)}" y2="${formatNumber(lowY, 2)}" stroke="${color}" stroke-width="${wickWidth}" />`,
          `<rect x="${formatNumber(x - candleWidth / 2, 2)}" y="${formatNumber(bodyTop, 2)}" width="${formatNumber(candleWidth, 2)}" height="${formatNumber(bodyHeight, 2)}" fill="${color}" stroke="${color}" stroke-width="1" />`,
        ].join("");
      })
      .join("");

    const currentCandle = candles.at(-1)!;
    const currentPrice = currentCandle.close;
    const currentY = priceToY(currentPrice);
    const currentColor =
      currentCandle.close >= currentCandle.open ? COLORS.bullish : COLORS.bearish;
    const priceText = formatPriceCompact(currentPrice);
    const priceLabelWidth = Math.max(54, priceText.length * 8 + 16);
    const priceLabelX = width - padding.right + 5;
    const priceLabelY = currentY - 11;
    const priceChangePercent =
      ((currentPrice - candles[0].open) / candles[0].open) * 100;
    const priceChangeText = `${formatPriceCompact(currentPrice)} (${priceChangePercent >= 0 ? "+" : ""}${priceChangePercent.toFixed(2)}%)`;
    const ohlcInfo = {
      open: formatPriceCompact(currentCandle.open),
      high: formatPriceCompact(currentCandle.high),
      low: formatPriceCompact(currentCandle.low),
      close: formatPriceCompact(currentCandle.close),
    };

    const xLabels: string[] = [];
    const labelStep = Math.max(1, Math.floor(candles.length / 12));

    for (let index = 0; index < candles.length; index += labelStep) {
      const x = indexToX(index);
      const timeLabel = formatTimestampLabel(candles[index].timestamp);
      xLabels.push(
        `<text x="${formatNumber(x, 2)}" y="${height - padding.bottom + 16}" fill="${COLORS.textMuted}" font-family="Arial, sans-serif" font-size="10" text-anchor="middle">${escapeXml(timeLabel)}</text>`,
      );
    }

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${COLORS.bg}" />
  ${yGridLines.join("")}
  ${verticalGridLines.join("")}
  ${
    bbPath.length > 0
      ? `<path d="${bbPath}" fill="${COLORS.bbFill}" stroke="none" />`
      : ""
  }
  <line x1="${padding.left}" y1="${height - padding.bottom - volumeHeight - 10}" x2="${width - padding.right}" y2="${height - padding.bottom - volumeHeight - 10}" stroke="${COLORS.separator}" stroke-width="1" />
  ${volumeBars}
  ${candlesSvg}
  <path d="${buildLinePath(
    xValues,
    sma20.map((value) => (value === null ? null : priceToY(value))),
  )}" fill="none" stroke="${COLORS.sma20}" stroke-width="2" />
  <path d="${buildLinePath(
    xValues,
    sma50.map((value) => (value === null ? null : priceToY(value))),
  )}" fill="none" stroke="${COLORS.sma50}" stroke-width="2" />
  <path d="${buildLinePath(xValues, bbUpper)}" fill="none" stroke="${COLORS.bbLine}" stroke-width="1" />
  <path d="${buildLinePath(xValues, bbMiddle)}" fill="none" stroke="${COLORS.bbLine}" stroke-width="1" opacity="0.8" />
  <path d="${buildLinePath(xValues, bbLower)}" fill="none" stroke="${COLORS.bbLine}" stroke-width="1" />
  <line x1="${padding.left}" y1="${formatNumber(currentY, 2)}" x2="${width - padding.right}" y2="${formatNumber(currentY, 2)}" stroke="${currentColor}" stroke-width="1" stroke-dasharray="3 3" />
  <rect x="${formatNumber(priceLabelX, 2)}" y="${formatNumber(priceLabelY, 2)}" width="${formatNumber(priceLabelWidth, 2)}" height="22" fill="${currentColor}" />
  <text x="${formatNumber(priceLabelX + priceLabelWidth / 2, 2)}" y="${formatNumber(currentY + 4, 2)}" fill="${COLORS.priceLabelText}" font-family="Arial, sans-serif" font-size="12" font-weight="700" text-anchor="middle">${escapeXml(priceText)}</text>
  <text x="30" y="34" fill="${COLORS.textBright}" font-family="Arial, sans-serif" font-size="20" font-weight="700">${escapeXml(`${parsed.symbol.toUpperCase()}/USDT - ${parsed.timeframe.toUpperCase()}`)}</text>
  <text x="30" y="58" fill="${priceChangePercent >= 0 ? COLORS.bullish : COLORS.bearish}" font-family="Arial, sans-serif" font-size="16" font-weight="700">${escapeXml(priceChangeText)}</text>
  <line x1="270" y1="22" x2="290" y2="22" stroke="${COLORS.sma20}" stroke-width="3" />
  <text x="296" y="26" fill="${COLORS.text}" font-family="Arial, sans-serif" font-size="12">SMA 20</text>
  <line x1="350" y1="22" x2="370" y2="22" stroke="${COLORS.sma50}" stroke-width="3" />
  <text x="376" y="26" fill="${COLORS.text}" font-family="Arial, sans-serif" font-size="12">SMA 50</text>
  <rect x="430" y="16" width="20" height="12" fill="${COLORS.bbLine}" opacity="0.6" />
  <text x="456" y="26" fill="${COLORS.text}" font-family="Arial, sans-serif" font-size="12">BB(20,2)</text>
  <text x="${width - 155}" y="34" fill="${COLORS.textMuted}" font-family="Arial, sans-serif" font-size="12">O</text>
  <text x="${width - 138}" y="34" fill="${COLORS.text}" font-family="Arial, sans-serif" font-size="12">${escapeXml(ohlcInfo.open)}</text>
  <text x="${width - 95}" y="34" fill="${COLORS.textMuted}" font-family="Arial, sans-serif" font-size="12">H</text>
  <text x="${width - 78}" y="34" fill="${COLORS.bullish}" font-family="Arial, sans-serif" font-size="12">${escapeXml(ohlcInfo.high)}</text>
  <text x="${width - 155}" y="52" fill="${COLORS.textMuted}" font-family="Arial, sans-serif" font-size="12">L</text>
  <text x="${width - 138}" y="52" fill="${COLORS.bearish}" font-family="Arial, sans-serif" font-size="12">${escapeXml(ohlcInfo.low)}</text>
  <text x="${width - 95}" y="52" fill="${COLORS.textMuted}" font-family="Arial, sans-serif" font-size="12">C</text>
  <text x="${width - 78}" y="52" fill="${currentColor}" font-family="Arial, sans-serif" font-size="12">${escapeXml(ohlcInfo.close)}</text>
  ${yLabels.join("")}
  ${xLabels.join("")}
</svg>`;

    const buffer = await sharp(Buffer.from(svg)).png().toBuffer();

    return chartImageResultSchema.parse({
      base64: buffer.toString("base64"),
      mimeType: "image/png",
      width,
      height,
      description: buildChartDescription(
        parsed.symbol,
        parsed.timeframe,
        parsed.candles,
      ),
    });
  }
}
