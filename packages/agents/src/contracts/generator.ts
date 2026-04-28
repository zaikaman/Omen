import { z } from "zod";

import {
  evidenceItemSchema,
  generatedIntelContentSchema,
  intelReportSchema,
  orchestrationContextSchema,
} from "./common.js";

export const generatorInputSchema = z.object({
  context: orchestrationContextSchema,
  report: intelReportSchema,
  evidence: z.array(evidenceItemSchema).default([]),
});

export const generatorOutputSchema = z.object({
  content: generatedIntelContentSchema,
});

export type GeneratorInput = z.infer<typeof generatorInputSchema>;
export type GeneratorOutput = z.infer<typeof generatorOutputSchema>;
