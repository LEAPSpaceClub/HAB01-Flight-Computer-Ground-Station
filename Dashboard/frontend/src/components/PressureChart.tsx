import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartCard } from './ChartCard';
import { useTelemetry } from '../hooks/useTelemetry';
import { mapWithGaps, timeFormatter, commonTooltipStyle, commonAxisProps, commonGridProps } from '../utils/chartUtils';
import { parseSensorHealth } from '../types/telemetry';

export function PressureChart() {
  const { frames } = useTelemetry();

  const data = useMemo(() => {
    return mapWithGaps(frames, (f) => {
      const health = parseSensorHealth(f.sensor_health_hex);
      return {
        time: f.received_at,
        pressure: (f.bmp_ok && health.BMP180 && f.bmp_pressPa != null) ? f.bmp_pressPa / 100 : null,
      };
    });
  }, [frames]);

  return (
    <ChartCard title="Pressure (hPa)">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid {...commonGridProps} />
          <XAxis dataKey="time" {...commonAxisProps} />
          <YAxis stroke="#71717a" tick={{ fill: '#71717a' }} domain={['auto', 'auto']} />
          <Tooltip {...commonTooltipStyle} labelFormatter={timeFormatter} />
          <Line type="monotone" dataKey="pressure" name="Pressure" stroke="#a855f7" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
