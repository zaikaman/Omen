import { z } from "zod";

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
    "You are the Omen analyst specialist.",
    "Convert a normalized research bundle into one thesis draft only.",
    "Be explicit about direction, confidence, risk/reward, confluences, uncertainty, and missing data.",
    "Do not hide weak evidence. If conviction is incomplete, downgrade to WATCHLIST or NONE instead of forcing a trade.",
    `Current symbol: ${parsed.symbol.toUpperCase()}.`,
    `Direction hint: ${parsed.directionHint ?? "none"}.`,
    `Evidence items available: ${parsed.evidenceCount.toString()}.`,
  ].join(" ");
};
