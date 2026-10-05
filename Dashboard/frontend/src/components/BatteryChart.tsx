import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ChartCard } from './ChartCard';
import { useTelemetry } from '../hooks/useTelemetry';
import { mapWithGaps, timeFormatter, commonTooltipStyle, commonAxisProps, commonGridProps } from '../utils/chartUtils';

export function BatteryChart() {
  const { frames } = useTelemetry();

  const data = useMemo(() => {
    return mapWithGaps(frames, (f) => ({
      time: f.received_at,
      battery: f.battery_voltage,
    }));
  }, [frames]);

  return (
    <ChartCard title="Battery Voltage (V)">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid {...commonGridProps} />
          <XAxis dataKey="time" {...commonAxisProps} />
          <YAxis stroke="#71717a" tick={{ fill: '#71717a' }} domain={['auto', 'auto']} />
          <Tooltip {...commonTooltipStyle} labelFormatter={timeFormatter} />
          <ReferenceLine y={3.3} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: 'LOW BATTERY (3.3V)', fill: '#ef4444', fontSize: 10 }} />
          <Line type="monotone" dataKey="battery" name="Battery" stroke="#22c55e" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
