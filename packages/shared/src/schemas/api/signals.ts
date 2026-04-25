import { z } from "zod";

import { signalListItemSchema, signalSchema } from "../signal.js";

export const signalFeedResponseSchema = z.object({
  items: z.array(signalListItemSchema),
  total: z.number().int().min(0),
  nextCursor: z.string().min(1).nullable(),
});

export const signalDetailResponseSchema = z.object({
  item: signalSchema,
});

export type SignalFeedResponse = z.infer<typeof signalFeedResponseSchema>;
export type SignalDetailResponse = z.infer<typeof signalDetailResponseSchema>;
