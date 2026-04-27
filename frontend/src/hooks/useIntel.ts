import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getIntelDetail,
  getIntelFeed,
  type GetIntelFeedOptions,
} from '../lib/api/intel';
import type { IntelDetailResponse, IntelFeedResponse } from '@omen/shared';

export type UseIntelOptions = GetIntelFeedOptions & {
  enabled?: boolean;
  refreshIntervalMs?: number;
};

export type UseIntelResult = {
  response: IntelFeedResponse | null;
  intel: IntelFeedResponse['items'];
  nextCursor: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

export type UseIntelDetailOptions = {
  enabled?: boolean;
  refreshIntervalMs?: number;
};

export type UseIntelDetailResult = {
  response: IntelDetailResponse | null;
  intel: IntelDetailResponse['item'] | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

const toError = (error: unknown, message: string) =>
  error instanceof Error ? error : new Error(message);

export const useIntel = (options: UseIntelOptions = {}): UseIntelResult => {
  const { cursor, enabled = true, limit, query, refreshIntervalMs } = options;
  const requestOptions = useMemo<GetIntelFeedOptions>(
    () => ({ cursor, limit, query }),
    [cursor, limit, query],
  );
  const [response, setResponse] = useState<IntelFeedResponse | null>(null);
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
      setResponse(await getIntelFeed(requestOptions));
      hasDataRef.current = true;
    } catch (caughtError) {
      setError(toError(caughtError, 'Failed to load intel feed.'));
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
    intel: response?.items ?? [],
    nextCursor: response?.nextCursor ?? null,
    isLoading,
    isRefreshing,
    error,
    refetch: load,
  };
};

export const useIntelDetail = (
  id: string | null | undefined,
  options: UseIntelDetailOptions = {},
): UseIntelDetailResult => {
  const { enabled = true, refreshIntervalMs } = options;
  const shouldLoad = enabled && Boolean(id);
  const [response, setResponse] = useState<IntelDetailResponse | null>(null);
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
      setResponse(await getIntelDetail(id));
      hasDataRef.current = true;
    } catch (caughtError) {
      setError(toError(caughtError, 'Failed to load intel detail.'));
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
    intel: response?.item ?? null,
    isLoading,
    isRefreshing,
    error,
    refetch: load,
  };
};
