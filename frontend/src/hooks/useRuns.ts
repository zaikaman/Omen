import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getRuns,
  type GetRunsOptions,
  type RunsFeedResponse,
} from '../lib/api/runs';

export type UseRunsOptions = GetRunsOptions & {
  enabled?: boolean;
  refreshIntervalMs?: number;
};

export type UseRunsResult = {
  response: RunsFeedResponse | null;
  runs: RunsFeedResponse['runs'];
  nextCursor: string | null;
  total: number;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error('Failed to load runs.');

export const useRuns = (options: UseRunsOptions = {}): UseRunsResult => {
  const { enabled = true, limit, refreshIntervalMs } = options;
  const requestOptions = useMemo<GetRunsOptions>(() => ({ limit }), [limit]);
  const [response, setResponse] = useState<RunsFeedResponse | null>(null);
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
      setResponse(await getRuns(requestOptions));
      hasDataRef.current = true;
    } catch (caughtError) {
      setError(toError(caughtError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [enabled, requestOptions]);

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
    response,
    runs: response?.runs ?? [],
    nextCursor: response?.nextCursor ?? null,
    total: response?.total ?? 0,
    isLoading,
    isRefreshing,
    error,
    refetch: load,
  };
};
