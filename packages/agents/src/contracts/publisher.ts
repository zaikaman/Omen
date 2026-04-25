import { z } from "zod";

import { criticDecisionSchema } from "@omen/shared";

import {
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
  intelSummary: z
    .object({
      title: z.string().min(1),
      summary: z.string().min(1),
      confidence: z.number().int().min(0).max(100),
    })
    .nullable(),
});

export const publisherOutputSchema = z.object({
  outcome: criticDecisionSchema.or(z.enum(["intel_ready", "no_conviction"])),
  packet: publicationPacketSchema.nullable(),
  drafts: z.array(publisherDraftSchema).default([]),
});

export type PublisherInput = z.infer<typeof publisherInputSchema>;
export type PublisherOutput = z.infer<typeof publisherOutputSchema>;
