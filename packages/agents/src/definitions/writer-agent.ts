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

const buildFallbackArticle = (input: z.input<typeof writerInputSchema>): IntelArticle => {
  const parsed = writerInputSchema.parse(input);
  const evidenceLines = parsed.evidence
    .slice(0, 6)
    .map((item) => `- ${normalizeParagraph(item.summary)} (${item.sourceLabel})`);
  const symbols = parsed.report.symbols.length
    ? parsed.report.symbols.map((symbol) => `$${symbol.toUpperCase()}`).join(", ")
    : "the tracked market";
  const evidenceSection =
    evidenceLines.length > 0
      ? evidenceLines.join("\n")
      : "- Source coverage was thin, so this should be treated as preliminary desk context.";

  return {
    headline: parsed.report.title,
    tldr: parsed.report.summary,
    content: [
      `### ${parsed.report.title}`,
      "",
      parsed.report.summary,
      "",
      "### Why It Matters",
      "",
      parsed.report.insight,
      "",
      "### Evidence On The Desk",
      "",
      evidenceSection,
      "",
      "### The Edge",
      "",
      `${symbols} deserves attention while this ${parsed.report.category.replace(/_/g, " ")} remains active. The practical read is to track confirmation, liquidity follow-through, and whether the narrative survives the next market-wide volatility check.`,
      "",
      "### Verdict",
      "",
      `Omen rates this at ${parsed.report.importanceScore}/10 importance with ${parsed.report.confidence}% confidence. Treat it as market intelligence first, not an automatic trade instruction.`,
    ].join("\n"),
  };
};

export class WriterAgentFactory {
  private readonly llmClient: OpenAiCompatibleJsonClient | null;

  constructor(input: zod.input<typeof writerAgentOptionsSchema> = {}) {
    const parsed = writerAgentOptionsSchema.parse(input);
    this.llmClient =
      parsed.llmClient ?? OpenAiCompatibleJsonClient.fromEnv(resolveModelProfileForRole("writer"));
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
        userPrompt: JSON.stringify(
          {
            report: parsed.report,
            evidence: parsed.evidence,
            instruction:
              "Write the long-form website article. Keep factual claims anchored to the report and evidence.",
          },
          null,
          2,
        ),
        temperature: 0.35,
      });

      return writerOutputSchema.parse(response);
    } catch {
      return writerOutputSchema.parse({ article: fallbackArticle });
    }
  }
}

export const createWriterAgent = (input: zod.input<typeof writerAgentOptionsSchema> = {}) =>
  new WriterAgentFactory(input).createDefinition();
