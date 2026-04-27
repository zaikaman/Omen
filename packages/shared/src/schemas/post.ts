import { z } from "zod";

import { POST_STATUS_VALUES } from "../constants/index.js";

export const postStatusSchema = z.enum(POST_STATUS_VALUES);

export const postLifecycleEventSchema = z.enum([
  "format",
  "mark_ready",
  "start_posting",
  "mark_posted",
  "fail",
  "retry",
]);

export const postTargetSchema = z.enum(["x"]);

export const postKindSchema = z.enum(["signal_alert", "intel_summary", "intel_thread"]);

export const outboundPostPayloadSchema = z.object({
  text: z.string().min(1),
  thread: z.array(z.string().min(1)).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const outboundPostSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1),
  signalId: z.string().min(1).nullable(),
  intelId: z.string().min(1).nullable(),
  target: postTargetSchema,
  kind: postKindSchema,
  status: postStatusSchema,
  payload: outboundPostPayloadSchema,
  provider: z.string().min(1),
  providerPostId: z.string().min(1).nullable(),
  publishedUrl: z.string().url().nullable(),
  lastError: z.string().min(1).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  publishedAt: z.string().datetime().nullable(),
});

export type PostStatus = z.infer<typeof postStatusSchema>;
export type PostLifecycleEvent = z.infer<typeof postLifecycleEventSchema>;
export type PostTarget = z.infer<typeof postTargetSchema>;
export type PostKind = z.infer<typeof postKindSchema>;
export type OutboundPostPayload = z.infer<typeof outboundPostPayloadSchema>;
export type OutboundPost = z.infer<typeof outboundPostSchema>;
