import { useCallback, useEffect, useRef, useState } from 'react';

import {
  getDashboardSummary,
  getRuntimeStatus,
  type DashboardSummaryResponse,
  type RuntimeStatusResponse,
} from '../lib/api/dashboard';

export type UseRunStatusOptions = {
  enabled?: boolean;
  refreshIntervalMs?: number;
};

export type UseRunStatusResult = {
  runtimeStatus: RuntimeStatusResponse | null;
  dashboardSummary: DashboardSummaryResponse | null;
  activeRun: DashboardSummaryResponse['activeRun'] | null;
  latestRun: DashboardSummaryResponse['latestRun'] | null;
  scheduler: RuntimeStatusResponse['scheduler'] | null;
  activeRunId: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error('Failed to load run status.');

export const useRunStatus = (
  options: UseRunStatusOptions = {},
): UseRunStatusResult => {
  const { enabled = true, refreshIntervalMs } = options;
  const [runtimeStatus, setRuntimeStatus] =
    useState<RuntimeStatusResponse | null>(null);
  const [dashboardSummary, setDashboardSummary] =
    useState<DashboardSummaryResponse | null>(null);
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
      const [nextRuntimeStatus, nextDashboardSummary] = await Promise.all([
        getRuntimeStatus(),
        getDashboardSummary(),
      ]);

      setRuntimeStatus(nextRuntimeStatus);
      setDashboardSummary(nextDashboardSummary);
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
    runtimeStatus,
    dashboardSummary,
    activeRun: dashboardSummary?.activeRun ?? null,
    latestRun: dashboardSummary?.latestRun ?? null,
    scheduler: runtimeStatus?.scheduler ?? dashboardSummary?.scheduler ?? null,
    activeRunId:
      runtimeStatus?.activeRunId ?? dashboardSummary?.activeRun?.id ?? null,
    isLoading,
    isRefreshing,
    error,
    refetch: load,
  };
};
