import { z } from "zod";

import { proofArtifactSchema } from "@omen/shared";

import { intelReportSchema, orchestrationContextSchema } from "./common.js";

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

export const memoryRecallInputSchema = z.object({
  context: orchestrationContextSchema,
  query: z.string().min(1),
  report: intelReportSchema.nullable().default(null),
  recentNotes: z.array(z.string().min(1)).default([]),
});

export const memoryRecallOutputSchema = z.object({
  summary: z.string().min(1),
  relevantNotes: z.array(z.string().min(1)).default([]),
  proofRefIds: z.array(z.string().min(1)).default([]),
});

export type MemoryInput = z.infer<typeof memoryInputSchema>;
export type MemoryOutput = z.infer<typeof memoryOutputSchema>;
export type MemoryRecallInput = z.infer<typeof memoryRecallInputSchema>;
export type MemoryRecallOutput = z.infer<typeof memoryRecallOutputSchema>;
