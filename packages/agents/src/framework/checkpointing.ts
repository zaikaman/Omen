import { z } from "zod";

import { proofArtifactSchema } from "@omen/shared";

import { swarmStateSchema, swarmStateUpdateSchema } from "./state.js";

export const swarmCheckpointSchema = z.object({
  checkpointId: z.string().min(1),
  threadId: z.string().min(1),
  runId: z.string().min(1),
  createdAt: z.string().datetime(),
  step: z.string().min(1),
  state: swarmStateSchema,
  stateDelta: swarmStateUpdateSchema,
  durableRef: proofArtifactSchema.nullable(),
});

export interface SwarmCheckpointStore {
  save(checkpoint: z.infer<typeof swarmCheckpointSchema>): Promise<void>;
  loadLatest(input: {
    runId: string;
    threadId: string;
  }): Promise<z.infer<typeof swarmCheckpointSchema> | null>;
  listByRun(runId: string): Promise<z.infer<typeof swarmCheckpointSchema>[]>;
}

export type SwarmCheckpoint = z.infer<typeof swarmCheckpointSchema>;
