import { describe, expect, it } from "vitest";

import {
  assessMultiTimeframeAlignment,
  calculateBollingerBands,
  calculateEma,
  calculateMacd,
  calculateRsi,
  calculateSma,
  detectSupportResistance,
} from "../src/index.js";

describe("indicator primitives", () => {
  const closes = [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111];

  it("calculates moving averages and RSI with explainable outputs", () => {
    const sma = calculateSma({ values: closes, period: 5 });
    const ema = calculateEma({ values: closes, period: 5 });
    const rsi = calculateRsi({ values: closes, period: 5 });

    expect(sma.latest).toBeGreaterThan(0);
    expect(ema.latest).toBeGreaterThan(0);
    expect(rsi.latest).toBeGreaterThanOrEqual(0);
    expect(rsi.latest).toBeLessThanOrEqual(100);
  });

  it("calculates MACD and Bollinger Bands", () => {
    const longerSeries = Array.from({ length: 40 }, (_, index) => 100 + index);
    const macd = calculateMacd({ values: longerSeries });
    const bands = calculateBollingerBands({ values: longerSeries });

    expect(["bullish", "bearish", "neutral"]).toContain(macd.bias);
    expect(Number.isFinite(macd.macdLine)).toBe(true);
    expect(Number.isFinite(macd.signalLine)).toBe(true);
    expect(Number.isFinite(macd.histogram)).toBe(true);
    expect(bands.upper).toBeGreaterThan(bands.middle);
    expect(bands.lower).toBeLessThan(bands.middle);
  });

  it("detects support/resistance and multi-timeframe alignment", () => {
    const supportResistance = detectSupportResistance({
      candles: [
        { high: 110, low: 100, close: 105 },
        { high: 112, low: 101, close: 109 },
        { high: 115, low: 103, close: 114 },
        { high: 111, low: 102, close: 104 },
      ],
    });
    const alignment = assessMultiTimeframeAlignment({
      timeframes: [
        { timeframe: "15m", trend: "bullish", confidence: 70 },
        { timeframe: "1h", trend: "bullish", confidence: 80 },
        { timeframe: "4h", trend: "neutral", confidence: 40 },
      ],
    });

    expect(supportResistance.supports.length).toBeGreaterThan(0);
    expect(supportResistance.resistances.length).toBeGreaterThan(0);
    expect(alignment.dominantTrend).toBe("bullish");
    expect(alignment.alignedTimeframes).toContain("1h");
  });
});
