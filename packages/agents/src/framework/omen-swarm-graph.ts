import { z } from "zod";

import type { PublisherOutput } from "../contracts/publisher.js";
import type { ChartVisionOutput } from "../contracts/chart-vision.js";
import {
  createAnalystAgent,
  createChartVisionAgent,
  createCriticAgent,
  createMarketBiasAgent,
  createMemoryAgent,
  createPublisherAgent,
  createResearchAgent,
  createScannerAgent,
} from "../definitions/index.js";
import type { RuntimeNodeDefinition } from "./agent-runtime.js";
import { mergeSwarmState, type CriticReview, type SwarmState, type ThesisDraft } from "./state.js";
import type { SwarmGraphDefinition } from "./graph-factory.js";

export const omenSwarmNodeKeySchema = z.enum([
  "market-bias-agent",
  "scanner-agent",
  "research-agent",
  "chart-vision-agent",
  "analyst-agent",
  "critic-agent",
  "memory-agent",
  "publisher-agent",
]);

export type OmenSwarmNodeKey = z.infer<typeof omenSwarmNodeKeySchema>;

const terminalNodeKeys = ["publisher-agent"] as const satisfies readonly OmenSwarmNodeKey[];

const nodeKeyOrder = [
  "market-bias-agent",
  "scanner-agent",
  "research-agent",
  "chart-vision-agent",
  "analyst-agent",
  "critic-agent",
  "memory-agent",
  "publisher-agent",
] as const satisfies readonly OmenSwarmNodeKey[];

const normalizeCandidate = (candidate: {
  id: string;
  symbol: string;
  reason: string;
  directionHint: "LONG" | "SHORT" | "WATCHLIST" | null;
  status: "pending" | "researched" | "rejected" | "promoted";
  sourceUniverse: string;
  dedupeKey: string;
  missingDataNotes?: string[];
}) => ({
  ...candidate,
  missingDataNotes: candidate.missingDataNotes ?? [],
});

const normalizeEvidenceItem = (item: {
  category: "market" | "technical" | "liquidity" | "funding" | "fundamental" | "catalyst" | "sentiment" | "chart";
  summary: string;
  sourceLabel: string;
  sourceUrl: string | null;
  structuredData?: Record<string, unknown>;
}) => ({
  ...item,
  structuredData: item.structuredData ?? {},
});

const normalizeThesis = (thesis: {
  candidateId: string;
  asset: string;
  direction: "LONG" | "SHORT" | "WATCHLIST" | "NONE";
  confidence: number;
  orderType?: "market" | "limit" | null;
  tradingStyle?: "day_trade" | "swing_trade" | null;
  expectedDuration?: string | null;
  currentPrice?: number | null;
  entryPrice?: number | null;
  targetPrice?: number | null;
  stopLoss?: number | null;
  riskReward: number | null;
  whyNow: string;
  confluences?: string[];
  uncertaintyNotes: string;
  missingDataNotes: string;
}) => ({
  ...thesis,
  orderType: thesis.orderType ?? null,
  tradingStyle: thesis.tradingStyle ?? null,
  expectedDuration: thesis.expectedDuration ?? null,
  currentPrice: thesis.currentPrice ?? null,
  entryPrice: thesis.entryPrice ?? null,
  targetPrice: thesis.targetPrice ?? null,
  stopLoss: thesis.stopLoss ?? null,
  confluences: thesis.confluences ?? [],
});

const normalizeReview = (review: {
  candidateId: string;
  decision: "approved" | "rejected" | "watchlist_only";
  objections?: string[];
  forcedOutcomeReason: string | null;
}) => ({
  ...review,
  objections: review.objections ?? [],
});

const normalizeDraft = (draft: {
  kind: "signal_alert" | "intel_summary" | "intel_thread" | "no_conviction";
  headline: string;
  summary: string;
  text: string;
  metadata?: Record<string, unknown>;
}) => ({
  ...draft,
  metadata: draft.metadata ?? {},
});

type NormalizedPublisherOutput = {
  outcome: PublisherOutput["outcome"];
  drafts: Array<ReturnType<typeof normalizeDraft>>;
  packet:
    | {
        drafts: Array<ReturnType<typeof normalizeDraft>>;
        approvedReview: ReturnType<typeof normalizeReview> | null;
      }
    | null;
};

const normalizePublisherOutput = (output: {
  outcome: PublisherOutput["outcome"];
  drafts?: Array<{
    kind: "signal_alert" | "intel_summary" | "intel_thread" | "no_conviction";
    headline: string;
    summary: string;
    text: string;
    metadata?: Record<string, unknown>;
  }>;
  packet:
    | {
        drafts: Array<{
          kind: "signal_alert" | "intel_summary" | "intel_thread" | "no_conviction";
          headline: string;
          summary: string;
          text: string;
          metadata?: Record<string, unknown>;
        }>;
        approvedReview:
          | {
              candidateId: string;
              decision: "approved" | "rejected" | "watchlist_only";
              objections?: string[];
              forcedOutcomeReason: string | null;
            }
          | null;
      }
    | null;
}): NormalizedPublisherOutput => {
  const drafts = (output.drafts ?? []).map(normalizeDraft);

  return {
    ...output,
    drafts,
    packet:
      output.packet === null
        ? null
        : {
            drafts: output.packet.drafts.map(normalizeDraft),
            approvedReview:
              output.packet.approvedReview === null
                ? null
                : normalizeReview(output.packet.approvedReview),
          },
  };
};

const inferIntelSummary = (input: {
  thesis: ThesisDraft | null;
  review: CriticReview | null;
}): {
  title: string;
  summary: string;
  confidence: number;
} | null => {
  if (input.thesis === null) {
    return null;
  }

  if (
    input.review?.decision !== "watchlist_only" &&
    input.thesis.direction !== "WATCHLIST" &&
    input.thesis.direction !== "NONE"
  ) {
    return null;
  }

  return {
    title: `${input.thesis.asset} market intel`,
    summary: `${input.thesis.whyNow} ${input.thesis.uncertaintyNotes}`.trim(),
    confidence: Math.min(100, Math.max(0, input.thesis.confidence)),
  };
};

const buildRunOutcome = (input: {
  runId: string;
  publisher: NormalizedPublisherOutput;
  thesis: ThesisDraft | null;
}): NonNullable<SwarmState["run"]["outcome"]> => {
  if (input.publisher.outcome === "approved" && input.thesis !== null) {
    return {
      outcomeType: "signal",
      summary: `${input.thesis.asset} ${input.thesis.direction} signal approved for publication.`,
      signalId: `signal-${input.runId}`,
      intelId: null,
    };
  }

  if (input.publisher.outcome === "intel_ready" && input.thesis !== null) {
    return {
      outcomeType: "intel",
      summary: `${input.thesis.asset} produced a publishable intel summary.`,
      signalId: null,
      intelId: `intel-${input.runId}`,
    };
  }

  return {
    outcomeType: "no_conviction",
    summary: "The swarm completed without a publishable signal.",
    signalId: null,
    intelId: null,
  };
};

const buildPublisherNotes = (output: NormalizedPublisherOutput) => [
  `publisher-outcome:${output.outcome}`,
  ...output.drafts.map((draft) => `publisher-draft:${draft.kind}`),
];

export const createDefaultOmenSwarmNodes = (): readonly RuntimeNodeDefinition<unknown, unknown>[] => [
  createMarketBiasAgent(),
  createScannerAgent(),
  createResearchAgent(),
  createChartVisionAgent(),
  createAnalystAgent(),
  createCriticAgent(),
  createMemoryAgent(),
  createPublisherAgent(),
];

export const createOmenSwarmGraph = (): SwarmGraphDefinition => ({
  name: "omen-swarm-runtime",
  nodes: createDefaultOmenSwarmNodes(),
  entryNodeKey: "market-bias-agent",
  terminalNodeKeys,
});

export const resolveNextOmenNodeKey = (
  current: OmenSwarmNodeKey | null,
  state: SwarmState,
): OmenSwarmNodeKey | null => {
  if (current === null) {
    return "market-bias-agent";
  }

  if (current === "market-bias-agent") {
    return "scanner-agent";
  }

  if (current === "scanner-agent") {
    return state.activeCandidates.length > 0 ? "research-agent" : "memory-agent";
  }

  if (current === "research-agent") {
    return "chart-vision-agent";
  }

  if (current === "chart-vision-agent") {
    return "analyst-agent";
  }

  if (current === "analyst-agent") {
    return "critic-agent";
  }

  if (current === "critic-agent") {
    return "memory-agent";
  }

  if (current === "memory-agent") {
    return "publisher-agent";
  }

  return null;
};

export const buildOmenNodeInput = (input: {
  nodeKey: OmenSwarmNodeKey;
  state: SwarmState;
  threadId: string;
}) => {
  const context = {
    runId: input.state.run.id,
    threadId: input.threadId,
    mode: input.state.run.mode,
    triggeredBy: input.state.run.triggeredBy,
  } as const;

  if (input.nodeKey === "market-bias-agent") {
    return {
      context,
      snapshots: [],
      narratives: [],
    };
  }

  if (input.nodeKey === "scanner-agent") {
    return {
      context,
      bias: {
        marketBias: input.state.run.marketBias,
        reasoning:
          input.state.marketBiasReasoning ??
          "Bias reasoning not yet available, so scanner should stay conservative.",
        confidence: input.state.marketBiasReasoning ? 60 : 40,
      },
      universe: input.state.config.marketUniverse,
    };
  }

  if (input.nodeKey === "research-agent") {
    const candidate = input.state.activeCandidates[0];

    if (!candidate) {
      throw new Error("Research node requires at least one active candidate.");
    }

    return {
      context,
      candidate,
    };
  }

  if (input.nodeKey === "analyst-agent") {
    const candidate = input.state.activeCandidates[0];

    if (!candidate) {
      throw new Error("Analyst node requires a researched candidate.");
    }

    const researchSummary =
      input.state.notes.findLast((note) => note.startsWith("research-summary:")) ??
      "research-summary:Research remained market-led with limited external context.";

    return {
      context,
      research: {
        candidate,
        evidence: input.state.evidenceItems,
        narrativeSummary: researchSummary.replace("research-summary:", "").trim(),
        chartVisionSummary:
          input.state.chartVisionSummaries.at(-1) ??
          null,
        chartVisionTimeframes: input.state.evidenceItems
          .filter((item) => item.category === "chart")
          .map((item) => String(item.structuredData.timeframe ?? ""))
          .filter((value) => value.length > 0),
        missingDataNotes: candidate?.missingDataNotes ?? [],
      },
    };
  }

  if (input.nodeKey === "chart-vision-agent") {
    const candidate = input.state.activeCandidates[0];

    if (!candidate) {
      throw new Error("Chart vision node requires a researched candidate.");
    }

    return {
      context,
      candidate,
    };
  }

  if (input.nodeKey === "critic-agent") {
    const thesis = input.state.thesisDrafts.at(-1);

    if (!thesis) {
      throw new Error("Critic node requires a thesis draft.");
    }

    return {
      context,
      evaluation: {
        thesis,
        evidence: input.state.evidenceItems,
      },
    };
  }

  if (input.nodeKey === "memory-agent") {
    const review = input.state.criticReviews.at(-1) ?? null;

    return {
      context,
      checkpointLabel: review?.decision ?? "no-conviction",
      notes: input.state.notes.slice(-5),
      proofArtifacts: input.state.proofArtifacts,
    };
  }

  const thesis = input.state.thesisDrafts.at(-1) ?? null;
  const review = input.state.criticReviews.at(-1) ?? null;

  return {
    context,
    thesis,
    review,
    intelSummary: inferIntelSummary({ thesis, review }),
  };
};

export const applyOmenNodeOutput = (input: {
  state: SwarmState;
  nodeKey: OmenSwarmNodeKey;
  output: unknown;
  timestamp: string;
}): {
  state: SwarmState;
  stateDelta: Partial<SwarmState>;
} => {
  if (input.nodeKey === "market-bias-agent") {
    const output = createMarketBiasAgent().outputSchema.parse(input.output);
    const nextRun = {
      ...input.state.run,
      status: "running" as const,
      startedAt: input.state.run.startedAt ?? input.timestamp,
      marketBias: output.marketBias,
      updatedAt: input.timestamp,
    };
    const stateDelta = {
      run: nextRun,
      marketBiasReasoning: output.reasoning,
      notes: [...input.state.notes, `market-bias:${output.reasoning}`],
    };

    return {
      state: mergeSwarmState(input.state, stateDelta),
      stateDelta,
    };
  }

  if (input.nodeKey === "scanner-agent") {
    const output = createScannerAgent().outputSchema.parse(input.output);
    const candidates = (output.candidates ?? []).map(normalizeCandidate);
    const nextRun = {
      ...input.state.run,
      activeCandidateCount: candidates.length,
      updatedAt: input.timestamp,
    };
    const stateDelta = {
      run: nextRun,
      activeCandidates: candidates,
      notes: [
        ...input.state.notes,
        `scanner-selected:${candidates.map((candidate) => candidate.symbol).join(",") || "none"}`,
      ],
    };

    return {
      state: mergeSwarmState(input.state, stateDelta),
      stateDelta,
    };
  }

  if (input.nodeKey === "research-agent") {
    const output = createResearchAgent().outputSchema.parse(input.output);
    const missingDataNotes = output.missingDataNotes ?? [];
    const nextCandidates = input.state.activeCandidates.map((candidate) =>
      candidate.id === output.candidate.id
        ? normalizeCandidate({
            ...output.candidate,
            missingDataNotes,
          })
        : candidate,
    );
    const stateDelta = {
      activeCandidates: nextCandidates,
      evidenceItems: output.evidence.map(normalizeEvidenceItem),
      notes: [
        ...input.state.notes,
        `research-summary:${output.narrativeSummary}`,
        ...missingDataNotes.map((note) => `research-missing:${note}`),
      ],
    };

    return {
      state: mergeSwarmState(input.state, stateDelta),
      stateDelta,
    };
  }

  if (input.nodeKey === "analyst-agent") {
    const output = createAnalystAgent().outputSchema.parse(input.output);
    const thesis = normalizeThesis(output.thesis);
    const stateDelta = {
      thesisDrafts: [...input.state.thesisDrafts, thesis],
      notes: [...input.state.notes, ...(output.analystNotes ?? [])],
    };

    return {
      state: mergeSwarmState(input.state, stateDelta),
      stateDelta,
    };
  }

  if (input.nodeKey === "chart-vision-agent") {
    const output = createChartVisionAgent().outputSchema.parse(
      input.output,
    ) as ChartVisionOutput;
    const chartEvidence = output.evidence.map(normalizeEvidenceItem);
    const mergedEvidence = [...input.state.evidenceItems, ...chartEvidence];
    const nextCandidates = input.state.activeCandidates.map((candidate) =>
      candidate.id === output.candidate.id
        ? normalizeCandidate({
            ...output.candidate,
            missingDataNotes: output.missingDataNotes,
          })
        : candidate,
    );
    const stateDelta = {
      activeCandidates: nextCandidates,
      evidenceItems: mergedEvidence,
      chartVisionSummaries: [
        ...input.state.chartVisionSummaries,
        output.chartSummary,
      ],
      notes: [
        ...input.state.notes,
        `chart-vision-summary:${output.chartSummary}`,
        ...output.frames.map(
          (frame) => `chart-vision-${frame.timeframe}:${frame.analysis}`,
        ),
      ],
    };

    return {
      state: mergeSwarmState(input.state, stateDelta),
      stateDelta,
    };
  }

  if (input.nodeKey === "critic-agent") {
    const output = createCriticAgent().outputSchema.parse(input.output);
    const review = normalizeReview(output.review);
    const stateDelta = {
      criticReviews: [...input.state.criticReviews, review],
      errors: [...input.state.errors, ...(output.blockingReasons ?? [])],
      notes: [...input.state.notes, `critic-decision:${review.decision}`],
    };

    return {
      state: mergeSwarmState(input.state, stateDelta),
      stateDelta,
    };
  }

  if (input.nodeKey === "memory-agent") {
    const output = createMemoryAgent().outputSchema.parse(input.output);
    const appendedProofRefs = output.appendedProofRefs ?? [];
    const nextRun = {
      ...input.state.run,
      currentCheckpointRefId: output.checkpointRefId,
      updatedAt: input.timestamp,
    };
    const stateDelta = {
      run: nextRun,
      latestCheckpointRefId: output.checkpointRefId,
      notes: [
        ...input.state.notes,
        `checkpoint:${output.checkpointRefId ?? "none"}`,
        ...appendedProofRefs.map((ref) => `proof-ref:${ref}`),
      ],
    };

    return {
      state: mergeSwarmState(input.state, stateDelta),
      stateDelta,
    };
  }

  const output = normalizePublisherOutput(
    createPublisherAgent().outputSchema.parse(input.output),
  );
  const drafts = output.drafts;
  const thesis = input.state.thesisDrafts.at(-1) ?? null;
  const outcome = buildRunOutcome({
    runId: input.state.run.id,
    publisher: output,
    thesis,
  });
  const nextRun = {
    ...input.state.run,
    status: "completed" as const,
    completedAt: input.timestamp,
    finalSignalId: outcome.signalId,
    finalIntelId: outcome.intelId,
    outcome,
    updatedAt: input.timestamp,
  };
  const stateDelta = {
    run: nextRun,
    publisherDrafts: drafts,
    notes: [
      ...input.state.notes,
      ...buildPublisherNotes(output),
    ],
  };

  return {
    state: mergeSwarmState(input.state, stateDelta),
    stateDelta,
  };
};

export const isOmenTerminalNodeKey = (nodeKey: string): nodeKey is OmenSwarmNodeKey =>
  nodeKeyOrder.includes(nodeKey as OmenSwarmNodeKey);
