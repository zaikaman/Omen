import {
  analyticsFeedResponseSchema,
  analyticsLatestResponseSchema,
  type AnalyticsFeedResponse,
  type AnalyticsLatestResponse,
  type AnalyticsSnapshot,
} from "@omen/shared";

export type AnalyticsFeedPresenterInput = {
  items: AnalyticsSnapshot[];
  nextCursor?: string | null;
};

export const presentAnalyticsFeed = (
  input: AnalyticsFeedPresenterInput,
): AnalyticsFeedResponse =>
  analyticsFeedResponseSchema.parse({
    items: input.items,
    nextCursor: input.nextCursor ?? null,
  });

export const presentLatestAnalyticsSnapshot = (
  item: AnalyticsSnapshot | null,
): AnalyticsLatestResponse =>
  analyticsLatestResponseSchema.parse({
    item,
  });
