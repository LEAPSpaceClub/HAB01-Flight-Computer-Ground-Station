import { useTelemetry } from '../hooks/useTelemetry';
import { parseSensorHealth } from '../types/telemetry';

export function DataTable() {
  const { frames } = useTelemetry();
  const recent = [...frames].reverse();

  return (
    <div className="bg-[#1e2130] border border-[#2a2d3a] rounded-lg overflow-hidden flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="sticky top-0 bg-[#1e2130] text-muted border-b border-[#2a2d3a] z-10">
            <tr>
              <th className="p-2 pl-4 font-semibold">Time</th>
              <th className="p-2 font-semibold">Phase</th>
              <th className="p-2 text-right font-semibold">Alt (m)</th>
              <th className="p-2 text-right font-semibold">Lat</th>
              <th className="p-2 text-right font-semibold">Lon</th>
              <th className="p-2 text-right font-semibold">Spd (km/h)</th>
              <th className="p-2 text-right font-semibold">Temp (°C)</th>
              <th className="p-2 text-right font-semibold">Press (hPa)</th>
              <th className="p-2 text-right font-semibold">Batt (V)</th>
              <th className="p-2 text-right font-semibold">Accel (g)</th>
              <th className="p-2 text-right font-semibold">Hum (%)</th>
              <th className="p-2 pr-4 font-semibold">Sensors (7)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2a2d3a] font-tabular">
            {recent.map((f, i) => {
              const health = parseSensorHealth(f.sensor_health_hex);
              const altValid = f.bmp_ok && f.bmp_altitude_valid;
              const gpsValid = f.gps_fix_valid && f.gps_lat != null && f.gps_lon != null;

              return (
                <tr key={f.id ?? i} className="hover:bg-[#2a2d3a]/50 transition-colors">
                  <td className="p-2 pl-4 text-[#a1a1aa] whitespace-nowrap font-mono">
                    {new Date(f.received_at).toLocaleTimeString()}
                  </td>
                  <td className="p-2 font-bold text-xs">{f.flight_phase.substring(0, 3)}</td>
                  <td className="p-2 text-right text-info font-mono">
                    {altValid && f.bmp_altitude_m != null ? f.bmp_altitude_m.toFixed(1) : '-'}
                  </td>
                  <td className="p-2 text-right font-mono">
                    {gpsValid ? f.gps_lat!.toFixed(4) : '-'}
                  </td>
                  <td className="p-2 text-right font-mono">
                    {gpsValid ? f.gps_lon!.toFixed(4) : '-'}
                  </td>
                  <td className="p-2 text-right font-mono">
                    {f.gps_fix_valid && f.gps_speed_kmh != null ? f.gps_speed_kmh.toFixed(1) : '-'}
                  </td>
                  <td className="p-2 text-right font-mono">
                    {health.DS18B20_OUT && f.ds_out_tempC != null ? f.ds_out_tempC.toFixed(1) : '-'}
                  </td>
                  <td className="p-2 text-right font-mono">
                    {f.bmp_ok && f.bmp_pressPa != null ? (f.bmp_pressPa / 100).toFixed(1) : '-'}
                  </td>
                  <td className="p-2 text-right text-success font-mono">
                    {f.battery_voltage != null ? f.battery_voltage.toFixed(2) : '-'}
                  </td>
                  <td className="p-2 text-right font-mono">
                    {health.MPU6050 && f.accel_mag_g != null ? f.accel_mag_g.toFixed(2) : '-'}
                  </td>
                  <td className="p-2 text-right font-mono">
                    {health.AHT10 && f.aht_humPct != null ? f.aht_humPct.toFixed(1) : '-'}
                  </td>
                  <td className="p-2 pr-4">
                    <div className="flex gap-1" title={f.sensor_health_hex}>
                      {['BMP180', 'MPU6050', 'AHT10', 'DS18B20_IN', 'DS18B20_OUT', 'BMP_ALT', 'GPS'].map((name) => {
                        const isOk = health[name] ?? false;
                        return (
                          <div
                            key={name}
                            title={`${name}: ${isOk ? 'OK' : 'FAIL'}`}
                            className={`w-2 h-2 rounded-sm ${isOk ? 'bg-success' : 'bg-danger'}`}
                          />
                        );
                      })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {recent.length === 0 && (
          <div className="p-8 text-center text-muted">No telemetry frames recorded yet.</div>
        )}
      </div>
    </div>
  );
}
