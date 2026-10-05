import { useTelemetry } from '../hooks/useTelemetry';

const phaseColors: Record<string, string> = {
  PRELAUNCH: 'bg-slate-600',
  ASCENT: 'bg-green-500',
  NEAR_APOGEE: 'bg-amber-500',
  DESCENT: 'bg-blue-500',
  LANDED: 'bg-red-500',
};

export function StatusHeader() {
  const {
    latestFrame,
    isConnected,
    isLive,
    isStale,
    gapDetected,
    lastGapSeconds,
    sensorHealth,
    linkQuality,
  } = useTelemetry();

  const phase = latestFrame?.flight_phase ?? 'UNKNOWN';
  const phaseColor = phaseColors[phase] ?? 'bg-slate-600';

  return (
    <header className="sticky top-0 z-50 bg-[#1a1d27] border-b border-[#2a2d3a] p-3 flex flex-wrap items-center gap-4 text-sm font-tabular shrink-0">
      {/* WS connection indicator */}
      <div className="flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-success shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-danger'}`} />
        <span className="font-semibold text-xs">WS</span>
      </div>

      {/* Live / History badge */}
      <span className={`px-2 py-0.5 rounded text-xs font-bold tracking-wider ${isLive ? 'bg-danger text-white' : 'bg-accent text-white'}`}>
        {isLive ? 'LIVE' : 'HISTORY'}
      </span>

      {latestFrame ? (
        <>
          {/* Phase badge */}
          <div className={`px-2.5 py-1 rounded text-white font-bold text-xs shadow-sm ${phaseColor}`}>
            {phase}
          </div>

          {/* Last frame time + stale/gap indicators */}
          <div className={`flex items-center gap-2 px-3 border-l border-r border-[#2a2d3a] ${isStale ? 'text-warning font-bold' : 'text-[#a1a1aa]'}`}>
            <span>Last: {new Date(latestFrame.received_at).toLocaleTimeString()}</span>
            {isStale && <span className="bg-warning/20 border border-warning px-1.5 py-0.5 rounded text-[10px] text-warning">STALE</span>}
          </div>

          {gapDetected && lastGapSeconds && (
            <span className="text-warning font-bold bg-warning/10 border border-warning/60 px-2 py-0.5 rounded text-xs">
              ⚠ GAP: {lastGapSeconds}s
            </span>
          )}

          {/* Per-sensor health indicators (7 sensors) */}
          <div className="flex items-center gap-2 px-3 border-l border-[#2a2d3a]">
            {Object.entries(sensorHealth).map(([name, isOk]) => (
              <div key={name} title={`${name}: ${isOk ? 'OK' : 'FAIL'}`} className="flex items-center gap-1">
                <div className={`w-2.5 h-2.5 rounded-sm ${isOk ? 'bg-success shadow-[0_0_4px_rgba(34,197,94,0.5)]' : 'bg-danger'}`} />
                <span className="text-[10px] text-text-muted font-medium">{name.replace('DS18B20_', 'DS-').replace('BMP_ALT', 'ALT')}</span>
              </div>
            ))}
          </div>

          {/* Link quality ratio + trend */}
          <div className="flex items-center gap-2 px-3 border-l border-[#2a2d3a]">
            <span className="text-[10px] text-text-muted font-bold uppercase">RX:</span>
            <span className="text-success text-xs font-semibold">{linkQuality.ok}</span>
            <span className="text-[10px] text-text-muted">/</span>
            <span className="text-danger text-xs font-semibold">{linkQuality.bad}</span>
            <span className={`text-xs font-bold ${linkQuality.ratio >= 0.95 ? 'text-success' : linkQuality.ratio >= 0.90 ? 'text-warning' : 'text-danger'}`}>
              ({(linkQuality.ratio * 100).toFixed(1)}%)
            </span>
          </div>

          {/* Quick stats */}
          <div className="flex gap-4 ml-auto border-l border-[#2a2d3a] pl-4">
            <div>
              <span className="text-muted text-xs mr-1">ALT</span>
              <span className="text-info font-bold font-mono">{latestFrame.bmp_altitude_m?.toFixed(0) ?? '---'} m</span>
            </div>
            <div>
              <span className="text-muted text-xs mr-1">SPD</span>
              <span className="font-bold font-mono">{latestFrame.gps_speed_kmh?.toFixed(0) ?? '---'} km/h</span>
            </div>
            <div>
              <span className="text-muted text-xs mr-1">SAT</span>
              <span className="font-bold font-mono">{latestFrame.gps_satellites}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="ml-4 text-muted text-xs">Waiting for telemetry frames...</div>
      )}
    </header>
  );
}
