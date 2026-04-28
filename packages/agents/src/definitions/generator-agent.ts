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
  tweetText: zod.string().min(1).max(280).optional(),
  tweet_text: zod.string().min(1).max(280).optional(),
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
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

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

const enforceTweetLimit = (value: string) => {
  const normalized = value.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

  if (normalized.length <= 280) {
    return normalized;
  }

  const trimmed = normalized.slice(0, 279).trimEnd();
  const boundary = Math.max(trimmed.lastIndexOf("\n\n"), trimmed.lastIndexOf("\n"), trimmed.lastIndexOf("."));

  if (boundary >= 150) {
    return trimmed.slice(0, boundary).trimEnd();
  }

  const wordBoundary = trimmed.lastIndexOf(" ");
  return trimmed.slice(0, wordBoundary > 0 ? wordBoundary : trimmed.length).trimEnd();
};

const isTemplateStyleTweet = (value: string) => {
  const normalized = value.trim();

  return (
    normalized.length > 0 &&
    normalized.length <= 280 &&
    normalized.includes("\n") &&
    /^-\s+/m.test(normalized) &&
    !lowSignalTweetPatterns.some((pattern) => pattern.test(normalized))
  );
};

const buildFallbackTweet = (report: IntelReport) => {
  const hook = lowerProseKeepTickers(report.title.replace(/\.$/, ""));
  const sentences = splitSentences(report.summary || report.insight)
    .map(lowerProseKeepTickers)
    .filter((sentence) => sentence !== hook)
    .slice(0, 3);
  const bullets = sentences.length > 0 ? sentences : [lowerProseKeepTickers(report.insight)];
  const watchLine = `watch ${extractTickerText(report)} if liquidity confirms`;

  return enforceTweetLimit([hook, "", ...bullets.map((sentence) => `- ${sentence}`), "", watchLine].join("\n"));
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

const buildFallbackImagePrompt = (report: IntelReport) =>
  report.imagePrompt ??
  [
    "Premium cyberpunk crypto market intelligence cover art",
    `focused on ${extractTickerText(report)}`,
    "futuristic trading desk, liquidity streams, institutional research terminal",
    "cinematic lighting, high contrast, no text, no logos, 16:9",
  ].join(", ");

const normalizeGeneratorContent = (
  input: z.infer<typeof rawGeneratorContentSchema>,
  report: IntelReport,
): GeneratedIntelContent => {
  const candidateTweet = enforceTweetLimit(input.tweetText ?? input.tweet_text ?? "");
  const fallbackTweet = buildFallbackTweet(report);
  const tweetText = isTemplateStyleTweet(candidateTweet) ? candidateTweet : fallbackTweet;

  return {
    topic: input.topic ?? report.title,
    tweetText,
    blogPost: input.blogPost ?? input.blog_post ?? buildFallbackBlogPost(report),
    imagePrompt: input.imagePrompt ?? input.image_prompt ?? buildFallbackImagePrompt(report),
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
      const response = await this.llmClient.completeJson({
        schema: rawGeneratorContentSchema,
        systemPrompt: buildGeneratorSystemPrompt(parsed.context),
        userPrompt: JSON.stringify(
          {
            report: parsed.report,
            evidence: parsed.evidence,
            instruction:
              "Generate content for this INTEL REPORT. Return topic, tweetText, blogPost, imagePrompt, formattedContent, and logMessage.",
          },
          null,
          2,
        ),
      });

      return generatorOutputSchema.parse({
        content: normalizeGeneratorContent(response, parsed.report),
      });
    } catch {
      return generatorOutputSchema.parse({ content: fallbackContent });
    }
  }
}

export const createGeneratorAgent = (input: zod.input<typeof generatorAgentOptionsSchema> = {}) =>
  new GeneratorAgentFactory(input).createDefinition();
