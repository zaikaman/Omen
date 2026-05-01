import { z as zod } from "zod";

import { intelReportSchema, orchestrationContextSchema } from "../contracts/common.js";
import { OpenAiCompatibleJsonClient } from "../llm/openai-compatible-client.js";
import { resolveModelProfileForRole } from "../llm/model-routing.js";

const SHORTENER_TWEET_MAX_LENGTH = 270;
const MAX_SHORTENER_ATTEMPTS = 3;

type JsonCompletionClient = Pick<OpenAiCompatibleJsonClient, "completeJson">;

const shortenerAgentOptionsSchema = zod.object({
  llmClient: zod.custom<JsonCompletionClient>().nullable().optional(),
});

const shortenerInputSchema = zod.object({
  context: orchestrationContextSchema,
  report: intelReportSchema,
  text: zod.string().min(1),
});

const shortenerOutputSchema = zod.object({
  shortenedText: zod.string().optional(),
  shortened_text: zod.string().optional(),
});

const normalizeTweetWhitespace = (value: string) =>
  value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

const extractShortenedText = (output: zod.infer<typeof shortenerOutputSchema>) =>
  normalizeTweetWhitespace(output.shortenedText ?? output.shortened_text ?? "");

const buildShortenerSystemPrompt = (runId: string) =>
  [
    "You are the Omen tweet shortener agent.",
    `Run: ${runId}.`,
    "Your only job is to rewrite an over-length market intel tweet so it fits X.",
    "Return strict JSON only.",
    "",
    "Output fields:",
    "- shortenedText: rewritten tweet at 270 characters or fewer.",
    "",
    "Rules:",
  "- Preserve the core market thesis, tickers, and concrete market-context line.",
    "- Keep lowercase prose and uppercase tickers when prefixed with $, e.g. $BTC.",
    "- Keep useful line breaks and '-' bullets when possible.",
    "- Remove filler before removing facts.",
    "- Do not add new metrics, catalysts, promises, hashtags, emojis, or claims.",
    "- Do not truncate mid-word, mid-sentence, or mid-phrase.",
  ].join("\n");

export class ShortenerAgentFactory {
  private readonly llmClient: JsonCompletionClient | null;

  constructor(input: zod.input<typeof shortenerAgentOptionsSchema> = {}) {
    const parsed = shortenerAgentOptionsSchema.parse(input);
    this.llmClient =
      parsed.llmClient ?? OpenAiCompatibleJsonClient.fromEnv(resolveModelProfileForRole("generator"));
  }

  async shortenTweet(input: zod.input<typeof shortenerInputSchema>) {
    const parsed = shortenerInputSchema.parse(input);

    if (this.llmClient === null) {
      throw new Error("Shortener LLM client is not configured.");
    }

    let previousText = normalizeTweetWhitespace(parsed.text);

    for (let attempt = 1; attempt <= MAX_SHORTENER_ATTEMPTS; attempt += 1) {
      const response = await this.llmClient.completeJson({
        schema: shortenerOutputSchema,
        systemPrompt: buildShortenerSystemPrompt(parsed.context.runId),
        userPrompt: [
          attempt === 1
            ? "Shorten this over-length INTEL tweet."
            : "Shorten the previous rewrite again because it is still too long for X.",
          "",
          `Hard limit: ${SHORTENER_TWEET_MAX_LENGTH.toString()} characters or fewer.`,
          `Current length: ${previousText.length.toString()} characters.`,
          "",
          `Report: ${JSON.stringify(parsed.report, null, 2)}`,
          "",
          `Tweet to shorten:\n${previousText}`,
        ].join("\n"),
      });
      const shortenedText = extractShortenedText(response);

      if (shortenedText.length > 0 && shortenedText.length <= SHORTENER_TWEET_MAX_LENGTH) {
        return shortenedText;
      }

      previousText = shortenedText || previousText;
    }

    throw new Error(
      `Shortener LLM tweetText exceeded ${SHORTENER_TWEET_MAX_LENGTH.toString()} characters after ${MAX_SHORTENER_ATTEMPTS.toString()} attempts.`,
    );
  }
}

export const createShortenerAgent = (input: zod.input<typeof shortenerAgentOptionsSchema> = {}) =>
  new ShortenerAgentFactory(input);
