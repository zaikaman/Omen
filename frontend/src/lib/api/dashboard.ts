import {
  dashboardSummarySchema,
  schedulerStatusSchema,
  type DashboardSummary,
  type SchedulerStatus,
} from '@omen/shared';

import { apiRequest } from './client';

const dashboardSummaryResponseSchema = dashboardSummarySchema;
const schedulerStatusResponseSchema = schedulerStatusSchema;
const runtimeStatusResponseSchema = {
  parse: (input: unknown) => {
    const payload = input as {
      scheduler?: unknown;
      activeRunId?: unknown;
    };

    return {
      scheduler: schedulerStatusSchema.parse(payload.scheduler),
      activeRunId:
        typeof payload.activeRunId === 'string' ? payload.activeRunId : null,
    };
  },
};

export const getLiveDashboardSummary = () =>
  apiRequest('/dashboard/summary', dashboardSummaryResponseSchema);

export const getDashboardSummary = getLiveDashboardSummary;

export const getLiveSchedulerStatus = () =>
  apiRequest('/dashboard/scheduler', schedulerStatusResponseSchema);

export const getSchedulerStatus = getLiveSchedulerStatus;

export const getLiveRuntimeStatus = () =>
  apiRequest('/status/runtime', runtimeStatusResponseSchema);

export const getRuntimeStatus = getLiveRuntimeStatus;

export type DashboardSummaryResponse = DashboardSummary;
export type SchedulerStatusResponse = SchedulerStatus;
export type RuntimeStatusResponse = ReturnType<
  typeof runtimeStatusResponseSchema.parse
>;
