import { ActivityChart } from '../../components/analytics/ActivityChart';
import { AssetPerformanceTable } from '../../components/analytics/AssetPerformanceTable';
import { DirectionBreakdownChart } from '../../components/analytics/DirectionBreakdownChart';
import { SignalStatusChart } from '../../components/analytics/SignalStatusChart';
import { HugeiconsIcon } from '@hugeicons/react';
import { AnalyticsUpIcon, ChartHistogramIcon, GpsSignal01Icon } from '@hugeicons/core-free-icons';
import { useAnalyticsOutletContext } from '../AnalyticsPage';

type SummaryCardProps = {
  label: string;
  value: string;
  tone?: 'default' | 'good' | 'bad' | 'info';
};

const toneClassName: Record<NonNullable<SummaryCardProps['tone']>, string> = {
  default: 'text-white',
  good: 'text-emerald-400',
  bad: 'text-red-400',
  info: 'text-cyan-400',
};

function SummaryCard({ label, value, tone = 'default' }: SummaryCardProps) {
  return (
    <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
      <div className="text-gray-400 text-sm mb-1">{label}</div>
      <div className={`text-2xl font-bold ${toneClassName[tone]}`}>{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6 text-gray-400">
      No signals match the selected timeframe.
    </div>
  );
}

export function AnalyticsOverview() {
  const { signals, summary, isLoading } = useAnalyticsOutletContext();

  if (isLoading && signals.length === 0) {
    return (
      <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6 text-gray-400">
        Loading signal analytics...
      </div>
    );
  }

  if (signals.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard label="Signals" value={summary.totalSignals.toString()} />
        <SummaryCard label="Active" value={summary.activeSignals.toString()} tone="info" />
        <SummaryCard
          label="Win Rate"
          value={summary.winRate === null ? 'N/A' : `${summary.winRate.toFixed(1)}%`}
          tone="good"
        />
        <SummaryCard
          label="Total PnL"
          value={`${summary.totalPnlPercent > 0 ? '+' : ''}${summary.totalPnlPercent.toFixed(2)}%`}
          tone={summary.totalPnlPercent >= 0 ? 'good' : 'bad'}
        />
        <SummaryCard
          label="Avg Confidence"
          value={
            summary.averageConfidence === null
              ? 'N/A'
              : `${summary.averageConfidence.toFixed(1)}%`
          }
          tone="info"
        />
        <SummaryCard
          label="Closed"
          value={`${summary.closedSignals} (${summary.winningSignals}/${summary.losingSignals})`}
        />
        <SummaryCard label="Top Asset" value={summary.mostFrequentAsset ?? 'N/A'} />
        <SummaryCard
          label="Long / Short"
          value={`${summary.longSignals} / ${summary.shortSignals}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <HugeiconsIcon icon={GpsSignal01Icon} className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-bold text-white">Signal Activity</h3>
          </div>
          <ActivityChart signals={signals} />
        </div>

        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <HugeiconsIcon icon={ChartHistogramIcon} className="w-5 h-5 text-cyan-500" />
            <h3 className="text-lg font-bold text-white">Signal Lifecycle</h3>
          </div>
          <SignalStatusChart signals={signals} />
        </div>

        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <HugeiconsIcon icon={AnalyticsUpIcon} className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-bold text-white">Direction Mix</h3>
          </div>
          <DirectionBreakdownChart signals={signals} />
        </div>

        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <HugeiconsIcon icon={ChartHistogramIcon} className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-bold text-white">Asset Performance</h3>
          </div>
          <AssetPerformanceTable signals={signals} />
        </div>
      </div>
    </div>
  );
}
