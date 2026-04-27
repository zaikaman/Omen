import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getTopology,
  type TopologyResponse,
} from '../lib/api/topology';

export type UseTopologyOptions = {
  enabled?: boolean;
  refreshIntervalMs?: number;
};

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error('Failed to load topology.');

export const useTopology = (options: UseTopologyOptions = {}) => {
  const { enabled = true, refreshIntervalMs } = options;
  const [response, setResponse] = useState<TopologyResponse | null>(null);
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
      setResponse(await getTopology());
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
    response,
    nodes: response?.nodes ?? [],
    snapshot: response?.snapshot ?? null,
    peers: response?.snapshot.peers ?? [],
    services: response?.snapshot.services ?? [],
    routes: response?.snapshot.routes ?? [],
    capturedAt: response?.snapshot.capturedAt ?? null,
    isLoading,
    isRefreshing,
    error,
    refetch: load,
  };
};
