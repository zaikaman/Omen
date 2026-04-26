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
      const node = this.graph.nodes.find((entry) => entry.key === currentNodeKey);

      if (!node) {
        throw new Error(`Missing graph node ${currentNodeKey} in runtime ${this.runtimeName}.`);
      }

      const output = await node.invoke(
        buildOmenNodeInput({
          nodeKey: currentNodeKey,
          state,
          threadId: input.threadId,
        }) as never,
        state,
      );
      const timestamp = new Date().toISOString();
      const applied = applyOmenNodeOutput({
        state,
        nodeKey: currentNodeKey,
        output,
        timestamp,
      });

      state = applied.state;
      sequence += 1;
      this.states.set(input.threadId, state);
      await this.checkpointStore.save({
        checkpointId: createCheckpointId({
          threadId: input.threadId,
          step: currentNodeKey,
          sequence,
        }),
        threadId: input.threadId,
        runId: state.run.id,
        createdAt: timestamp,
        step: currentNodeKey,
        state,
        stateDelta: applied.stateDelta,
        durableRef: null,
      });
      currentNodeKey = resolveNextOmenNodeKey(currentNodeKey, state);
    }

    return state;
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
