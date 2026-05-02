import type { z } from "zod";
import { z as zod } from "zod";

import { generatorInputSchema, generatorOutputSchema } from "../contracts/generator.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import type { GeneratedIntelContent } from "../framework/state.js";
import { OpenAiCompatibleJsonClient } from "../llm/openai-compatible-client.js";
import { resolveModelProfileForRole } from "../llm/model-routing.js";
import { buildGeneratorSystemPrompt } from "../prompts/generator/system.js";
import { ShortenerAgentFactory } from "./shortener-agent.js";

type JsonCompletionClient = Pick<OpenAiCompatibleJsonClient, "completeJson">;

const generatorAgentOptionsSchema = zod.object({
  llmClient: zod.custom<JsonCompletionClient>().nullable().optional(),
  shortenerClient: zod.custom<JsonCompletionClient>().nullable().optional(),
});

const optionalModelString = zod.preprocess(
  (value) => (typeof value === "string" ? value : undefined),
  zod.string().optional(),
);

const rawGeneratorContentSchema = zod.object({
  topic: optionalModelString,
  tweetText: optionalModelString,
  tweet_text: optionalModelString,
  blogPost: optionalModelString,
  blog_post: optionalModelString,
  imagePrompt: optionalModelString,
  image_prompt: optionalModelString,
  formattedContent: optionalModelString,
  formatted_content: optionalModelString,
  logMessage: optionalModelString,
  log_message: optionalModelString,
});

const GENERATED_TWEET_MAX_LENGTH = 270;
const X_TWEET_MAX_LENGTH = 280;

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
    trimmed.lastIndexOf("\u2014"),
  );

  if (sentenceBoundary >= Math.floor(maxLength * 0.55)) {
    return trimmed.slice(0, sentenceBoundary + 1);
  }

  const wordBoundary = trimmed.lastIndexOf(" ");
  return trimmed.slice(0, wordBoundary > 0 ? wordBoundary : trimmed.length).trimEnd();
};

const imageTextExclusion =
  "no visible or readable text, no pseudo-readable text, no words, no letters, no numbers, no captions, no labels, no watermarks, no signatures";

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const replaceSymbolMentions = (value: string, symbols: string[]) =>
  symbols.reduce(
    (result, symbol) =>
      result.replace(new RegExp(`\\$?\\b${escapeRegExp(symbol.replace(/^\$/, ""))}\\b`, "gi"), "an unmarked digital asset"),
    value,
  );

const removeTextLikeTokens = (value: string) =>
  value
    .replace(/\$[A-Za-z0-9_]+/g, "an unmarked digital asset")
    .replace(/\b(?:with|showing|displaying|featuring)?\s*the\s+words?\s+[^,.]+/gi, "")
    .replace(
      /\b(?:with|showing|displaying|featuring)?\s*(?:big\s+)?(?:glowing\s+)?(?:coin\s+)?logos?\s+containing\s+text\b[^,.]*/gi,
      " abstract symbolic forms",
    )
    .replace(
      /\b(?:headline|caption|label|labels|watermark|ticker symbol|ticker symbols|lettering|typography|text overlay|signage|chart axes|legend|legends)\b/gi,
      " abstract detail",
    )
    .replace(/\s+/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();

const buildImageVisualBrief = (report: IntelReport) => {
  const topic = removeTextLikeTokens(replaceSymbolMentions(report.title, report.symbols));
  const summary = removeTextLikeTokens(replaceSymbolMentions(report.summary || report.insight, report.symbols));

  return [
    `A detailed, creative prompt for an AI image generator to create a visual for this intel: ${topic}.`,
    `Context: ${trimLine(summary, 180)}.`,
    "Style: cyberpunk, futuristic, high-tech, cinematic.",
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
    removeTextLikeTokens(replaceSymbolMentions(candidate, report.symbols)),
    imageTextExclusion,
  ].join(", ");
};

const requireGeneratorField = (
  field: string,
  ...values: Array<string | null | undefined>
) => {
  const value = firstNonBlank(...values);

  if (!value) {
    throw new Error(`Generator LLM response did not include ${field}.`);
  }

  return value;
};

const normalizeGeneratorContent = (
  input: z.infer<typeof rawGeneratorContentSchema>,
  report: IntelReport,
): GeneratedIntelContent => {
  const candidateTweet = normalizeTweetWhitespace(input.tweetText ?? input.tweet_text ?? "");
  if (!candidateTweet) {
    throw new Error("Generator LLM response did not include tweetText.");
  }

  return {
    topic: requireGeneratorField("topic", input.topic),
    tweetText: candidateTweet,
    blogPost: requireGeneratorField("blogPost", input.blogPost, input.blog_post),
    imagePrompt: normalizeImagePrompt(input, report),
    formattedContent: requireGeneratorField(
      "formattedContent",
      input.formattedContent,
      input.formatted_content,
    ),
    logMessage: requireGeneratorField("logMessage", input.logMessage, input.log_message),
  };
};

export class GeneratorAgentFactory {
  private readonly llmClient: JsonCompletionClient | null;

  private readonly shortenerAgent: ShortenerAgentFactory;

  constructor(input: zod.input<typeof generatorAgentOptionsSchema> = {}) {
    const parsed = generatorAgentOptionsSchema.parse(input);
    this.llmClient =
      "llmClient" in input
        ? (parsed.llmClient ?? null)
        : OpenAiCompatibleJsonClient.fromEnv(resolveModelProfileForRole("generator"));
    this.shortenerAgent = new ShortenerAgentFactory({
      llmClient:
        "shortenerClient" in input
          ? (parsed.shortenerClient ?? null)
          : this.llmClient,
    });
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

    if (this.llmClient === null) {
      throw new Error("Generator content requires a configured LLM client.");
    }

    try {
      const response: z.infer<typeof rawGeneratorContentSchema> = await this.llmClient.completeJson({
        schema: rawGeneratorContentSchema,
        systemPrompt: buildGeneratorSystemPrompt(parsed.context),
        userPrompt: [
          "Generate content for this INTEL REPORT.",
          "",
          `I need a 'tweetText' at ${GENERATED_TWEET_MAX_LENGTH.toString()} characters or fewer, a 'blogPost' markdown article, an 'imagePrompt' for a relevant cover image with no visible text, a 'formattedContent' value, and a short 'logMessage'.`,
          "",
          `Report: ${JSON.stringify(parsed.report, null, 2)}`,
        ].join("\n"),
      });
      const responseTweetText = extractResponseTweetText(response);

      if (responseTweetText.length === 0) {
        throw new Error("Generator LLM response did not include tweetText.");
      }

      if (responseTweetText.length <= X_TWEET_MAX_LENGTH) {
        return generatorOutputSchema.parse({
          content: normalizeGeneratorContent(response, parsed.report),
        });
      }

      const shortenedTweetText = await this.shortenerAgent.shortenTweet({
        context: parsed.context,
        report: parsed.report,
        text: responseTweetText,
      });

      return generatorOutputSchema.parse({
        content: normalizeGeneratorContent(
          {
            ...response,
            tweetText: shortenedTweetText,
            tweet_text: undefined,
            formattedContent: shortenedTweetText,
            formatted_content: undefined,
          },
          parsed.report,
        ),
      });
    } catch (error) {
      console.warn("[omen-generator] LLM generation failed; refusing synthetic tweet publication.", {
        runId: parsed.context.runId,
        error: error instanceof Error ? error.message : "Unknown generator error.",
      });
      throw error;
    }
  }
}

export const createGeneratorAgent = (input: zod.input<typeof generatorAgentOptionsSchema> = {}) =>
  new GeneratorAgentFactory(input).createDefinition();
