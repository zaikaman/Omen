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

export const getDashboardSummary = () =>
  apiRequest('/dashboard/summary', dashboardSummaryResponseSchema);

export const getSchedulerStatus = () =>
  apiRequest('/dashboard/scheduler', schedulerStatusResponseSchema);

export const getRuntimeStatus = () =>
  apiRequest('/status/runtime', runtimeStatusResponseSchema);

export type DashboardSummaryResponse = DashboardSummary;
export type SchedulerStatusResponse = SchedulerStatus;
export type RuntimeStatusResponse = ReturnType<
  typeof runtimeStatusResponseSchema.parse
>;
