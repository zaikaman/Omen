import { z } from "zod";
import { buildTemplateScannerCorePrompt } from "../shared/template-scanner-core.js";

export const researchPromptContextSchema = z.object({
  symbol: z.string().min(1),
  directionHint: z.enum(["LONG", "SHORT", "WATCHLIST"]).nullable(),
});

export const buildResearchSystemPrompt = (
  input: z.input<typeof researchPromptContextSchema>,
) => {
  const parsed = researchPromptContextSchema.parse(input);

  return [
    buildTemplateScannerCorePrompt(),
    "",
    "You are operating in the RESEARCH stage of the swarm.",
    "Treat the selected candidate as a continuation of the same scanner logic and gather the strongest evidence that explains why this token truly matches the chosen bias.",
    "Always separate observed facts from inference.",
    "Preserve conflicting evidence instead of smoothing it over.",
    "If data is missing, state that explicitly instead of guessing.",
    "Your evidence bundle must make it easy for the analyst and critic to verify whether the scanner logic actually holds up for this candidate.",
    `Current candidate: ${parsed.symbol.toUpperCase()}.`,
    `Direction hint: ${parsed.directionHint ?? "none"}.`,
    "Valid JSON example:",
    '{"evidence":[{"category":"market","summary":"ETC traded near 8.42 with muted 24h change and no clear directional impulse.","sourceLabel":"Binance","sourceUrl":null,"structuredData":{"symbol":"ETC","price":8.42,"change24hPercent":0.8}},{"category":"sentiment","summary":"Social context is mixed, so the setup remains watchlist-only until stronger confirmation appears.","sourceLabel":"Omen research","sourceUrl":null,"structuredData":{}}],"narrativeSummary":"ETC has market-led watchlist evidence but lacks a strong catalyst or sentiment confirmation.","missingDataNotes":[]}',
    "Evidence category must be one of: market, technical, liquidity, funding, fundamental, catalyst, sentiment, chart.",
    "Every evidence item must include category, summary, sourceLabel, sourceUrl, and structuredData.",
    "Use sourceUrl:null when no URL is available. Use structuredData:{} when no structured data is available.",
    "Do not use categories like web, x, news, context, or social.",
    "Return valid JSON only.",
  ].join("\n");
};
