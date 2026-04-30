import { z } from "zod";

import { proofArtifactSchema } from "@omen/shared";

import {
  orchestrationContextSchema,
  criticReviewSchema,
  thesisEvaluationSchema,
} from "./common.js";

export const criticInputSchema = z.object({
  context: orchestrationContextSchema,
  evaluation: thesisEvaluationSchema,
});

export const criticOutputSchema = z.object({
  review: criticReviewSchema,
  blockingReasons: z.array(z.string().min(1)).default([]),
  proofArtifacts: z.array(proofArtifactSchema).default([]),
});

export type CriticInput = z.infer<typeof criticInputSchema>;
export type CriticOutput = z.infer<typeof criticOutputSchema>;
