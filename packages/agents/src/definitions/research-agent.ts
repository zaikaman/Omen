import {
  BinanceMarketService,
  DefiLlamaMarketService,
  TavilyMarketResearchService,
  type AssetNarrative,
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
  narratives: z.custom<TavilyMarketResearchService>().optional(),
  llmClient: z.custom<OpenAiCompatibleJsonClient>().nullable().optional(),
});

const researchSynthesisSchema = z.object({
  evidence: z.array(evidenceItemSchema).min(1),
  narrativeSummary: z.string().min(1),
  missingDataNotes: z.array(z.string().min(1)).default([]),
});

const normalizeSourceLabel = (input: string) =>
  input
    .trim()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const buildNarrativeEvidence = (
  narratives: AssetNarrative[],
  symbol: string,
): EvidenceItem[] =>
  narratives.map((narrative) =>
    evidenceItemSchema.parse({
      category:
        narrative.sentiment === "bullish" || narrative.sentiment === "bearish"
          ? "sentiment"
          : "catalyst",
      summary: `${narrative.title}: ${narrative.summary}`,
      sourceLabel: normalizeSourceLabel(narrative.source),
      sourceUrl: narrative.sourceUrl,
      structuredData: {
        symbol,
        sentiment: narrative.sentiment,
        capturedAt: narrative.capturedAt,
      },
    }),
  );

const buildProtocolEvidence = (
  protocolSnapshot: ProtocolSnapshot,
  symbol: string,
): EvidenceItem =>
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

const summarizeNarratives = (narratives: AssetNarrative[], symbol: string) => {
  if (narratives.length === 0) {
    return `${symbol} has no strong external narrative confirmation yet; the candidate remains dependent on market-structure evidence.`;
  }

  return narratives
    .slice(0, 2)
    .map((narrative) => narrative.summary)
    .join(" ");
};

const truncateNarrativeText = (value: string, maxLength = 280) =>
  value.length > maxLength ? `${value.slice(0, maxLength).trim()}...` : value;

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

export class ResearchAgentFactory {
  private readonly marketData: BinanceMarketService;

  private readonly protocolData: DefiLlamaMarketService;

  private readonly narratives: TavilyMarketResearchService;

  private readonly llmClient: OpenAiCompatibleJsonClient | null;

  constructor(input: z.input<typeof researchServiceOptionsSchema> = {}) {
    const parsed = researchServiceOptionsSchema.parse(input);
    this.marketData = parsed.marketData ?? new BinanceMarketService();
    this.protocolData = parsed.protocolData ?? new DefiLlamaMarketService();
    this.narratives = parsed.narratives ?? new TavilyMarketResearchService();
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

    const [snapshotResult, protocolResult] = await Promise.all([
      this.marketData.getSnapshot(symbol),
      protocolSlug === null
        ? Promise.resolve(null)
        : this.protocolData.getProtocolSnapshot(protocolSlug),
    ]);

    const evidence: EvidenceItem[] = [];
    const missingDataNotes = [...parsed.candidate.missingDataNotes];

    if (snapshotResult.ok) {
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
      missingDataNotes.push(`Market snapshot missing: ${snapshotResult.error.message}`);
    }

    if (protocolResult?.ok) {
      evidence.push(buildProtocolEvidence(protocolResult.value, symbol));
    } else if (protocolResult && !protocolResult.ok) {
      missingDataNotes.push(`Protocol snapshot missing: ${protocolResult.error.message}`);
    }

    let narrativeSummary = `${symbol} research bundle is currently market-led with limited external context.`;

    const prompt = buildResearchSystemPrompt({
      symbol,
      directionHint: parsed.candidate.directionHint,
    });

    let synthesized = await this.synthesizeResearch({
      candidate: parsed.candidate,
      prompt,
      state,
      snapshot: snapshotResult.ok
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
      narratives: [],
      evidence,
      narrativeSummary,
      missingDataNotes,
      nativeSearchPrimary: true,
    });

    if (synthesized === null) {
      const narrativeBundleResult = await this.narratives.getSymbolResearchBundle({
        symbol,
        query: `${symbol} catalysts narrative context`,
      });

      if (narrativeBundleResult.ok) {
        const allNarratives = [
          ...narrativeBundleResult.value.narratives,
          ...narrativeBundleResult.value.macroContext,
        ].map((narrative) => ({
          ...narrative,
          summary: truncateNarrativeText(narrative.summary),
          title: truncateNarrativeText(narrative.title, 120),
        }));
        evidence.push(...buildNarrativeEvidence(allNarratives, symbol));
        narrativeSummary = summarizeNarratives(allNarratives, symbol);
      } else {
        missingDataNotes.push(`Narrative bundle missing: ${narrativeBundleResult.error.message}`);
      }

      synthesized = await this.synthesizeResearch({
        candidate: parsed.candidate,
        prompt,
        state,
        snapshot: snapshotResult.ok
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
        narratives: [],
        evidence,
        narrativeSummary,
        missingDataNotes,
        nativeSearchPrimary: false,
      });
    }

    if (synthesized !== null) {
      evidence.splice(
        0,
        evidence.length,
        ...synthesized.evidence.map((item) => evidenceItemSchema.parse(item)),
      );
      narrativeSummary = synthesized.narrativeSummary;

      if ((synthesized.missingDataNotes ?? []).length > 0) {
        missingDataNotes.splice(
          0,
          missingDataNotes.length,
          ...(synthesized.missingDataNotes ?? []),
        );
      }
    }

    if (evidence.length === 0) {
      evidence.push(
        evidenceItemSchema.parse({
          category: "catalyst",
          summary: `${symbol} retained only placeholder research coverage. Additional external reads are needed before analyst escalation.`,
          sourceLabel: "Omen Research Shell",
          sourceUrl: null,
          structuredData: {
            prompt,
            marketBiasReasoning: state.marketBiasReasoning,
          },
        }),
      );
    } else {
      evidence[0] = evidenceItemSchema.parse({
        ...evidence[0],
        structuredData: {
          ...evidence[0].structuredData,
          prompt,
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
    narratives: AssetNarrative[];
    evidence: EvidenceItem[];
    narrativeSummary: string;
    missingDataNotes: string[];
    nativeSearchPrimary: boolean;
  }) {
    if (this.llmClient === null || input.evidence.length === 0) {
      return null;
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
            narratives: input.narratives,
            preliminaryEvidence: input.evidence,
            preliminaryNarrativeSummary: input.narrativeSummary,
            missingDataNotes: input.missingDataNotes,
            instruction: [
              input.nativeSearchPrimary
                ? "Use your built-in web and X search capabilities exactly like the template scanner flow. Gather only the most relevant confirming or disconfirming evidence for this candidate."
                : "Rewrite the supplied raw research into a cleaner analyst-ready bundle.",
              input.nativeSearchPrimary
                ? "Prefer a small, focused evidence set over a broad article dump."
                : "Use only the facts provided in the input.",
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
    } catch {
      return null;
    }
  }
}

export const createResearchAgent = (
  input: z.input<typeof researchServiceOptionsSchema> = {},
) => new ResearchAgentFactory(input).createDefinition();
