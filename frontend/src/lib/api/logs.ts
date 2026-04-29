import { logFeedResponseSchema, type LogFeedResponse } from '@omen/shared';

import { apiRequest } from './client';

export type GetLogsOptions = {
  runId?: string | null;
  limit?: number;
};

export const getLiveLogs = async (
  options: GetLogsOptions = {},
): Promise<LogFeedResponse> => {
  const searchParams = new URLSearchParams();

  if (options.runId) {
    searchParams.set('runId', options.runId);
  }

  if (typeof options.limit === 'number') {
    searchParams.set('limit', options.limit.toString());
  }

  const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
  return apiRequest(`/logs${suffix}`, logFeedResponseSchema);
};

export const getLogs = (options: GetLogsOptions = {}): Promise<LogFeedResponse> =>
  getLiveLogs(options);
