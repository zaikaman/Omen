import { z } from "zod";

export const metricPointSchema = z.object({
  label: z.string().min(1),
  value: z.number(),
});

export const analyticsSnapshotSchema = z.object({
  id: z.string().min(1),
  runId: z.string().min(1).nullable(),
  generatedAt: z.string().datetime(),
  totals: z.object({
    totalRuns: z.number().int().min(0),
    completedRuns: z.number().int().min(0),
    publishedSignals: z.number().int().min(0),
    publishedIntel: z.number().int().min(0),
  }),
  confidenceBands: z.array(metricPointSchema).default([]),
  tokenFrequency: z.array(metricPointSchema).default([]),
  mindshare: z.array(metricPointSchema).default([]),
  winRate: z.number().min(0).max(100).nullable(),
});

export type MetricPoint = z.infer<typeof metricPointSchema>;
export type AnalyticsSnapshot = z.infer<typeof analyticsSnapshotSchema>;
