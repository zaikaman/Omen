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
import { buildResearchSystemPrompt } from "../prompts/research/system.js";

const researchServiceOptionsSchema = z.object({
  marketData: z.custom<BinanceMarketService>().optional(),
  protocolData: z.custom<DefiLlamaMarketService>().optional(),
  narratives: z.custom<TavilyMarketResearchService>().optional(),
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

const promoteCandidateToResearched = (candidate: CandidateState) =>
  candidateStateSchema.parse({
    ...candidate,
    status: "researched",
  });

export class ResearchAgentFactory {
  private readonly marketData: BinanceMarketService;

  private readonly protocolData: DefiLlamaMarketService;

  private readonly narratives: TavilyMarketResearchService;

  constructor(input: z.input<typeof researchServiceOptionsSchema> = {}) {
    const parsed = researchServiceOptionsSchema.parse(input);
    this.marketData = parsed.marketData ?? new BinanceMarketService();
    this.protocolData = parsed.protocolData ?? new DefiLlamaMarketService();
    this.narratives = parsed.narratives ?? new TavilyMarketResearchService();
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

    const [snapshotResult, protocolResult, narrativeBundleResult] = await Promise.all([
      this.marketData.getSnapshot(symbol),
      this.protocolData.getProtocolSnapshot(symbol.toLowerCase()),
      this.narratives.getSymbolResearchBundle({
        symbol,
        query: `${symbol} catalysts narrative context`,
      }),
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

    if (protocolResult.ok) {
      evidence.push(buildProtocolEvidence(protocolResult.value, symbol));
    } else {
      missingDataNotes.push(`Protocol snapshot missing: ${protocolResult.error.message}`);
    }

    let narrativeSummary = `${symbol} research bundle is currently market-led with limited external context.`;

    if (narrativeBundleResult.ok) {
      const allNarratives = [
        ...narrativeBundleResult.value.narratives,
        ...narrativeBundleResult.value.macroContext,
      ];
      evidence.push(...buildNarrativeEvidence(allNarratives, symbol));
      narrativeSummary = summarizeNarratives(allNarratives, symbol);
    } else {
      missingDataNotes.push(`Narrative bundle missing: ${narrativeBundleResult.error.message}`);
    }

    const prompt = buildResearchSystemPrompt({
      symbol,
      directionHint: parsed.candidate.directionHint,
    });

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
}

export const createResearchAgent = (
  input: z.input<typeof researchServiceOptionsSchema> = {},
) => new ResearchAgentFactory(input).createDefinition();
