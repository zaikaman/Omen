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
    zod.input<typeof writerInputSchema>,
    zod.input<typeof writerOutputSchema>
  > {
    return {
      key: "writer-agent",
      role: "writer",
      inputSchema: writerInputSchema,
      outputSchema: writerOutputSchema,
      invoke: async (input, state) => this.writeArticle(input, state),
    };
  }

  private async writeArticle(input: zod.input<typeof writerInputSchema>, state: SwarmState) {
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
