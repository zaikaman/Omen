import { z } from "zod";

import {
  MARKET_BIAS_VALUES,
  RUN_STATUS_VALUES,
  RUN_TRIGGER_VALUES,
  RUNTIME_MODE_VALUES,
} from "../constants/index.js";

export const runtimeModeSchema = z.enum(RUNTIME_MODE_VALUES);

export const runStatusSchema = z.enum(RUN_STATUS_VALUES);

export const runTriggerSchema = z.enum(RUN_TRIGGER_VALUES);

export const marketBiasSchema = z.enum(MARKET_BIAS_VALUES);

export const candidateSummarySchema = z.object({
  symbol: z.string().min(1),
  reason: z.string().min(1),
  confidenceHint: z.number().min(0).max(100).nullable(),
});

export const proofFinalizationStatusSchema = z.enum([
  "not_configured",
  "publishing",
  "anchoring",
  "complete",
  "partial",
  "failed",
]);

export const proofFinalizationSchema = z.object({
  status: proofFinalizationStatusSchema,
  artifactCount: z.number().int().min(0),
  manifestRefId: z.string().min(1).nullable(),
  chainRefId: z.string().min(1).nullable(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  error: z.string().min(1).nullable(),
});

export const runOutcomeSchema = z.object({
  outcomeType: z.enum(["signal", "intel", "no_conviction", "failed"]),
  summary: z.string().min(1),
  signalId: z.string().min(1).nullable(),
  intelId: z.string().min(1).nullable(),
  postId: z.string().min(1).nullable().optional(),
  postStatus: z.string().min(1).nullable().optional(),
  publishedUrl: z.string().url().nullable().optional(),
  proofFinalization: proofFinalizationSchema.optional(),
});

export const runBaseSchema = z.object({
  id: z.string().min(1),
  mode: runtimeModeSchema,
  status: runStatusSchema,
  marketBias: marketBiasSchema,
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  triggeredBy: runTriggerSchema,
  activeCandidateCount: z.number().int().min(0).max(3),
  currentCheckpointRefId: z.string().min(1).nullable(),
  finalSignalId: z.string().min(1).nullable(),
  finalIntelId: z.string().min(1).nullable(),
  failureReason: z.string().min(1).nullable(),
  outcome: runOutcomeSchema.nullable(),
  configSnapshot: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const runSchema = runBaseSchema.superRefine((run, ctx) => {
    if (
      (run.status === "completed" || run.status === "failed" || run.status === "cancelled") &&
      !run.completedAt
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "completedAt is required when a run reaches a terminal state",
        path: ["completedAt"],
      });
    }
});

export const runListItemSchema = runBaseSchema.pick({
  id: true,
  mode: true,
  status: true,
  marketBias: true,
  startedAt: true,
  completedAt: true,
  triggeredBy: true,
  finalSignalId: true,
  finalIntelId: true,
  failureReason: true,
  outcome: true,
});

export type RuntimeMode = z.infer<typeof runtimeModeSchema>;
export type RunStatus = z.infer<typeof runStatusSchema>;
export type RunTrigger = z.infer<typeof runTriggerSchema>;
export type MarketBias = z.infer<typeof marketBiasSchema>;
export type CandidateSummary = z.infer<typeof candidateSummarySchema>;
export type ProofFinalizationStatus = z.infer<typeof proofFinalizationStatusSchema>;
export type ProofFinalization = z.infer<typeof proofFinalizationSchema>;
export type RunOutcome = z.infer<typeof runOutcomeSchema>;
export type Run = z.infer<typeof runSchema>;
export type RunListItem = z.infer<typeof runListItemSchema>;
