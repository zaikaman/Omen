import { z } from "zod";

import { orchestrationContextSchema, candidateStateSchema, researchBundleSchema } from "./common.js";

export const researchInputSchema = z.object({
  context: orchestrationContextSchema,
  candidate: candidateStateSchema,
});

export const researchOutputSchema = researchBundleSchema;

export type ResearchInput = z.infer<typeof researchInputSchema>;
export type ResearchOutput = z.infer<typeof researchOutputSchema>;
