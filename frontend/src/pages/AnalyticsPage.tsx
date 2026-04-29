import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { ChartHistogramIcon } from '@hugeicons/core-free-icons';
import { AnalyticsNavigation } from '../components/analytics/AnalyticsNavigation';
import { getSignals } from '../lib/api/signals';
import { cn } from '../lib/utils';
import type { SignalFeedResponse } from '@omen/shared';
import type { ChartSignal, SignalStatus } from '../types/ui-models';

const PAGE_SIZE = 50;
const MAX_SIGNAL_PAGES = 10;

export const TIMEFRAME_OPTIONS = [
  { label: '7D', value: '7d', days: 7 },
  { label: '30D', value: '30d', days: 30 },
  { label: '90D', value: '90d', days: 90 },
  { label: 'All', value: 'all', days: null },
] as const;

export type AnalyticsTimeframe = (typeof TIMEFRAME_OPTIONS)[number]['value'];

export type SignalAnalyticsSummary = {
  totalSignals: number;
  activeSignals: number;
  closedSignals: number;
  winningSignals: number;
  losingSignals: number;
  winRate: number | null;
  averageConfidence: number | null;
  totalPnlPercent: number;
  averageR: number | null;
  mostFrequentAsset: string | null;
  longSignals: number;
  shortSignals: number;
};

export type AnalyticsOutletContext = {
  signals: ChartSignal[];
  allSignals: ChartSignal[];
  summary: SignalAnalyticsSummary;
  timeframe: AnalyticsTimeframe;
  loadedCount: number;
  totalAvailable: number;
  isPartialHistory: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

export const useAnalyticsOutletContext = () =>
  useOutletContext<AnalyticsOutletContext>();

type SignalListItem = SignalFeedResponse['items'][number];

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error('Failed to load signal analytics.');

const toChartStatus = (signal: SignalListItem): SignalStatus => {
  if (signal.signalStatus) {
    return signal.signalStatus;
  }

  return signal.publishedAt ? 'active' : 'pending';
};

export const toChartSignal = (signal: SignalListItem): ChartSignal => ({
  created_at: signal.publishedAt ?? signal.createdAt,
  content: {
    asset: signal.asset,
    confidence_score: signal.confidence / 100,
    confidence: signal.confidence,
    current_price: signal.currentPrice ?? undefined,
    direction: signal.direction,
    entry_price: signal.entryPrice ?? undefined,
    pnl_percent: signal.pnlPercent ?? undefined,
    status: toChartStatus(signal),
    stop_loss: signal.stopLoss ?? undefined,
    target_price: signal.targetPrice ?? undefined,
    trade_setup: {
      asset: signal.asset,
      direction: signal.direction,
      entry_price: signal.entryPrice ?? undefined,
      stop_loss: signal.stopLoss ?? undefined,
      target_price: signal.targetPrice ?? undefined,
    },
  },
});

const isClosedSignal = (signal: ChartSignal) =>
  signal.content.status === 'tp_hit' || signal.content.status === 'sl_hit';

const isWinningSignal = (signal: ChartSignal) =>
  signal.content.status === 'tp_hit';

const isLosingSignal = (signal: ChartSignal) =>
  signal.content.status === 'sl_hit';

const isActiveSignal = (signal: ChartSignal) =>
  signal.content.status === 'active' || signal.content.status === 'pending';

export const getConfidencePercent = (signal: ChartSignal) => {
  if (typeof signal.content.confidence === 'number') {
    return signal.content.confidence;
  }

  if (typeof signal.content.confidence_score === 'number') {
    return signal.content.confidence_score * 100;
  }

  return null;
};

const getSignalTimestamp = (signal: ChartSignal) =>
  new Date(signal.created_at).getTime();

const filterSignalsByTimeframe = (
  signals: ChartSignal[],
  timeframe: AnalyticsTimeframe,
) => {
  const option = TIMEFRAME_OPTIONS.find((item) => item.value === timeframe);

  if (!option?.days) {
    return signals;
  }

  const cutoff = Date.now() - option.days * 24 * 60 * 60 * 1000;
  return signals.filter((signal) => getSignalTimestamp(signal) >= cutoff);
};

export const buildSignalAnalyticsSummary = (
  signals: ChartSignal[],
): SignalAnalyticsSummary => {
  const closedSignals = signals.filter(isClosedSignal);
  const winningSignals = signals.filter(isWinningSignal);
  const losingSignals = signals.filter(isLosingSignal);
  const confidenceValues = signals
    .map(getConfidencePercent)
    .filter((value): value is number => typeof value === 'number');
  const assetCounts = signals.reduce<Record<string, number>>((counts, signal) => {
    const asset = signal.content.trade_setup?.asset ?? signal.content.asset;

    if (asset) {
      counts[asset] = (counts[asset] ?? 0) + 1;
    }

    return counts;
  }, {});
  const mostFrequentAsset =
    Object.entries(assetCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ??
    null;
  const totalPnlPercent = closedSignals.reduce(
    (total, signal) => total + (signal.content.pnl_percent ?? 0),
    0,
  );

  return {
    totalSignals: signals.length,
    activeSignals: signals.filter(isActiveSignal).length,
    closedSignals: closedSignals.length,
    winningSignals: winningSignals.length,
    losingSignals: losingSignals.length,
    winRate:
      closedSignals.length > 0
        ? (winningSignals.length / closedSignals.length) * 100
        : null,
    averageConfidence:
      confidenceValues.length > 0
        ? confidenceValues.reduce((total, value) => total + value, 0) /
          confidenceValues.length
        : null,
    totalPnlPercent,
    averageR:
      closedSignals.length > 0 ? totalPnlPercent / closedSignals.length : null,
    mostFrequentAsset,
    longSignals: signals.filter((signal) => signal.content.direction === 'LONG')
      .length,
    shortSignals: signals.filter((signal) => signal.content.direction === 'SHORT')
      .length,
  };
};

const formatUpdatedAt = (signals: ChartSignal[]) => {
  const latestTimestamp = signals
    .map(getSignalTimestamp)
    .filter(Number.isFinite)
    .sort((left, right) => right - left)[0];

  return latestTimestamp ? new Date(latestTimestamp).toLocaleString() : null;
};

export function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState<AnalyticsTimeframe>('30d');
  const [allSignals, setAllSignals] = useState<ChartSignal[]>([]);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const hasDataRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadSignals = useCallback(async () => {
    setIsLoading(!hasDataRef.current);
    setIsRefreshing(hasDataRef.current);
    setError(null);

    try {
      const items: SignalListItem[] = [];
      let total = 0;

      for (let page = 1; page <= MAX_SIGNAL_PAGES; page += 1) {
        const response = await getSignals({
          limit: PAGE_SIZE,
          page,
          sort: 'newest',
        });

        items.push(...response.items);
        total = response.total;

        if (!response.nextCursor) {
          break;
        }
      }

      setAllSignals(items.map(toChartSignal));
      setTotalAvailable(total);
      hasDataRef.current = true;
    } catch (caughtError) {
      setError(toError(caughtError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadSignals();

    const intervalId = window.setInterval(() => {
      void loadSignals();
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadSignals]);

  const signals = useMemo(
    () => filterSignalsByTimeframe(allSignals, timeframe),
    [allSignals, timeframe],
  );
  const summary = useMemo(
    () => buildSignalAnalyticsSummary(signals),
    [signals],
  );
  const latestUpdatedAt = formatUpdatedAt(allSignals);
  const isPartialHistory =
    totalAvailable > allSignals.length || allSignals.length >= PAGE_SIZE * MAX_SIGNAL_PAGES;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <HugeiconsIcon icon={ChartHistogramIcon} className="w-6 h-6 text-cyan-500" />
            Analytics
          </h2>
          <p className="text-gray-400 mt-1">Signal performance, outcomes, and asset frequency.</p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center xl:justify-end">
          <div className="flex space-x-1 bg-gray-900/50 p-1 rounded-lg border border-gray-800">
            {TIMEFRAME_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTimeframe(option.value)}
                className={cn(
                  'min-w-12 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  timeframe === option.value
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'border border-transparent text-gray-400 hover:text-white hover:bg-gray-800',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="text-left text-sm text-gray-500 sm:text-right">
            {isRefreshing ? <div className="text-cyan-400">Refreshing...</div> : null}
            {latestUpdatedAt ? <div>Updated {latestUpdatedAt}</div> : null}
            <div>
              Showing {signals.length} of {allSignals.length} loaded signals
              {totalAvailable ? ` (${totalAvailable} total)` : ''}
            </div>
            {isPartialHistory ? (
              <div className="text-amber-300/80">History capped at latest {allSignals.length} signals</div>
            ) : null}
          </div>
        </div>
      </div>

      <AnalyticsNavigation />

      {error ? (
        <div className="border border-red-900/60 bg-red-950/30 rounded-xl p-4 text-sm text-red-200">
          <div className="font-semibold text-red-100">Signal analytics unavailable</div>
          <div className="mt-1">{error.message}</div>
        </div>
      ) : null}

      <Outlet
        context={{
          signals,
          allSignals,
          summary,
          timeframe,
          loadedCount: allSignals.length,
          totalAvailable,
          isPartialHistory,
          isLoading,
          isRefreshing,
          error,
          refetch: loadSignals,
        } satisfies AnalyticsOutletContext}
      />
    </div>
  );
}
