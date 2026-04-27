import type { z } from "zod";
import { z as zod } from "zod";

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
});

const summarizeEvidence = (evidence: EvidenceItem[]) =>
  evidence
    .slice(0, 3)
    .map((item) => item.summary.replace(/\s+/g, " ").trim())
    .join(" ");

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
    input.evidence.some(
      (item) => item.category === "fundamental" || item.category === "sentiment",
    )
  ) {
    return "narrative_shift" as const;
  }

  return "market_update" as const;
};

const normalizeComparableText = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

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
  report: Omit<IntelReport, "symbols"> & { symbols?: string[] },
): IntelReport => ({
  ...report,
  symbols: report.symbols ?? [],
});

const deriveFallbackIntelReport = (input: z.input<typeof intelInputSchema>): IntelReport | null => {
  const parsed = intelInputSchema.parse(input);
  const symbols = [...new Set(parsed.candidates.map((candidate) => candidate.symbol))];
  const leadSymbol = symbols[0] ?? parsed.thesis?.asset ?? "market";
  const evidenceSummary = summarizeEvidence(parsed.evidence);
  const thesisContext =
    parsed.thesis === null
      ? "No actionable signal cleared the threshold, but the market context is still worth tracking."
      : `${parsed.thesis.asset} failed the signal gate, so this is being reframed as intel rather than a trade call.`;
  const chartContext =
    parsed.chartVisionSummary?.trim().length
      ? `Chart context: ${parsed.chartVisionSummary.trim()}`
      : "Chart context remains limited.";
  const reviewContext =
    parsed.review?.forcedOutcomeReason ??
    parsed.review?.objections.join("; ") ??
    "No explicit critic objections were recorded.";
  const summary = `${thesisContext} ${evidenceSummary} ${chartContext}`.replace(/\s+/g, " ").trim();
  const importanceScore = parsed.review?.decision === "watchlist_only" ? 7 : 8;

  if (importanceScore < 7) {
    return null;
  }

  return {
    topic: `${leadSymbol} market setup fallback`,
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
  };
};

export class IntelAgentFactory {
  private readonly llmClient: OpenAiCompatibleJsonClient | null;

  constructor(input: zod.input<typeof intelAgentOptionsSchema> = {}) {
    const parsed = intelAgentOptionsSchema.parse(input);
    this.llmClient =
      parsed.llmClient ??
      OpenAiCompatibleJsonClient.fromEnv(resolveModelProfileForRole("intel"));
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

  private async generateIntel(
    input: z.input<typeof intelInputSchema>,
    state: SwarmState,
  ) {
    void state;
    const parsed = intelInputSchema.parse(input);

    const fallbackReport = deriveFallbackIntelReport(parsed);
  const prompt = buildIntelSystemPrompt({
      runId: parsed.context.runId,
      hasCandidates: parsed.candidates.length > 0,
      hasThesis: parsed.thesis !== null,
      reviewDecision: parsed.review?.decision ?? null,
    });

    if (this.llmClient === null) {
      const dedupedFallback =
        fallbackReport && isDuplicateIntelReport({
          report: fallbackReport,
          recentHistory: parsed.recentIntelHistory,
        })
          ? null
          : fallbackReport;

      return intelOutputSchema.parse({
        action: dedupedFallback === null ? "skip" : "ready",
        report: dedupedFallback,
        skipReason:
          fallbackReport !== null && dedupedFallback === null
            ? "recent_duplicate"
            : null,
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
      fallbackReport && isDuplicateIntelReport({
        report: fallbackReport,
        recentHistory: parsed.recentIntelHistory,
      })
        ? null
        : fallbackReport;

    return intelOutputSchema.parse({
      action: dedupedFallback === null ? "skip" : "ready",
      report: dedupedFallback,
      skipReason:
        fallbackReport !== null && dedupedFallback === null ? "recent_duplicate" : null,
    });
  }
}

export const createIntelAgent = (
  input: zod.input<typeof intelAgentOptionsSchema> = {},
) => new IntelAgentFactory(input).createDefinition();
