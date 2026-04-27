import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { ChartSignal } from '../../types/ui-models';

interface Props {
  signals: ChartSignal[];
}

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#6b7280'];

export function WinRateChart({ signals }: Props) {
  const data = useMemo(() => {
    if (!signals || signals.length === 0) {
      return [
        { name: 'Wins', value: 65 },
        { name: 'Losses', value: 25 },
        { name: 'Pending', value: 10 },
      ];
    }

    const wins = signals.filter((s) => s.content.status === 'tp_hit').length;
    const losses = signals.filter((s) => s.content.status === 'sl_hit').length;
    const active = signals.filter((s) => s.content.status === 'active' || s.content.status === 'entry_hit').length;

    return [
      { name: 'Wins', value: wins },
      { name: 'Losses', value: losses },
      { name: 'Active', value: active },
    ].filter((d) => d.value > 0);
  }, [signals]);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: '#111827',
              border: '1px solid #374151',
              borderRadius: '8px'
            }}
          />
          <Legend verticalAlign="bottom" height={36} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
