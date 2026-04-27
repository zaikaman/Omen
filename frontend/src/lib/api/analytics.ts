import {
  analyticsLatestResponseSchema,
  analyticsFeedResponseSchema,
  type AnalyticsSnapshot,
} from '@omen/shared';

import { apiRequest } from './client';
import {
  getSeededAnalyticsSnapshots,
  getSeededLatestAnalyticsSnapshot,
  withSeededFallback,
} from './seededFallback';

export const getLiveAnalyticsSnapshots = () =>
  apiRequest('/analytics', analyticsFeedResponseSchema);

export const getAnalyticsSnapshots = () =>
  withSeededFallback(getLiveAnalyticsSnapshots, getSeededAnalyticsSnapshots);

export const getLiveLatestAnalyticsSnapshot = () =>
  apiRequest('/analytics/latest', analyticsLatestResponseSchema);

export const getLatestAnalyticsSnapshot = () =>
  withSeededFallback(
    getLiveLatestAnalyticsSnapshot,
    getSeededLatestAnalyticsSnapshot,
  );
export type AnalyticsSnapshotResponse = AnalyticsSnapshot;
