import { z } from "zod";

import { analyticsSnapshotSchema } from "../analytics.js";
import { outboundPostSchema } from "../post.js";
import { runListItemSchema } from "../run.js";

export const schedulerStatusSchema = z.object({
  enabled: z.boolean(),
  isRunning: z.boolean(),
  nextRunAt: z.string().datetime().nullable(),
  lastRunAt: z.string().datetime().nullable(),
  scanIntervalMinutes: z.number().int().min(1),
  overlapPrevented: z.boolean(),
});

export const dashboardSummarySchema = z.object({
  activeRun: runListItemSchema.nullable(),
  latestRun: runListItemSchema.nullable(),
  latestSignalId: z.string().min(1).nullable(),
  latestIntelId: z.string().min(1).nullable(),
  scheduler: schedulerStatusSchema,
  latestPost: outboundPostSchema.nullable(),
  analytics: analyticsSnapshotSchema.nullable(),
});

export type SchedulerStatus = z.infer<typeof schedulerStatusSchema>;
export type DashboardSummary = z.infer<typeof dashboardSummarySchema>;
