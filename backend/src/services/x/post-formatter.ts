import {
  OMEN_DISCLAIMER,
  outboundPostPayloadSchema,
  xPostDraftSchema,
  type Intel,
  type OutboundPostPayload,
  type Signal,
  type XPostDraft,
} from "@omen/shared";

type IntelPostInput = Pick<Intel, "title" | "summary" | "symbols"> & {
  body?: string | null;
  generatedTweetText?: string | null;
  topic?: string | null;
};

const STANDARD_X_POST_LIMIT = 280;
const MAX_HOOK_LENGTH = 72;
const MAX_BULLET_LENGTH = 82;
const MAX_TAKE_LENGTH = 92;
const MAX_SIGNAL_ANALYSIS_LENGTH = 82;

const symbolHashtagMap: Record<string, string> = {
  ARB: "arbitrum",
  BTC: "bitcoin",
  DOGE: "dogecoin",
  ETH: "ethereum",
  SOL: "solana",
  SUI: "sui",
};

const trimToLength = (value: string, maxLength: number) => {
  if (value.length <= maxLength) {
    return value;
  }

  const trimmed = value.slice(0, maxLength).trimEnd();
  const lastSpace = trimmed.lastIndexOf(" ");

  return (lastSpace > maxLength * 0.65 ? trimmed.slice(0, lastSpace) : trimmed).trimEnd();
};

const trimLineToLength = (value: string, maxLength: number) =>
  trimToLength(value.replace(/\s+/g, " ").trim(), maxLength);

const toCashtag = (value: string) =>
  `$${value
    .replace(/^\$/, "")
    .replace(/[^a-z0-9]+/gi, "")
    .toUpperCase()}`;

const buildCashtags = (values: string[], limit = 3) =>
  [...new Set(values.map(toCashtag))]
    .filter((value) => value.length > 1)
    .slice(0, limit);

const joinWithCashtags = (value: string, symbols: string[], maxLength: number) => {
  const cashtags = buildCashtags(symbols);
  const suffix = cashtags.length > 0 ? ` ${cashtags.join(" ")}` : "";

  if (!suffix || value.includes(cashtags[0] ?? "\0")) {
    return trimLineToLength(value, maxLength);
  }

  return `${trimLineToLength(value, Math.max(1, maxLength - suffix.length))}${suffix}`;
};

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

const formatSignalStyle = (tradingStyle: Signal["tradingStyle"]) =>
  tradingStyle === "swing_trade" ? "swing trade" : "day trade";

const formatSignalHold = (signal: Pick<Signal, "expectedDuration" | "tradingStyle">) =>
  signal.expectedDuration ?? (signal.tradingStyle === "swing_trade" ? "3-5 days" : "8-16h");

const buildSignalAnalysis = (
  signal: Pick<Signal, "asset" | "confluences" | "whyNow">,
) => {
  const raw =
    signal.confluences.length > 0
      ? signal.confluences.slice(0, 3).join(" + ")
      : signal.whyNow;

  return trimLineToLength(normalizeAnalysisLine(raw), MAX_SIGNAL_ANALYSIS_LENGTH);
};

const buildSignalHashtag = (asset: string) => {
  const symbol = asset.replace(/^\$/, "").toUpperCase();
  const label = symbolHashtagMap[symbol] ?? symbol.toLowerCase();

  return `#${label}`;
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

const removeSourceNoise = (value: string) =>
  value
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\b[a-z0-9-]+(?:\.[a-z0-9-]+)+\s*:\s*/gi, "")
    .replace(/\s+-\s+[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\s*:)?\s*/gi, ". ")
    .replace(/\b(?:crypto news|market news|press release|sponsored)\s*:\s*/gi, "")
    .replace(/\s+/g, " ");

const normalizeAnalysisLine = (value: string) =>
  removeSourceNoise(value).replace(/\.$/, "").toLowerCase().trim();

const stripMarkdownForTweet = (value: string) =>
  value
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\[[^\]]+\]\([^)]+\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

const splitIntelSentences = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((part) => normalizeAnalysisLine(part))
    .filter((part) => part.length > 0);

const stripGenericIntelTitle = (value: string) =>
  normalizeAnalysisLine(value)
    .replace(/^omen intel:\s*/i, "")
    .replace(/\bmarket market intel\b/i, "market intel")
    .replace(/\bmarket intel\b$/i, "")
    .trim();

const buildIntelHook = (intel: Pick<Intel, "title" | "summary" | "symbols">) => {
  const title = stripGenericIntelTitle(intel.title);

  if (title.length > 0 && !/^market$/i.test(title)) {
    return joinWithCashtags(title, intel.symbols, MAX_HOOK_LENGTH);
  }

  const firstSentence = splitIntelSentences(intel.summary)[0] ?? "crypto narratives shifting";
  return joinWithCashtags(
    firstSentence.replace(/^fresh market intelligence scan found\s*/i, "").trim(),
    intel.symbols,
    MAX_HOOK_LENGTH,
  );
};

const buildIntelBullets = (summary: string, hook: string) =>
  splitIntelSentences(stripMarkdownForTweet(summary))
    .filter((sentence) => sentence !== normalizeAnalysisLine(hook))
    .filter((sentence) => !sentence.includes("fresh market intelligence scan found"))
    .filter((sentence) => !sentence.includes("not enough value"))
    .filter((sentence) => !sentence.includes("source coverage was thin"))
    .filter((sentence) => !sentence.includes("treat it as market intelligence first"))
    .filter((sentence) => sentence.length > 0)
    .slice(0, 3)
    .map((sentence) => `- ${trimLineToLength(sentence, MAX_BULLET_LENGTH - 2)}`);

const buildIntelTake = (intel: IntelPostInput) => {
  const tickers = intel.symbols
    .slice(0, 3)
    .map((symbol) => `$${symbol.replace(/^\$/, "").toUpperCase()}`)
    .join(" / ");
  const topic = normalizeAnalysisLine(intel.topic ?? intel.title ?? intel.summary ?? "");

  const take = tickers.length > 0
    ? `watch ${tickers} if ${topic || "this narrative"} gets follow-through`
    : `watch for rotation if ${topic || "this narrative"} gets follow-through`;

  return trimLineToLength(take, MAX_TAKE_LENGTH);
};

const compactPostLines = (lines: string[], maxLength = STANDARD_X_POST_LIMIT) => {
  const compacted = lines.filter((line, index, allLines) => {
    if (line.length > 0) {
      return true;
    }

    return allLines[index - 1]?.length && allLines[index + 1]?.length;
  });

  while (compacted.join("\n").length > maxLength && compacted.length > 3) {
    const bulletIndex = compacted.findLastIndex((line) => line.startsWith("- "));

    if (bulletIndex === -1) {
      break;
    }

    compacted.splice(bulletIndex, 1);
  }

  return trimToLength(compacted.join("\n"), maxLength);
};

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
    text: compactPostLines(
      [
        `${signal.direction === "SHORT" ? "📉" : "📈"} $${signal.asset.toUpperCase()} ${formatSignalStyle(signal.tradingStyle)}`,
        `order: ${signal.orderType ?? "market"}`,
        `⏱️ hold: ${formatSignalHold(signal)}`,
        signal.entryPrice !== null ? `entry: $${formatPrice(signal.entryPrice)}` : null,
        signal.targetPrice !== null
          ? `target: $${formatPrice(signal.targetPrice)}${
              calculateMovePercent(signal.entryPrice, signal.targetPrice, signal.direction) === null
                ? ""
                : ` (${formatPercent(
                    calculateMovePercent(signal.entryPrice, signal.targetPrice, signal.direction) ??
                      0,
                  )})`
            }`
          : null,
        signal.stopLoss !== null
          ? `stop: $${formatPrice(signal.stopLoss)}${
              calculateMovePercent(signal.entryPrice, signal.stopLoss, signal.direction) === null
                ? ""
                : ` (${formatPercent(
                    calculateMovePercent(signal.entryPrice, signal.stopLoss, signal.direction) ?? 0,
                  )})`
            }`
          : null,
        `r:r: ${signal.riskReward === null ? "n/a" : `1:${signal.riskReward.toFixed(1)}`}`,
        `conf: ${signal.confidence}%`,
        buildSignalAnalysis(signal),
        buildSignalHashtag(signal.asset),
      ].filter((line): line is string => line !== null),
      STANDARD_X_POST_LIMIT,
    ),
    replyToTweetId: null,
    quoteTweetId: null,
    attachmentUrl: null,
    communityId: null,
    isNoteTweet: false,
    mediaIds: [],
    scheduleFor: null,
  });

export const formatIntelPost = (intel: IntelPostInput): XPostDraft => {
  if (intel.generatedTweetText) {
    return xPostDraftSchema.parse({
      text: trimToLength(intel.generatedTweetText.trim(), 280),
      replyToTweetId: null,
      quoteTweetId: null,
      attachmentUrl: null,
      communityId: null,
      isNoteTweet: false,
      mediaIds: [],
      scheduleFor: null,
    });
  }

  const hook = buildIntelHook(intel);
  const sourceText = intel.body && intel.body.trim().length > intel.summary.length
    ? `${intel.summary}. ${intel.body}`
    : intel.summary;
  const bullets = buildIntelBullets(sourceText, hook);
  const fallbackBullet =
    bullets.length > 0
      ? []
      : [`- ${trimLineToLength(normalizeAnalysisLine(intel.summary), MAX_BULLET_LENGTH - 2)}`];

  return xPostDraftSchema.parse({
    text: compactPostLines([hook, "", ...bullets, ...fallbackBullet, buildIntelTake(intel)]),
    replyToTweetId: null,
    quoteTweetId: null,
    attachmentUrl: null,
    communityId: null,
    isNoteTweet: false,
    mediaIds: [],
    scheduleFor: null,
  });
};

export const formatThreadPosts = (parts: string[]): XPostDraft[] =>
  parts.map((part) =>
    xPostDraftSchema.parse({
      text: trimToLength(`${part}\n\n${OMEN_DISCLAIMER}`, STANDARD_X_POST_LIMIT),
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
  intel: IntelPostInput & Pick<Intel, "body" | "confidence">,
): OutboundPostPayload => {
  const summary = formatIntelPost(intel);

  return outboundPostPayloadSchema.parse({
    text: summary.text,
    thread: [],
    metadata: {
      formatter: intel.generatedTweetText ? "generator:intel_tweet:v1" : "intel_summary:v1",
      threadPartCount: 0,
    },
  });
};
