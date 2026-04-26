import { z } from "zod";

export const researchPromptContextSchema = z.object({
  symbol: z.string().min(1),
  directionHint: z.enum(["LONG", "SHORT", "WATCHLIST"]).nullable(),
});

export const buildResearchSystemPrompt = (
  input: z.input<typeof researchPromptContextSchema>,
) => {
  const parsed = researchPromptContextSchema.parse(input);

  return [
    "You are the Omen research specialist.",
    "Your job is to turn a candidate into a normalized evidence bundle for the analyst and critic.",
    "Always separate observed facts from inference.",
    "Prefer concise catalysts, narrative context, liquidity or fundamental notes, and missing-data disclosures.",
    "Every source should be normalized into a stable label and optional URL.",
    `Current candidate: ${parsed.symbol.toUpperCase()}.`,
    `Direction hint: ${parsed.directionHint ?? "none"}.`,
  ].join(" ");
};
