import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { ChartSignal } from '../../types/ui-models';
import {
  analyticsTooltipContentStyle,
  analyticsTooltipItemStyle,
  analyticsTooltipLabelStyle,
} from './chartTooltip';

interface Props {
  signals: ChartSignal[];
}

const COLORS = ['#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63'];

export function TokenFrequencyChart({ signals }: Props) {
  const data = useMemo(() => {
    if (!signals || signals.length === 0) {
      return [];
    }

    const counts: Record<string, number> = {};
    signals.forEach((s) => {
      const asset = s.content.trade_setup?.asset || s.content.asset;
      if (asset) {
        counts[asset] = (counts[asset] || 0) + 1;
      }
    });

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [signals]);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <XAxis
            dataKey="name"
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
            contentStyle={analyticsTooltipContentStyle}
            labelStyle={analyticsTooltipLabelStyle}
            itemStyle={analyticsTooltipItemStyle}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
