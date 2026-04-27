import type { z } from "zod";
import { z as zod } from "zod";

import { TavilyMarketResearchService } from "@omen/market-data";
import { intelInputSchema, intelOutputSchema } from "../contracts/intel.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import {
  type EvidenceItem,
  type IntelReport,
  type RecentIntelHistoryItem,
  type SwarmState,
  type ThesisDraft,
} from "../framework/state.js";
import { OpenAiCompatibleJsonClient } from "../llm/openai-compatible-client.js";
import { resolveModelProfileForRole } from "../llm/model-routing.js";
import { buildIntelSystemPrompt } from "../prompts/intel/system.js";

const intelAgentOptionsSchema = zod.object({
  llmClient: zod.custom<OpenAiCompatibleJsonClient>().nullable().optional(),
  marketResearch: zod.custom<TavilyMarketResearchService>().optional(),
});

const summarizeEvidence = (evidence: EvidenceItem[]) =>
  evidence
    .slice(0, 3)
    .map((item) => item.summary.replace(/\s+/g, " ").trim())
    .join(" ");

const hasNarrativeEvidence = (evidence: EvidenceItem[]) =>
  evidence.some(
    (item) =>
      item.category === "fundamental" ||
      item.category === "catalyst" ||
      item.category === "sentiment" ||
      item.category === "liquidity",
  );

const inferIntelCategory = (input: {
  thesis: ThesisDraft | null;
  symbols: string[];
  evidence: EvidenceItem[];
}) => {
  if (input.symbols.length > 1) {
    return "narrative_shift" as const;
  }

  if (input.thesis !== null) {
    if (input.thesis.direction === "WATCHLIST" || input.thesis.direction === "NONE") {
      return "token_watch" as const;
    }

    return "opportunity" as const;
  }

  if (
    input.evidence.some((item) => item.category === "fundamental" || item.category === "sentiment")
  ) {
    return "narrative_shift" as const;
  }

  return "market_update" as const;
};

const normalizeComparableText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const isWithinLastHours = (timestamp: string, hours: number) => {
  const parsed = Date.parse(timestamp);

  if (Number.isNaN(parsed)) {
    return false;
  }

  return Date.now() - parsed <= hours * 60 * 60 * 1000;
};

const isDuplicateIntelReport = (input: {
  report: IntelReport;
  recentHistory: RecentIntelHistoryItem[];
}) => {
  const reportTitle = normalizeComparableText(input.report.title);
  const reportTopic = normalizeComparableText(input.report.topic);
  const reportSymbols = new Set(input.report.symbols.map((symbol) => symbol.toUpperCase()));

  return input.recentHistory.some((item) => {
    if (!isWithinLastHours(item.timestamp, 24)) {
      return false;
    }

    const sameTitle = normalizeComparableText(item.title) === reportTitle;
    const sameTopic = normalizeComparableText(item.topic) === reportTopic;
    const sameCategoryAndSymbol =
      item.category === input.report.category &&
      item.symbols.some((symbol) => reportSymbols.has(symbol.toUpperCase()));

    return sameTitle || sameTopic || sameCategoryAndSymbol;
  });
};

const toIntelReport = (
  report: Omit<IntelReport, "symbols" | "imagePrompt"> & {
    symbols?: string[];
    imagePrompt?: string | null;
  },
): IntelReport => ({
  ...report,
  symbols: report.symbols ?? [],
  imagePrompt: report.imagePrompt ?? null,
});

const deriveFallbackIntelReport = (
  parsed: z.infer<typeof intelInputSchema>,
): IntelReport | null => {
  const symbols = [
    ...new Set(
      [
        ...parsed.candidates.map((candidate) => candidate.symbol),
        parsed.thesis?.asset,
        ...parsed.evidence
          .map((item) => item.structuredData.symbol)
          .filter((symbol): symbol is string => typeof symbol === "string" && symbol.length > 0),
      ]
        .filter((symbol): symbol is string => typeof symbol === "string" && symbol.length > 0)
        .map((symbol) => symbol.toUpperCase()),
    ),
  ];
  const leadSymbol = symbols[0] ?? parsed.thesis?.asset ?? "market";
  const evidenceSummary = summarizeEvidence(parsed.evidence);
  const hasEvidenceSummary = evidenceSummary.trim().length > 0;
  const rejectedTradeOnly =
    parsed.review?.decision === "rejected" &&
    parsed.thesis !== null &&
    !hasNarrativeEvidence(parsed.evidence) &&
    symbols.length <= 1;

  if (!hasEvidenceSummary || rejectedTradeOnly) {
    return null;
  }

  const thesisContext =
    parsed.thesis === null
      ? "Fresh market intelligence scan found a context worth tracking."
      : parsed.thesis.direction === "NONE"
        ? "No actionable trade cleared the threshold, but the market context may still be worth tracking."
        : `${parsed.thesis.asset} remains on the desk as market intel, not a standalone trade call.`;
  const chartContext = parsed.chartVisionSummary?.trim().length
    ? `Chart context: ${parsed.chartVisionSummary.trim()}`
    : "Chart context remains limited.";
  const reviewContext =
    parsed.review?.forcedOutcomeReason ??
    parsed.review?.objections.join("; ") ??
    "No explicit critic objections were recorded.";
  const summary = `${thesisContext} ${evidenceSummary} ${chartContext}`.replace(/\s+/g, " ").trim();
  const importanceScore =
    parsed.review?.decision === "watchlist_only" || hasNarrativeEvidence(parsed.evidence) ? 7 : 6;

  if (importanceScore < 7) {
    return null;
  }

  return {
    topic: symbols.length > 1 ? `${symbols.join(", ")} market watch` : `${leadSymbol} market watch`,
    insight: `${summary} Gate context: ${reviewContext}`.replace(/\s+/g, " ").trim(),
    importanceScore,
    category: inferIntelCategory({
      thesis: parsed.thesis,
      symbols,
      evidence: parsed.evidence,
    }),
    title: `${leadSymbol} market intel`,
    summary,
    confidence: Math.min(95, Math.max(60, (parsed.thesis?.confidence ?? 65) - 5)),
    symbols,
    imagePrompt: [
      "Premium editorial crypto market intelligence cover art",
      `focused on ${leadSymbol.toUpperCase()}`,
      "cinematic cyberpunk trading desk, data streams, institutional research terminal",
      "sharp composition, high contrast, no text, no logos, 16:9",
    ].join(", "),
  };
};

export class IntelAgentFactory {
  private readonly llmClient: OpenAiCompatibleJsonClient | null;

  private readonly marketResearch: TavilyMarketResearchService;

  constructor(input: zod.input<typeof intelAgentOptionsSchema> = {}) {
    const parsed = intelAgentOptionsSchema.parse(input);
    this.llmClient =
      parsed.llmClient ?? OpenAiCompatibleJsonClient.fromEnv(resolveModelProfileForRole("intel"));
    this.marketResearch = parsed.marketResearch ?? new TavilyMarketResearchService();
  }

  createDefinition(): RuntimeNodeDefinition<
    z.input<typeof intelInputSchema>,
    z.input<typeof intelOutputSchema>
  > {
    return {
      key: "intel-agent",
      role: "intel",
      inputSchema: intelInputSchema,
      outputSchema: intelOutputSchema,
      invoke: async (input, state) => this.generateIntel(input, state),
    };
  }

  private async generateIntel(input: z.input<typeof intelInputSchema>, state: SwarmState) {
    const parsed = await this.enrichInputWithIntelResearch(intelInputSchema.parse(input), state);

    const fallbackReport = deriveFallbackIntelReport(parsed);
    const prompt = buildIntelSystemPrompt({
      runId: parsed.context.runId,
      hasCandidates: parsed.candidates.length > 0,
      hasThesis: parsed.thesis !== null,
      reviewDecision: parsed.review?.decision ?? null,
    });

    if (this.llmClient === null) {
      const dedupedFallback =
        fallbackReport &&
        isDuplicateIntelReport({
          report: fallbackReport,
          recentHistory: parsed.recentIntelHistory,
        })
          ? null
          : fallbackReport;

      return intelOutputSchema.parse({
        action: dedupedFallback === null ? "skip" : "ready",
        report: dedupedFallback,
        skipReason: fallbackReport !== null && dedupedFallback === null ? "recent_duplicate" : null,
      });
    }

    try {
      const response = await this.llmClient.completeJson({
        schema: intelOutputSchema,
        systemPrompt: prompt,
        userPrompt: JSON.stringify(
          {
            bias: parsed.bias,
            candidates: parsed.candidates,
            evidence: parsed.evidence,
            chartVisionSummary: parsed.chartVisionSummary,
            thesis: parsed.thesis,
            review: parsed.review,
            instruction:
              "Produce one high-signal intel report only when it is genuinely valuable. If this is routine noise, return action=skip.",
          },
          null,
          2,
        ),
      });

      if (response.action === "ready" && response.report !== null) {
        const normalizedReport = toIntelReport(response.report);

        if (
          isDuplicateIntelReport({
            report: normalizedReport,
            recentHistory: parsed.recentIntelHistory,
          })
        ) {
          return intelOutputSchema.parse({
            action: "skip",
            report: null,
            skipReason: "recent_duplicate",
          });
        }

        return intelOutputSchema.parse({
          ...response,
          report: normalizedReport,
        });
      }
    } catch {
      // Fall back to deterministic intel shaping.
    }

    const dedupedFallback =
      fallbackReport &&
      isDuplicateIntelReport({
        report: fallbackReport,
        recentHistory: parsed.recentIntelHistory,
      })
        ? null
        : fallbackReport;

    return intelOutputSchema.parse({
      action: dedupedFallback === null ? "skip" : "ready",
      report: dedupedFallback,
      skipReason: fallbackReport !== null && dedupedFallback === null ? "recent_duplicate" : null,
    });
  }

  private async enrichInputWithIntelResearch(
    input: z.infer<typeof intelInputSchema>,
    state: SwarmState,
  ): Promise<z.infer<typeof intelInputSchema>> {
    const parsed = intelInputSchema.parse(input);

    if (parsed.context.mode === "mocked" || !state.config.providers.news.enabled) {
      return parsed;
    }

    const existingEvidence = [...parsed.evidence];
    const existingNarrativeKeys = new Set(
      existingEvidence
        .filter((item) => item.category === "sentiment" || item.category === "catalyst")
        .map((item) => item.summary.toLowerCase()),
    );
    const symbols = [
      ...new Set(
        [parsed.thesis?.asset, ...parsed.candidates.map((candidate) => candidate.symbol)]
          .filter((symbol): symbol is string => Boolean(symbol))
          .map((symbol) => symbol.toUpperCase()),
      ),
    ].slice(0, 3);
    const focus =
      symbols.length > 0
        ? `${symbols.join(" ")} crypto market news catalyst sentiment high signal accounts`
        : "crypto market narratives today high signal accounts WatcherGuru Pentosh1 Cointelegraph";

    const narratives = await this.marketResearch.getSymbolResearchBundle({
      symbol: symbols[0] ?? "MARKET",
      query: focus,
    });

    if (!narratives.ok) {
      return parsed;
    }

    const narrativeEvidence = [...narratives.value.narratives, ...narratives.value.macroContext]
      .slice(0, 4)
      .map(
        (narrative) =>
          ({
            category: narrative.sentiment === "neutral" ? "catalyst" : "sentiment",
            summary: `${narrative.title}: ${narrative.summary}`,
            sourceLabel: narrative.source,
            sourceUrl: narrative.sourceUrl,
            structuredData: {
              symbol: narrative.symbol,
              sentiment: narrative.sentiment,
              capturedAt: narrative.capturedAt,
              source: "intel-research",
            },
          }) satisfies EvidenceItem,
      )
      .filter((item) => {
        const key = item.summary.toLowerCase();

        if (existingNarrativeKeys.has(key)) {
          return false;
        }

        existingNarrativeKeys.add(key);
        return true;
      });

    if (narrativeEvidence.length === 0) {
      return parsed;
    }

    return intelInputSchema.parse({
      ...parsed,
      evidence: [...existingEvidence, ...narrativeEvidence],
    });
  }
}

export const createIntelAgent = (input: zod.input<typeof intelAgentOptionsSchema> = {}) =>
  new IntelAgentFactory(input).createDefinition();
