import type { TelemetryFrame } from '../types/telemetry';

/**
 * Maps telemetry frames to chart data points, inserting null points
 * wherever the gap between consecutive frames exceeds 6 seconds.
 * Recharts naturally breaks lines on null values, making gaps visible.
 */
export function mapWithGaps<T extends Record<string, any>>(
  frames: TelemetryFrame[],
  mapper: (f: TelemetryFrame) => T
): (T | Record<string, any>)[] {
  const result: any[] = [];
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    if (i > 0) {
      const gap = new Date(f.received_at).getTime() - new Date(frames[i - 1].received_at).getTime();
      if (gap > 6000) {
        // Insert null point to break the line
        const mappedPrev = mapper(frames[i - 1]);
        const nullPoint: Record<string, any> = { time: '' };
        Object.keys(mappedPrev).forEach(k => {
          if (k !== 'time') nullPoint[k] = null;
        });
        result.push(nullPoint);
      }
    }
    result.push(mapper(f));
  }
  return result;
}

export const timeFormatter = (tick: string | number) => {
  if (!tick) return '';
  const d = new Date(tick);
  return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export const commonTooltipStyle = {
  contentStyle: { backgroundColor: '#1a1d27', borderColor: '#2a2d3a', color: '#e4e4e7' },
  itemStyle: { color: '#e4e4e7' }
};

export const commonAxisProps = {
  stroke: "#71717a",
  tick: { fill: '#71717a' },
  tickFormatter: timeFormatter
};

export const commonGridProps = {
  stroke: "#2a2d3a"
};
