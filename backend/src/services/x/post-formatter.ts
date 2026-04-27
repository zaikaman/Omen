import {
  OMEN_DISCLAIMER,
  outboundPostPayloadSchema,
  xPostDraftSchema,
  type Intel,
  type OutboundPostPayload,
  type Signal,
  type XPostDraft,
} from "@omen/shared";

import { buildIntelThreadParts } from "./intel-thread-builder";

const trimToLength = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
};

const toHashtag = (value: string) =>
  `#${value.replace(/[^a-z0-9]+/gi, "").toLowerCase()}`;

const buildHashtagLine = (values: string[]) =>
  [...new Set(values.map(toHashtag))].filter((value) => value.length > 1).join(" ");

export const formatSignalPost = (signal: Pick<
  Signal,
  | "asset"
  | "direction"
  | "confidence"
  | "whyNow"
  | "riskReward"
  | "confluences"
  | "tradingStyle"
  | "expectedDuration"
  | "entryPrice"
  | "targetPrice"
  | "stopLoss"
  | "orderType"
>): XPostDraft =>
  xPostDraftSchema.parse({
    text: trimToLength(
      [
        `$${signal.asset} ${signal.direction} ${signal.tradingStyle === "swing_trade" ? "swing trade" : "day trade"}`,
        `order: ${signal.orderType ?? "market"}`,
        `hold: ${signal.expectedDuration ?? "8-16 hours"}`,
        ...(signal.entryPrice !== null ? [`entry: $${signal.entryPrice}`] : []),
        ...(signal.targetPrice !== null ? [`target: $${signal.targetPrice}`] : []),
        ...(signal.stopLoss !== null ? [`stop: $${signal.stopLoss}`] : []),
        `conf: ${signal.confidence}%`,
        `r:r: ${signal.riskReward === null ? "n/a" : `1:${signal.riskReward.toFixed(1)}`}`,
        `thesis: ${signal.whyNow.toLowerCase()}`,
        ...(signal.confluences.length > 0
          ? signal.confluences.slice(0, 2).map((confluence) => `- ${confluence.toLowerCase()}`)
          : []),
        buildHashtagLine([signal.asset, "crypto"]),
      ].join("\n"),
      280,
    ),
    replyToTweetId: null,
    quoteTweetId: null,
    attachmentUrl: null,
    communityId: null,
    isNoteTweet: false,
    mediaIds: [],
    scheduleFor: null,
  });

export const formatIntelPost = (intel: Pick<
  Intel,
  "title" | "summary" | "confidence" | "symbols"
>): XPostDraft =>
  xPostDraftSchema.parse({
    text: trimToLength(
      [
        intel.title.toLowerCase(),
        "",
        `- ${intel.summary.toLowerCase()}`,
        `- confidence: ${intel.confidence}%`,
        "",
        buildHashtagLine(intel.symbols.length > 0 ? intel.symbols : ["crypto"]),
      ].join("\n"),
      280,
    ),
    replyToTweetId: null,
    quoteTweetId: null,
    attachmentUrl: null,
    communityId: null,
    isNoteTweet: false,
    mediaIds: [],
    scheduleFor: null,
  });

export const formatThreadPosts = (parts: string[]): XPostDraft[] =>
  parts.map((part) =>
    xPostDraftSchema.parse({
      text: trimToLength(`${part}\n\n${OMEN_DISCLAIMER}`, 280),
      replyToTweetId: null,
      quoteTweetId: null,
      attachmentUrl: null,
      communityId: null,
      isNoteTweet: false,
      mediaIds: [],
      scheduleFor: null,
    }),
  );

export const formatSignalPostPayload = (
  signal: Parameters<typeof formatSignalPost>[0],
): OutboundPostPayload =>
  outboundPostPayloadSchema.parse({
    text: formatSignalPost(signal).text,
    thread: [],
    metadata: {
      formatter: "signal_alert:v1",
    },
  });

export const formatIntelPostPayload = (
  intel: Pick<Intel, "title" | "summary" | "body" | "confidence" | "symbols">,
): OutboundPostPayload => {
  const summary = formatIntelPost(intel);
  const thread = buildIntelThreadParts(intel).slice(1);

  return outboundPostPayloadSchema.parse({
    text: summary.text,
    thread,
    metadata: {
      formatter: "intel_summary:v1",
      threadPartCount: thread.length,
    },
  });
};
