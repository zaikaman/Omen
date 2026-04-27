import {
  OMEN_DISCLAIMER,
  outboundPostPayloadSchema,
  xPostDraftSchema,
  type Intel,
  type OutboundPostPayload,
  type Signal,
  type XPostDraft,
} from "@omen/shared";

const trimToLength = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

const toHashtag = (value: string) =>
  `#${value
    .replace(/^\$/, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toLowerCase()}`;

const buildHashtagLine = (values: string[]) =>
  [...new Set(values.map(toHashtag))].filter((value) => value.length > 1).join(" ");

const formatPrice = (value: number) => {
  if (value >= 100) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }

  if (value >= 1) {
    return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }

  return value.toLocaleString("en-US", { maximumFractionDigits: 8 });
};

const formatPercent = (value: number) => {
  const rounded = Number(value.toFixed(1));
  const prefix = rounded > 0 ? "+" : "";

  return `${prefix}${rounded}%`;
};

const calculateMovePercent = (
  entry: number | null,
  exit: number | null,
  direction: Signal["direction"],
) => {
  if (entry === null || exit === null || entry === 0) {
    return null;
  }

  const multiplier = direction === "SHORT" ? -1 : 1;

  return ((exit - entry) / entry) * 100 * multiplier;
};

const normalizeAnalysisLine = (value: string) =>
  value.replace(/\s+/g, " ").replace(/\.$/, "").toLowerCase().trim();

export const formatSignalPost = (
  signal: Pick<
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
  >,
): XPostDraft =>
  xPostDraftSchema.parse({
    text: trimToLength(
      [
        `${signal.tradingStyle === "swing_trade" ? "\u{1F4C8}" : "\u{1F3AF}"} $${signal.asset} ${signal.tradingStyle === "swing_trade" ? "swing trade" : "day trade"}`,
        `\u23F1\uFE0F hold: ${signal.expectedDuration ?? "8-16h"}`,
        ...(signal.entryPrice !== null ? [`entry: $${formatPrice(signal.entryPrice)}`] : []),
        ...(signal.targetPrice !== null
          ? [
              `target: $${formatPrice(signal.targetPrice)}${
                calculateMovePercent(signal.entryPrice, signal.targetPrice, signal.direction) ===
                null
                  ? ""
                  : ` (${formatPercent(
                      calculateMovePercent(
                        signal.entryPrice,
                        signal.targetPrice,
                        signal.direction,
                      ) ?? 0,
                    )})`
              }`,
            ]
          : []),
        ...(signal.stopLoss !== null
          ? [
              `stop: $${formatPrice(signal.stopLoss)}${
                calculateMovePercent(signal.entryPrice, signal.stopLoss, signal.direction) === null
                  ? ""
                  : ` (${formatPercent(
                      calculateMovePercent(signal.entryPrice, signal.stopLoss, signal.direction) ??
                        0,
                    )})`
              }`,
            ]
          : []),
        `r:r: ${signal.riskReward === null ? "n/a" : `1:${signal.riskReward.toFixed(1)}`}`,
        `conf: ${signal.confidence}%`,
        normalizeAnalysisLine(
          signal.confluences.length > 0
            ? signal.confluences.slice(0, 3).join(" + ")
            : signal.whyNow,
        ),
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

export const formatIntelPost = (
  intel: Pick<Intel, "title" | "summary" | "confidence" | "symbols">,
): XPostDraft =>
  xPostDraftSchema.parse({
    text: trimToLength(
      [
        `omen intel: ${intel.title.toLowerCase()}`,
        "",
        `- ${normalizeAnalysisLine(intel.summary)}`,
        ...(intel.symbols.length > 0
          ? [
              `- watch: ${intel.symbols.map((symbol) => `$${symbol.replace(/^\$/, "")}`).join(" / ")}`,
            ]
          : []),
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

  return outboundPostPayloadSchema.parse({
    text: summary.text,
    thread: [],
    metadata: {
      formatter: "intel_summary:v1",
      threadPartCount: 0,
    },
  });
};
