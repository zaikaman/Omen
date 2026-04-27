import { z } from "zod";

import {
  biasDecisionSchema,
  candidateStateSchema,
  criticReviewSchema,
  evidenceItemSchema,
  recentIntelHistoryItemSchema,
  orchestrationContextSchema,
  thesisDraftSchema,
} from "./common.js";
import { intelReportSchema } from "../framework/state.js";

export const intelInputSchema = z.object({
  context: orchestrationContextSchema,
  bias: biasDecisionSchema.nullable(),
  candidates: z.array(candidateStateSchema).default([]),
  evidence: z.array(evidenceItemSchema).default([]),
  chartVisionSummary: z.string().min(1).nullable(),
  thesis: thesisDraftSchema.nullable(),
  review: criticReviewSchema.nullable(),
  recentIntelHistory: z.array(recentIntelHistoryItemSchema).default([]),
});

export const intelOutputSchema = z.object({
  action: z.enum(["ready", "skip"]),
  report: intelReportSchema.nullable(),
  skipReason: z.string().min(1).nullable().default(null),
});

export type IntelInput = z.infer<typeof intelInputSchema>;
export type IntelOutput = z.infer<typeof intelOutputSchema>;
