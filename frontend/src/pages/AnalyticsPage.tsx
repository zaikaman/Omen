import { Outlet, useOutletContext } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { ChartHistogramIcon } from '@hugeicons/core-free-icons';
import { AnalyticsNavigation } from '../components/analytics/AnalyticsNavigation';
import { useAnalytics } from '../hooks/useAnalytics';
import type { AnalyticsSnapshot } from '@omen/shared';
import type { ChartSignal, MindsharePoint, SignalStatus } from '../types/ui-models';

export type AnalyticsOutletContext = {
  snapshots: AnalyticsSnapshot[];
  latestSnapshot: AnalyticsSnapshot | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

export const useAnalyticsOutletContext = () =>
  useOutletContext<AnalyticsOutletContext>();

export const toMindsharePoints = (
  snapshot: AnalyticsSnapshot | null,
): MindsharePoint[] =>
  snapshot?.mindshare.map((point) => ({
    topic: point.label,
    value: point.value,
  })) ?? [];

const expandCount = (count: number) => Math.max(0, Math.round(count));

const makeChartSignal = (
  generatedAt: string,
  status: SignalStatus,
  content: ChartSignal['content'] = {},
): ChartSignal => ({
  created_at: generatedAt,
  content: {
    status,
    ...content,
  },
});

export const toActivitySignals = (
  snapshots: AnalyticsSnapshot[],
  selector: (snapshot: AnalyticsSnapshot) => number,
): ChartSignal[] => {
  const sortedSnapshots = [...snapshots].sort((left, right) =>
    left.generatedAt.localeCompare(right.generatedAt),
  );

  let previousTotal = 0;

  return sortedSnapshots.flatMap((snapshot) => {
    const total = selector(snapshot);
    const count = expandCount(Math.max(0, total - previousTotal));
    previousTotal = total;

    return Array.from({ length: count }, () =>
      makeChartSignal(snapshot.generatedAt, 'active'),
    );
  });
};

export const toConfidenceSignals = (
  snapshot: AnalyticsSnapshot | null,
): ChartSignal[] => {
  if (!snapshot) {
    return [];
  }

  return snapshot.confidenceBands.flatMap((band) => {
    const [low = '0', high = low] = band.label.split('-');
    const confidence =
      ((Number.parseInt(low, 10) + Number.parseInt(high, 10)) / 2) / 100;

    return Array.from({ length: expandCount(band.value) }, () =>
      makeChartSignal(snapshot.generatedAt, 'active', {
        confidence_score: Number.isFinite(confidence) ? confidence : 0,
      }),
    );
  });
};

export const toTokenFrequencySignals = (
  snapshot: AnalyticsSnapshot | null,
): ChartSignal[] => {
  if (!snapshot) {
    return [];
  }

  return snapshot.tokenFrequency.flatMap((token) =>
    Array.from({ length: expandCount(token.value) }, () =>
      makeChartSignal(snapshot.generatedAt, 'active', {
        asset: token.label,
      }),
    ),
  );
};

export const toPerformanceSignals = (
  snapshot: AnalyticsSnapshot | null,
): ChartSignal[] => {
  if (!snapshot) {
    return [];
  }

  const { activeSignals, winningSignals, losingSignals } = snapshot.totals;

  return [
    ...Array.from({ length: expandCount(winningSignals) }, () =>
      makeChartSignal(snapshot.generatedAt, 'tp_hit'),
    ),
    ...Array.from({ length: expandCount(losingSignals) }, () =>
      makeChartSignal(snapshot.generatedAt, 'sl_hit'),
    ),
    ...Array.from({ length: expandCount(activeSignals) }, () =>
      makeChartSignal(snapshot.generatedAt, 'active'),
    ),
  ];
};

export const toPnlSignals = (snapshots: AnalyticsSnapshot[]): ChartSignal[] => {
  const sortedSnapshots = [...snapshots].sort((left, right) =>
    left.generatedAt.localeCompare(right.generatedAt),
  );

  let previousPnl = 0;

  return sortedSnapshots.flatMap((snapshot) => {
    const closedSignals = snapshot.totals.closedSignals;

    if (closedSignals <= 0) {
      previousPnl = snapshot.totals.totalPnlPercent;
      return [];
    }

    const pnlDelta = snapshot.totals.totalPnlPercent - previousPnl;
    previousPnl = snapshot.totals.totalPnlPercent;

    if (pnlDelta === 0) {
      return [];
    }

    return [
      makeChartSignal(snapshot.generatedAt, pnlDelta > 0 ? 'tp_hit' : 'sl_hit', {
        pnl_percent: pnlDelta,
      }),
    ];
  });
};

export function AnalyticsPage() {
  const analytics = useAnalytics({ refreshIntervalMs: 30_000 });
  const latestGeneratedAt = analytics.latestSnapshot?.generatedAt
    ? new Date(analytics.latestSnapshot.generatedAt).toLocaleString()
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <HugeiconsIcon icon={ChartHistogramIcon} className="w-6 h-6 text-cyan-500" />
            Analytics
          </h2>
          <p className="text-gray-400 mt-1">Market metrics and mindshare velocity tracking.</p>
        </div>
        <div className="text-right text-sm text-gray-500">
          {analytics.isRefreshing ? (
            <div className="text-cyan-400">Refreshing...</div>
          ) : null}
          {latestGeneratedAt ? <div>Updated {latestGeneratedAt}</div> : null}
        </div>
      </div>

      <AnalyticsNavigation />

      {analytics.error ? (
        <div className="border border-red-900/60 bg-red-950/30 rounded-xl p-4 text-sm text-red-200">
          <div className="font-semibold text-red-100">Analytics data unavailable</div>
          <div className="mt-1">{analytics.error.message}</div>
        </div>
      ) : null}
      
      <Outlet
        context={{
          snapshots: analytics.snapshots,
          latestSnapshot: analytics.latestSnapshot,
          isLoading: analytics.isLoading,
          isRefreshing: analytics.isRefreshing,
          error: analytics.error,
          refetch: analytics.refetch,
        } satisfies AnalyticsOutletContext}
      />
    </div>
  );
}
