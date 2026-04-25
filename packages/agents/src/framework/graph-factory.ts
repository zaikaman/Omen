import { z } from "zod";

import type { AgentRuntime, RuntimeNodeDefinition } from "./agent-runtime.js";
import type { SwarmCheckpointStore } from "./checkpointing.js";
import type { SwarmState } from "./state.js";

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
