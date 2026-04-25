import {
  OMEN_DISCLAIMER,
  xPostDraftSchema,
  type Signal,
  type Intel,
  type XPostDraft,
} from "@omen/shared";

const trimToLength = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

export const formatSignalPost = (signal: Pick<
  Signal,
  "asset" | "direction" | "confidence" | "whyNow"
>): XPostDraft =>
  xPostDraftSchema.parse({
    text: trimToLength(
      `Omen signal: ${signal.asset} ${signal.direction} (${signal.confidence}% confidence). ${signal.whyNow} ${OMEN_DISCLAIMER}`,
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
  "title" | "summary" | "confidence"
>): XPostDraft =>
  xPostDraftSchema.parse({
    text: trimToLength(
      `Omen intel: ${intel.title}. ${intel.summary} (${intel.confidence}% confidence). ${OMEN_DISCLAIMER}`,
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
      text: trimToLength(part, 280),
      replyToTweetId: null,
      quoteTweetId: null,
      attachmentUrl: null,
      communityId: null,
      isNoteTweet: false,
      mediaIds: [],
      scheduleFor: null,
    }),
  );
