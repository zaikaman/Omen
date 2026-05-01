import { z } from "zod";

import { proofArtifactSchema } from "@omen/shared";

import {
  orchestrationContextSchema,
  criticReviewSchema,
  thesisEvaluationSchema,
} from "./common.js";

export const criticInputSchema = z.object({
  context: orchestrationContextSchema,
  evaluation: thesisEvaluationSchema.extend({
    qualityThresholds: z
      .object({
        minConfidence: z.number().min(0).max(100),
        minRiskReward: z.number().min(0),
        minConfluences: z.number().int().min(0),
      })
      .optional(),
  }),
});

export const criticOutputSchema = z.object({
  review: criticReviewSchema,
  blockingReasons: z.array(z.string().min(1)).default([]),
  proofArtifacts: z.array(proofArtifactSchema).default([]),
});

export type CriticInput = z.infer<typeof criticInputSchema>;
export type CriticOutput = z.infer<typeof criticOutputSchema>;
