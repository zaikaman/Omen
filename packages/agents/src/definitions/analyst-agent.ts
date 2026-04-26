import type { z } from "zod";
import { z as zod } from "zod";

import { analystInputSchema, analystOutputSchema } from "../contracts/analyst.js";
import type { RuntimeNodeDefinition } from "../framework/agent-runtime.js";
import { type EvidenceItem, type SwarmState, thesisDraftSchema } from "../framework/state.js";
import { OpenAiCompatibleJsonClient } from "../llm/openai-compatible-client.js";
import { resolveModelProfileForRole } from "../llm/model-routing.js";
import { buildAnalystSystemPrompt } from "../prompts/analyst/system.js";

const analystAgentOptionsSchema = zod.object({
  llmClient: zod.custom<OpenAiCompatibleJsonClient>().nullable().optional(),
});

const categoryWeight: Record<EvidenceItem["category"], number> = {
  market: 8,
  technical: 9,
  liquidity: 6,
  funding: 7,
  fundamental: 6,
  catalyst: 5,
  sentiment: 4,
  chart: 8,
};

const directionFromResearch = (
  directionHint: z.infer<typeof analystInputSchema>["research"]["candidate"]["directionHint"],
  evidence: EvidenceItem[],
) => {
  if (directionHint) {
    return directionHint;
  }

  const bullishSignals = evidence.filter((item) =>
    /bullish|breakout|strength|reclaim|positive/i.test(item.summary),
  ).length;
  const bearishSignals = evidence.filter((item) =>
    /bearish|breakdown|weakness|rejection|negative/i.test(item.summary),
  ).length;

  if (bullishSignals > bearishSignals) {
    return "LONG";
  }

  if (bearishSignals > bullishSignals) {
    return "SHORT";
  }

  return "WATCHLIST";
};

const buildConfluences = (evidence: EvidenceItem[]) =>
  evidence
    .slice(0, 4)
    .map((item) => normalizeConfluence(item.summary))
    .filter((entry, index, array) => array.indexOf(entry) === index);

const normalizeConfluence = (summary: string) =>
  summary.replace(/\s+/g, " ").trim().replace(/\.$/, "");

const roundTradingPrice = (value: number) => {
  if (value >= 1_000) {
    return Number(value.toFixed(0));
  }

  if (value >= 1) {
    return Number(value.toFixed(2));
  }

  if (value >= 0.01) {
    return Number(value.toFixed(4));
  }

  return Number(value.toFixed(8));
};

const extractCurrentPrice = (evidence: EvidenceItem[]) => {
  for (const item of evidence) {
    const candidate = item.structuredData.price;

    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
  }

  return null;
};

const estimateRiskReward = (
  direction: "LONG" | "SHORT" | "WATCHLIST" | "NONE",
  evidence: EvidenceItem[],
) => {
  if (direction !== "LONG" && direction !== "SHORT") {
    return null;
  }

  const technicalCount = evidence.filter(
    (item) => item.category === "technical" || item.category === "chart",
  ).length;

  return Number((1.8 + technicalCount * 0.35).toFixed(2));
};

const estimateConfidence = (input: {
  direction: "LONG" | "SHORT" | "WATCHLIST" | "NONE";
  evidence: EvidenceItem[];
  missingDataNotes: string[];
}) => {
  const evidenceScore = input.evidence.reduce(
    (sum, item) => sum + categoryWeight[item.category],
    0,
  );
  const confidence =
    input.direction === "LONG" || input.direction === "SHORT"
      ? 55 + evidenceScore - input.missingDataNotes.length * 4
      : 50 + Math.floor(evidenceScore / 3) - input.missingDataNotes.length * 4;

  return Math.max(
    45,
    Math.min(input.direction === "LONG" || input.direction === "SHORT" ? 92 : 82, confidence),
  );
};

const summarizeWhyNow = (symbol: string, evidence: EvidenceItem[], narrativeSummary: string) => {
  const leadEvidence = evidence
    .slice(0, 2)
    .map((item) => item.summary)
    .join(" ");

  return `${symbol} is actionable because ${leadEvidence} ${narrativeSummary}`.trim();
};

const deriveTradeSetup = (input: {
  direction: "LONG" | "SHORT" | "WATCHLIST" | "NONE";
  confidence: number;
  riskReward: number | null;
  confluences: string[];
  evidence: EvidenceItem[];
}) => {
  if ((input.direction !== "LONG" && input.direction !== "SHORT") || input.riskReward === null) {
    return {
      orderType: null,
      tradingStyle: null,
      expectedDuration: null,
      currentPrice: null,
      entryPrice: null,
      targetPrice: null,
      stopLoss: null,
    } as const;
  }

  const currentPrice = extractCurrentPrice(input.evidence);

  if (currentPrice === null) {
    return {
      orderType: "market" as const,
      tradingStyle:
        input.confidence >= 90 && input.confluences.length >= 3
          ? ("swing_trade" as const)
          : ("day_trade" as const),
      expectedDuration:
        input.confidence >= 90 && input.confluences.length >= 3 ? "2-5 days" : "8-16 hours",
      currentPrice: null,
      entryPrice: null,
      targetPrice: null,
      stopLoss: null,
    } as const;
  }

  const tradingStyle =
    input.confidence >= 90 && input.confluences.length >= 3 ? "swing_trade" : "day_trade";
  const expectedDuration = tradingStyle === "swing_trade" ? "2-5 days" : "8-16 hours";
  const stopDistancePercent = tradingStyle === "swing_trade" ? 0.05 : 0.035;
  const entryPrice = currentPrice;
  const stopLoss =
    input.direction === "LONG"
      ? currentPrice * (1 - stopDistancePercent)
      : currentPrice * (1 + stopDistancePercent);
  const riskPerUnit = Math.abs(entryPrice - stopLoss);
  const targetPrice =
    input.direction === "LONG"
      ? entryPrice + riskPerUnit * input.riskReward
      : entryPrice - riskPerUnit * input.riskReward;

  return {
    orderType: "market" as const,
    tradingStyle,
    expectedDuration,
    currentPrice: roundTradingPrice(currentPrice),
    entryPrice: roundTradingPrice(entryPrice),
    targetPrice: roundTradingPrice(targetPrice),
    stopLoss: roundTradingPrice(stopLoss),
  } as const;
};

const mergeChartVisionSummary = (
  narrativeSummary: string,
  chartVisionSummary: string | null,
) =>
  chartVisionSummary && chartVisionSummary.trim().length > 0
    ? `${narrativeSummary} Chart confirmation: ${chartVisionSummary.trim()}`
    : narrativeSummary;

const summarizeUncertainty = (missingDataNotes: string[], evidence: EvidenceItem[]) => {
  if (missingDataNotes.length > 0) {
    return missingDataNotes.join(" ");
  }

  const softEvidenceCount = evidence.filter(
    (item) => item.category === "sentiment" || item.category === "catalyst",
  ).length;

  if (softEvidenceCount > 0) {
    return "Narrative and sentiment evidence contributed to conviction, so follow-through still needs confirmation from live market structure.";
  }

  return "No material uncertainty flags were raised beyond normal market volatility.";
};

export const deriveAnalystThesis = (input: z.input<typeof analystInputSchema>) => {
  const parsed = analystInputSchema.parse(input);
  const direction = directionFromResearch(
    parsed.research.candidate.directionHint,
    parsed.research.evidence,
  );
  const confluences = buildConfluences(parsed.research.evidence);
  const riskReward = estimateRiskReward(direction, parsed.research.evidence);
  const confidence = estimateConfidence({
    direction,
    evidence: parsed.research.evidence,
    missingDataNotes: parsed.research.missingDataNotes,
  });
  const tradeSetup = deriveTradeSetup({
    direction,
    confidence,
    riskReward,
    confluences,
    evidence: parsed.research.evidence,
  });
  const prompt = buildAnalystSystemPrompt({
    symbol: parsed.research.candidate.symbol,
    directionHint: parsed.research.candidate.directionHint,
    evidenceCount: parsed.research.evidence.length,
  });

  const thesis = thesisDraftSchema.parse({
    candidateId: parsed.research.candidate.id,
    asset: parsed.research.candidate.symbol,
    direction:
      direction === "WATCHLIST" && confidence < 60
        ? "WATCHLIST"
        : direction === "WATCHLIST"
          ? "NONE"
          : direction,
    confidence,
    orderType: tradeSetup.orderType,
    tradingStyle: tradeSetup.tradingStyle,
    expectedDuration: tradeSetup.expectedDuration,
    currentPrice: tradeSetup.currentPrice,
    entryPrice: tradeSetup.entryPrice,
    targetPrice: tradeSetup.targetPrice,
    stopLoss: tradeSetup.stopLoss,
    riskReward,
    whyNow: summarizeWhyNow(
      parsed.research.candidate.symbol,
      parsed.research.evidence,
      mergeChartVisionSummary(
        parsed.research.narrativeSummary,
        parsed.research.chartVisionSummary,
      ),
    ),
    confluences,
    uncertaintyNotes: summarizeUncertainty(
      parsed.research.missingDataNotes,
      parsed.research.evidence,
    ),
    missingDataNotes:
      parsed.research.missingDataNotes.length > 0
        ? parsed.research.missingDataNotes.join(" ")
        : "No additional missing-data flags.",
  });

  return analystOutputSchema.parse({
    thesis,
    analystNotes: [
      `Prompt shell: ${prompt}`,
      `Evidence categories: ${parsed.research.evidence.map((item) => item.category).join(", ")}`,
      ...(parsed.research.chartVisionSummary
        ? [`Chart vision: ${parsed.research.chartVisionSummary}`]
        : []),
    ],
  });
};

export class AnalystAgentFactory {
  private readonly llmClient: OpenAiCompatibleJsonClient | null;

  constructor(input: zod.input<typeof analystAgentOptionsSchema> = {}) {
    const parsed = analystAgentOptionsSchema.parse(input);
    this.llmClient =
      parsed.llmClient ??
      OpenAiCompatibleJsonClient.fromEnv(resolveModelProfileForRole("analyst"));
  }

  createDefinition(): RuntimeNodeDefinition<
    z.input<typeof analystInputSchema>,
    z.input<typeof analystOutputSchema>
  > {
    return {
      key: "analyst-agent",
      role: "analyst",
      inputSchema: analystInputSchema,
      outputSchema: analystOutputSchema,
      invoke: async (input, state) => this.analyze(input, state),
    };
  }

  private async analyze(
    input: z.input<typeof analystInputSchema>,
    state: SwarmState,
  ) {
    void state;
    const fallback = deriveAnalystThesis(input);

    if (this.llmClient === null) {
      return fallback;
    }

    const parsed = analystInputSchema.parse(input);

    try {
      const prompt = buildAnalystSystemPrompt({
        symbol: parsed.research.candidate.symbol,
        directionHint: parsed.research.candidate.directionHint,
        evidenceCount: parsed.research.evidence.length,
      });
      const response = await this.llmClient.completeJson({
        schema: analystOutputSchema,
        systemPrompt: prompt,
        userPrompt: JSON.stringify(
          {
            candidate: parsed.research.candidate,
            narrativeSummary: parsed.research.narrativeSummary,
            chartVisionSummary: parsed.research.chartVisionSummary,
            chartVisionTimeframes: parsed.research.chartVisionTimeframes,
            missingDataNotes: parsed.research.missingDataNotes,
            evidence: parsed.research.evidence,
            instruction:
              "Return one thesis draft only. Keep candidateId equal to the candidate id and asset equal to the candidate symbol.",
          },
          null,
          2,
        ),
      });

      return analystOutputSchema.parse({
        ...response,
        thesis: {
          ...fallback.thesis,
          ...response.thesis,
          candidateId: parsed.research.candidate.id,
          asset: parsed.research.candidate.symbol.toUpperCase(),
        },
        analystNotes: [
          ...(response.analystNotes ?? []),
          `Model-backed analyst path: ${this.llmClient.config.model}`,
        ],
      });
    } catch {
      return fallback;
    }
  }
}

export const createAnalystAgent = (
  input: zod.input<typeof analystAgentOptionsSchema> = {},
) => new AnalystAgentFactory(input).createDefinition();
