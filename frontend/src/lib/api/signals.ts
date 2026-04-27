import {
  signalDetailResponseSchema,
  signalFeedResponseSchema,
  type SignalDetailResponse,
  type SignalFeedResponse,
} from '@omen/shared';

import { apiRequest } from './client';
import {
  getSeededSignalDetail,
  getSeededSignals,
  withSeededFallback,
} from './seededFallback';

export type GetSignalsOptions = {
  cursor?: string | null;
  limit?: number;
  status?: string;
  direction?: string;
  query?: string;
};

export const getLiveSignals = async (
  options: GetSignalsOptions = {},
): Promise<SignalFeedResponse> => {
  const searchParams = new URLSearchParams();

  if (options.cursor) {
    searchParams.set('cursor', options.cursor);
  }

  if (typeof options.limit === 'number') {
    searchParams.set('limit', options.limit.toString());
  }

  if (options.status) {
    searchParams.set('status', options.status);
  }

  if (options.direction) {
    searchParams.set('direction', options.direction);
  }

  if (options.query) {
    searchParams.set('query', options.query);
  }

  const suffix = searchParams.size > 0 ? `?${searchParams.toString()}` : '';
  return apiRequest(`/signals${suffix}`, signalFeedResponseSchema);
};

export const getSignals = (
  options: GetSignalsOptions = {},
): Promise<SignalFeedResponse> =>
  withSeededFallback(
    () => getLiveSignals(options),
    () => getSeededSignals(),
  );

export const getLiveSignalDetail = (
  id: string,
): Promise<SignalDetailResponse> =>
  apiRequest(`/signals/${encodeURIComponent(id)}`, signalDetailResponseSchema);

export const getSignalDetail = (id: string): Promise<SignalDetailResponse> =>
  withSeededFallback(
    () => getLiveSignalDetail(id),
    () => getSeededSignalDetail(id),
  );
