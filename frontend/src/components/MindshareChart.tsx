import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface MindshareChartProps {
  data: any[];
}

export function MindshareChart({ data }: MindshareChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) {
      return [
        { label: '10:00', value: 45 },
        { label: '10:20', value: 52 },
        { label: '10:40', value: 48 },
        { label: '11:00', value: 61 },
        { label: '11:20', value: 55 },
        { label: '11:40', value: 67 },
        { label: '12:00', value: 72 },
      ];
    }

    return data.map((point, index) => ({
      label: point.time ?? point.topic ?? `Point ${index + 1}`,
      value: point.value ?? point.volume ?? 0,
    }));
  }, [data]);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
          <XAxis 
            dataKey="label" 
            stroke="#9ca3af" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
            minTickGap={20}
          />
          <YAxis 
            stroke="#9ca3af" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
            tickFormatter={(value) => `${value}`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: '#0f172a', 
              border: '1px solid #1e293b',
              borderRadius: '4px',
              fontSize: '12px'
            }}
            itemStyle={{ color: '#22d3ee' }}
          />
          <Area 
            type="monotone" 
            dataKey="value" 
            stroke="#06b6d4" 
            fillOpacity={1} 
            fill="url(#colorValue)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
