import { mockHistorySignals } from '../../data/mockData';
import { ActivityChart } from '../../components/analytics/ActivityChart';
import { SignalConfidenceChart } from '../../components/analytics/SignalConfidenceChart';
import { HugeiconsIcon } from '@hugeicons/react';
import { GpsSignal01Icon, ChartHistogramIcon } from '@hugeicons/core-free-icons';

export function SignalAnalytics() {
  const signals = mockHistorySignals;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Signal Activity */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="relative">
              <HugeiconsIcon icon={GpsSignal01Icon} className="w-5 h-5 text-emerald-500" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            </div>
            <h3 className="text-lg font-bold text-white">Signal Activity</h3>
          </div>
          <ActivityChart signals={signals} />
        </div>

        {/* Confidence Distribution */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
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
