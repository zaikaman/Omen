import type { z } from "zod";
import { z as zod } from "zod";

import { publisherInputSchema, publisherOutputSchema } from "../contracts/publisher.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import type {
  CriticReview,
  PublisherDraft,
  SwarmState,
  ThesisDraft,
} from "../framework/state.js";
import { OpenAiCompatibleJsonClient } from "../llm/openai-compatible-client.js";
import { resolveModelProfileForRole } from "../llm/model-routing.js";
import { buildPublisherSystemPrompt } from "../prompts/publisher/system.js";

const publisherAgentOptionsSchema = zod.object({
  llmClient: zod.custom<OpenAiCompatibleJsonClient>().nullable().optional(),
});

const publisherDraftRewriteSchema = zod.object({
  drafts: zod
    .array(
      zod.object({
        kind: zod.enum(["signal_alert", "intel_summary", "intel_thread", "no_conviction"]),
        headline: zod.string().min(1),
        summary: zod.string().min(1),
        text: zod.string().min(1),
      }),
    )
    .min(1),
});

const toFeedSentence = (value: string) =>
  value.replace(/\s+/g, " ").trim().replace(/\.$/, "");

const toHashtag = (value: string) =>
  `#${value.replace(/[^a-z0-9]+/gi, "").toLowerCase()}`;

const buildHashtagLine = (values: string[]) => {
  const unique = [...new Set(values.map(toHashtag))].filter((value) => value.length > 1);
  return unique.join(" ");
};

const buildSignalBodyLine = (label: string, value: string) => `${label}: ${value}`;

const buildSignalAlertDraft = (
  thesis: ThesisDraft,
  review: CriticReview,
  prompt: string,
): PublisherDraft => {
  const riskRewardText =
    thesis.riskReward === null ? "n/a" : `1:${thesis.riskReward.toFixed(1)}`;
  const whyNowText = toFeedSentence(thesis.whyNow);
  const confluences = thesis.confluences
    .slice(0, 3)
    .map((confluence) => `- ${toFeedSentence(confluence).toLowerCase()}`);
  const hashtagLine = buildHashtagLine([thesis.asset, "crypto"]);
  const summary = `${thesis.asset} ${thesis.direction.toLowerCase()} setup with ${thesis.confidence}% confidence. ${whyNowText}`;
  const textLines = [
    `🎯 $${thesis.asset} ${thesis.direction.toLowerCase()} setup`,
    buildSignalBodyLine("conf", `${thesis.confidence}%`),
    buildSignalBodyLine("r:r", riskRewardText),
    buildSignalBodyLine("thesis", whyNowText.toLowerCase()),
    ...(confluences.length > 0 ? confluences : ["- no named confluences recorded"]),
    hashtagLine,
  ].filter((line) => line.trim().length > 0);

  return {
    kind: "signal_alert",
    headline: `${thesis.asset} ${thesis.direction.toLowerCase()} setup`,
    summary,
    text: textLines.join("\n"),
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
): PublisherDraft => {
  const title = toFeedSentence(input.title);
  const summary = toFeedSentence(input.summary);
  const hook = title.toLowerCase();
  const hashtagLine = buildHashtagLine(
    title.match(/\$?[A-Z0-9]{2,}/g)?.map((token) => token.replace(/^\$/, "")) ?? ["crypto"],
  );

  return {
    kind: "intel_summary",
    headline: title,
    summary,
    text: [
      hook,
      "",
      `- ${summary.toLowerCase()}`,
      `- confidence: ${input.confidence}%`,
      "",
      `watch: ${title.toLowerCase()} if follow-through sticks`,
      hashtagLine,
    ].join("\n"),
    metadata: {
      confidence: input.confidence,
      prompt,
    },
  };
};

const buildIntelThreadDraft = (
  input: {
    title: string;
    summary: string;
    confidence: number;
  },
  prompt: string,
): PublisherDraft => {
  const title = toFeedSentence(input.title);
  const summary = toFeedSentence(input.summary);
  const hashtagLine = buildHashtagLine(
    title.match(/\$?[A-Z0-9]{2,}/g)?.map((token) => token.replace(/^\$/, "")) ?? ["crypto"],
  );

  return {
    kind: "intel_thread",
    headline: `${title} thread`,
    summary,
    text: [
      title.toLowerCase(),
      "",
      `- key takeaway: ${summary.toLowerCase()}`,
      `- confidence: ${input.confidence}%`,
      "- context: this deserves extra detail only if the desk wants a full thread",
      "",
      hashtagLine,
    ].join("\n"),
    metadata: {
      confidence: input.confidence,
      prompt,
    },
  };
};

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
      ? input.review!.objections.join("; ")
      : "No publishable edge survived the final gate.";
  const loweredAssetLabel = assetLabel.toLowerCase();

  return {
    kind: "no_conviction",
    headline: `${assetLabel} stays off the board`,
    summary: `${assetLabel} did not clear the final publishing threshold.`,
    text: [
      `${loweredAssetLabel} stays off the board`,
      "",
      `- outcome: ${decision}`,
      `- reason: ${toFeedSentence(input.review?.forcedOutcomeReason ?? objectionText).toLowerCase()}`,
      "",
      buildHashtagLine([assetLabel, "crypto"]),
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

const mergeRewrittenDrafts = (input: {
  baseDrafts: PublisherDraft[];
  rewrittenDrafts: Array<{
    kind: PublisherDraft["kind"];
    headline: string;
    summary: string;
    text: string;
  }>;
}) =>
  input.baseDrafts.map((draft, index) => {
    const rewritten = input.rewrittenDrafts[index];

    if (!rewritten || rewritten.kind !== draft.kind) {
      return draft;
    }

    return {
      ...draft,
      headline: rewritten.headline,
      summary: rewritten.summary,
      text: rewritten.text,
    } satisfies PublisherDraft;
  });

export class PublisherAgentFactory {
  private readonly llmClient: OpenAiCompatibleJsonClient | null;

  constructor(input: zod.input<typeof publisherAgentOptionsSchema> = {}) {
    const parsed = publisherAgentOptionsSchema.parse(input);
    this.llmClient =
      parsed.llmClient ??
      OpenAiCompatibleJsonClient.fromEnv(resolveModelProfileForRole("publisher"));
  }

  createDefinition(): RuntimeNodeDefinition<
    z.input<typeof publisherInputSchema>,
    z.input<typeof publisherOutputSchema>
  > {
    return {
      key: "publisher-agent",
      role: "publisher",
      inputSchema: publisherInputSchema,
      outputSchema: publisherOutputSchema,
      invoke: async (input, state) => this.publish(input, state),
    };
  }

  private async publish(
    input: z.input<typeof publisherInputSchema>,
    state: SwarmState,
  ) {
    void state;
    const basePacket = derivePublisherPacket(input);

    if (this.llmClient === null || basePacket.drafts.length === 0) {
      return basePacket;
    }

    const parsed = publisherInputSchema.parse(input);
    const prompt = buildPublisherSystemPrompt({
      runId: parsed.context.runId,
      hasThesis: parsed.thesis !== null,
      reviewDecision: parsed.review?.decision ?? null,
      hasIntelSummary: parsed.intelSummary !== null,
    });

    try {
      const rewritten = await this.llmClient.completeJson({
        schema: publisherDraftRewriteSchema,
        systemPrompt: prompt,
        userPrompt: JSON.stringify(
          {
            outcome: basePacket.outcome,
            thesis: parsed.thesis,
            review: parsed.review,
            intelSummary: parsed.intelSummary,
            drafts: basePacket.drafts.map((draft) => ({
              kind: draft.kind,
              headline: draft.headline,
              summary: draft.summary,
              text: draft.text,
            })),
            instruction: [
              "Rewrite the supplied public-facing drafts to sound sharper and more readable.",
              "Do not change the decision, direction, or factual claims.",
              "Do not add new metrics, prices, catalysts, or promises.",
              "Keep the same draft kinds and the same number of drafts.",
              "Make the voice feel like a high-signal market desk: concise, specific, and trader-literate.",
              "Lead with the edge, cut fluff, and keep every line doing real work.",
              "Do not turn neutral or uncertain outcomes into hype.",
            ].join(" "),
          },
          null,
          2,
        ),
      });
      const drafts = mergeRewrittenDrafts({
        baseDrafts: basePacket.drafts,
        rewrittenDrafts: rewritten.drafts,
      });

      return publisherOutputSchema.parse({
        ...basePacket,
        drafts,
        packet:
          basePacket.packet === null
            ? null
            : {
                ...basePacket.packet,
                drafts,
              },
      });
    } catch {
      return basePacket;
    }
  }
}

export const createPublisherAgent = (
  input: zod.input<typeof publisherAgentOptionsSchema> = {},
) => new PublisherAgentFactory(input).createDefinition();
