import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getAnalyticsSnapshots,
  getLatestAnalyticsSnapshot,
} from '../lib/api/analytics';
import type {
  AnalyticsFeedResponse,
  AnalyticsLatestResponse,
} from '@omen/shared';

export type UseAnalyticsOptions = {
  enabled?: boolean;
  refreshIntervalMs?: number;
};

export type UseAnalyticsResult = {
  feed: AnalyticsFeedResponse | null;
  latest: AnalyticsLatestResponse | null;
  snapshots: AnalyticsFeedResponse['items'];
  latestSnapshot: AnalyticsLatestResponse['item'] | null;
  nextCursor: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error('Failed to load analytics.');

export const useAnalytics = (
  options: UseAnalyticsOptions = {},
): UseAnalyticsResult => {
  const { enabled = true, refreshIntervalMs } = options;
  const [feed, setFeed] = useState<AnalyticsFeedResponse | null>(null);
  const [latest, setLatest] = useState<AnalyticsLatestResponse | null>(null);
  const hasDataRef = useRef(false);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setIsLoading(!hasDataRef.current);
    setIsRefreshing(hasDataRef.current);
    setError(null);

    try {
      const [nextFeed, nextLatest] = await Promise.all([
        getAnalyticsSnapshots(),
        getLatestAnalyticsSnapshot(),
      ]);

      setFeed(nextFeed);
      setLatest(nextLatest);
      hasDataRef.current = true;
    } catch (caughtError) {
      setError(toError(caughtError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    void load();

    if (!refreshIntervalMs) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void load();
    }, refreshIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, load, refreshIntervalMs]);

  return {
    feed,
    latest,
    snapshots: feed?.items ?? [],
    latestSnapshot: latest?.item ?? feed?.items[0] ?? null,
    nextCursor: feed?.nextCursor ?? null,
    isLoading,
    isRefreshing,
    error,
    refetch: load,
  };
};
