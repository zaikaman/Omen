import type { z } from "zod";

import { publisherInputSchema, publisherOutputSchema } from "../contracts/publisher.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import type {
  CriticReview,
  PublisherDraft,
  SwarmState,
  ThesisDraft,
} from "../framework/state.js";
import { buildPublisherSystemPrompt } from "../prompts/publisher/system.js";

const buildSignalAlertDraft = (
  thesis: ThesisDraft,
  review: CriticReview,
  prompt: string,
): PublisherDraft => {
  const riskRewardText =
    thesis.riskReward === null ? "RR not available" : `RR ${thesis.riskReward.toFixed(2)}`;
  const confluenceText =
    thesis.confluences.length > 0
      ? thesis.confluences.slice(0, 3).join("; ")
      : "No named confluences recorded";

  return {
    kind: "signal_alert",
    headline: `${thesis.asset} ${thesis.direction} signal`,
    summary: `${thesis.asset} ${thesis.direction} setup with ${thesis.confidence}% confidence and ${riskRewardText}.`,
    text: [
      `${thesis.asset} ${thesis.direction} signal`,
      `Confidence: ${thesis.confidence}%`,
      riskRewardText,
      `Why now: ${thesis.whyNow}`,
      `Confluences: ${confluenceText}`,
    ].join("\n"),
    metadata: {
      candidateId: thesis.candidateId,
      decision: review.decision,
      direction: thesis.direction,
      prompt,
    },
  };
};

const buildIntelSummaryDraft = (
  input: {
    title: string;
    summary: string;
    confidence: number;
  },
  prompt: string,
): PublisherDraft => ({
  kind: "intel_summary",
  headline: input.title,
  summary: input.summary,
  text: `${input.title}\n${input.summary}\nConfidence: ${input.confidence}%`,
  metadata: {
    confidence: input.confidence,
    prompt,
  },
});

const buildIntelThreadDraft = (
  input: {
    title: string;
    summary: string;
    confidence: number;
  },
  prompt: string,
): PublisherDraft => ({
  kind: "intel_thread",
  headline: `${input.title} thread`,
  summary: input.summary,
  text: [
    input.title,
    `Key takeaway: ${input.summary}`,
    `Confidence: ${input.confidence}%`,
    "Thread this only if the coordinator decides the update deserves more context.",
  ].join("\n"),
  metadata: {
    confidence: input.confidence,
    prompt,
  },
});

const buildNoConvictionDraft = (
  input: {
    thesis: ThesisDraft | null;
    review: CriticReview | null;
  },
  prompt: string,
): PublisherDraft => {
  const assetLabel = input.thesis?.asset ?? "Current market setup";
  const decision = input.review?.decision ?? "no_conviction";
  const objectionText =
    (input.review?.objections.length ?? 0) > 0
      ? input.review?.objections.join("; ")
      : "No publishable edge survived the final gate.";

  return {
    kind: "no_conviction",
    headline: `${assetLabel} stays off the board`,
    summary: `${assetLabel} did not clear the final publishing threshold.`,
    text: [
      `${assetLabel} stays off the board.`,
      `Outcome: ${decision}.`,
      `Reasoning: ${input.review?.forcedOutcomeReason ?? objectionText}`,
    ].join("\n"),
    metadata: {
      decision,
      prompt,
    },
  };
};

const isApprovedSignal = (input: z.infer<typeof publisherInputSchema>) =>
  input.thesis !== null &&
  input.review?.decision === "approved" &&
  (input.thesis.direction === "LONG" || input.thesis.direction === "SHORT");

export const derivePublisherPacket = (input: z.input<typeof publisherInputSchema>) => {
  const parsed = publisherInputSchema.parse(input);
  const prompt = buildPublisherSystemPrompt({
    runId: parsed.context.runId,
    hasThesis: parsed.thesis !== null,
    reviewDecision: parsed.review?.decision ?? null,
    hasIntelSummary: parsed.intelSummary !== null,
  });

  if (isApprovedSignal(parsed) && parsed.thesis !== null && parsed.review !== null) {
    const drafts: PublisherDraft[] = [
      buildSignalAlertDraft(parsed.thesis, parsed.review, prompt),
    ];

    if (parsed.intelSummary !== null) {
      drafts.push(buildIntelSummaryDraft(parsed.intelSummary, prompt));
    }

    return publisherOutputSchema.parse({
      outcome: "approved",
      packet: {
        drafts,
        approvedReview: parsed.review,
      },
      drafts,
    });
  }

  if (parsed.intelSummary !== null) {
    const drafts: PublisherDraft[] = [
      buildIntelSummaryDraft(parsed.intelSummary, prompt),
      buildIntelThreadDraft(parsed.intelSummary, prompt),
    ];

    return publisherOutputSchema.parse({
      outcome: "intel_ready",
      packet: {
        drafts,
        approvedReview: null,
      },
      drafts,
    });
  }

  if (parsed.review !== null) {
    return publisherOutputSchema.parse({
      outcome: parsed.review.decision,
      packet: null,
      drafts: [buildNoConvictionDraft({ thesis: parsed.thesis, review: parsed.review }, prompt)],
    });
  }

  return publisherOutputSchema.parse({
    outcome: "no_conviction",
    packet: null,
    drafts: [buildNoConvictionDraft({ thesis: parsed.thesis, review: null }, prompt)],
  });
};

export const createPublisherAgent = (): RuntimeNodeDefinition<
  z.input<typeof publisherInputSchema>,
  z.input<typeof publisherOutputSchema>
> => ({
  key: "publisher-agent",
  role: "publisher",
  inputSchema: publisherInputSchema,
  outputSchema: publisherOutputSchema,
  async invoke(input: z.input<typeof publisherInputSchema>, state: SwarmState) {
    void state;
    return derivePublisherPacket(input);
  },
});
