import { ActivityChart } from '../../components/analytics/ActivityChart';
import { ConfidenceOutcomeChart } from '../../components/analytics/ConfidenceOutcomeChart';
import { DirectionBreakdownChart } from '../../components/analytics/DirectionBreakdownChart';
import { SignalConfidenceChart } from '../../components/analytics/SignalConfidenceChart';
import { SignalStatusChart } from '../../components/analytics/SignalStatusChart';
import { HugeiconsIcon } from '@hugeicons/react';
import { AnalyticsUpIcon, ChartHistogramIcon, GpsSignal01Icon } from '@hugeicons/core-free-icons';
import { useAnalyticsOutletContext } from '../AnalyticsPage';

export function SignalAnalytics() {
  const { signals, isLoading } = useAnalyticsOutletContext();

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <HugeiconsIcon icon={ChartHistogramIcon} className="w-5 h-5 text-cyan-500" />
            <h3 className="text-lg font-bold text-white">Confidence Distribution</h3>
          </div>
          <SignalConfidenceChart signals={signals} />
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
            <h3 className="text-lg font-bold text-white">Lifecycle Breakdown</h3>
          </div>
          <SignalStatusChart signals={signals} />
        </div>

        <div className="bg-gray-900/30 border border-gray-800 rounded-xl p-6 lg:col-span-2">
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
