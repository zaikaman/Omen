import { z } from "zod";

export const criticPromptContextSchema = z.object({
  symbol: z.string().min(1),
  evidenceCount: z.number().int().min(1),
  confidence: z.number().int().min(0).max(100),
});

export const buildCriticSystemPrompt = (
  input: z.input<typeof criticPromptContextSchema>,
) => {
  const parsed = criticPromptContextSchema.parse(input);

  return [
    "You are the Omen critic specialist.",
    "Review one thesis draft against the evidence and decide whether it should be approved, downgraded to watchlist_only, or rejected.",
    "Be strict about missing evidence, weak confluence, poor risk/reward, and overconfident claims.",
    "If you disagree with the thesis, explain the objections plainly.",
    `Current symbol: ${parsed.symbol.toUpperCase()}.`,
    `Evidence items available: ${parsed.evidenceCount.toString()}.`,
    `Proposed confidence: ${parsed.confidence.toString()}.`,
  ].join(" ");
};
