import { z } from "zod";

import { outboundPostSchema } from "../post.js";

export const postFeedResponseSchema = z.object({
  items: z.array(outboundPostSchema),
});

export const postStatusResponseSchema = z.object({
  item: outboundPostSchema,
});

export type PostFeedResponse = z.infer<typeof postFeedResponseSchema>;
export type PostStatusResponse = z.infer<typeof postStatusResponseSchema>;
