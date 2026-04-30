import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getProofDetail,
  getProofFeed,
  type ProofDetailResponse,
  type ProofFeedResponse,
} from '../lib/api/proofs';

export type UseProofFeedOptions = {
  enabled?: boolean;
  limit?: number;
  refreshIntervalMs?: number;
};

export type UseProofDetailOptions = {
  enabled?: boolean;
  refreshIntervalMs?: number;
};

const toError = (error: unknown, message: string) =>
  error instanceof Error ? error : new Error(message);

export const useProofFeed = (options: UseProofFeedOptions = {}) => {
  const { enabled = true, limit = 20, refreshIntervalMs } = options;
  const [response, setResponse] = useState<ProofFeedResponse | null>(null);
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
      setResponse(await getProofFeed(limit));
      hasDataRef.current = true;
    } catch (caughtError) {
      setError(toError(caughtError, 'Failed to load proof feed.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [enabled, limit]);

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
    proofs: response?.items ?? [],
    nextCursor: response?.nextCursor ?? null,
    isLoading,
    isRefreshing,
    error,
    refetch: load,
  };
};

export const useProofDetail = (
  runId: string | null | undefined,
  options: UseProofDetailOptions = {},
) => {
  const { enabled = true, refreshIntervalMs } = options;
  const shouldLoad = enabled && Boolean(runId);
  const [response, setResponse] = useState<ProofDetailResponse | null>(null);
  const hasDataRef = useRef(false);
  const [isLoading, setIsLoading] = useState(shouldLoad);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!shouldLoad || !runId) {
      return;
    }

    setIsLoading(!hasDataRef.current);
    setIsRefreshing(hasDataRef.current);
    setError(null);

    try {
      setResponse(await getProofDetail(runId));
      hasDataRef.current = true;
    } catch (caughtError) {
      setError(toError(caughtError, 'Failed to load proof detail.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [runId, shouldLoad]);

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
    run: response?.run ?? null,
    proofBundle: response?.proofBundle ?? null,
    artifacts: response?.artifacts ?? [],
    manifest: response?.manifest ?? null,
    proofFinalization: response?.proofFinalization ?? null,
    isLoading,
    isRefreshing,
    error,
    refetch: load,
  };
};
