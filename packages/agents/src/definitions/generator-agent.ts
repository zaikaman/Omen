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
  topic: zod.string().optional(),
  tweetText: zod.string().optional(),
  tweet_text: zod.string().optional(),
  blogPost: zod.string().optional(),
  blog_post: zod.string().optional(),
  imagePrompt: zod.string().optional(),
  image_prompt: zod.string().optional(),
  formattedContent: zod.string().optional(),
  formatted_content: zod.string().optional(),
  logMessage: zod.string().optional(),
  log_message: zod.string().optional(),
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

const GENERATED_TWEET_MAX_LENGTH = 270;
const X_TWEET_MAX_LENGTH = 280;
const MAX_GENERATOR_ATTEMPTS = 2;

const normalizeTweetWhitespace = (value: string) =>
  value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

const firstNonBlank = (...values: Array<string | null | undefined>) =>
  values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim();

const extractResponseTweetText = (response: z.infer<typeof rawGeneratorContentSchema>) =>
  normalizeTweetWhitespace(response.tweetText ?? response.tweet_text ?? "");

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

  return compose(70, 1);
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
  "strictly visual-only image with no readable or pseudo-readable text, no words, no letters, no numbers, no captions, no labels, no logos, no brand marks, no watermarks, no signatures, no ticker symbols, no charts with axes or legends, no dashboard UI, no screens, no monitors, no terminal windows, no documents, no posters, no signs, no coins with markings";

const removeTextLikeTokens = (value: string) =>
  value
    .replace(/\$[A-Za-z0-9_]+/g, "the referenced crypto asset")
    .replace(/\b(?:with|showing|displaying|featuring)?\s*the\s+words?\s+[^,.]+/gi, "")
    .replace(
      /\b(?:with|showing|displaying|featuring)?\s*(?:big\s+)?(?:glowing\s+)?(?:coin\s+)?logos?\b[^,.]*/gi,
      " abstract symbolic forms",
    )
    .replace(
      /\b(?:headline|caption|label|labels|watermark|ticker symbol|ticker symbols|lettering|typography|text overlay|poster|signage|sign|document|documents|whitepaper|interface|dashboard|ui|screen|screens|monitor|terminal|chart axes|legend|legends)\b/gi,
      " abstract detail",
    )
    .replace(/\s+/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();

const buildImageVisualBrief = (report: IntelReport) => {
  const topic = removeTextLikeTokens(report.title);
  const summary = removeTextLikeTokens(report.summary || report.insight);
  const category = report.category.replace(/_/g, " ");
  const symbolCount = report.symbols.length;
  const assetContext =
    symbolCount > 0
      ? "abstract representations of the tracked crypto assets through color-coded light, liquidity flows, geometric forms, and market structure, with every surface blank and unmarked"
      : "broad crypto market structure represented through institutional liquidity, macro pressure, and social narrative signals, with every surface blank and unmarked";
  const visualCatalyst =
    symbolCount > 0
      ? "depict the specific named-asset thesis as unmarked color-coded asset forms, directional liquidity streams, protocol-scale architecture, wallet-node clusters, and risk/attention pressure matching the report"
      : "depict the specific market thesis through macro pressure, liquidity depth, narrative attention, and risk rotation matching the report";

  return [
    "Premium editorial crypto market intelligence cover art directly tied to this intel thesis",
    `visual thesis: ${topic}`,
    `context: ${trimLine(summary, 220)}`,
    `category: ${category}`,
    `must visually represent this exact catalyst, not a generic crypto scene: ${trimLine(summary, 180)}`,
    visualCatalyst,
    assetContext,
    "cinematic cyberpunk institutional research environment, abstract market flows as light trails and geometric depth, high-tech atmosphere, realistic lighting, 16:9",
    "avoid any object that normally contains writing or glyphs; use blank glass, clean architecture, light, shadow, and symbolic shapes instead",
    imageTextExclusion,
  ].join(", ");
};

const normalizeImagePrompt = (input: z.infer<typeof rawGeneratorContentSchema>, report: IntelReport) => {
  const candidate = firstNonBlank(input.imagePrompt, input.image_prompt) ?? "";
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
  const tweetText = candidateTweet || buildFallbackTweet(report);

  return {
    topic: firstNonBlank(input.topic) ?? report.title,
    tweetText,
    blogPost: firstNonBlank(input.blogPost, input.blog_post) ?? buildFallbackBlogPost(report),
    imagePrompt: normalizeImagePrompt(input, report),
    formattedContent: firstNonBlank(input.formattedContent, input.formatted_content) ?? tweetText,
    logMessage: firstNonBlank(input.logMessage, input.log_message) ?? `INTEL LOCKED: ${report.title}`,
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
      let lastResponse: z.infer<typeof rawGeneratorContentSchema> | null = null;

      for (let attempt = 1; attempt <= MAX_GENERATOR_ATTEMPTS; attempt += 1) {
        const response: z.infer<typeof rawGeneratorContentSchema> =
          await this.llmClient.completeJson({
          schema: rawGeneratorContentSchema,
          systemPrompt: buildGeneratorSystemPrompt(parsed.context),
          userPrompt: [
            attempt === 1
              ? "Generate content for this INTEL REPORT."
              : "Regenerate the content for this INTEL REPORT because the previous tweetText was too long for X.",
            "",
            `I need a 'tweetText' at ${GENERATED_TWEET_MAX_LENGTH.toString()} characters or fewer, a 'blogPost' markdown article, an 'imagePrompt' for a relevant cover image with no visible text, a 'formattedContent' value, and a short 'logMessage'.`,
            attempt === 1
              ? ""
              : `The previous tweetText was ${extractResponseTweetText(lastResponse ?? {}).length.toString()} characters. Return a complete tweetText under ${X_TWEET_MAX_LENGTH.toString()} characters. Do not truncate mid-sentence or mid-phrase.`,
            "",
            `Report: ${JSON.stringify(parsed.report, null, 2)}`,
          ].join("\n"),
        });
        const responseTweetText = extractResponseTweetText(response);
        lastResponse = response;

        if (responseTweetText.length === 0) {
          throw new Error("Generator LLM response did not include tweetText.");
        }

        if (responseTweetText.length < X_TWEET_MAX_LENGTH) {
          return generatorOutputSchema.parse({
            content: normalizeGeneratorContent(response, parsed.report),
          });
        }
      }

      throw new Error(
        `Generator LLM tweetText exceeded ${X_TWEET_MAX_LENGTH.toString()} characters after ${MAX_GENERATOR_ATTEMPTS.toString()} attempts.`,
      );
    } catch (error) {
      console.warn("[omen-generator] LLM generation failed; refusing fallback tweet publication.", {
        runId: parsed.context.runId,
        error: error instanceof Error ? error.message : "Unknown generator error.",
      });
      throw error;
    }
  }
}

export const createGeneratorAgent = (input: zod.input<typeof generatorAgentOptionsSchema> = {}) =>
  new GeneratorAgentFactory(input).createDefinition();
