import { z } from "zod";

import { intelListItemSchema, intelSchema } from "../intel.js";

export const intelFeedResponseSchema = z.object({
  items: z.array(intelListItemSchema),
  nextCursor: z.string().min(1).nullable(),
});

export const intelDetailResponseSchema = z.object({
  item: intelSchema,
});

export type IntelFeedResponse = z.infer<typeof intelFeedResponseSchema>;
export type IntelDetailResponse = z.infer<typeof intelDetailResponseSchema>;
