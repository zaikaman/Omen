import type { z } from "zod";
import { z as zod } from "zod";

import { writerInputSchema, writerOutputSchema } from "../contracts/writer.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import type { IntelArticle, SwarmState } from "../framework/state.js";
import { OpenAiCompatibleJsonClient } from "../llm/openai-compatible-client.js";
import { resolveModelProfileForRole } from "../llm/model-routing.js";
import { buildWriterSystemPrompt } from "../prompts/writer/system.js";

const writerAgentOptionsSchema = zod.object({
  llmClient: zod.custom<OpenAiCompatibleJsonClient>().nullable().optional(),
});

const normalizeParagraph = (value: string) => value.replace(/\s+/g, " ").trim();

const trimToLength = (value: string, maxLength: number) => {
  const normalized = normalizeParagraph(value);

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const trimmed = normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd();
  const sentenceBoundary = Math.max(
    trimmed.lastIndexOf("."),
    trimmed.lastIndexOf("?"),
    trimmed.lastIndexOf("!"),
  );

  if (sentenceBoundary >= Math.floor(maxLength * 0.5)) {
    return trimmed.slice(0, sentenceBoundary + 1);
  }

  const wordBoundary = trimmed.lastIndexOf(" ");
  return `${trimmed.slice(0, wordBoundary > 0 ? wordBoundary : trimmed.length).trimEnd()}...`;
};

const splitSentences = (value: string) =>
  normalizeParagraph(value)
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

const titleCase = (value: string) =>
  value
    .split(" ")
    .map((word) =>
      word.startsWith("$") || /^[A-Z0-9]{2,}$/.test(word)
        ? word
        : `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`,
    )
    .join(" ");

const stripArticleBoilerplate = (value: string) =>
  normalizeParagraph(value)
    .replace(/fresh market intelligence scan found a context worth tracking\.?\s*/gi, "")
    .replace(/no actionable trade cleared the threshold,\s*/gi, "")
    .replace(/but the market context may still be worth tracking\.?\s*/gi, "")
    .replace(/\bmarket market intel\b/gi, "crypto market intel")
    .trim();

const buildCleanHeadline = (parsed: z.infer<typeof writerInputSchema>) => {
  const rawTitle = stripArticleBoilerplate(parsed.report.title);
  const topic = stripArticleBoilerplate(parsed.report.topic);

  if (rawTitle.length > 0 && !/^market intel$/i.test(rawTitle)) {
    return titleCase(rawTitle);
  }

  if (topic.length > 0 && !/^crypto market narratives$/i.test(topic)) {
    return titleCase(topic);
  }

  const symbolTitle =
    parsed.report.symbols.length > 0
      ? `${parsed.report.symbols.map((symbol) => symbol.toUpperCase()).join(", ")} Market Watch`
      : "Crypto Market Rotation Watch";

  return symbolTitle;
};

const buildPreviewSummary = (parsed: z.infer<typeof writerInputSchema>) => {
  const reportSummary = stripArticleBoilerplate(parsed.report.summary);
  const reportInsight = stripArticleBoilerplate(parsed.report.insight);
  const sentences = splitSentences(reportSummary || reportInsight).slice(0, 2);
  const preview = sentences.join(" ");

  return trimToLength(
    preview.length > 0
      ? preview
      : "Market structure is shifting, but the setup still needs confirmation before it becomes a trade.",
    320,
  );
};

const hasUsefulArticleShape = (article: IntelArticle) =>
  article.headline.trim().length >= 12 &&
  article.tldr.trim().length >= 40 &&
  article.content.trim().length >= 900 &&
  /###\s+/i.test(article.content);

export class WriterAgentFactory {
  private readonly llmClient: OpenAiCompatibleJsonClient | null;

  constructor(input: zod.input<typeof writerAgentOptionsSchema> = {}) {
    const parsed = writerAgentOptionsSchema.parse(input);
    this.llmClient =
      "llmClient" in input
        ? (parsed.llmClient ?? null)
        : OpenAiCompatibleJsonClient.fromEnv(resolveModelProfileForRole("writer"));
  }

  createDefinition(): RuntimeNodeDefinition<
    z.input<typeof writerInputSchema>,
    z.input<typeof writerOutputSchema>
  > {
    return {
      key: "writer-agent",
      role: "writer",
      inputSchema: writerInputSchema,
      outputSchema: writerOutputSchema,
      invoke: async (input, state) => this.writeArticle(input, state),
    };
  }

  private async writeArticle(input: z.input<typeof writerInputSchema>, state: SwarmState) {
    void state;
    const parsed = writerInputSchema.parse(input);

    if (this.llmClient === null) {
      throw new Error("Writer article generation requires a configured LLM client.");
    }

    try {
      const response = await this.llmClient.completeJson({
        schema: writerOutputSchema,
        systemPrompt: buildWriterSystemPrompt({
          runId: parsed.context.runId,
          category: parsed.report.category,
          symbolCount: parsed.report.symbols.length,
        }),
        userPrompt: [
          "Write a deep-dive article for this INTEL REPORT.",
          "",
          `Report: ${JSON.stringify(parsed.report, null, 2)}`,
          "",
          `Evidence: ${JSON.stringify(parsed.evidence, null, 2)}`,
          "",
          `Generated content context: ${JSON.stringify(parsed.generatedContent, null, 2)}`,
        ].join("\n"),
        temperature: 0.35,
      });

      const parsedResponse = writerOutputSchema.parse(response);

      if (!hasUsefulArticleShape(parsedResponse.article)) {
        throw new Error("Writer LLM response did not include a substantial markdown article.");
      }

      return parsedResponse;
    } catch (error) {
      throw new Error(
        `Writer article generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const createWriterAgent = (input: zod.input<typeof writerAgentOptionsSchema> = {}) =>
  new WriterAgentFactory(input).createDefinition();
