import { z } from "zod";

import { researchInputSchema, researchOutputSchema } from "../contracts/research.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import {
  candidateStateSchema,
  evidenceItemSchema,
  type CandidateState,
  type EvidenceItem,
  type SwarmState,
} from "../framework/state.js";
import { OpenAiCompatibleJsonClient } from "../llm/openai-compatible-client.js";
import { resolveModelProfileForRole } from "../llm/model-routing.js";
import { buildResearchSystemPrompt } from "../prompts/research/system.js";

const researchServiceOptionsSchema = z.object({
  llmClient: z.custom<OpenAiCompatibleJsonClient>().nullable().optional(),
});

const researchSynthesisSchema = z.object({
  evidence: z.array(evidenceItemSchema).min(1),
  narrativeSummary: z.string().min(1),
  missingDataNotes: z.array(z.string().min(1)).default([]),
});

const modelResearchEvidenceCategories = new Set<EvidenceItem["category"]>([
  "fundamental",
  "catalyst",
  "sentiment",
]);

const sanitizeModelResearchEvidence = (evidence: EvidenceItem[]) =>
  evidence.filter((item) => modelResearchEvidenceCategories.has(item.category));

const promoteCandidateToResearched = (candidate: CandidateState) =>
  candidateStateSchema.parse({
    ...candidate,
    status: "researched",
  });

export class ResearchAgentFactory {
  private readonly llmClient: OpenAiCompatibleJsonClient | null;

  constructor(input: z.input<typeof researchServiceOptionsSchema> = {}) {
    const parsed = researchServiceOptionsSchema.parse(input);
    this.llmClient =
      parsed.llmClient ??
      OpenAiCompatibleJsonClient.fromEnv(resolveModelProfileForRole("research"));
  }

  createDefinition(): RuntimeNodeDefinition<
    z.input<typeof researchInputSchema>,
    z.input<typeof researchOutputSchema>
  > {
    return {
      key: "research-agent",
      role: "research",
      inputSchema: researchInputSchema,
      outputSchema: researchOutputSchema,
      invoke: async (input, state) => this.research(input, state),
    };
  }

  private async research(
    input: z.input<typeof researchInputSchema>,
    state: SwarmState,
  ): Promise<z.input<typeof researchOutputSchema>> {
    const parsed = researchInputSchema.parse(input);
    const symbol = parsed.candidate.symbol.toUpperCase();
    const missingDataNotes = [...parsed.candidate.missingDataNotes];

    const prompt = buildResearchSystemPrompt({
      symbol,
      directionHint: parsed.candidate.directionHint,
    });

    const synthesized = await this.synthesizeResearch({
      candidate: parsed.candidate,
      prompt,
      state,
      missingDataNotes,
    });

    const parsedEvidence = synthesized.evidence.map((item) => evidenceItemSchema.parse(item));
    const evidence = sanitizeModelResearchEvidence(parsedEvidence);
    const narrativeSummary = synthesized.narrativeSummary;

    if ((synthesized.missingDataNotes ?? []).length > 0) {
      missingDataNotes.splice(0, missingDataNotes.length, ...(synthesized.missingDataNotes ?? []));
    }

    const filteredEvidenceCount = parsedEvidence.length - evidence.length;

    if (filteredEvidenceCount > 0) {
      missingDataNotes.push(
        `Research discarded ${filteredEvidenceCount.toString()} model-sourced market/technical/funding/liquidity/chart item(s); deterministic provider nodes own executable price evidence.`,
      );
    }

    if (evidence.length === 0) {
      throw new Error(
        "Research synthesis returned no narrative, fundamental, catalyst, or sentiment evidence after filtering model-sourced market data.",
      );
    }

    evidence[0] = evidenceItemSchema.parse({
      ...evidence[0],
      structuredData: {
        ...evidence[0]?.structuredData,
        marketBiasReasoning: state.marketBiasReasoning,
      },
    });

    return researchOutputSchema.parse({
      candidate: promoteCandidateToResearched(parsed.candidate),
      evidence,
      narrativeSummary,
      missingDataNotes,
    });
  }

  private async synthesizeResearch(input: {
    candidate: CandidateState;
    prompt: string;
    state: SwarmState;
    missingDataNotes: string[];
  }) {
    if (this.llmClient === null) {
      throw new Error("Research synthesis requires a configured LLM client.");
    }

    try {
      const response = await this.llmClient.completeJson({
        schema: researchSynthesisSchema,
        systemPrompt: input.prompt,
        userPrompt: JSON.stringify(
          {
            candidate: input.candidate,
            marketBiasReasoning: input.state.marketBiasReasoning,
            injectedEvidence: input.state.evidenceItems,
            missingDataNotes: input.missingDataNotes,
            instruction: [
              "Use only the candidate, market bias, injected evidence, and your built-in web and X search capabilities exactly like the template scanner flow.",
              "Do not call market-data tools, DeFiLlama, Binance, or any local provider service from this research node.",
              "Do not return market, technical, liquidity, funding, or chart evidence categories because deterministic provider nodes own live prices, funding, volume, and execution data.",
              "Return only fundamental, catalyst, or sentiment evidence from research.",
              "Gather only the most relevant confirming or disconfirming evidence for this candidate.",
              "Prefer a small, focused evidence set over a broad article dump.",
              "Do not invent extra sources, catalysts, numbers, or claims.",
              "Preserve contradiction and uncertainty when present.",
              "Keep evidence concise, factual, and independently readable.",
              "Cap the final evidence bundle at 5 items.",
            ].join(" "),
          },
          null,
          2,
        ),
      });

      return researchSynthesisSchema.parse(response);
    } catch (error) {
      throw new Error(
        `Research synthesis failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const createResearchAgent = (input: z.input<typeof researchServiceOptionsSchema> = {}) =>
  new ResearchAgentFactory(input).createDefinition();
