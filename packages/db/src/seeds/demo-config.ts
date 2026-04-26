import {
  TRADEABLE_SYMBOLS,
  dashboardSummarySchema,
  runtimeConfigSchema,
  schedulerStatusSchema,
} from "@omen/shared";

export const DEMO_BASE_TIME = "2026-04-25T08:00:00.000Z";
export const DEMO_SIGNAL_RUN_STARTED_AT = "2026-04-25T08:00:00.000Z";
export const DEMO_SIGNAL_RUN_COMPLETED_AT = "2026-04-25T08:06:00.000Z";
export const DEMO_INTEL_RUN_STARTED_AT = "2026-04-25T09:00:00.000Z";
export const DEMO_INTEL_RUN_COMPLETED_AT = "2026-04-25T09:04:00.000Z";
export const DEMO_NEXT_RUN_AT = "2026-04-25T10:00:00.000Z";

export const demoRuntimeConfig = runtimeConfigSchema.parse({
  id: "default",
  mode: "mocked",
  marketUniverse: TRADEABLE_SYMBOLS,
  qualityThresholds: {
    minConfidence: 85,
    minRiskReward: 2,
    minConfluences: 2,
  },
  providers: {
    axl: { enabled: true, required: true },
    zeroGStorage: { enabled: true, required: true },
    zeroGCompute: { enabled: true, required: false },
    binance: { enabled: true, required: false },
    coinGecko: { enabled: true, required: false },
    defiLlama: { enabled: true, required: false },
    news: { enabled: true, required: false },
    twitterapi: { enabled: true, required: false },
  },
  paperTradingEnabled: true,
  testnetExecutionEnabled: false,
  mainnetExecutionEnabled: false,
  postToXEnabled: true,
  scanIntervalMinutes: 60,
  updatedAt: DEMO_BASE_TIME,
});

export const demoSchedulerStatus = schedulerStatusSchema.parse({
  enabled: true,
  isRunning: false,
  nextRunAt: DEMO_NEXT_RUN_AT,
  lastRunAt: DEMO_INTEL_RUN_COMPLETED_AT,
  scanIntervalMinutes: 60,
  overlapPrevented: true,
});

export const createEmptyDashboardSummary = () =>
  dashboardSummarySchema.parse({
    activeRun: null,
    latestRun: null,
    latestSignalId: null,
    latestIntelId: null,
    scheduler: demoSchedulerStatus,
    latestPost: null,
    analytics: null,
  });
