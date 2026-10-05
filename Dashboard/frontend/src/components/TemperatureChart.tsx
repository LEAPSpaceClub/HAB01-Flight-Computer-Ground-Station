import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartCard } from './ChartCard';
import { useTelemetry } from '../hooks/useTelemetry';
import { mapWithGaps, timeFormatter, commonTooltipStyle, commonAxisProps, commonGridProps } from '../utils/chartUtils';
import { parseSensorHealth } from '../types/telemetry';

export function TemperatureChart() {
  const { frames } = useTelemetry();

  const data = useMemo(() => {
    return mapWithGaps(frames, (f) => {
      const health = parseSensorHealth(f.sensor_health_hex);
      return {
        time: f.received_at,
        aht_tempC: health.AHT10 ? f.aht_tempC : null,
        ds_in_tempC: health.DS18B20_IN ? f.ds_in_tempC : null,
        ds_out_tempC: health.DS18B20_OUT ? f.ds_out_tempC : null,
        dew_point_C: health.AHT10 ? f.dew_point_C : null,
      };
    });
  }, [frames]);

  return (
    <ChartCard title="Temperature (°C)">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid {...commonGridProps} />
          <XAxis dataKey="time" {...commonAxisProps} />
          <YAxis stroke="#71717a" tick={{ fill: '#71717a' }} domain={['auto', 'auto']} />
          <Tooltip {...commonTooltipStyle} labelFormatter={timeFormatter} />
          <Line type="monotone" dataKey="aht_tempC" name="AHT10" stroke="#f59e0b" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="ds_in_tempC" name="DS-In" stroke="#22c55e" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="ds_out_tempC" name="DS-Out" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="dew_point_C" name="Dew Point" stroke="#06b6d4" strokeWidth={1} strokeDasharray="5 5" dot={false} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
