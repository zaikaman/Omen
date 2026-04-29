import { AssetPerformanceTable } from '../../components/analytics/AssetPerformanceTable';
import { DirectionBreakdownChart } from '../../components/analytics/DirectionBreakdownChart';
import { SignalConfidenceChart } from '../../components/analytics/SignalConfidenceChart';
import { TokenFrequencyChart } from '../../components/analytics/TokenFrequencyChart';
import { HugeiconsIcon } from '@hugeicons/react';
import { AnalyticsUpIcon, ChartHistogramIcon, News01Icon } from '@hugeicons/core-free-icons';
import { useAnalyticsOutletContext } from '../AnalyticsPage';

export function MarketAnalytics() {
  const { signals, summary, isLoading } = useAnalyticsOutletContext();

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Top Asset</div>
          <div className="text-2xl font-bold text-white">{summary.mostFrequentAsset ?? 'N/A'}</div>
        </div>
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Long Signals</div>
          <div className="text-2xl font-bold text-emerald-400">{summary.longSignals}</div>
        </div>
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-4">
          <div className="text-gray-400 text-sm mb-1">Short Signals</div>
          <div className="text-2xl font-bold text-red-400">{summary.shortSignals}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <HugeiconsIcon icon={News01Icon} className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-bold text-white">Top Signal Assets</h3>
          </div>
          <TokenFrequencyChart signals={signals} />
        </div>

        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <HugeiconsIcon icon={AnalyticsUpIcon} className="w-5 h-5 text-cyan-500" />
            <h3 className="text-lg font-bold text-white">Direction Mix</h3>
          </div>
          <DirectionBreakdownChart signals={signals} />
        </div>

        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <HugeiconsIcon icon={ChartHistogramIcon} className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-bold text-white">Asset Performance</h3>
          </div>
          <AssetPerformanceTable signals={signals} />
        </div>

        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <HugeiconsIcon icon={ChartHistogramIcon} className="w-5 h-5 text-cyan-500" />
            <h3 className="text-lg font-bold text-white">Confidence Distribution</h3>
          </div>
          <SignalConfidenceChart signals={signals} />
        </div>
      </div>
    </div>
  );
}
