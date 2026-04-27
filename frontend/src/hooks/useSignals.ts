import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getSignalDetail,
  getSignals,
  type GetSignalsOptions,
} from '../lib/api/signals';
import type { SignalDetailResponse, SignalFeedResponse } from '@omen/shared';

export type UseSignalsOptions = GetSignalsOptions & {
  enabled?: boolean;
  refreshIntervalMs?: number;
};

export type UseSignalsResult = {
  response: SignalFeedResponse | null;
  signals: SignalFeedResponse['items'];
  total: number;
  nextCursor: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

export type UseSignalDetailOptions = {
  enabled?: boolean;
  refreshIntervalMs?: number;
};

export type UseSignalDetailResult = {
  response: SignalDetailResponse | null;
  signal: SignalDetailResponse['item'] | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

const toError = (error: unknown, message: string) =>
  error instanceof Error ? error : new Error(message);

export const useSignals = (options: UseSignalsOptions = {}): UseSignalsResult => {
  const {
    cursor,
    direction,
    enabled = true,
    limit,
    page,
    query,
    refreshIntervalMs,
    sort,
    status,
  } = options;
  const requestOptions = useMemo<GetSignalsOptions>(
    () => ({ cursor, direction, limit, page, query, sort, status }),
    [cursor, direction, limit, page, query, sort, status],
  );
  const [response, setResponse] = useState<SignalFeedResponse | null>(null);
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
      setResponse(await getSignals(requestOptions));
      hasDataRef.current = true;
    } catch (caughtError) {
      setError(toError(caughtError, 'Failed to load signals.'));
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
    signals: response?.items ?? [],
    total: response?.total ?? 0,
    nextCursor: response?.nextCursor ?? null,
    isLoading,
    isRefreshing,
    error,
    refetch: load,
  };
};

export const useSignalDetail = (
  id: string | null | undefined,
  options: UseSignalDetailOptions = {},
): UseSignalDetailResult => {
  const { enabled = true, refreshIntervalMs } = options;
  const shouldLoad = enabled && Boolean(id);
  const [response, setResponse] = useState<SignalDetailResponse | null>(null);
  const hasDataRef = useRef(false);
  const [isLoading, setIsLoading] = useState(shouldLoad);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!shouldLoad || !id) {
      return;
    }

    setIsLoading(!hasDataRef.current);
    setIsRefreshing(hasDataRef.current);
    setError(null);

    try {
      setResponse(await getSignalDetail(id));
      hasDataRef.current = true;
    } catch (caughtError) {
      setError(toError(caughtError, 'Failed to load signal detail.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [id, shouldLoad]);

  useEffect(() => {
    if (!shouldLoad) {
      setResponse(null);
      hasDataRef.current = false;
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
  }, [load, refreshIntervalMs, shouldLoad]);

  return {
    response,
    signal: response?.item ?? null,
    isLoading,
    isRefreshing,
    error,
    refetch: load,
  };
};
