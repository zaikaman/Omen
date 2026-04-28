import type { z } from "zod";
import { z as zod } from "zod";

import { intelInputSchema, intelOutputSchema } from "../contracts/intel.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import {
  type EvidenceItem,
  type IntelReport,
  type RecentIntelHistoryItem,
  type SwarmState,
} from "../framework/state.js";
import { OpenAiCompatibleJsonClient } from "../llm/openai-compatible-client.js";
import { resolveModelProfileForRole } from "../llm/model-routing.js";
import { buildIntelSystemPrompt } from "../prompts/intel/system.js";

const intelAgentOptionsSchema = zod.object({
  llmClient: zod.custom<OpenAiCompatibleJsonClient>().nullable().optional(),
});

const normalizeImportanceScore = (value: unknown) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return value;
  }

  const normalized = value > 10 ? value / 10 : value;

  return Math.min(10, Math.max(1, Math.round(normalized)));
};

type TemplateIntel = {
  topic: string;
  insight: string;
  importance_score: number;
};

const templateIntelSchema: zod.ZodType<TemplateIntel, zod.ZodTypeDef, unknown> = zod.object({
  topic: zod.string().min(1),
  insight: zod.string().min(1),
  importance_score: zod.preprocess(normalizeImportanceScore, zod.number().int().min(1).max(10)),
});

const lowSignalNarrativePatterns = [
  /\bcrypto news\b/i,
  /\bprice prediction\b/i,
  /\bbest crypto to buy\b/i,
  /\bpresale\b/i,
  /\bico\b/i,
  /\bannounces investment growth\b/i,
  /\bmassive accumulation pepeto\b/i,
  /\bpepeto\b/i,
  /\bsponsored\b/i,
  /\bpress release\b/i,
];

const rawProviderListPatterns = [
  /^coingecko trending tokens:/i,
  /^birdeye trending tokens:/i,
  /^top watched movers:/i,
  /^coingecko top gainers:/i,
  /^defillama top chain tvl:/i,
];

const isRawProviderListEvidence = (item: EvidenceItem) =>
  rawProviderListPatterns.some((pattern) => pattern.test(item.summary.trim()));

const templateEvidenceRank = (item: EvidenceItem) => {
  if (item.structuredData.source === "intel-research") {
    return 0;
  }

  if (
    item.category === "catalyst" ||
    item.category === "fundamental" ||
    item.category === "liquidity"
  ) {
    return 1;
  }

  if (item.category === "sentiment" && !isRawProviderListEvidence(item)) {
    return 2;
  }

  if (item.category === "market") {
    return 3;
  }

  return isRawProviderListEvidence(item) ? 5 : 4;
};

const sortTemplateEvidence = (evidence: EvidenceItem[]) =>
  [...evidence].sort((left, right) => templateEvidenceRank(left) - templateEvidenceRank(right));

const summarizeEvidence = (evidence: EvidenceItem[]) =>
  sortTemplateEvidence(evidence)
    .slice(0, 4)
    .map((item) => item.summary.replace(/\s+/g, " ").trim())
    .join(" ");

const trimToLength = (value: string, maxLength: number) => {
  const normalized = value.replace(/\s+/g, " ").trim();

  if (normalized.length <= maxLength) {
    return normalized;
  }

  const trimmed = normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd();
  const boundary = Math.max(trimmed.lastIndexOf("."), trimmed.lastIndexOf(";"));

  if (boundary >= Math.floor(maxLength * 0.55)) {
    return trimmed.slice(0, boundary + 1);
  }

  const wordBoundary = trimmed.lastIndexOf(" ");
  return `${trimmed.slice(0, wordBoundary > 0 ? wordBoundary : trimmed.length).trimEnd()}...`;
};

const stripIntelBoilerplate = (value: string) =>
  value
    .replace(/fresh market intelligence scan found a context worth tracking\.?\s*/gi, "")
    .replace(/no actionable trade cleared the threshold,\s*/gi, "")
    .replace(/but the market context may still be worth tracking\.?\s*/gi, "")
    .replace(/\bmarket market intel\b/gi, "crypto market intel")
    .replace(/\s+/g, " ")
    .trim();

const isLowSignalNarrativeText = (value: string) =>
  lowSignalNarrativePatterns.some((pattern) => pattern.test(value));

const isGenericIntelTopic = (topic: string) => {
  const normalized = topic.trim().toLowerCase();

  return (
    normalized === "coingecko trending tokens" ||
    normalized === "birdeye trending tokens" ||
    normalized === "top watched movers" ||
    normalized === "coingecko top gainers" ||
    normalized === "defillama top chain tvl" ||
    normalized === "crypto news" ||
    normalized === "market update" ||
    normalized === "crypto market update" ||
    normalized === "crypto market intel" ||
    normalized.length < 8
  );
};

const isIntelOwnedEvidence = (item: EvidenceItem) =>
  item.structuredData.source === "intel-market-data" ||
  item.structuredData.source === "intel-research";

const toTemplateEvidence = (
  evidence: EvidenceItem[],
  options: { includeDirectFixtures?: boolean } = {},
) =>
  evidence.filter(
    (item) =>
      isIntelOwnedEvidence(item) ||
      (options.includeDirectFixtures === true &&
        (item.category === "fundamental" ||
          item.category === "catalyst" ||
          item.category === "sentiment" ||
          item.category === "liquidity")),
  );

const extractSymbols = (evidence: EvidenceItem[]) => [
  ...new Set(
    evidence
      .flatMap((item) => {
        const symbol = item.structuredData.symbol;
        const symbols = item.structuredData.symbols;

        return [
          ...(typeof symbol === "string" ? [symbol] : []),
          ...(Array.isArray(symbols) ? symbols : []),
        ];
      })
      .filter((symbol): symbol is string => typeof symbol === "string" && symbol.length > 0)
      .map((symbol) => symbol.toUpperCase())
      .filter((symbol) => symbol !== "MARKET" && symbol !== "MACRO"),
  ),
];

const titleFromTopic = (topic: string) =>
  stripIntelBoilerplate(topic)
    .replace(/^skip$/i, "SKIP")
    .trim();

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

const templateIntelToReport = (input: {
  template: z.infer<typeof templateIntelSchema>;
  evidence: EvidenceItem[];
}): IntelReport | null => {
  const topic = titleFromTopic(input.template.topic);
  const insight = stripIntelBoilerplate(input.template.insight);

  if (
    /^skip$/i.test(topic) ||
    isGenericIntelTopic(topic) ||
    isLowSignalNarrativeText(`${topic} ${insight}`) ||
    /not enough value/i.test(insight) ||
    input.template.importance_score < 7
  ) {
    return null;
  }

  const symbols = extractSymbols(input.evidence);
  const title = topic.length > 0 ? topic : "Crypto Market Rotation";
  const category =
    symbols.length > 1 ? "narrative_shift" : symbols.length === 1 ? "token_watch" : "market_update";

  return {
    topic: title,
    insight,
    importanceScore: input.template.importance_score,
    category,
    title,
    summary: trimToLength(insight, 360),
    confidence: Math.min(95, Math.max(60, input.template.importance_score * 10)),
    symbols,
    imagePrompt: [
      "Premium editorial crypto market intelligence cover art",
      `focused on ${symbols.length > 0 ? symbols.join(", ") : title}`,
      "cinematic cyberpunk trading desk, data streams, institutional research terminal",
      "sharp composition, high contrast, no text, no logos, 16:9",
    ].join(", "),
  };
};

const deriveTemplateIntel = (evidence: EvidenceItem[]): z.infer<typeof templateIntelSchema> => {
  const templateEvidence = evidence;
  const evidenceSummary = stripIntelBoilerplate(summarizeEvidence(templateEvidence));

  if (!evidenceSummary) {
    return {
      topic: "SKIP",
      insight: "Not enough value",
      importance_score: 1,
    };
  }

  const first = sortTemplateEvidence(templateEvidence)[0];
  const topic = first
    ? stripIntelBoilerplate(first.summary)
        .replace(/:\s.*$/, "")
        .trim()
    : "Crypto Market Rotation";

  return {
    topic: titleFromTopic(topic) || "Crypto Market Rotation",
    insight: trimToLength(evidenceSummary, 900),
    importance_score: 7,
  };
};

export class IntelAgentFactory {
  private readonly llmClient: OpenAiCompatibleJsonClient | null;

  constructor(input: zod.input<typeof intelAgentOptionsSchema> = {}) {
    const parsed = intelAgentOptionsSchema.parse(input);
    this.llmClient =
      parsed.llmClient ?? OpenAiCompatibleJsonClient.fromEnv(resolveModelProfileForRole("intel"));
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
    const parsed = await this.enrichInputWithIntelResearch(
      this.toTemplateStyleInput(intelInputSchema.parse(input)),
      state,
    );
    const templateEvidence = parsed.evidence;
    const fallbackReport = templateIntelToReport({
      template: deriveTemplateIntel(templateEvidence),
      evidence: templateEvidence,
    });
    const prompt = buildIntelSystemPrompt({
      runId: parsed.context.runId,
      hasCandidates: false,
      hasThesis: false,
      reviewDecision: null,
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
      const response = await this.llmClient.completeJson<TemplateIntel>({
        schema: templateIntelSchema,
        systemPrompt: prompt,
        userPrompt: JSON.stringify(
          {
            bias: parsed.bias,
            market_data: templateEvidence.map((item) => ({
              category: item.category,
              summary: item.summary,
              sourceLabel: item.sourceLabel,
              sourceUrl: item.sourceUrl,
              structuredData: item.structuredData,
            })),
            recently_covered_topics: parsed.recentIntelHistory.slice(0, 10).map((item) => ({
              title: item.title,
              topic: item.topic,
              category: item.category,
              symbols: item.symbols,
              timestamp: item.timestamp,
            })),
            recent_posts: parsed.recentPostContext.slice(0, 10).map((post) => ({
              kind: post.kind,
              text: post.text,
              status: post.status,
              publishedUrl: post.publishedUrl,
              signalId: post.signalId,
              intelId: post.intelId,
              timestamp: post.timestamp,
            })),
            instruction: [
              "Return exactly the template intel shape: topic, insight, importance_score.",
              'If importance_score is below 7, set topic to "SKIP" and insight to "Not enough value".',
              "Do not use thesis, critic review, chart vision, publisher notes, or trade-gating context.",
              "Avoid repeating recently covered topics unless the new evidence materially changes the thesis.",
              "Avoid repeating recent_posts; use their exact text to keep the new intel distinct from what was already published.",
              "Use your built-in X search capability to inspect only the high-signal X accounts named in the system prompt.",
              "You must search those X accounts before deciding whether to skip.",
              "Do not build intel from CoinGecko, Birdeye, DeFiLlama, raw token lists, top gainer lists, or generic market-data feeds.",
              "Prefer specific, recent posts from those accounts that reveal a narrative, catalyst, liquidity shift, or macro crypto thesis.",
              "If any searched high-signal account has a coherent crypto-relevant narrative, pick the strongest one and score it 7-10.",
            ].join(" "),
          },
          null,
          2,
        ),
      });
      const normalizedReport = templateIntelToReport({
        template: response,
        evidence: templateEvidence,
      });

      if (normalizedReport !== null) {
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
          report: normalizedReport,
          action: "ready",
          skipReason: null,
        });
      }

      if (fallbackReport !== null) {
        if (
          isDuplicateIntelReport({
            report: fallbackReport,
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
          report: fallbackReport,
          action: "ready",
          skipReason: null,
        });
      }

      return intelOutputSchema.parse({
        action: "skip",
        report: null,
        skipReason: "not_enough_value",
      });
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

  private toTemplateStyleInput(
    input: z.infer<typeof intelInputSchema>,
  ): z.infer<typeof intelInputSchema> {
    return intelInputSchema.parse({
      ...input,
      candidates: [],
      evidence: toTemplateEvidence(input.evidence, {
        includeDirectFixtures: input.context.mode === "mocked",
      }),
      chartVisionSummary: null,
      thesis: null,
      review: null,
    });
  }

  private async enrichInputWithIntelResearch(
    input: z.infer<typeof intelInputSchema>,
    _state: SwarmState,
  ): Promise<z.infer<typeof intelInputSchema>> {
    const parsed = intelInputSchema.parse(input);

    if (parsed.context.mode === "mocked") {
      return parsed;
    }

    return intelInputSchema.parse({
      ...parsed,
      evidence: parsed.evidence,
    });
  }
}

export const createIntelAgent = (input: zod.input<typeof intelAgentOptionsSchema> = {}) =>
  new IntelAgentFactory(input).createDefinition();
