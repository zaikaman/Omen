import { z } from "zod";

import { orchestrationContextSchema, researchBundleSchema, thesisDraftSchema } from "./common.js";

export const analystInputSchema = z.object({
  context: orchestrationContextSchema,
  research: researchBundleSchema,
});

export const analystOutputSchema = z.object({
  thesis: thesisDraftSchema,
  analystNotes: z.array(z.string().min(1)).default([]),
});

export type AnalystInput = z.infer<typeof analystInputSchema>;
export type AnalystOutput = z.infer<typeof analystOutputSchema>;
