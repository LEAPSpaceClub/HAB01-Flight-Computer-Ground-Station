import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { ChartCard } from './ChartCard';
import { useTelemetry } from '../hooks/useTelemetry';
import { mapWithGaps, timeFormatter, commonTooltipStyle, commonAxisProps, commonGridProps } from '../utils/chartUtils';

export function AltitudeChart() {
  const { frames, latestFrame } = useTelemetry();

  const data = useMemo(() => {
    return mapWithGaps(frames, (f) => {
      const time = f.received_at;
      const bmpAlt = (f.bmp_ok && f.bmp_altitude_valid && !f.bmp_altitude_disabled) ? f.bmp_altitude_m : null;
      const gpsAlt = (f.gps_fix_valid && f.gps_has_altitude && !f.gps_stale) ? f.gps_alt_m : null;
      return { time, bmpAlt, gpsAlt };
    });
  }, [frames]);

  const maxAltitude = useMemo(() => {
    const frameMax = latestFrame?.max_altitude_m ?? 0;
    if (frameMax > 0) return frameMax;
    let max = 0;
    for (const f of frames) {
      if (f.bmp_ok && f.bmp_altitude_valid && f.bmp_altitude_m != null && f.bmp_altitude_m > max) {
        max = f.bmp_altitude_m;
      }
      if (f.gps_fix_valid && f.gps_alt_m != null && f.gps_alt_m > max) {
        max = f.gps_alt_m;
      }
    }
    return max;
  }, [frames, latestFrame]);

  return (
    <ChartCard title="Altitude (m)">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid {...commonGridProps} />
          <XAxis dataKey="time" {...commonAxisProps} />
          <YAxis stroke="#71717a" tick={{ fill: '#71717a' }} domain={['auto', 'auto']} />
          <Tooltip {...commonTooltipStyle} labelFormatter={timeFormatter} />
          {maxAltitude > 0 && (
            <ReferenceLine
              y={maxAltitude}
              stroke="#ef4444"
              strokeDasharray="3 3"
              label={{ position: 'top', value: `Max: ${maxAltitude.toFixed(1)}m`, fill: '#ef4444', fontSize: 10 }}
            />
          )}
          <Line type="monotone" dataKey="bmpAlt" name="BMP Alt" stroke="#06b6d4" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="gpsAlt" name="GPS Alt" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
