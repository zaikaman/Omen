import { z } from "zod";

import {
  evidenceItemSchema,
  criticReviewSchema,
  orchestrationContextSchema,
  researchBundleSchema,
  thesisDraftSchema,
} from "./common.js";

export const analystInputSchema = z.object({
  context: orchestrationContextSchema,
  research: researchBundleSchema,
  repairContext: z
    .object({
      attemptNumber: z.number().int().min(1),
      previousThesis: thesisDraftSchema,
      review: criticReviewSchema,
    })
    .nullable()
    .default(null),
});

export const analystOutputSchema = z.object({
  thesis: thesisDraftSchema,
  evidence: z.array(evidenceItemSchema).optional().default([]),
  analystNotes: z.array(z.string().min(1)).default([]),
});

export type AnalystInput = z.infer<typeof analystInputSchema>;
export type AnalystOutput = z.infer<typeof analystOutputSchema>;
