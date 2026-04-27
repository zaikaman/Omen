import {
  analyticsLatestResponseSchema,
  analyticsFeedResponseSchema,
  type AnalyticsSnapshot,
} from '@omen/shared';

import { apiRequest } from './client';

export const getAnalyticsSnapshots = () =>
  apiRequest('/analytics', analyticsFeedResponseSchema);

export const getLatestAnalyticsSnapshot = () =>
  apiRequest('/analytics/latest', analyticsLatestResponseSchema);
export type AnalyticsSnapshotResponse = AnalyticsSnapshot;
