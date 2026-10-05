import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartCard } from './ChartCard';
import { useTelemetry } from '../hooks/useTelemetry';
import { mapWithGaps, timeFormatter, commonTooltipStyle, commonAxisProps, commonGridProps } from '../utils/chartUtils';

export function UVChart() {
  const { frames } = useTelemetry();

  const data = useMemo(() => {
    return mapWithGaps(frames, (f) => ({
      time: f.received_at,
      uvIndex: f.uv_index,
    }));
  }, [frames]);

  return (
    <ChartCard title="UV Index">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid {...commonGridProps} />
          <XAxis dataKey="time" {...commonAxisProps} />
          <YAxis stroke="#71717a" tick={{ fill: '#71717a' }} domain={['auto', 'auto']} />
          <Tooltip {...commonTooltipStyle} labelFormatter={timeFormatter} />
          <Line type="monotone" dataKey="uvIndex" name="UV Index" stroke="#eab308" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
