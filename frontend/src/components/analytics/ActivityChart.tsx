import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Props {
  signals: any[];
}

export function ActivityChart({ signals }: Props) {
  const data = useMemo(() => {
    if (!signals || signals.length === 0) {
      // Generate mock data for last 14 days
      const mockData = [];
      const now = new Date();
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];

        // Random activity with some trend
        const base = 10;
        const random = Math.floor(Math.random() * 15);
        const trend = Math.sin(i / 2) * 5; // Slight wave

        mockData.push({
          date: dateStr,
          displayDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          count: Math.max(2, Math.floor(base + random + trend))
        });
      }
      return mockData;
    }

    // Group by date (YYYY-MM-DD)
    const counts: Record<string, number> = {};

    signals.forEach(s => {
      try {
        // Use created_at from the root object
        const timestamp = s.created_at;
        if (timestamp) {
          const date = new Date(timestamp).toISOString().split('T')[0];
          counts[date] = (counts[date] || 0) + 1;
        }
      } catch (e) {
        // ignore invalid dates
      }
    });

    // Convert to array and sort
    return Object.entries(counts)
      .map(([date, count]) => ({
        date,
        displayDate: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [signals]);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis
            dataKey="displayDate"
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            minTickGap={30}
          />
          <YAxis
            stroke="#9ca3af"
            tick={{ fill: '#9ca3af', fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#111827',
              border: '1px solid #374151',
              borderRadius: '8px'
            }}
            itemStyle={{ color: '#10b981' }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#10b981"
            fillOpacity={1}
            fill="url(#colorCount)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
