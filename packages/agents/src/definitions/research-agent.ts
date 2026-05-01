import {
  BinanceMarketService,
  DefiLlamaMarketService,
  type ProtocolSnapshot,
} from "@omen/market-data";
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
  marketData: z.custom<BinanceMarketService>().optional(),
  protocolData: z.custom<DefiLlamaMarketService>().optional(),
  llmClient: z.custom<OpenAiCompatibleJsonClient>().nullable().optional(),
});

const researchSynthesisSchema = z.object({
  evidence: z.array(evidenceItemSchema).min(1),
  narrativeSummary: z.string().min(1),
  missingDataNotes: z.array(z.string().min(1)).default([]),
});

const buildProtocolEvidence = (protocolSnapshot: ProtocolSnapshot, symbol: string): EvidenceItem =>
  evidenceItemSchema.parse({
    category: "fundamental",
    summary: `${protocolSnapshot.protocol} TVL snapshot on ${protocolSnapshot.chain} came in at $${protocolSnapshot.tvlUsd.toLocaleString("en-US")}.`,
    sourceLabel: "DeFiLlama",
    sourceUrl: protocolSnapshot.sourceUrl,
    structuredData: {
      symbol,
      protocol: protocolSnapshot.protocol,
      tvlUsd: protocolSnapshot.tvlUsd,
      tvlChange1dPercent: protocolSnapshot.tvlChange1dPercent,
      tvlChange7dPercent: protocolSnapshot.tvlChange7dPercent,
      category: protocolSnapshot.category,
      capturedAt: protocolSnapshot.capturedAt,
    },
  });

const buildMarketEvidence = (input: {
  symbol: string;
  price: number;
  change24hPercent: number | null;
  fundingRate: number | null;
  capturedAt: string;
}): EvidenceItem =>
  evidenceItemSchema.parse({
    category: "market",
    summary: `${input.symbol} spot snapshot recorded ${input.price.toFixed(2)} with 24h change ${input.change24hPercent?.toFixed(2) ?? "n/a"}%.`,
    sourceLabel: "Binance",
    sourceUrl: null,
    structuredData: {
      symbol: input.symbol,
      price: input.price,
      change24hPercent: input.change24hPercent,
      fundingRate: input.fundingRate,
      capturedAt: input.capturedAt,
    },
  });

const protocolSlugBySymbol: Partial<Record<string, string>> = {
  AAVE: "aave",
  CRV: "curve-dex",
  ENA: "ethena",
  LDO: "lido",
  MKR: "makerdao",
  PENDLE: "pendle",
  UNI: "uniswap",
};

const resolveProtocolSlugForCandidate = (symbol: string) =>
  protocolSlugBySymbol[symbol.toUpperCase()] ?? null;

const promoteCandidateToResearched = (candidate: CandidateState) =>
  candidateStateSchema.parse({
    ...candidate,
    status: "researched",
  });

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

export class ResearchAgentFactory {
  private readonly marketData: BinanceMarketService;

  private readonly protocolData: DefiLlamaMarketService;

  private readonly llmClient: OpenAiCompatibleJsonClient | null;

  constructor(input: z.input<typeof researchServiceOptionsSchema> = {}) {
    const parsed = researchServiceOptionsSchema.parse(input);
    this.marketData = parsed.marketData ?? new BinanceMarketService();
    this.protocolData = parsed.protocolData ?? new DefiLlamaMarketService();
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
    const protocolSlug = resolveProtocolSlugForCandidate(symbol);

    const [snapshotAttempt, protocolAttempt] = await Promise.all([
      this.marketData
        .getSnapshot(symbol)
        .then((result) => ({ ok: true as const, result }))
        .catch((error: unknown) => ({ ok: false as const, error })),
      protocolSlug === null
        ? Promise.resolve(null)
        : this.protocolData
            .getProtocolSnapshot(protocolSlug)
            .then((result) => ({ ok: true as const, result }))
            .catch((error: unknown) => ({ ok: false as const, error })),
    ]);

    const evidence: EvidenceItem[] = [];
    const missingDataNotes = [...parsed.candidate.missingDataNotes];

    const snapshotResult = snapshotAttempt.ok ? snapshotAttempt.result : null;
    const protocolResult = protocolAttempt?.ok ? protocolAttempt.result : null;

    if (snapshotResult?.ok) {
      evidence.push(
        buildMarketEvidence({
          symbol,
          price: snapshotResult.value.price,
          change24hPercent: snapshotResult.value.change24hPercent,
          fundingRate: snapshotResult.value.fundingRate,
          capturedAt: snapshotResult.value.capturedAt,
        }),
      );
    } else {
      const message =
        snapshotResult !== null
          ? snapshotResult.error.message
          : !snapshotAttempt.ok
            ? errorMessage(snapshotAttempt.error)
            : "unknown market data error";
      missingDataNotes.push(`Market snapshot missing: ${message}`);
    }

    if (protocolResult?.ok) {
      evidence.push(buildProtocolEvidence(protocolResult.value, symbol));
    } else if (protocolResult && !protocolResult.ok) {
      missingDataNotes.push(`Protocol snapshot missing: ${protocolResult.error.message}`);
    } else if (protocolAttempt && !protocolAttempt.ok) {
      missingDataNotes.push(`Protocol snapshot missing: ${errorMessage(protocolAttempt.error)}`);
    }

    let narrativeSummary = `${symbol} research bundle is currently market-led with limited external context.`;

    const prompt = buildResearchSystemPrompt({
      symbol,
      directionHint: parsed.candidate.directionHint,
    });

    const synthesized = await this.synthesizeResearch({
      candidate: parsed.candidate,
      prompt,
      state,
      snapshot: snapshotResult?.ok
        ? {
            symbol: snapshotResult.value.symbol,
            price: snapshotResult.value.price,
            change24hPercent: snapshotResult.value.change24hPercent,
            volume24h: snapshotResult.value.volume24h,
            fundingRate: snapshotResult.value.fundingRate,
            openInterest: snapshotResult.value.openInterest,
            capturedAt: snapshotResult.value.capturedAt,
          }
        : null,
      protocolSnapshot: protocolResult?.ok ? protocolResult.value : null,
      evidence,
      narrativeSummary,
      missingDataNotes,
    });

    evidence.splice(
      0,
      evidence.length,
      ...synthesized.evidence.map((item) => evidenceItemSchema.parse(item)),
    );
    narrativeSummary = synthesized.narrativeSummary;

    if ((synthesized.missingDataNotes ?? []).length > 0) {
      missingDataNotes.splice(0, missingDataNotes.length, ...(synthesized.missingDataNotes ?? []));
    }

    if (evidence.length === 0) {
      evidence.push(
        evidenceItemSchema.parse({
          category: "catalyst",
          summary: `${symbol} retained only incomplete research coverage. Additional external reads are needed before analyst escalation.`,
          sourceLabel: "Omen Research Shell",
          sourceUrl: null,
          structuredData: {
            marketBiasReasoning: state.marketBiasReasoning,
          },
        }),
      );
    } else {
      evidence[0] = evidenceItemSchema.parse({
        ...evidence[0],
        structuredData: {
          ...evidence[0].structuredData,
          marketBiasReasoning: state.marketBiasReasoning,
        },
      });
    }

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
    snapshot: Record<string, unknown> | null;
    protocolSnapshot: ProtocolSnapshot | null;
    evidence: EvidenceItem[];
    narrativeSummary: string;
    missingDataNotes: string[];
  }) {
    if (this.llmClient === null) {
      throw new Error("Research synthesis requires a configured LLM client.");
    }

    if (input.evidence.length === 0) {
      throw new Error("Research synthesis requires at least one live evidence item.");
    }

    try {
      const response = await this.llmClient.completeJson({
        schema: researchSynthesisSchema,
        systemPrompt: input.prompt,
        userPrompt: JSON.stringify(
          {
            candidate: input.candidate,
            marketBiasReasoning: input.state.marketBiasReasoning,
            snapshot: input.snapshot,
            protocolSnapshot: input.protocolSnapshot,
            preliminaryEvidence: input.evidence,
            preliminaryNarrativeSummary: input.narrativeSummary,
            missingDataNotes: input.missingDataNotes,
            instruction: [
              "Use your built-in web and X search capabilities exactly like the template scanner flow. Gather only the most relevant confirming or disconfirming evidence for this candidate.",
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
