import { z } from "zod";

import {
  evidenceItemSchema,
  intelArticleSchema,
  intelReportSchema,
  orchestrationContextSchema,
} from "./common.js";

export const writerInputSchema = z.object({
  context: orchestrationContextSchema,
  report: intelReportSchema,
  evidence: z.array(evidenceItemSchema).default([]),
});

export const writerOutputSchema = z.object({
  article: intelArticleSchema,
});

export type WriterInput = z.infer<typeof writerInputSchema>;
export type WriterOutput = z.infer<typeof writerOutputSchema>;
