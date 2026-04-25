import { mockRunStatus, mockHistorySignals } from '../../data/mockData';
import { MindshareChart } from '../../components/MindshareChart';
import { TokenFrequencyChart } from '../../components/analytics/TokenFrequencyChart';
import { HugeiconsIcon } from '@hugeicons/react';
import { ChartHistogramIcon, News01Icon } from '@hugeicons/core-free-icons';

export function MarketAnalytics() {
  const runStatus = mockRunStatus;
  const signals = mockHistorySignals;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mindshare Chart */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <HugeiconsIcon icon={ChartHistogramIcon} className="w-5 h-5 text-cyan-500" />
            <h3 className="text-lg font-bold text-white">Mindshare Velocity</h3>
          </div>

          <MindshareChart data={runStatus?.mindshare} />
        </div>

        {/* Top Tokens */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <HugeiconsIcon icon={News01Icon} className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-bold text-white">Top Tokens by Frequency</h3>
          </div>
          <TokenFrequencyChart signals={signals} />
        </div>
      </div>
    </div>
  );
}
