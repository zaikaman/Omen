import { z } from "zod";

import { analyticsSnapshotSchema } from "../analytics.js";

export const analyticsFeedResponseSchema = z.object({
  items: z.array(analyticsSnapshotSchema),
  nextCursor: z.string().min(1).nullable(),
});

export const analyticsLatestResponseSchema = z.object({
  item: analyticsSnapshotSchema.nullable(),
});

export type AnalyticsFeedResponse = z.infer<typeof analyticsFeedResponseSchema>;
export type AnalyticsLatestResponse = z.infer<typeof analyticsLatestResponseSchema>;
