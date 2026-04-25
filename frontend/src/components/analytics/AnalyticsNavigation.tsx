import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../lib/utils';

export function AnalyticsNavigation() {
  const location = useLocation();
  const currentPath = location.pathname;

  const tabs = [
    { name: 'Overview', path: '/app/analytics' },
    { name: 'Performance', path: '/app/analytics/performance' },
    { name: 'Market', path: '/app/analytics/market' },
    { name: 'Signals', path: '/app/analytics/signals' },
  ];

  return (
    <div className="flex space-x-1 bg-gray-900/50 p-1 rounded-lg border border-gray-800 w-fit mb-6">
      {tabs.map((tab) => {
        const isActive = currentPath === tab.path || (tab.path === '/app/analytics' && currentPath === '/app/analytics/');
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              isActive
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                : "text-gray-400 hover:text-white hover:bg-gray-800"
            )}
          >
            {tab.name}
          </Link>
        );
      })}
    </div>
  );
}
