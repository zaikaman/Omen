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

const criticOutputObjectSchema = z.object({
  review: criticReviewSchema,
  blockingReasons: z.array(z.string().min(1)).default([]),
  proofArtifacts: z.array(proofArtifactSchema).default([]),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const criticOutputSchema = z.preprocess((value) => {
  if (!isRecord(value) || "review" in value) {
    return value;
  }

  const result = value.result;

  if (isRecord(result) && "review" in result) {
    return {
      ...result,
      blockingReasons: result.blockingReasons ?? value.blockingReasons ?? [],
      proofArtifacts: result.proofArtifacts ?? value.proofArtifacts ?? [],
    };
  }

  const criticReview = value.criticReview ?? value.reviewDecision;

  if (isRecord(criticReview)) {
    return {
      ...value,
      review: criticReview,
      blockingReasons: value.blockingReasons ?? [],
      proofArtifacts: value.proofArtifacts ?? [],
    };
  }

  if ("candidateId" in value && "decision" in value) {
    return {
      review: value,
      blockingReasons: value.blockingReasons ?? [],
      proofArtifacts: value.proofArtifacts ?? [],
    };
  }

  return value;
}, criticOutputObjectSchema);

export type CriticInput = z.infer<typeof criticInputSchema>;
export type CriticOutput = z.infer<typeof criticOutputSchema>;
