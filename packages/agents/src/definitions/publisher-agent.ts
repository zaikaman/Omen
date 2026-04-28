import type { z } from "zod";
import { z as zod } from "zod";

import { publisherInputSchema, publisherOutputSchema } from "../contracts/publisher.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import type { CriticReview, PublisherDraft, SwarmState, ThesisDraft } from "../framework/state.js";
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

const toFeedSentence = (value: string) => value.replace(/\s+/g, " ").trim().replace(/\.$/, "");

const toHashtag = (value: string) => `#${value.replace(/[^a-z0-9]+/gi, "").toLowerCase()}`;

const buildHashtagLine = (values: string[]) => {
  const unique = [...new Set(values.map(toHashtag))].filter((value) => value.length > 1);
  return unique.join(" ");
};

const trimToLength = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const splitIntelSentences = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => toFeedSentence(part).toLowerCase())
    .filter((part) => part.length > 0);

const stripGenericIntelTitle = (value: string) =>
  toFeedSentence(value)
    .toLowerCase()
    .replace(/^omen intel:\s*/i, "")
    .replace(/\bmarket market intel\b/i, "market intel")
    .replace(/\bmarket intel\b$/i, "")
    .trim();

const buildSignalBodyLine = (label: string, value: string) => `${label}: ${value}`;

const buildSignalAlertDraft = (thesis: ThesisDraft, review: CriticReview): PublisherDraft => {
  const riskRewardText = thesis.riskReward === null ? "n/a" : `1:${thesis.riskReward.toFixed(1)}`;
  const orderTypeText = thesis.orderType ?? "market";
  const tradingStyleText = thesis.tradingStyle ?? "day_trade";
  const durationText = thesis.expectedDuration ?? "8-16 hours";
  const whyNowText = toFeedSentence(thesis.whyNow);
  const confluences = thesis.confluences
    .slice(0, 3)
    .map((confluence) => `- ${toFeedSentence(confluence).toLowerCase()}`);
  const hashtagLine = buildHashtagLine([thesis.asset, "crypto"]);
  const summary = `${thesis.asset} ${thesis.direction.toLowerCase()} setup with ${thesis.confidence}% confidence. ${whyNowText}`;
  const textLines = [
    `${tradingStyleText === "swing_trade" ? "📈" : "🎯"} $${thesis.asset} ${tradingStyleText === "swing_trade" ? "swing trade" : "day trade"}`,
    buildSignalBodyLine("order", orderTypeText),
    buildSignalBodyLine("hold", durationText),
    ...(thesis.entryPrice !== null ? [buildSignalBodyLine("entry", `$${thesis.entryPrice}`)] : []),
    ...(thesis.targetPrice !== null
      ? [buildSignalBodyLine("target", `$${thesis.targetPrice}`)]
      : []),
    ...(thesis.stopLoss !== null ? [buildSignalBodyLine("stop", `$${thesis.stopLoss}`)] : []),
    buildSignalBodyLine("r:r", riskRewardText),
    buildSignalBodyLine("conf", `${thesis.confidence}%`),
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
    },
  };
};

const buildIntelSummaryDraft = (input: {
  topic: string;
  insight: string;
  category: string;
  title: string;
  summary: string;
  confidence: number;
  generatedTweetText?: string | null;
}): PublisherDraft => {
  if (input.generatedTweetText) {
    return {
      kind: "intel_summary",
      headline: toFeedSentence(input.title),
      summary: toFeedSentence(input.summary),
      text: trimToLength(input.generatedTweetText, 280),
      metadata: {
        confidence: input.confidence,
        source: "generator-agent",
      },
    };
  }

  const title = toFeedSentence(input.title);
  const summary = toFeedSentence(input.summary);
  const insight = toFeedSentence(input.insight);
  const hook =
    stripGenericIntelTitle(title) ||
    splitIntelSentences(summary)[0]?.replace(/^fresh market intelligence scan found\s*/i, "") ||
    "crypto narratives shifting";
  const bullets = splitIntelSentences(summary)
    .filter((sentence) => sentence !== hook)
    .filter((sentence) => !sentence.includes("fresh market intelligence scan found"))
    .filter((sentence) => !sentence.includes("not enough value"))
    .slice(0, 3)
    .map((sentence) => `- ${sentence}`);
  const hashtagLine = buildHashtagLine(
    title.match(/\$?[A-Z0-9]{2,}/g)?.map((token) => token.replace(/^\$/, "")) ?? ["crypto"],
  );
  const watchLine = `watch ${input.topic.toLowerCase()} if follow-through sticks`;

  return {
    kind: "intel_summary",
    headline: title,
    summary,
    text: trimToLength(
      [
        hook,
        "",
        ...(bullets.length > 0 ? bullets : [`- ${insight.toLowerCase()}`]),
        "",
        watchLine,
        hashtagLine,
      ].join("\n"),
      280,
    ),
    metadata: {
      confidence: input.confidence,
    },
  };
};

const buildNoConvictionDraft = (input: {
  thesis: ThesisDraft | null;
  review: CriticReview | null;
}): PublisherDraft => {
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
    },
  };
};

const isApprovedSignal = (input: z.infer<typeof publisherInputSchema>) =>
  input.thesis !== null &&
  input.review?.decision === "approved" &&
  (input.thesis.direction === "LONG" || input.thesis.direction === "SHORT");

export const derivePublisherPacket = (input: z.input<typeof publisherInputSchema>) => {
  const parsed = publisherInputSchema.parse(input);

  if (isApprovedSignal(parsed) && parsed.thesis !== null && parsed.review !== null) {
    const drafts: PublisherDraft[] = [buildSignalAlertDraft(parsed.thesis, parsed.review)];

    if (parsed.intelSummary !== null) {
      drafts.push(
        buildIntelSummaryDraft({
          ...parsed.intelSummary,
          generatedTweetText: parsed.generatedContent?.tweetText ?? null,
        }),
      );
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
      buildIntelSummaryDraft({
        ...parsed.intelSummary,
        generatedTweetText: parsed.generatedContent?.tweetText ?? null,
      }),
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
      drafts: [buildNoConvictionDraft({ thesis: parsed.thesis, review: parsed.review })],
    });
  }

  return publisherOutputSchema.parse({
    outcome: "no_conviction",
    packet: null,
    drafts: [buildNoConvictionDraft({ thesis: parsed.thesis, review: null })],
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

  private async publish(input: z.input<typeof publisherInputSchema>, state: SwarmState) {
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

export const createPublisherAgent = (input: zod.input<typeof publisherAgentOptionsSchema> = {}) =>
  new PublisherAgentFactory(input).createDefinition();
