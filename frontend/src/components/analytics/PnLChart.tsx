import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import type { ChartSignal } from '../../types/ui-models';
import {
  analyticsTooltipContentStyle,
  analyticsTooltipItemStyle,
  analyticsTooltipLabelStyle,
} from './chartTooltip';

interface Props {
  signals: ChartSignal[];
}

type PnLPoint = {
  name: number;
  pnl: number;
  date: string;
};

export function PnLChart({ signals }: Props) {
  // Process signals to get cumulative PnL
  const data = signals
    .filter((s) => s.content.status === 'tp_hit' || s.content.status === 'sl_hit')
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .reduce<PnLPoint[]>((acc, s, i) => {
      const prevPnL = i > 0 ? acc[i - 1].pnl : 0;
      const currentPnL = s.content.pnl_percent ?? 0;
      acc.push({
        name: i + 1,
        pnl: Number((prevPnL + currentPnL).toFixed(2)),
        date: new Date(s.created_at).toLocaleDateString()
      });
      return acc;
    }, []);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
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
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            contentStyle={analyticsTooltipContentStyle}
            labelStyle={analyticsTooltipLabelStyle}
            itemStyle={analyticsTooltipItemStyle}
          />
          <Line
            type="monotone"
            dataKey="pnl"
            stroke="#8b5cf6"
            strokeWidth={3}
            dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4, stroke: '#111827' }}
            activeDot={{ r: 6, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
