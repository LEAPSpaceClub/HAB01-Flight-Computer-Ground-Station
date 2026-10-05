import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartCard } from './ChartCard';
import { useTelemetry } from '../hooks/useTelemetry';
import { mapWithGaps, timeFormatter, commonTooltipStyle, commonAxisProps, commonGridProps } from '../utils/chartUtils';
import { parseSensorHealth } from '../types/telemetry';

export function HumidityChart() {
  const { frames } = useTelemetry();

  const data = useMemo(() => {
    return mapWithGaps(frames, (f) => {
      const health = parseSensorHealth(f.sensor_health_hex);
      return {
        time: f.received_at,
        aht_humPct: (health.AHT10 && f.aht_humPct != null) ? f.aht_humPct : null,
      };
    });
  }, [frames]);

  return (
    <ChartCard title="Humidity (%)">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid {...commonGridProps} />
          <XAxis dataKey="time" {...commonAxisProps} />
          <YAxis stroke="#71717a" tick={{ fill: '#71717a' }} domain={[0, 100]} />
          <Tooltip {...commonTooltipStyle} labelFormatter={timeFormatter} />
          <Line type="monotone" dataKey="aht_humPct" name="Humidity" stroke="#0ea5e9" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
