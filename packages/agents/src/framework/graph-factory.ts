import { z } from "zod";

import type { AgentRuntime, RuntimeNodeDefinition } from "./agent-runtime.js";
import { swarmCheckpointSchema, type SwarmCheckpoint, type SwarmCheckpointStore } from "./checkpointing.js";
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

const logRuntimeStage = (input: {
  runId: string;
  threadId: string;
  nodeKey: OmenSwarmNodeKey;
  sequence: number;
  output: unknown;
  stateDelta: SwarmStateUpdate;
}) => {
  const payload = {
    runId: input.runId,
    threadId: input.threadId,
    node: input.nodeKey,
    sequence: input.sequence,
    output: serializeRuntimeLogValue(input.output),
    stateDelta: serializeRuntimeLogValue(input.stateDelta),
  };

  console.log(
    `[omen-runtime] ${input.nodeKey} response\n${JSON.stringify(payload, null, 2)}`,
  );
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

  private readonly states = new Map<string, SwarmState>();

  constructor(input: GraphFactoryInput & { graph: SwarmGraphDefinition }) {
    this.checkpointStore = input.checkpointStore;
    this.runtimeName = input.runtimeName;
    this.graph = input.graph;
  }

  async invoke(input: {
    threadId: string;
    initialState: z.infer<typeof swarmStateSchema>;
  }) {
    const initialState = swarmStateSchema.parse(input.initialState);
    this.states.set(input.threadId, initialState);

    return this.runFromNode({
      threadId: input.threadId,
      startingState: initialState,
      previousStep: null,
      sequenceOffset: 0,
    });
  }

  async resume(checkpoint: SwarmCheckpoint) {
    const parsed = swarmCheckpointSchema.parse(checkpoint);
    this.states.set(parsed.threadId, parsed.state);
    const checkpoints = await this.checkpointStore.listByRun(parsed.runId);

    return this.runFromNode({
      threadId: parsed.threadId,
      startingState: parsed.state,
      previousStep: parsed.step as OmenSwarmNodeKey,
      sequenceOffset: checkpoints.length,
    });
  }

  async getState(threadId: string) {
    return this.states.get(threadId) ?? null;
  }

  async applyUpdate(input: {
    threadId: string;
    update: SwarmStateUpdate;
  }) {
    const currentState = this.states.get(input.threadId);

    if (!currentState) {
      throw new Error(`No state found for thread ${input.threadId} in runtime ${this.runtimeName}.`);
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
          researchNode.invoke(researchInput as never, state),
          chartVisionNode.invoke(chartVisionInput as never, state),
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
    const output = await node.invoke(
      buildOmenNodeInput({
        nodeKey: input.nodeKey,
        state: input.state,
        threadId: input.threadId,
      }) as never,
      input.state,
    );

    return this.applyOutputAndCheckpoint({
      ...input,
      output,
    });
  }

  private async applyOutputAndCheckpoint(
    input: InvokeAndCheckpointInput & { output: unknown },
  ) {
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
