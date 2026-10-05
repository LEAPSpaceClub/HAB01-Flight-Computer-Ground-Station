import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';
import { ChartCard } from './ChartCard';
import { useTelemetry } from '../hooks/useTelemetry';
import { mapWithGaps, timeFormatter, commonTooltipStyle, commonAxisProps, commonGridProps } from '../utils/chartUtils';
import { parseSensorHealth } from '../types/telemetry';

export function AccelerationChart() {
  const { frames } = useTelemetry();

  const data = useMemo(() => {
    return mapWithGaps(frames, (f) => {
      const health = parseSensorHealth(f.sensor_health_hex);
      return {
        time: f.received_at,
        accel: (health.MPU6050 && f.accel_mag_g != null) ? f.accel_mag_g : null,
      };
    });
  }, [frames]);

  const peak = useMemo(() => {
    let maxAccel = -1;
    let maxTime: string | null = null;

    frames.forEach((f) => {
      const health = parseSensorHealth(f.sensor_health_hex);
      if (health.MPU6050 && f.accel_mag_g != null && f.accel_mag_g > maxAccel) {
        maxAccel = f.accel_mag_g;
        maxTime = f.received_at;
      }
    });

    if (maxTime && maxAccel > -1) {
      return { time: maxTime, value: maxAccel };
    }
    return null;
  }, [frames]);

  return (
    <ChartCard title="Acceleration Magnitude (g)">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid {...commonGridProps} />
          <XAxis dataKey="time" {...commonAxisProps} />
          <YAxis stroke="#71717a" tick={{ fill: '#71717a' }} domain={['auto', 'auto']} />
          <Tooltip {...commonTooltipStyle} labelFormatter={timeFormatter} />
          <ReferenceLine y={2.0} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'top', value: '> 2g shock', fill: '#ef4444', fontSize: 10 }} />
          {peak && (
            <ReferenceDot
              x={peak.time}
              y={peak.value}
              r={5}
              fill="#ef4444"
              stroke="#ffffff"
              strokeWidth={1}
              label={{ position: 'top', value: `Peak: ${peak.value.toFixed(2)}g`, fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }}
            />
          )}
          <Line type="monotone" dataKey="accel" name="Acceleration" stroke="#8b5cf6" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
