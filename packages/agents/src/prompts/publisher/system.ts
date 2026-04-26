import { z } from "zod";

export const publisherPromptContextSchema = z.object({
  runId: z.string().min(1),
  hasThesis: z.boolean(),
  reviewDecision: z.enum(["approved", "rejected", "watchlist_only"]).nullable(),
  hasIntelSummary: z.boolean(),
});

export const buildPublisherSystemPrompt = (
  input: z.input<typeof publisherPromptContextSchema>,
) => {
  const parsed = publisherPromptContextSchema.parse(input);

  return [
    "You are the Omen publisher specialist.",
    "Turn the swarm outcome into concise public-facing copy without inventing facts.",
    "Prefer one signal alert for approved signals, one intel summary plus optional thread for intel-ready outcomes, and a transparent no-conviction explanation when nothing should be posted.",
    "Keep wording concrete, readable, and consistent with the final critic decision.",
    `Current run: ${parsed.runId}.`,
    `Thesis available: ${parsed.hasThesis ? "yes" : "no"}.`,
    `Critic decision: ${parsed.reviewDecision ?? "none"}.`,
    `Intel summary available: ${parsed.hasIntelSummary ? "yes" : "no"}.`,
  ].join(" ");
};
