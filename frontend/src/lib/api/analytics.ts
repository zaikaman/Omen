import {
  analyticsLatestResponseSchema,
  analyticsFeedResponseSchema,
  type AnalyticsSnapshot,
} from '@omen/shared';

import { apiRequest } from './client';

export const getLiveAnalyticsSnapshots = () =>
  apiRequest('/analytics', analyticsFeedResponseSchema);

export const getAnalyticsSnapshots = getLiveAnalyticsSnapshots;

export const getLiveLatestAnalyticsSnapshot = () =>
  apiRequest('/analytics/latest', analyticsLatestResponseSchema);

export const getLatestAnalyticsSnapshot = getLiveLatestAnalyticsSnapshot;
export type AnalyticsSnapshotResponse = AnalyticsSnapshot;
