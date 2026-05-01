import { runListItemSchema, type RunListItem } from '@omen/shared';

import { apiRequest } from './client';

export type RunsFeedResponse = {
  runs: RunListItem[];
  nextCursor: string | null;
  total: number;
};

export type GetRunsOptions = {
  limit?: number;
};

const runsFeedResponseSchema = {
  parse: (input: unknown): RunsFeedResponse => {
    const payload = input as {
      runs?: unknown;
      nextCursor?: unknown;
      total?: unknown;
    };

    return {
      runs: Array.isArray(payload.runs)
        ? payload.runs.map((run) => runListItemSchema.parse(run))
        : [],
      nextCursor: typeof payload.nextCursor === 'string' ? payload.nextCursor : null,
      total: typeof payload.total === 'number' ? payload.total : 0,
    };
  },
};

export const getRuns = async (
  options: GetRunsOptions = {},
): Promise<RunsFeedResponse> => {
  const searchParams = new URLSearchParams();

  if (typeof options.limit === 'number') {
    searchParams.set('limit', options.limit.toString());
  }

  const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
  return apiRequest(`/runs${suffix}`, runsFeedResponseSchema);
};
