import { z } from "zod";

import { criticDecisionSchema } from "@omen/shared";

import {
  intelReportSchema,
  generatedIntelContentSchema,
  orchestrationContextSchema,
  criticReviewSchema,
  publicationPacketSchema,
  publisherDraftSchema,
  thesisDraftSchema,
} from "./common.js";

export const publisherInputSchema = z.object({
  context: orchestrationContextSchema,
  thesis: thesisDraftSchema.nullable(),
  review: criticReviewSchema.nullable(),
  intelSummary: intelReportSchema.nullable(),
  generatedContent: generatedIntelContentSchema.nullable().default(null),
});

export const publisherOutputSchema = z.object({
  outcome: criticDecisionSchema.or(z.enum(["intel_ready", "no_conviction"])),
  packet: publicationPacketSchema.nullable(),
  drafts: z.array(publisherDraftSchema).default([]),
});

export type PublisherInput = z.infer<typeof publisherInputSchema>;
export type PublisherOutput = z.infer<typeof publisherOutputSchema>;
