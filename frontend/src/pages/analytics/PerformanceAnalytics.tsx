import { WinRateChart } from '../../components/analytics/WinRateChart';
import { PnLChart } from '../../components/analytics/PnLChart';
import { HugeiconsIcon } from '@hugeicons/react';
import { ChartHistogramIcon, AnalyticsUpIcon } from '@hugeicons/core-free-icons';
import {
  toPerformanceSignals,
  toPnlSignals,
  useAnalyticsOutletContext,
} from '../AnalyticsPage';

export function PerformanceAnalytics() {
  const { latestSnapshot, snapshots, isLoading } = useAnalyticsOutletContext();
  const signals = toPerformanceSignals(latestSnapshot);
  const pnlSignals = toPnlSignals(snapshots);
  const totalClosed = latestSnapshot?.totals.closedSignals ?? 0;
  const winRate =
    latestSnapshot?.winRate === null || latestSnapshot?.winRate === undefined
      ? '0.0'
      : latestSnapshot.winRate.toFixed(1);
  const totalPnL = latestSnapshot?.totals.totalPnlPercent ?? 0;
  const avgPnL = latestSnapshot?.totals.averageR?.toFixed(2) ?? '0.00';

  if (isLoading && !latestSnapshot) {
    return (
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6 text-gray-400">
        Loading analytics snapshots...
      </div>
    );
  }

  if (!latestSnapshot) {
    return (
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6 text-gray-400">
        No analytics snapshots have been generated yet.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Win Rate</div>
          <div className="text-2xl font-bold text-emerald-400">{winRate}%</div>
        </div>
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Total Return (1% Risk)</div>
          <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalPnL > 0 ? '+' : ''}{totalPnL.toFixed(2)}%
          </div>
        </div>
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Avg R per Trade</div>
          <div className={`text-2xl font-bold ${Number(avgPnL) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {Number(avgPnL) > 0 ? '+' : ''}{avgPnL}R
          </div>
        </div>
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Total Closed Signals</div>
          <div className="text-2xl font-bold text-white">{totalClosed}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <HugeiconsIcon icon={ChartHistogramIcon} className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-bold text-white">Win/Loss Ratio</h3>
          </div>
          {signals.length > 0 ? (
            <WinRateChart signals={signals} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No signal performance data in the latest snapshot.
            </div>
          )}
        </div>

        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <HugeiconsIcon icon={AnalyticsUpIcon} className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-bold text-white">PnL History</h3>
          </div>
          {pnlSignals.length > 0 ? (
            <PnLChart signals={pnlSignals} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No closed-signal PnL history in the analytics feed.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
