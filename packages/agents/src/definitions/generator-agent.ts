import type { z } from "zod";
import { z as zod } from "zod";

import { generatorInputSchema, generatorOutputSchema } from "../contracts/generator.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import type { GeneratedIntelContent, IntelReport } from "../framework/state.js";
import { OpenAiCompatibleJsonClient } from "../llm/openai-compatible-client.js";
import { resolveModelProfileForRole } from "../llm/model-routing.js";
import { buildGeneratorSystemPrompt } from "../prompts/generator/system.js";

const generatorAgentOptionsSchema = zod.object({
  llmClient: zod.custom<OpenAiCompatibleJsonClient>().nullable().optional(),
});

const rawGeneratorContentSchema = zod.object({
  topic: zod.string().min(1).optional(),
  tweetText: zod.string().min(1).optional(),
  tweet_text: zod.string().min(1).optional(),
  blogPost: zod.string().min(1).optional(),
  blog_post: zod.string().min(1).optional(),
  imagePrompt: zod.string().min(1).optional(),
  image_prompt: zod.string().min(1).optional(),
  formattedContent: zod.string().min(1).optional(),
  formatted_content: zod.string().min(1).optional(),
  logMessage: zod.string().min(1).optional(),
  log_message: zod.string().min(1).optional(),
});

const toDollarSymbol = (symbol: string) => `$${symbol.replace(/^\$/, "").toUpperCase()}`;

const extractTickerText = (report: IntelReport) =>
  report.symbols.length > 0 ? report.symbols.map(toDollarSymbol).join(" ") : "crypto";

const splitSentences = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/\bU\.S\./g, "US")
    .replace(/\bU\.K\./g, "UK")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

const uniqueSentences = (values: string[]) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const key = value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
};

const lowerProseKeepTickers = (value: string) =>
  value
    .split(/(\$[A-Za-z0-9]+)/g)
    .map((part) => (part.startsWith("$") ? part.toUpperCase() : part.toLowerCase()))
    .join("");

const lowSignalTweetPatterns = [
  /\bcrypto news\b/i,
  /\bprice prediction\b/i,
  /\bbest crypto to buy\b/i,
  /\bpresale\b/i,
  /\bpepeto\b/i,
  /\bpress release\b/i,
];

const danglingTweetEndings = new Set([
  "a",
  "about",
  "above",
  "after",
  "against",
  "amid",
  "and",
  "around",
  "as",
  "at",
  "awaiting",
  "because",
  "before",
  "below",
  "between",
  "but",
  "by",
  "for",
  "from",
  "if",
  "in",
  "into",
  "near",
  "of",
  "on",
  "or",
  "over",
  "that",
  "the",
  "through",
  "to",
  "under",
  "until",
  "versus",
  "via",
  "while",
  "with",
]);

const GENERATED_TWEET_MAX_LENGTH = 270;
const GENERATOR_TWEET_RETRY_COUNT = 2;

const normalizeTweetWhitespace = (value: string) =>
  value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

const enforceTweetLimit = (value: string) => {
  const normalized = normalizeTweetWhitespace(value);

  if (normalized.length <= GENERATED_TWEET_MAX_LENGTH) {
    return normalized;
  }

  const trimmed = normalized.slice(0, GENERATED_TWEET_MAX_LENGTH).trimEnd();
  const boundary = Math.max(trimmed.lastIndexOf("\n\n"), trimmed.lastIndexOf("\n"), trimmed.lastIndexOf("."));

  if (boundary >= 150) {
    return trimmed.slice(0, boundary).trimEnd();
  }

  const wordBoundary = trimmed.lastIndexOf(" ");
  return trimmed.slice(0, wordBoundary > 0 ? wordBoundary : trimmed.length).trimEnd();
};

const lastWord = (value: string) => {
  const match = value.trim().match(/([a-z0-9]+)[^a-z0-9]*$/i);
  return match?.[1]?.toLowerCase() ?? "";
};

const looksTruncatedTweet = (value: string) => {
  const normalized = value.trim();

  return (
    /[,;:([{-]$/.test(normalized) ||
    danglingTweetEndings.has(lastWord(normalized))
  );
};

const hasRepeatedTweetLines = (value: string) => {
  const lines = value
    .split("\n")
    .map((line) => line.replace(/^-\s*/, "").toLowerCase().replace(/[^a-z0-9$]+/g, " ").trim())
    .filter((line) => line.length >= 20);
  const seen = new Set<string>();

  for (const line of lines) {
    if (seen.has(line)) {
      return true;
    }

    seen.add(line);
  }

  return false;
};

const countBulletLines = (value: string) =>
  value
    .split("\n")
    .filter((line) => /^-\s+\S/.test(line.trim())).length;

const hasClosingTake = (value: string) => {
  const lines = value
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean);
  const lastLine = lines.at(-1) ?? "";

  return /^(watch|expect|takeaway|if\b|wait\b|look\b|rotate\b|rotation\b)/i.test(lastLine);
};

const isTemplateStyleTweet = (value: string) => {
  const normalized = value.trim();

  return (
    normalized.length > 0 &&
    normalized.length <= GENERATED_TWEET_MAX_LENGTH &&
    normalized.includes("\n") &&
    countBulletLines(normalized) >= 2 &&
    hasClosingTake(normalized) &&
    !looksTruncatedTweet(normalized) &&
    !hasRepeatedTweetLines(normalized) &&
    !lowSignalTweetPatterns.some((pattern) => pattern.test(normalized))
  );
};

const getTweetValidationError = (value: string) => {
  const normalized = normalizeTweetWhitespace(value);

  if (normalized.length === 0) {
    return "tweetText is empty";
  }

  if (normalized.length > GENERATED_TWEET_MAX_LENGTH) {
    return `tweetText is ${normalized.length.toString()} characters; it must be ${GENERATED_TWEET_MAX_LENGTH.toString()} or fewer`;
  }

  if (!normalized.includes("\n")) {
    return "tweetText needs line breaks";
  }

  if (countBulletLines(normalized) < 2) {
    return "tweetText needs at least two '-' bullet lines";
  }

  if (!hasClosingTake(normalized)) {
    return "tweetText needs a final watch/take/expect line";
  }

  if (looksTruncatedTweet(normalized)) {
    return "tweetText appears cut off mid-thought";
  }

  if (hasRepeatedTweetLines(normalized)) {
    return "tweetText repeats a line";
  }

  if (lowSignalTweetPatterns.some((pattern) => pattern.test(normalized))) {
    return "tweetText contains low-signal headline spam";
  }

  return null;
};

const trimLine = (value: string, maxLength: number) => {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const trimmed = normalized.slice(0, maxLength).trimEnd();
  const sentenceBoundary = Math.max(
    trimmed.lastIndexOf("."),
    trimmed.lastIndexOf("?"),
    trimmed.lastIndexOf("!"),
    trimmed.lastIndexOf(";"),
    trimmed.lastIndexOf(","),
    trimmed.lastIndexOf("—"),
  );

  if (sentenceBoundary >= Math.floor(maxLength * 0.55)) {
    return trimmed.slice(0, sentenceBoundary + 1);
  }

  const wordBoundary = trimmed.lastIndexOf(" ");
  return trimmed.slice(0, wordBoundary > 0 ? wordBoundary : trimmed.length).trimEnd();
};

const buildFallbackTweet = (report: IntelReport) => {
  const hook = trimLine(lowerProseKeepTickers(report.title.replace(/\.$/, "")), 72);
  const sourceSentences = uniqueSentences(splitSentences(`${report.summary} ${report.insight}`))
    .map(lowerProseKeepTickers)
    .filter((sentence) => sentence !== hook)
    .filter((sentence) => sentence.length > 0);
  const watchLine =
    report.symbols.length > 0
      ? `watch ${extractTickerText(report)} if confirmation follows`
      : "watch confirmation before chasing the move";

  const compose = (lineBudget: number, bulletCount: number) => {
    const bullets = (sourceSentences.length > 0 ? sourceSentences : [lowerProseKeepTickers(report.insight)])
      .slice(0, bulletCount)
      .map((sentence) => `- ${trimLine(sentence, lineBudget).replace(/[;:,]$/, ".")}`);

    return [hook, "", ...bullets, "", watchLine].join("\n").trim();
  };

  for (const [lineBudget, bulletCount] of [
    [105, 2],
    [90, 2],
    [75, 2],
    [90, 1],
  ] as const) {
    const tweet = compose(lineBudget, bulletCount);

    if (tweet.length <= GENERATED_TWEET_MAX_LENGTH) {
      return tweet;
    }
  }

  return enforceTweetLimit(compose(70, 1));
};

const buildFallbackBlogPost = (report: IntelReport) =>
  [
    `# ${report.title}`,
    "",
    "## Executive Summary",
    report.summary,
    "",
    "## The Alpha",
    report.insight,
    "",
    "## Market Impact",
    "This is market intelligence, not an automatic trade instruction. The useful read is where attention, liquidity, and risk are starting to cluster.",
    "",
    "## Verdict",
    `${extractTickerText(report)} stays on watch while the narrative remains active. Confirmation needs liquidity follow-through and repeated attention across future scans.`,
  ].join("\n");

const imageTextExclusion =
  "strictly no text, no words, no letters, no numbers, no captions, no labels, no logos, no watermarks, no UI, no ticker symbols";

const removeTextLikeTokens = (value: string) =>
  value
    .replace(/\$[A-Za-z0-9_]+/g, "the referenced crypto asset")
    .replace(/\b(?:with|showing|displaying|featuring)?\s*the\s+words?\s+[^,.]+/gi, "")
    .replace(
      /\b(?:with|showing|displaying|featuring)?\s*(?:big\s+)?(?:glowing\s+)?(?:coin\s+)?logos?\b[^,.]*/gi,
      "abstract symbolic forms",
    )
    .replace(/\b(?:headline|caption|label|labels|watermark|ticker symbol|ticker symbols)\b/gi, "abstract detail")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();

const buildImageVisualBrief = (report: IntelReport) => {
  const topic = removeTextLikeTokens(report.title);
  const summary = removeTextLikeTokens(report.summary || report.insight);
  const category = report.category.replace(/_/g, " ");
  const assetContext =
    report.symbols.length > 0
      ? "abstract representations of the tracked crypto assets through color-coded light, liquidity flows, and market structure"
      : "broad crypto market structure represented through institutional liquidity, macro pressure, and social narrative signals";

  return [
    "Premium editorial crypto market intelligence cover art directly tied to this intel thesis",
    `visual thesis: ${topic}`,
    `context: ${trimLine(summary, 220)}`,
    `category: ${category}`,
    assetContext,
    "cinematic cyberpunk institutional research desk, abstract market flows, high-tech atmosphere, realistic lighting, 16:9",
    imageTextExclusion,
  ].join(", ");
};

const normalizeImagePrompt = (input: z.infer<typeof rawGeneratorContentSchema>, report: IntelReport) => {
  const candidate = input.imagePrompt ?? input.image_prompt ?? "";
  const visualBrief = buildImageVisualBrief(report);

  if (!candidate.trim()) {
    return visualBrief;
  }

  return [
    visualBrief,
    `additional visual direction: ${removeTextLikeTokens(candidate)}`,
    imageTextExclusion,
  ].join(", ");
};

const normalizeGeneratorContent = (
  input: z.infer<typeof rawGeneratorContentSchema>,
  report: IntelReport,
): GeneratedIntelContent => {
  const candidateTweet = normalizeTweetWhitespace(input.tweetText ?? input.tweet_text ?? "");
  const fallbackTweet = buildFallbackTweet(report);
  const tweetText = isTemplateStyleTweet(candidateTweet) ? candidateTweet : fallbackTweet;

  return {
    topic: input.topic ?? report.title,
    tweetText,
    blogPost: input.blogPost ?? input.blog_post ?? buildFallbackBlogPost(report),
    imagePrompt: normalizeImagePrompt(input, report),
    formattedContent: input.formattedContent ?? input.formatted_content ?? tweetText,
    logMessage: input.logMessage ?? input.log_message ?? `INTEL LOCKED: ${report.title}`,
  };
};

export class GeneratorAgentFactory {
  private readonly llmClient: OpenAiCompatibleJsonClient | null;

  constructor(input: zod.input<typeof generatorAgentOptionsSchema> = {}) {
    const parsed = generatorAgentOptionsSchema.parse(input);
    this.llmClient =
      parsed.llmClient ?? OpenAiCompatibleJsonClient.fromEnv(resolveModelProfileForRole("generator"));
  }

  createDefinition(): RuntimeNodeDefinition<
    z.input<typeof generatorInputSchema>,
    z.input<typeof generatorOutputSchema>
  > {
    return {
      key: "generator-agent",
      role: "generator",
      inputSchema: generatorInputSchema,
      outputSchema: generatorOutputSchema,
      invoke: async (input) => this.generate(input),
    };
  }

  private async generate(input: z.input<typeof generatorInputSchema>) {
    const parsed = generatorInputSchema.parse(input);
    const fallbackContent = normalizeGeneratorContent({}, parsed.report);

    if (this.llmClient === null) {
      return generatorOutputSchema.parse({ content: fallbackContent });
    }

    try {
      const systemPrompt = buildGeneratorSystemPrompt(parsed.context);
      let lastResponse: z.infer<typeof rawGeneratorContentSchema> | null = null;
      let lastTweetError: string | null = null;

      for (let attempt = 0; attempt <= GENERATOR_TWEET_RETRY_COUNT; attempt += 1) {
        const response: z.infer<typeof rawGeneratorContentSchema> = await this.llmClient.completeJson({
          schema: rawGeneratorContentSchema,
          systemPrompt,
          userPrompt: [
            attempt === 0
              ? "Generate content for this INTEL REPORT."
              : "Rewrite only the generated assets that need correction, keeping the same facts.",
            "",
            `The 'tweetText' field must be a complete Rogue-style tweet at ${GENERATED_TWEET_MAX_LENGTH.toString()} characters or fewer. Do not rely on downstream trimming.`,
            "It needs a hook, line breaks, at least two '-' bullets, and a final watch/take/expect line. Every line must end cleanly.",
            lastTweetError ? `Previous tweet failed validation: ${lastTweetError}.` : null,
            lastResponse?.tweetText || lastResponse?.tweet_text
              ? `Previous tweetText:\n${lastResponse.tweetText ?? lastResponse.tweet_text ?? ""}`
              : null,
            "",
            "Return 'tweetText', a 'blogPost' markdown article, an 'imagePrompt' for a relevant cover image with no visible text, a 'formattedContent' value, and a short 'logMessage'.",
            "",
            `Report: ${JSON.stringify(parsed.report, null, 2)}`,
          ]
            .filter((part): part is string => part !== null)
            .join("\n"),
        });
        const tweetError = getTweetValidationError(response.tweetText ?? response.tweet_text ?? "");

        lastResponse = response;
        lastTweetError = tweetError;

        if (tweetError === null) {
          break;
        }
      }

      return generatorOutputSchema.parse({
        content: normalizeGeneratorContent(lastResponse ?? {}, parsed.report),
      });
    } catch {
      return generatorOutputSchema.parse({ content: fallbackContent });
    }
  }
}

export const createGeneratorAgent = (input: zod.input<typeof generatorAgentOptionsSchema> = {}) =>
  new GeneratorAgentFactory(input).createDefinition();
