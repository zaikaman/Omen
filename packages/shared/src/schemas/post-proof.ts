import { z } from "zod";

import { outboundPostPayloadSchema } from "./post.js";

export const postProofProviderResponseSchema = z.object({
  provider: z.string().min(1),
  providerPostId: z.string().min(1).nullable(),
  publishedUrl: z.string().url().nullable(),
  raw: z.record(z.string(), z.unknown()).default({}),
});

export const postProofSchema = z.object({
  postId: z.string().min(1),
  runId: z.string().min(1),
  signalId: z.string().min(1).nullable(),
  intelId: z.string().min(1).nullable(),
  payload: outboundPostPayloadSchema,
  providerResponse: postProofProviderResponseSchema.nullable(),
  createdAt: z.string().datetime(),
});

export type PostProofProviderResponse = z.infer<
  typeof postProofProviderResponseSchema
>;
export type PostProof = z.infer<typeof postProofSchema>;
