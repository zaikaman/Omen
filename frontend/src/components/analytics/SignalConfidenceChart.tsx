import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface Props {
  signals: any[];
}

export function SignalConfidenceChart({ signals }: Props) {
  const data = useMemo(() => {
    if (!signals || signals.length === 0) {
      return [
        { name: '90-100%', count: 12, color: '#10b981' },
        { name: '80-89%', count: 25, color: '#06b6d4' },
        { name: '70-79%', count: 18, color: '#8b5cf6' },
        { name: '60-69%', count: 8, color: '#f59e0b' },
        { name: '<60%', count: 4, color: '#ef4444' },
      ];
    }

    const groups = [
      { name: '90-100%', min: 0.9, max: 1.0, count: 0, color: '#10b981' },
      { name: '80-89%', min: 0.8, max: 0.899, count: 0, color: '#06b6d4' },
      { name: '70-79%', min: 0.7, max: 0.799, count: 0, color: '#8b5cf6' },
      { name: '60-69%', min: 0.6, max: 0.699, count: 0, color: '#f59e0b' },
      { name: '<60%', min: 0, max: 0.599, count: 0, color: '#ef4444' },
    ];

    signals.forEach(s => {
      const conf = s.content.confidence_score || 0;
      const group = groups.find(g => conf >= g.min && conf <= g.max);
      if (group) group.count++;
    });

    return groups;
  }, [signals]);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
          <XAxis type="number" hide />
          <YAxis
            dataKey="name"
            type="category"
            stroke="#9ca3af"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <Tooltip
            cursor={{ fill: 'transparent' }}
            contentStyle={{
              backgroundColor: '#111827',
              border: '1px solid #374151',
              borderRadius: '8px'
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={20}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
