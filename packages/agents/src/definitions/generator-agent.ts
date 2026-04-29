import type { z } from "zod";
import { z as zod } from "zod";

import { generatorInputSchema, generatorOutputSchema } from "../contracts/generator.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import type { GeneratedIntelContent, IntelReport } from "../framework/state.js";
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
  "strictly visual-only full-bleed scene with no title card, no banner, no header strip, no lower third, no text panel, no article layout, no news card, no readable or pseudo-readable text, no words, no letters, no numbers, no captions, no labels, no logos, no brand marks, no watermarks, no signatures, no ticker symbols, no charts with axes or legends, no dashboard UI, no screens, no monitors, no terminal windows, no documents, no posters, no signs, no coins with markings";

const creativeImageDirection =
  "relevant, distinct, creative visual metaphor; vary the setting, subject, scale, materials, lighting, camera angle, and mood for each report; suitable styles include cinematic realism, surreal physical scenes, speculative architecture, macro material studies, symbolic environments, industrial systems, orbital scenes, underwater scenes, landscapes, or other fitting non-textual imagery";

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
  const topic = removeTextLikeTokens(replaceSymbolMentions(report.title, report.symbols));
  const summary = removeTextLikeTokens(replaceSymbolMentions(report.summary || report.insight, report.symbols));
  const category = report.category.replace(/_/g, " ");
  const symbolCount = report.symbols.length;
  const assetContext =
    symbolCount > 0
      ? "represent the tracked crypto assets as separate unmarked forces, materials, structures, weather systems, vessels, energy sources, or ecosystems; make them visually distinguishable without symbols or writing"
      : "represent broad crypto market structure through institutional liquidity, macro pressure, social attention, risk rotation, and tension between buyers and sellers without symbols or writing";
  const visualCatalyst =
    symbolCount > 0
      ? "depict the specific named-asset thesis as a visual story with unmarked competing forces, changing momentum, capital rotation, and risk/attention pressure matching the report"
      : "depict the specific market thesis through macro pressure, liquidity depth, narrative attention, and risk rotation matching the report";

  return [
    imageTextExclusion,
    "single cinematic visual-only market-intelligence scene, not a poster, not an infographic, not a presentation slide, not a webpage, not an article thumbnail",
    creativeImageDirection,
    `depict ${topic.toLowerCase()} as visual metaphor only`,
    `the scene should be driven by ${trimLine(summary, 180).toLowerCase()}`,
    `market category mood is ${category}`,
    visualCatalyst,
    assetContext,
    "avoid defaulting to a neon trading-room, holographic chart, dashboard wall, or generic light-trail market grid; pick a fresh composition tied to this report",
    "realistic lighting, strong depth, clear focal subject, full-bleed 16:9 composition",
    "avoid any object that normally contains writing or glyphs; use blank unmarked surfaces, materials, light, shadow, motion, scale, and symbolic shapes instead",
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
    `use this secondary style only as abstract visual metaphor without layout text ${removeTextLikeTokens(replaceSymbolMentions(candidate, report.symbols))}`,
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
  private readonly llmClient: JsonCompletionClient | null;

  private readonly shortenerAgent: ShortenerAgentFactory;

  constructor(input: zod.input<typeof generatorAgentOptionsSchema> = {}) {
    const parsed = generatorAgentOptionsSchema.parse(input);
    this.llmClient =
      parsed.llmClient ?? OpenAiCompatibleJsonClient.fromEnv(resolveModelProfileForRole("generator"));
    this.shortenerAgent = new ShortenerAgentFactory({
      llmClient: parsed.shortenerClient ?? this.llmClient,
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
    const fallbackContent = normalizeGeneratorContent({}, parsed.report);

    if (this.llmClient === null) {
      return generatorOutputSchema.parse({ content: fallbackContent });
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
