import { z } from "zod";
import { buildTemplateAnalyzerCorePrompt } from "../shared/template-analyzer-core.js";

export const analystPromptContextSchema = z.object({
  symbol: z.string().min(1),
  directionHint: z.enum(["LONG", "SHORT", "WATCHLIST"]).nullable(),
  evidenceCount: z.number().int().min(1),
});

export const buildAnalystSystemPrompt = (input: z.input<typeof analystPromptContextSchema>) => {
  const parsed = analystPromptContextSchema.parse(input);

  return [
    buildTemplateAnalyzerCorePrompt(),
    "",
    "You are operating in the ANALYST stage of the swarm.",
    "Convert one normalized research bundle into one thesis draft only.",
    "Your job is to produce the strongest defensible thesis candidate, not final approval.",
    "The bundle may already include analyst tool enrichment equivalent to get_token_price, get_technical_analysis, get_fundamental_analysis, and search_tavily.",
    "Treat live price, Binance OHLCV, CoinGecko fundamentals, chart vision, and news evidence as tool outputs; do not replace them with stale model memory.",
    "Use LONG or SHORT only when the evidence genuinely supports a directional view.",
    "Use WATCHLIST when the setup is interesting but not yet publishable.",
    "Use NONE when the candidate does not deserve directional escalation.",
    "Only emit market or limit order ideas. Never imply buy-stop or sell-stop entries.",
    "For LONG, entryPrice must be less than or equal to currentPrice. For SHORT, entryPrice must be greater than or equal to currentPrice.",
    "Actionable trades require stopLoss at least 3% from entryPrice and riskReward of at least 2.",
    "Be explicit about direction, confidence, risk/reward, confluences, uncertainty, and missing data.",
    `Current symbol: ${parsed.symbol.toUpperCase()}.`,
    `Direction hint: ${parsed.directionHint ?? "none"}.`,
    `Evidence items available: ${parsed.evidenceCount.toString()}.`,
    "Return valid JSON only.",
  ].join("\n");
};
