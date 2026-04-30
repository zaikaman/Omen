import { z } from "zod";

import type { AgentRuntime, RuntimeNodeDefinition } from "./agent-runtime.js";
import {
  swarmCheckpointSchema,
  type SwarmCheckpoint,
  type SwarmCheckpointStore,
} from "./checkpointing.js";
import {
  applyOmenNodeOutput,
  buildOmenNodeInput,
  createOmenSwarmGraph,
  type OmenSwarmNodeKey,
  resolveNextOmenNodeKey,
} from "./omen-swarm-graph.js";
import {
  createInitialSwarmState,
  mergeSwarmState,
  swarmStateSchema,
  type SwarmStateUpdate,
  type SwarmState,
} from "./state.js";

export const graphFactoryInputSchema = z.object({
  checkpointStore: z.custom<SwarmCheckpointStore>(),
  runtimeName: z.string().min(1),
  nodeInvoker: z.custom<OmenSwarmNodeInvoker>().optional(),
});

export interface SwarmGraphDefinition {
  readonly name: string;
  readonly nodes: readonly RuntimeNodeDefinition<unknown, unknown>[];
  readonly entryNodeKey: string;
  readonly terminalNodeKeys: readonly string[];
}

export interface GraphFactory {
  createRuntime(input: z.infer<typeof graphFactoryInputSchema>): AgentRuntime;
  createSwarmGraph(): SwarmGraphDefinition;
  createInitialState(input: unknown): SwarmState;
}

export type GraphFactoryInput = z.infer<typeof graphFactoryInputSchema>;

export type OmenSwarmNodeInvoker = (input: {
  nodeKey: OmenSwarmNodeKey;
  nodeInput: unknown;
  state: SwarmState;
  threadId: string;
}) => Promise<unknown | null>;

const createCheckpointId = (input: {
  threadId: string;
  step: OmenSwarmNodeKey;
  sequence: number;
}) => `${input.threadId}:${input.sequence.toString()}:${input.step}`;

const truncateRuntimeLogString = (value: string, maxLength = 400) =>
  value.length > maxLength ? `${value.slice(0, maxLength)}...<truncated>` : value;

const serializeRuntimeLogValue = (value: unknown): unknown => {
  if (typeof value === "string") {
    return truncateRuntimeLogString(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => serializeRuntimeLogValue(entry));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, serializeRuntimeLogValue(entry)]),
    );
  }

  return value;
};

const runtimeDetailLoggingEnabled = () =>
  process.env.OMEN_RUNTIME_LOG_DETAIL === "full" || process.env.LOG_LEVEL === "debug";

const toRecord = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const summarizeCandidate = (candidate: unknown) => {
  const parsed = toRecord(candidate);

  return {
    symbol: parsed.symbol,
    status: parsed.status,
    directionHint: parsed.directionHint,
  };
};

const summarizeDraft = (draft: unknown) => {
  const parsed = toRecord(draft);
  const text = typeof parsed.text === "string" ? parsed.text : "";

  return {
    kind: parsed.kind,
    headline: parsed.headline,
    textLength: text.length,
  };
};

const summarizeRuntimeOutput = (nodeKey: OmenSwarmNodeKey, output: unknown) => {
  const parsed = toRecord(output);

  switch (nodeKey) {
    case "market-bias-agent":
      return {
        marketBias: parsed.marketBias,
        confidence: parsed.confidence,
        reasoning: truncateRuntimeLogString(String(parsed.reasoning ?? ""), 160),
      };
    case "scanner-agent": {
      const candidates = Array.isArray(parsed.candidates) ? parsed.candidates : [];

      return {
        marketBias: parsed.marketBias,
        candidateCount: candidates.length,
        candidates: candidates.map(summarizeCandidate),
      };
    }
    case "research-agent": {
      const evidence = Array.isArray(parsed.evidence) ? parsed.evidence : [];
      const missingDataNotes = Array.isArray(parsed.missingDataNotes)
        ? parsed.missingDataNotes
        : [];

      return {
        candidate: summarizeCandidate(parsed.candidate),
        evidenceCount: evidence.length,
        evidenceCategories: evidence.map((item) => toRecord(item).category).filter(Boolean),
        narrativeSummary: truncateRuntimeLogString(String(parsed.narrativeSummary ?? ""), 180),
        missingDataCount: missingDataNotes.length,
      };
    }
    case "chart-vision-agent": {
      const frames = Array.isArray(parsed.frames) ? parsed.frames : [];

      return {
        candidate: summarizeCandidate(parsed.candidate),
        frameCount: frames.length,
        timeframes: frames.map((frame) => toRecord(frame).timeframe).filter(Boolean),
        chartSummary: truncateRuntimeLogString(String(parsed.chartSummary ?? ""), 220),
      };
    }
    case "analyst-agent": {
      const thesis = toRecord(parsed.thesis);
      const analystNotes = Array.isArray(parsed.analystNotes) ? parsed.analystNotes : [];

      return {
        asset: thesis.asset,
        direction: thesis.direction,
        confidence: thesis.confidence,
        orderType: thesis.orderType,
        tradingStyle: thesis.tradingStyle,
        riskReward: thesis.riskReward,
        confluenceCount: Array.isArray(thesis.confluences) ? thesis.confluences.length : 0,
        analystNoteCount: analystNotes.length,
      };
    }
    case "critic-agent": {
      const review = toRecord(parsed.review);
      const blockingReasons = Array.isArray(parsed.blockingReasons) ? parsed.blockingReasons : [];

      return {
        candidateId: review.candidateId,
        decision: review.decision,
        objectionCount: Array.isArray(review.objections) ? review.objections.length : 0,
        blockingReasonCount: blockingReasons.length,
      };
    }
    case "memory-agent": {
      const appendedProofRefs = Array.isArray(parsed.appendedProofRefs)
        ? parsed.appendedProofRefs
        : [];

      return {
        checkpointRefId: parsed.checkpointRefId,
        proofRefCount: appendedProofRefs.length,
      };
    }
    case "publisher-agent": {
      const drafts = Array.isArray(parsed.drafts) ? parsed.drafts : [];

      return {
        outcome: parsed.outcome,
        draftCount: drafts.length,
        drafts: drafts.map(summarizeDraft),
      };
    }
    case "intel-agent": {
      const report = toRecord(parsed.report);

      return {
        hasReport: parsed.report !== null && parsed.report !== undefined,
        title: report.title,
        category: report.category,
        confidence: report.confidence,
        skipReason: parsed.skipReason,
      };
    }
    case "generator-agent": {
      const content = toRecord(parsed.content);
      const tweetText = typeof content.tweetText === "string" ? content.tweetText : "";

      return {
        topic: content.topic,
        tweetLength: tweetText.length,
        hasBlogPost: typeof content.blogPost === "string" && content.blogPost.length > 0,
      };
    }
    case "writer-agent": {
      const article = toRecord(parsed.article);

      return {
        headline: article.headline,
        contentLength: typeof article.content === "string" ? article.content.length : 0,
      };
    }
    default:
      return serializeRuntimeLogValue(output);
  }
};

const summarizeRuntimeState = (stateDelta: SwarmStateUpdate) => {
  const run = stateDelta.run;

  return {
    status: run?.status,
    marketBias: run?.marketBias,
    outcomeType: run?.outcome?.outcomeType,
    activeCandidateCount: run?.activeCandidateCount,
    finalSignalId: run?.finalSignalId,
    finalIntelId: run?.finalIntelId,
    noteCount: stateDelta.notes?.length,
    evidenceCount: stateDelta.evidenceItems?.length,
    thesisCount: stateDelta.thesisDrafts?.length,
    criticReviewCount: stateDelta.criticReviews?.length,
    draftCount: stateDelta.publisherDrafts?.length,
  };
};

const logRuntimeStage = (input: {
  runId: string;
  threadId: string;
  nodeKey: OmenSwarmNodeKey;
  sequence: number;
  output: unknown;
  stateDelta: SwarmStateUpdate;
}) => {
  const payload = runtimeDetailLoggingEnabled()
    ? {
        runId: input.runId,
        threadId: input.threadId,
        node: input.nodeKey,
        sequence: input.sequence,
        output: serializeRuntimeLogValue(input.output),
        stateDelta: serializeRuntimeLogValue(input.stateDelta),
      }
    : {
        runId: input.runId,
        node: input.nodeKey,
        sequence: input.sequence,
        output: summarizeRuntimeOutput(input.nodeKey, input.output),
        state: summarizeRuntimeState(input.stateDelta),
      };

  console.log(`[omen-runtime] ${input.nodeKey} ${JSON.stringify(payload)}`);
};

type InvokeAndCheckpointInput = {
  threadId: string;
  state: SwarmState;
  nodeKey: OmenSwarmNodeKey;
  sequence: number;
};

class DefaultAgentRuntime implements AgentRuntime {
  readonly checkpointStore: SwarmCheckpointStore;

  private readonly runtimeName: string;

  private readonly graph: SwarmGraphDefinition;

  private readonly nodeInvoker: OmenSwarmNodeInvoker | null;

  private readonly states = new Map<string, SwarmState>();

  constructor(input: GraphFactoryInput & { graph: SwarmGraphDefinition }) {
    this.checkpointStore = input.checkpointStore;
    this.runtimeName = input.runtimeName;
    this.graph = input.graph;
    this.nodeInvoker = input.nodeInvoker ?? null;
  }

  async invoke(input: { threadId: string; initialState: z.infer<typeof swarmStateSchema> }) {
    const initialState = swarmStateSchema.parse(input.initialState);
    this.states.set(input.threadId, initialState);

    try {
      return await this.runFromNode({
        threadId: input.threadId,
        startingState: initialState,
        previousStep: null,
        sequenceOffset: 0,
      });
    } finally {
      this.states.delete(input.threadId);
    }
  }

  async resume(checkpoint: SwarmCheckpoint) {
    const parsed = swarmCheckpointSchema.parse(checkpoint);
    this.states.set(parsed.threadId, parsed.state);
    const checkpoints = await this.checkpointStore.listByRun(parsed.runId);

    try {
      return await this.runFromNode({
        threadId: parsed.threadId,
        startingState: parsed.state,
        previousStep: parsed.step as OmenSwarmNodeKey,
        sequenceOffset: checkpoints.length,
      });
    } finally {
      this.states.delete(parsed.threadId);
    }
  }

  async getState(threadId: string) {
    return this.states.get(threadId) ?? null;
  }

  async applyUpdate(input: { threadId: string; update: SwarmStateUpdate }) {
    const currentState = this.states.get(input.threadId);

    if (!currentState) {
      throw new Error(
        `No state found for thread ${input.threadId} in runtime ${this.runtimeName}.`,
      );
    }

    const nextState = mergeSwarmState(currentState, input.update);
    this.states.set(input.threadId, nextState);

    return nextState;
  }

  private async runFromNode(input: {
    threadId: string;
    startingState: SwarmState;
    previousStep: OmenSwarmNodeKey | null;
    sequenceOffset: number;
  }) {
    let state = input.startingState;
    let currentNodeKey = resolveNextOmenNodeKey(input.previousStep, state);
    let sequence = input.sequenceOffset;

    while (currentNodeKey !== null) {
      if (currentNodeKey === "research-agent") {
        const researchNode = this.findNode("research-agent");
        const chartVisionNode = this.findNode("chart-vision-agent");
        const researchInput = buildOmenNodeInput({
          nodeKey: "research-agent",
          state,
          threadId: input.threadId,
        });
        const chartVisionInput = buildOmenNodeInput({
          nodeKey: "chart-vision-agent",
          state,
          threadId: input.threadId,
        });
        const [researchOutput, chartVisionOutput] = await Promise.all([
          this.invokeNodeWithOverride({
            node: researchNode,
            nodeKey: "research-agent",
            nodeInput: researchInput,
            state,
            threadId: input.threadId,
          }),
          this.invokeNodeWithOverride({
            node: chartVisionNode,
            nodeKey: "chart-vision-agent",
            nodeInput: chartVisionInput,
            state,
            threadId: input.threadId,
          }),
        ]);

        const researchCheckpoint = await this.applyOutputAndCheckpoint({
          threadId: input.threadId,
          state,
          nodeKey: "research-agent",
          sequence,
          output: researchOutput,
        });
        const chartVisionCheckpoint = await this.applyOutputAndCheckpoint({
          threadId: input.threadId,
          state: researchCheckpoint.state,
          nodeKey: "chart-vision-agent",
          sequence: researchCheckpoint.sequence,
          output: chartVisionOutput,
        });

        state = chartVisionCheckpoint.state;
        sequence = chartVisionCheckpoint.sequence;
        currentNodeKey = resolveNextOmenNodeKey("chart-vision-agent", state);
        continue;
      }

      const checkpoint = await this.invokeNodeAndCheckpoint({
        threadId: input.threadId,
        state,
        nodeKey: currentNodeKey,
        sequence,
      });

      state = checkpoint.state;
      sequence = checkpoint.sequence;
      currentNodeKey = resolveNextOmenNodeKey(currentNodeKey, state);
    }

    return state;
  }

  private findNode(nodeKey: OmenSwarmNodeKey) {
    const node = this.graph.nodes.find((entry) => entry.key === nodeKey);

    if (!node) {
      throw new Error(`Missing graph node ${nodeKey} in runtime ${this.runtimeName}.`);
    }

    return node;
  }

  private async invokeNodeAndCheckpoint(input: InvokeAndCheckpointInput) {
    const node = this.findNode(input.nodeKey);
    const nodeInput = buildOmenNodeInput({
      nodeKey: input.nodeKey,
      state: input.state,
      threadId: input.threadId,
    });
    const output = await this.invokeNodeWithOverride({
      node,
      nodeKey: input.nodeKey,
      nodeInput,
      state: input.state,
      threadId: input.threadId,
    });

    return this.applyOutputAndCheckpoint({
      ...input,
      output,
    });
  }

  private async invokeNodeWithOverride(input: {
    node: RuntimeNodeDefinition<unknown, unknown>;
    nodeKey: OmenSwarmNodeKey;
    nodeInput: unknown;
    state: SwarmState;
    threadId: string;
  }) {
    if (this.nodeInvoker) {
      const delegated = await this.nodeInvoker({
        nodeKey: input.nodeKey,
        nodeInput: input.nodeInput,
        state: input.state,
        threadId: input.threadId,
      });

      if (delegated !== null) {
        return delegated;
      }
    }

    return input.node.invoke(input.nodeInput as never, input.state);
  }

  private async applyOutputAndCheckpoint(input: InvokeAndCheckpointInput & { output: unknown }) {
    const timestamp = new Date().toISOString();
    const applied = applyOmenNodeOutput({
      state: input.state,
      nodeKey: input.nodeKey,
      output: input.output,
      timestamp,
    });
    const state = applied.state;
    const sequence = input.sequence + 1;

    logRuntimeStage({
      runId: state.run.id,
      threadId: input.threadId,
      nodeKey: input.nodeKey,
      sequence,
      output: input.output,
      stateDelta: applied.stateDelta,
    });
    this.states.set(input.threadId, state);
    await this.checkpointStore.save({
      checkpointId: createCheckpointId({
        threadId: input.threadId,
        step: input.nodeKey,
        sequence,
      }),
      threadId: input.threadId,
      runId: state.run.id,
      createdAt: timestamp,
      step: input.nodeKey,
      state,
      stateDelta: applied.stateDelta,
      durableRef: null,
    });

    return { state, sequence };
  }
}

export const createOmenGraphFactory = (): GraphFactory => ({
  createRuntime(input) {
    const parsed = graphFactoryInputSchema.parse(input);

    return new DefaultAgentRuntime({
      ...parsed,
      graph: createOmenSwarmGraph(),
    });
  },
  createSwarmGraph() {
    return createOmenSwarmGraph();
  },
  createInitialState(input) {
    const parsed = z
      .object({
        run: swarmStateSchema.shape.run,
        config: swarmStateSchema.shape.config,
      })
      .parse(input);

    return createInitialSwarmState(parsed);
  },
});
