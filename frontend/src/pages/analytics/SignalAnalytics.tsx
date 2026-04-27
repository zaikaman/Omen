import { ActivityChart } from '../../components/analytics/ActivityChart';
import { SignalConfidenceChart } from '../../components/analytics/SignalConfidenceChart';
import { HugeiconsIcon } from '@hugeicons/react';
import { GpsSignal01Icon, ChartHistogramIcon } from '@hugeicons/core-free-icons';
import {
  toActivitySignals,
  toConfidenceSignals,
  useAnalyticsOutletContext,
} from '../AnalyticsPage';

export function SignalAnalytics() {
  const { latestSnapshot, snapshots, isLoading } = useAnalyticsOutletContext();
  const signals = toActivitySignals(
    snapshots,
    (snapshot) => snapshot.totals.publishedSignals,
  );
  const confidenceSignals = toConfidenceSignals(latestSnapshot);

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
        {/* Signal Activity */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="relative">
              <HugeiconsIcon icon={GpsSignal01Icon} className="w-5 h-5 text-emerald-500" />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            </div>
            <h3 className="text-lg font-bold text-white">Signal Activity</h3>
          </div>
          {signals.length > 0 ? (
            <ActivityChart signals={signals} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No signal activity in the analytics feed.
            </div>
          )}
        </div>

        {/* Confidence Distribution */}
        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <HugeiconsIcon icon={ChartHistogramIcon} className="w-5 h-5 text-cyan-500" />
            <h3 className="text-lg font-bold text-white">Confidence Distribution</h3>
          </div>
          {confidenceSignals.length > 0 ? (
            <SignalConfidenceChart signals={confidenceSignals} />
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No confidence-band data in the latest snapshot.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
