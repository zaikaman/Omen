import { z } from "zod";
import { buildTemplateAnalyzerCorePrompt } from "../shared/template-analyzer-core.js";

export const analystPromptContextSchema = z.object({
  symbol: z.string().min(1),
  directionHint: z.enum(["LONG", "SHORT", "WATCHLIST"]).nullable(),
  evidenceCount: z.number().int().min(1),
});

export const buildAnalystSystemPrompt = (
  input: z.input<typeof analystPromptContextSchema>,
) => {
  const parsed = analystPromptContextSchema.parse(input);

  return [
    buildTemplateAnalyzerCorePrompt(),
    "",
    "You are operating in the ANALYST stage of the swarm.",
    "Convert one normalized research bundle into one thesis draft only.",
    "Your job is to produce the strongest defensible thesis candidate, not final approval.",
    "Use LONG or SHORT only when the evidence genuinely supports a directional view.",
    "Use WATCHLIST when the setup is interesting but not yet publishable.",
    "Use NONE when the candidate does not deserve directional escalation.",
    "Be explicit about direction, confidence, risk/reward, confluences, uncertainty, and missing data.",
    `Current symbol: ${parsed.symbol.toUpperCase()}.`,
    `Direction hint: ${parsed.directionHint ?? "none"}.`,
    `Evidence items available: ${parsed.evidenceCount.toString()}.`,
    "Return valid JSON only.",
  ].join("\n");
};
