import { useTelemetry } from '../hooks/useTelemetry';
import { SENSOR_HEALTH_BITS } from '../types/telemetry';

export function SensorHealthRow() {
  const { sensorHealth } = useTelemetry();

  // Map the keys from parseSensorHealth to friendly labels for the 7 spec sensors:
  // BMP180, MPU6050, AHT10, DS-in, DS-out, BMP-altitude-trusted, GPS-fresh
  const sensors = Object.entries(SENSOR_HEALTH_BITS)
    .filter(([bit]) => Number(bit) <= 6)
    .map(([, info]) => ({
      key: info.name,
      label: info.label,
      ok: sensorHealth[info.name] ?? false,
    }));

  return (
    <div className="flex flex-wrap items-center gap-3 bg-[#1e2130] p-3 rounded-lg border border-[#2a2d3a]">
      <span className="text-xs text-text-muted font-bold uppercase tracking-wider">Sensors:</span>
      <div className="flex flex-wrap gap-3">
        {sensors.map(({ key, label, ok }) => (
          <div key={key} className="flex items-center gap-1.5" title={`${label}: ${ok ? 'OK' : 'FAIL'}`}>
            <div className={`w-2.5 h-2.5 rounded-full ${ok ? 'bg-success shadow-[0_0_6px_rgba(34,197,94,0.5)]' : 'bg-danger'}`} />
            <span className="text-xs text-text-primary font-medium">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
