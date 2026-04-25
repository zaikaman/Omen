import { z } from "zod";

import { proofArtifactSchema } from "@omen/shared";

import { orchestrationContextSchema } from "./common.js";

export const memoryInputSchema = z.object({
  context: orchestrationContextSchema,
  checkpointLabel: z.string().min(1),
  notes: z.array(z.string().min(1)).default([]),
  proofArtifacts: z.array(proofArtifactSchema).default([]),
});

export const memoryOutputSchema = z.object({
  checkpointRefId: z.string().min(1).nullable(),
  appendedProofRefs: z.array(z.string().min(1)).default([]),
});

export type MemoryInput = z.infer<typeof memoryInputSchema>;
export type MemoryOutput = z.infer<typeof memoryOutputSchema>;
