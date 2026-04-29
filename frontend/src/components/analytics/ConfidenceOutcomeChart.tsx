import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ChartSignal } from '../../types/ui-models';
import {
  analyticsTooltipContentStyle,
  analyticsTooltipItemStyle,
  analyticsTooltipLabelStyle,
} from './chartTooltip';

interface Props {
  signals: ChartSignal[];
}

const BUCKETS = [
  { name: '90-100%', min: 90, max: 100 },
  { name: '80-89%', min: 80, max: 89.999 },
  { name: '70-79%', min: 70, max: 79.999 },
  { name: '60-69%', min: 60, max: 69.999 },
  { name: '<60%', min: 0, max: 59.999 },
];

const getConfidence = (signal: ChartSignal) => {
  if (typeof signal.content.confidence === 'number') {
    return signal.content.confidence;
  }

  if (typeof signal.content.confidence_score === 'number') {
    return signal.content.confidence_score * 100;
  }

  return null;
};

export function ConfidenceOutcomeChart({ signals }: Props) {
  const data = useMemo(
    () =>
      BUCKETS.map((bucket) => {
        const bucketSignals = signals.filter((signal) => {
          const confidence = getConfidence(signal);
          return (
            typeof confidence === 'number' &&
            confidence >= bucket.min &&
            confidence <= bucket.max
          );
        });

        return {
          name: bucket.name,
          Wins: bucketSignals.filter((signal) => signal.content.status === 'tp_hit').length,
          Losses: bucketSignals.filter((signal) => signal.content.status === 'sl_hit').length,
          Active: bucketSignals.filter(
            (signal) =>
              signal.content.status === 'active' || signal.content.status === 'pending',
          ).length,
        };
      }).filter((bucket) => bucket.Wins + bucket.Losses + bucket.Active > 0),
    [signals],
  );

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
          />
          <Tooltip
            cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
            contentStyle={analyticsTooltipContentStyle}
            labelStyle={analyticsTooltipLabelStyle}
            itemStyle={analyticsTooltipItemStyle}
          />
          <Legend />
          <Bar dataKey="Wins" stackId="outcome" fill="#10b981" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Losses" stackId="outcome" fill="#ef4444" />
          <Bar dataKey="Active" stackId="outcome" fill="#06b6d4" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
