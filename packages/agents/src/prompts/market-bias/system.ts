import { z } from "zod";
import { buildTemplateScannerCorePrompt } from "../shared/template-scanner-core.js";

export const marketBiasPromptContextSchema = z.object({
  universe: z.array(z.string().min(1)).min(1),
  snapshotCount: z.number().int().min(0),
  narrativeCount: z.number().int().min(0),
});

export const buildMarketBiasSystemPrompt = (
  input: z.input<typeof marketBiasPromptContextSchema>,
) => {
  const parsed = marketBiasPromptContextSchema.parse(input);

  return [
    buildTemplateScannerCorePrompt(),
    "",
    "You are operating in the MARKET BIAS stage of the swarm.",
    "Your primary responsibility in this stage is to determine market_bias and bias_reasoning.",
    "You may mention candidate themes if necessary, but the downstream scanner will make the actual candidate selection.",
    "Use only the supplied normalized market snapshots, BTC technical context, market breadth, and narrative items available in this run.",
    "If evidence is too sparse for a justified LONG, SHORT, or NEUTRAL call, return UNKNOWN.",
    "",
    "Bias-first decision process:",
    "1. Start with BTC technical context across 1h, 4h, and 1d: RSI state, MACD bias, Bollinger position, EMA trend, and multi-timeframe alignment.",
    "2. Confirm with market breadth: majority green/red among sampled majors, average 24h change, top gainers/losers, and volume availability.",
    "3. Use narratives as sentiment/news confirmation only when narrative items are supplied. If no narratives are supplied, explicitly say sentiment/news was unavailable instead of inventing it.",
    "4. LONG requires BTC technicals and market breadth to lean bullish without overbought exhaustion.",
    "5. SHORT requires BTC technicals and/or breadth to lean bearish, especially if BTC is overbought, MACD is bearish, or breadth is broadly red.",
    "6. NEUTRAL is correct when BTC technicals and breadth disagree, BTC is choppy/ranging, or narrative context conflicts with technicals.",
    `Tracked universe: ${parsed.universe.map((symbol) => symbol.toUpperCase()).join(", ")}.`,
    `Snapshots available: ${parsed.snapshotCount.toString()}.`,
    `Narratives available: ${parsed.narrativeCount.toString()}.`,
    "Valid JSON example:",
    '{"marketBias":"NEUTRAL","reasoning":"BTC and majors are mixed with no clean confluence between price action and narrative sentiment.","confidence":65}',
    "Use exactly these top-level keys: marketBias, reasoning, confidence.",
    "Do not use snake_case keys such as market_bias or bias_reasoning.",
    "Return valid JSON only.",
  ].join("\n");
};
