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

const buildFallbackArticle = (input: z.input<typeof writerInputSchema>): IntelArticle => {
  const parsed = writerInputSchema.parse(input);
  const headline = buildCleanHeadline(parsed);
  const tldr = buildPreviewSummary(parsed);

  const cleanedInsight = stripArticleBoilerplate(parsed.report.insight);
  const cleanedSummary = stripArticleBoilerplate(parsed.report.summary);
  const lead =
    splitSentences(cleanedInsight).find((sentence) => normalizeParagraph(sentence) !== tldr) ??
    splitSentences(cleanedSummary).find((sentence) => normalizeParagraph(sentence) !== tldr) ??
    `${headline} is worth tracking because the evidence points to a live narrative rather than a clean trade signal.`;
  const evidenceLines = parsed.evidence
    .slice(0, 6)
    .map((item) => `- ${normalizeParagraph(item.summary)} (${item.sourceLabel})`);
  const insightSentences = uniqueSentences(splitSentences(`${cleanedSummary} ${cleanedInsight}`));
  const signalMap =
    insightSentences.length > 0
      ? insightSentences
          .slice(0, 6)
          .map((sentence) => `- ${sentence}`)
          .join("\n")
      : "- The report did not include enough supporting detail to build a full signal map.";
  const symbols = parsed.report.symbols.length
    ? parsed.report.symbols.map((symbol) => `$${symbol.toUpperCase()}`).join(", ")
    : "the tracked market";
  const evidenceSection =
    evidenceLines.length > 0
      ? evidenceLines.join("\n")
      : signalMap;
  const category = parsed.report.category.replace(/_/g, " ");
  const confirmation =
    parsed.report.symbols.length > 0
      ? `Confirmation is simple: ${symbols} need to keep showing up in both liquidity and attention data while majors fail to absorb the bid. If the flow rotates back into BTC or ETH quickly, this stays a watchlist note rather than a tradeable regime change.`
      : "Confirmation is simple: the same narrative needs to keep appearing across liquidity, social attention, and price action. If it disappears after one scan, it is background noise.";

  return {
    headline,
    tldr,
    content: [
      "### ON-CHAIN",
      "",
      `> ${lead}`,
      "",
      "### The Alpha",
      "",
      cleanedInsight.length > 0
        ? cleanedInsight
        : `${headline} has enough signal to track, but not enough confirmation to treat as a standalone trade call.`,
      "",
      "### Signal Map",
      "",
      evidenceSection,
      "",
      "### Market Impact",
      "",
      `The read is not an automatic long or short. It is a ${category} note: useful because it shows where attention, liquidity, or risk is starting to cluster before the cleaner setups become obvious. The practical question is whether this is early rotation or just a one-cycle attention spike.`,
      "",
      "### What Confirms It",
      "",
      confirmation,
      "",
      "### The Edge",
      "",
      `${symbols} deserves attention while this ${category} remains active. The edge is not to chase the first headline; it is to track whether liquidity follows attention, whether the same tickers keep leading on down days, and whether the narrative survives the next market-wide volatility check.`,
      "",
      "### Verdict",
      "",
      `Omen rates this at ${parsed.report.importanceScore}/10 importance with ${parsed.report.confidence}% confidence. Treat it as market intelligence first, not an automatic trade instruction.`,
    ].join("\n"),
  };
};

const hasUsefulArticleShape = (article: IntelArticle) =>
  article.content.length >= 1_400 &&
  /###\s+The Alpha/i.test(article.content) &&
  /###\s+The Edge/i.test(article.content) &&
  /###\s+Verdict/i.test(article.content);

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
    const fallbackArticle = buildFallbackArticle(parsed);

    if (this.llmClient === null) {
      return writerOutputSchema.parse({ article: fallbackArticle });
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
        ].join("\n"),
        temperature: 0.35,
      });

      const parsedResponse = writerOutputSchema.parse(response);

      return hasUsefulArticleShape(parsedResponse.article)
        ? parsedResponse
        : writerOutputSchema.parse({ article: fallbackArticle });
    } catch {
      return writerOutputSchema.parse({ article: fallbackArticle });
    }
  }
}

export const createWriterAgent = (input: zod.input<typeof writerAgentOptionsSchema> = {}) =>
  new WriterAgentFactory(input).createDefinition();
