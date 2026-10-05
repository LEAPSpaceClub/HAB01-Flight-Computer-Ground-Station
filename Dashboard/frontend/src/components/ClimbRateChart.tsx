import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ChartCard } from './ChartCard';
import { useTelemetry } from '../hooks/useTelemetry';
import { timeFormatter, commonTooltipStyle, commonAxisProps, commonGridProps } from '../utils/chartUtils';

export function ClimbRateChart() {
  const { frames } = useTelemetry();

  const data = useMemo(() => {
    const result: any[] = [];
    for (let i = 1; i < frames.length; i++) {
      const prev = frames[i - 1];
      const curr = frames[i];

      const gap = new Date(curr.received_at).getTime() - new Date(prev.received_at).getTime();

      if (gap > 6000) {
        result.push({ time: '', climbRate: null });
        continue;
      }

      if (
        prev.bmp_ok &&
        prev.bmp_altitude_valid &&
        curr.bmp_ok &&
        curr.bmp_altitude_valid &&
        prev.bmp_altitude_m != null &&
        curr.bmp_altitude_m != null
      ) {
        const dAlt = curr.bmp_altitude_m - prev.bmp_altitude_m;
        const dT = gap / 1000;
        if (dT > 0) {
          result.push({ time: curr.received_at, climbRate: dAlt / dT });
        }
      } else {
        result.push({ time: curr.received_at, climbRate: null });
      }
    }
    return result;
  }, [frames]);

  return (
    <ChartCard title="Climb Rate (m/s)">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid {...commonGridProps} />
          <XAxis dataKey="time" {...commonAxisProps} />
          <YAxis stroke="#71717a" tick={{ fill: '#71717a' }} domain={['auto', 'auto']} />
          <Tooltip {...commonTooltipStyle} labelFormatter={timeFormatter} />
          <ReferenceLine y={0} stroke="#71717a" />
          <Line type="monotone" dataKey="climbRate" name="Climb Rate" stroke="#10b981" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
