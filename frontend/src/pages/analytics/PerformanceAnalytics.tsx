import { ConfidenceOutcomeChart } from '../../components/analytics/ConfidenceOutcomeChart';
import { PnLChart } from '../../components/analytics/PnLChart';
import { SignalStatusChart } from '../../components/analytics/SignalStatusChart';
import { WinRateChart } from '../../components/analytics/WinRateChart';
import { HugeiconsIcon } from '@hugeicons/react';
import { AnalyticsUpIcon, ChartHistogramIcon, Layers01Icon } from '@hugeicons/core-free-icons';
import { useAnalyticsOutletContext } from '../AnalyticsPage';

function EmptyState({ children }: { children: string }) {
  return (
    <div className="h-[300px] flex items-center justify-center text-gray-500">
      {children}
    </div>
  );
}

export function PerformanceAnalytics() {
  const { signals, summary, isLoading } = useAnalyticsOutletContext();
  const closedSignals = signals.filter(
    (signal) =>
      signal.content.status === 'tp_hit' || signal.content.status === 'sl_hit',
  );
  const hasPnlHistory = closedSignals.some(
    (signal) => signal.content.pnl_percent !== undefined,
  );

  if (isLoading && signals.length === 0) {
    return (
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6 text-gray-400">
        Loading signal analytics...
      </div>
    );
  }

  if (signals.length === 0) {
    return (
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6 text-gray-400">
        No signals match the selected timeframe.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Win Rate</div>
          <div className="text-2xl font-bold text-emerald-400">
            {summary.winRate === null ? 'N/A' : `${summary.winRate.toFixed(1)}%`}
          </div>
        </div>
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Total Return (1% Risk)</div>
          <div className={`text-2xl font-bold ${summary.totalPnlPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {summary.totalPnlPercent > 0 ? '+' : ''}{summary.totalPnlPercent.toFixed(2)}%
          </div>
        </div>
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Avg R per Trade</div>
          <div className={`text-2xl font-bold ${(summary.averageR ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {summary.averageR === null
              ? 'N/A'
              : `${summary.averageR > 0 ? '+' : ''}${summary.averageR.toFixed(2)}R`}
          </div>
        </div>
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Closed Signals</div>
          <div className="text-2xl font-bold text-white">{summary.closedSignals}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <HugeiconsIcon icon={ChartHistogramIcon} className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-bold text-white">Win/Loss Ratio</h3>
          </div>
          {closedSignals.length > 0 ? (
            <WinRateChart signals={closedSignals} />
          ) : (
            <EmptyState>No closed signals yet.</EmptyState>
          )}
        </div>

        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <HugeiconsIcon icon={AnalyticsUpIcon} className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-bold text-white">PnL History</h3>
          </div>
          {hasPnlHistory ? (
            <PnLChart signals={signals} />
          ) : (
            <EmptyState>No closed-signal PnL history yet.</EmptyState>
          )}
        </div>

        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <HugeiconsIcon icon={Layers01Icon} className="w-5 h-5 text-cyan-500" />
            <h3 className="text-lg font-bold text-white">Lifecycle Breakdown</h3>
          </div>
          <SignalStatusChart signals={signals} />
        </div>

        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <HugeiconsIcon icon={ChartHistogramIcon} className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-bold text-white">Confidence vs Outcome</h3>
          </div>
          <ConfidenceOutcomeChart signals={signals} />
        </div>
      </div>
    </div>
  );
}
