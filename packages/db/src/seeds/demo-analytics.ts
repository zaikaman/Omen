import {
  analyticsSnapshotSchema,
  dashboardSummarySchema,
} from "@omen/shared";

import { demoSchedulerStatus } from "./demo-config.js";
import { demoIntelRunBundle, demoSignalRunBundle } from "./demo-runs.js";

export const demoAnalyticsSnapshots = [
  analyticsSnapshotSchema.parse({
    id: "analytics-snapshot-001",
    runId: demoSignalRunBundle.run.id,
    generatedAt: "2026-04-25T08:06:15.000Z",
    totals: {
      totalRuns: 1,
      completedRuns: 1,
      publishedSignals: 1,
      publishedIntel: 0,
    },
    confidenceBands: [
      { label: "85-89", value: 0 },
      { label: "90-94", value: 1 },
    ],
    tokenFrequency: [
      { label: "BTC", value: 1 },
      { label: "ETH", value: 1 },
    ],
    mindshare: [
      { label: "BTC", value: 64 },
      { label: "ETH", value: 22 },
      { label: "SOL", value: 14 },
    ],
    winRate: null,
  }),
  analyticsSnapshotSchema.parse({
    id: "analytics-snapshot-002",
    runId: demoIntelRunBundle.run.id,
    generatedAt: "2026-04-25T09:04:25.000Z",
    totals: {
      totalRuns: 2,
      completedRuns: 2,
      publishedSignals: 1,
      publishedIntel: 1,
    },
    confidenceBands: [
      { label: "85-89", value: 1 },
      { label: "90-94", value: 1 },
    ],
    tokenFrequency: [
      { label: "BTC", value: 1 },
      { label: "TAO", value: 1 },
      { label: "RNDR", value: 1 },
      { label: "AKT", value: 1 },
    ],
    mindshare: [
      { label: "AI Infrastructure", value: 48 },
      { label: "BTC", value: 31 },
      { label: "L1 majors", value: 21 },
    ],
    winRate: 100,
  }),
];

export const demoDashboardSummary = dashboardSummarySchema.parse({
  activeRun: null,
  latestRun: demoIntelRunBundle.run,
  latestSignalId: demoSignalRunBundle.signal?.id ?? null,
  latestIntelId: demoIntelRunBundle.intel?.id ?? null,
  scheduler: demoSchedulerStatus,
  latestPost: demoIntelRunBundle.outboundPosts[0] ?? null,
  analytics: demoAnalyticsSnapshots[1] ?? null,
});
