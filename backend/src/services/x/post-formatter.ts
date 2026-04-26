import {
  OMEN_DISCLAIMER,
  xPostDraftSchema,
  type Intel,
  type Signal,
  type XPostDraft,
} from "@omen/shared";

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
  "asset" | "direction" | "confidence" | "whyNow" | "riskReward" | "confluences"
>): XPostDraft =>
  xPostDraftSchema.parse({
    text: trimToLength(
      [
        `🎯 $${signal.asset} ${signal.direction.toLowerCase()} setup`,
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
