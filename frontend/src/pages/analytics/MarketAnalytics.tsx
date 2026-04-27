import { MindshareChart } from '../../components/MindshareChart';
import { TokenFrequencyChart } from '../../components/analytics/TokenFrequencyChart';
import { HugeiconsIcon } from '@hugeicons/react';
import { ChartHistogramIcon, News01Icon } from '@hugeicons/core-free-icons';
import {
  toMindsharePoints,
  toTokenFrequencySignals,
  useAnalyticsOutletContext,
} from '../AnalyticsPage';

export function MarketAnalytics() {
  const { latestSnapshot, isLoading } = useAnalyticsOutletContext();
  const mindshare = toMindsharePoints(latestSnapshot);
  const tokenSignals = toTokenFrequencySignals(latestSnapshot);

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mindshare Chart */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <HugeiconsIcon icon={ChartHistogramIcon} className="w-5 h-5 text-cyan-500" />
            <h3 className="text-lg font-bold text-white">Mindshare Velocity</h3>
          </div>

          {mindshare.length > 0 ? (
            <MindshareChart data={mindshare} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No mindshare data in the latest snapshot.
            </div>
          )}
        </div>

        {/* Top Tokens */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <HugeiconsIcon icon={News01Icon} className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-bold text-white">Top Tokens by Frequency</h3>
          </div>
          {tokenSignals.length > 0 ? (
            <TokenFrequencyChart signals={tokenSignals} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No token-frequency data in the latest snapshot.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
