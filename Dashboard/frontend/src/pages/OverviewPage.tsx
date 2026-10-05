import { FlightTimeline } from '../components/FlightTimeline';
import { FlightMap } from '../components/FlightMap';
import { SensorHealthRow } from '../components/SensorHealthRow';
import { LinkQualityIndicator } from '../components/LinkQualityIndicator';
import { AltitudeChart } from '../components/AltitudeChart';
import { BatteryChart } from '../components/BatteryChart';
import { useTelemetry } from '../hooks/useTelemetry';

export function OverviewPage() {
  const { frames, gapDetected, lastGapSeconds } = useTelemetry();

  const recentFrames = [...frames].slice(-10).reverse();

  return (
    <div className="p-4 space-y-4 max-w-[1600px] mx-auto">
      {/* Gap warning */}
      {gapDetected && (
        <div className="bg-warning/20 border border-warning text-warning p-2.5 rounded-lg text-xs font-semibold text-center tracking-wide">
          ⚠ Telemetry gap detected: {lastGapSeconds}s without a frame (expected ~2s cadence). Link may be unstable.
        </div>
      )}

      {/* Mission timeline */}
      <FlightTimeline />

      {/* Sensor health + link quality */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SensorHealthRow />
        <LinkQualityIndicator />
      </div>

      {/* Headline charts + mini map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ minHeight: 480 }}>
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex-1 min-h-[220px]">
            <AltitudeChart />
          </div>
          <div className="flex-1 min-h-[220px]">
            <BatteryChart />
          </div>
        </div>
        <div className="lg:col-span-1 min-h-[300px] rounded-lg overflow-hidden border border-[#2a2d3a]">
          <FlightMap />
        </div>
      </div>

      {/* Recent frames strip */}
      <div className="bg-[#1e2130] rounded-lg border border-[#2a2d3a] overflow-hidden">
        <div className="p-2.5 border-b border-[#2a2d3a] bg-[#0f1117] text-xs text-muted font-bold uppercase tracking-wider">
          Recent Telemetry Frames (Last 10)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-muted bg-[#0f1117]">
              <tr>
                <th className="px-4 py-2 font-medium">Time</th>
                <th className="px-4 py-2 font-medium">Phase</th>
                <th className="px-4 py-2 font-medium text-right">Alt (m)</th>
                <th className="px-4 py-2 font-medium text-right">Spd (km/h)</th>
                <th className="px-4 py-2 font-medium text-right">Sats</th>
                <th className="px-4 py-2 font-medium text-right">Batt (V)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2d3a] font-tabular">
              {recentFrames.map((f, i) => (
                <tr key={f.id ?? i} className="hover:bg-[#2a2d3a]/50">
                  <td className="px-4 py-1.5 whitespace-nowrap font-mono">{new Date(f.received_at).toLocaleTimeString()}</td>
                  <td className="px-4 py-1.5 font-bold text-xs">{f.flight_phase.substring(0, 3)}</td>
                  <td className="px-4 py-1.5 text-right text-info font-mono">{f.bmp_altitude_m?.toFixed(1) ?? '-'}</td>
                  <td className="px-4 py-1.5 text-right font-mono">{f.gps_speed_kmh?.toFixed(1) ?? '-'}</td>
                  <td className="px-4 py-1.5 text-right font-mono">{f.gps_satellites}</td>
                  <td className="px-4 py-1.5 text-right text-success font-mono">{f.battery_voltage?.toFixed(2) ?? '-'}</td>
                </tr>
              ))}
              {recentFrames.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-4 text-center text-muted">No telemetry data recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
