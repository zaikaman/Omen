import { z } from "zod";

import {
  evidenceItemSchema,
  generatedIntelContentSchema,
  intelArticleSchema,
  intelReportSchema,
  orchestrationContextSchema,
} from "./common.js";

export const writerInputSchema = z.object({
  context: orchestrationContextSchema,
  report: intelReportSchema,
  evidence: z.array(evidenceItemSchema).default([]),
  generatedContent: generatedIntelContentSchema.nullable().default(null),
});

export const writerOutputSchema = z.object({
  article: intelArticleSchema,
  peerContext: z
    .object({
      sourcePeerId: z.string().min(1),
      service: z.string().min(1),
      method: z.string().min(1),
      summary: z.string().min(1),
    })
    .nullable()
    .default(null),
});

export type WriterInput = z.infer<typeof writerInputSchema>;
export type WriterOutput = z.infer<typeof writerOutputSchema>;
