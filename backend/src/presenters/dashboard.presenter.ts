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

export type RunTraceTiming = {
  traceStartedAt: string | null;
  traceCompletedAt: string | null;
};

const getTime = (value: string | null | undefined) => {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? null : timestamp;
};

const minTimestamp = (values: (string | null | undefined)[]) => {
  const timestamps = values
    .map((value) => {
      const timestamp = getTime(value);
      return timestamp === null ? null : { timestamp, value: value! };
    })
    .filter((item): item is { timestamp: number; value: string } => item !== null);

  return timestamps.length > 0
    ? timestamps.reduce((earliest, item) => (item.timestamp < earliest.timestamp ? item : earliest))
        .value
    : null;
};

const maxTimestamp = (values: (string | null | undefined)[]) => {
  const timestamps = values
    .map((value) => {
      const timestamp = getTime(value);
      return timestamp === null ? null : { timestamp, value: value! };
    })
    .filter((item): item is { timestamp: number; value: string } => item !== null);

  return timestamps.length > 0
    ? timestamps.reduce((latest, item) => (item.timestamp > latest.timestamp ? item : latest)).value
    : null;
};

const deriveTraceTiming = (
  run: Run,
  traceTiming: RunTraceTiming | null | undefined,
): RunTraceTiming => {
  const proofFinalization = run.outcome?.proofFinalization;

  return {
    traceStartedAt: minTimestamp([
      traceTiming?.traceStartedAt,
      run.createdAt,
      run.startedAt,
      proofFinalization?.startedAt,
    ]),
    traceCompletedAt: maxTimestamp([
      traceTiming?.traceCompletedAt,
      run.updatedAt,
      run.completedAt,
      proofFinalization?.completedAt,
    ]),
  };
};

export const presentRunListItem = (
  run: Run | null | undefined,
  traceTiming?: RunTraceTiming | null,
) => {
  if (!run) {
    return null;
  }

  const derivedTraceTiming = deriveTraceTiming(run, traceTiming);

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
    traceStartedAt: derivedTraceTiming.traceStartedAt,
    traceCompletedAt: derivedTraceTiming.traceCompletedAt,
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
