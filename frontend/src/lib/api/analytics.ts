import { analyticsSnapshotSchema, type AnalyticsSnapshot } from '@omen/shared';

import { apiRequest } from './client';

const analyticsFeedResponseSchema = {
  parse: (input: unknown) => {
    const payload = input as { items?: unknown[] };
    return {
      items: Array.isArray(payload.items)
        ? payload.items.map((item) => analyticsSnapshotSchema.parse(item))
        : [],
    };
  },
};

const analyticsLatestResponseSchema = {
  parse: (input: unknown) => {
    const payload = input as { item?: unknown };
    return {
      item: payload.item == null ? null : analyticsSnapshotSchema.parse(payload.item),
    };
  },
};

export const getAnalyticsSnapshots = () =>
  apiRequest('/analytics', analyticsFeedResponseSchema);

export const getLatestAnalyticsSnapshot = () =>
  apiRequest('/analytics/latest', analyticsLatestResponseSchema);

export type AnalyticsFeedResponse = ReturnType<
  typeof analyticsFeedResponseSchema.parse
>;
export type AnalyticsLatestResponse = ReturnType<
  typeof analyticsLatestResponseSchema.parse
>;
export type AnalyticsSnapshotResponse = AnalyticsSnapshot;
