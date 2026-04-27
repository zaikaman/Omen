import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getLogs, type GetLogsOptions } from '../lib/api/logs';
import type { LogFeedResponse } from '@omen/shared';

export type UseLogsOptions = GetLogsOptions & {
  enabled?: boolean;
  refreshIntervalMs?: number;
};

export type UseLogsResult = {
  response: LogFeedResponse | null;
  logs: LogFeedResponse['items'];
  nextCursor: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error('Failed to load logs.');

export const useLogs = (options: UseLogsOptions = {}): UseLogsResult => {
  const { enabled = true, limit, refreshIntervalMs, runId } = options;
  const requestOptions = useMemo<GetLogsOptions>(
    () => ({ limit, runId }),
    [limit, runId],
  );
  const [response, setResponse] = useState<LogFeedResponse | null>(null);
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
      setResponse(await getLogs(requestOptions));
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
    logs: response?.items ?? [],
    nextCursor: response?.nextCursor ?? null,
    isLoading,
    isRefreshing,
    error,
    refetch: load,
  };
};
