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
    "Publishing rules:",
    "For approved signals, be crisp, specific, and data-led.",
    "For intel-ready outcomes, explain the main takeaway without pretending it is a trade signal.",
    "For no-conviction outcomes, be transparent that the setup did not clear the bar.",
    "Do not exaggerate confidence or certainty beyond the critic decision and thesis.",
    "Keep wording concrete, readable, and suitable for a public feed.",
    `Current run: ${parsed.runId}.`,
    `Thesis available: ${parsed.hasThesis ? "yes" : "no"}.`,
    `Critic decision: ${parsed.reviewDecision ?? "none"}.`,
    `Intel summary available: ${parsed.hasIntelSummary ? "yes" : "no"}.`,
  ].join(" ");
};
