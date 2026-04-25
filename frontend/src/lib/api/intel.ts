import {
  intelDetailResponseSchema,
  intelFeedResponseSchema,
  type IntelDetailResponse,
  type IntelFeedResponse,
} from '@omen/shared';

import { apiRequest } from './client';

export type GetIntelFeedOptions = {
  cursor?: string | null;
  limit?: number;
  query?: string;
};

export const getIntelFeed = async (
  options: GetIntelFeedOptions = {},
): Promise<IntelFeedResponse> => {
  const searchParams = new URLSearchParams();

  if (options.cursor) {
    searchParams.set('cursor', options.cursor);
  }

  if (typeof options.limit === 'number') {
    searchParams.set('limit', options.limit.toString());
  }

  if (options.query) {
    searchParams.set('query', options.query);
  }

  const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
  return apiRequest(`/intel${suffix}`, intelFeedResponseSchema);
};

export const getIntelDetail = (id: string): Promise<IntelDetailResponse> =>
  apiRequest(`/intel/${encodeURIComponent(id)}`, intelDetailResponseSchema);
