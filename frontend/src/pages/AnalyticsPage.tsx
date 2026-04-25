import { Outlet } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { ChartHistogramIcon } from '@hugeicons/core-free-icons';
import { AnalyticsNavigation } from '../components/analytics/AnalyticsNavigation';

export function AnalyticsPage() {
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
      </div>

      <AnalyticsNavigation />
      
      <Outlet />
    </div>
  );
}
