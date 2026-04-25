import { z } from "zod";

import type { AgentRole } from "@omen/shared";

import type { SwarmCheckpointStore, swarmCheckpointSchema } from "./checkpointing.js";
import type { swarmStateSchema, swarmStateUpdateSchema } from "./state.js";

export const runtimeInvokeOptionsSchema = z.object({
  threadId: z.string().min(1),
  checkpointId: z.string().min(1).nullable(),
  stepTimeoutMs: z.number().int().min(1).nullable(),
});

export interface RuntimeNodeDefinition<TInput, TOutput> {
  readonly key: string;
  readonly role: AgentRole;
  readonly inputSchema: z.ZodType<TInput>;
  readonly outputSchema: z.ZodType<TOutput>;
  invoke(input: TInput, state: z.infer<typeof swarmStateSchema>): Promise<TOutput>;
}

export interface AgentRuntime {
  readonly checkpointStore: SwarmCheckpointStore;
  invoke(input: {
    threadId: string;
    initialState: z.infer<typeof swarmStateSchema>;
  }): Promise<z.infer<typeof swarmStateSchema>>;
  resume(checkpoint: z.infer<typeof swarmCheckpointSchema>): Promise<z.infer<typeof swarmStateSchema>>;
  getState(threadId: string): Promise<z.infer<typeof swarmStateSchema> | null>;
  applyUpdate(input: {
    threadId: string;
    update: z.infer<typeof swarmStateUpdateSchema>;
  }): Promise<z.infer<typeof swarmStateSchema>>;
}

export type RuntimeInvokeOptions = z.infer<typeof runtimeInvokeOptionsSchema>;
