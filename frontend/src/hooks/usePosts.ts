import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getPosts, type GetPostsOptions } from '../lib/api/posts';
import type { PostFeedResponse } from '@omen/shared';

export type UsePostsOptions = GetPostsOptions & {
  enabled?: boolean;
  refreshIntervalMs?: number;
};

const toError = (error: unknown, message: string) =>
  error instanceof Error ? error : new Error(message);

export const usePosts = (options: UsePostsOptions = {}) => {
  const {
    enabled = true,
    intelId,
    refreshIntervalMs,
    runId,
    signalId,
  } = options;
  const requestOptions = useMemo<GetPostsOptions>(
    () => ({ intelId, runId, signalId }),
    [intelId, runId, signalId],
  );
  const [response, setResponse] = useState<PostFeedResponse | null>(null);
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
      setResponse(await getPosts(requestOptions));
      hasDataRef.current = true;
    } catch (caughtError) {
      setError(toError(caughtError, 'Failed to load outbound posts.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [enabled, requestOptions]);

  useEffect(() => {
    if (!enabled) {
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
  }, [enabled, load, refreshIntervalMs]);

  return {
    response,
    posts: response?.items ?? [],
    latestPost: response?.items[0] ?? null,
    isLoading,
    isRefreshing,
    error,
    refetch: load,
  };
};
