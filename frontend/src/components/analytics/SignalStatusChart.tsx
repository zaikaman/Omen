import { useMemo } from 'react';
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { ChartSignal } from '../../types/ui-models';

interface Props {
  signals: ChartSignal[];
}

const COLORS: Record<string, string> = {
  Active: '#10b981',
  Pending: '#f59e0b',
  Wins: '#06b6d4',
  Losses: '#ef4444',
  Closed: '#8b5cf6',
};

export function SignalStatusChart({ signals }: Props) {
  const data = useMemo(() => {
    const counts = {
      Active: signals.filter((signal) => signal.content.status === 'active').length,
      Pending: signals.filter((signal) => signal.content.status === 'pending').length,
      Wins: signals.filter((signal) => signal.content.status === 'tp_hit').length,
      Losses: signals.filter((signal) => signal.content.status === 'sl_hit').length,
      Closed: signals.filter((signal) => signal.content.status === 'closed').length,
    };

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .filter((item) => item.value > 0);
  }, [signals]);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={58}
            outerRadius={82}
            paddingAngle={4}
            dataKey="value"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={COLORS[entry.name] ?? '#6b7280'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#111827',
              border: '1px solid #374151',
              borderRadius: '8px',
            }}
          />
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
