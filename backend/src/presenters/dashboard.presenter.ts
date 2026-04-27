import {
  dashboardSummarySchema,
  runListItemSchema,
  schedulerStatusSchema,
  type AnalyticsSnapshot,
  type DashboardSummary,
  type OutboundPost,
  type Run,
  type SchedulerStatus,
} from "@omen/shared";

export const presentRunListItem = (run: Run | null | undefined) => {
  if (!run) {
    return null;
  }

  return runListItemSchema.parse({
    id: run.id,
    mode: run.mode,
    status: run.status,
    marketBias: run.marketBias,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    triggeredBy: run.triggeredBy,
    finalSignalId: run.finalSignalId,
    finalIntelId: run.finalIntelId,
    failureReason: run.failureReason,
    outcome: run.outcome,
  });
};

export const presentSchedulerStatus = (scheduler: SchedulerStatus): SchedulerStatus =>
  schedulerStatusSchema.parse(scheduler);

export type DashboardSummaryPresenterInput = {
  activeRun?: Run | null;
  latestRun?: Run | null;
  latestSignalId?: string | null;
  latestIntelId?: string | null;
  scheduler: SchedulerStatus;
  latestPost?: OutboundPost | null;
  analytics?: AnalyticsSnapshot | null;
};

export const presentDashboardSummary = (
  input: DashboardSummaryPresenterInput,
): DashboardSummary =>
  dashboardSummarySchema.parse({
    activeRun: presentRunListItem(input.activeRun),
    latestRun: presentRunListItem(input.latestRun),
    latestSignalId: input.latestSignalId ?? null,
    latestIntelId: input.latestIntelId ?? null,
    scheduler: presentSchedulerStatus(input.scheduler),
    latestPost: input.latestPost ?? null,
    analytics: input.analytics ?? null,
  });
