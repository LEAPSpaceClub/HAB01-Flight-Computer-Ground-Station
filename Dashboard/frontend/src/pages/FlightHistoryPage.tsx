import { FlightSelector } from '../components/FlightSelector';
import { FlightTimeline } from '../components/FlightTimeline';
import { FlightMap } from '../components/FlightMap';
import { useTelemetry } from '../hooks/useTelemetry';
import { fetchJson } from '../api/client';

export function FlightHistoryPage() {
  const { currentFlightId, setFlightId, isLive, frames, latestFrame } = useTelemetry();

  const handleStartNewFlight = async () => {
    try {
      const dateStr = new Date().toLocaleString();
      await fetchJson('/flights', {
        method: 'POST',
        body: JSON.stringify({ name: `Flight - ${dateStr}` }),
      });
      setFlightId(null); // switch back to live
    } catch (err) {
      console.error('Failed to start new flight', err);
    }
  };

  // Compute max altitude from frames using valid bmp altitude or gps altitude
  const maxAlt = latestFrame?.max_altitude_m ?? Math.max(0, ...frames.map(f => (f.bmp_ok && f.bmp_altitude_valid ? (f.bmp_altitude_m ?? 0) : 0)));

  return (
    <div className="p-4 max-w-[1200px] mx-auto space-y-6">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#1e2130] p-4 rounded-lg border border-[#2a2d3a]">
        <div>
          <h1 className="text-lg font-bold text-text-primary mb-2">Flight Data Management</h1>
          <FlightSelector />
        </div>
        <div className="flex gap-2">
          {!isLive && (
            <button
              onClick={() => setFlightId(null)}
              className="px-4 py-2 bg-[#2a2d3a] hover:bg-[#3a3d4a] text-text-primary rounded text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Back to Live
            </button>
          )}
          {currentFlightId && (
            <a
              href={`/api/flights/${currentFlightId}/export`}
              download
              className="px-4 py-2 bg-info hover:bg-info/80 text-white rounded text-xs font-semibold uppercase tracking-wider transition-colors inline-block cursor-pointer"
            >
              Export CSV
            </a>
          )}
          <button
            onClick={handleStartNewFlight}
            className="px-4 py-2 bg-accent hover:bg-accent/80 text-white rounded text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Start New Flight
          </button>
        </div>
      </div>

      {/* Historical flight details */}
      {!isLive && currentFlightId && (
        <div className="space-y-6">
          <div className="bg-[#1e2130] p-4 rounded-lg border border-[#2a2d3a]">
            <h2 className="text-sm font-bold text-text-primary mb-4 uppercase tracking-wider">Flight Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-[#0f1117] p-3 rounded border border-[#2a2d3a]">
                <div className="text-muted text-xs uppercase font-semibold">Total Frames</div>
                <div className="text-xl font-bold text-text-primary font-tabular mt-1">{frames.length}</div>
              </div>
              <div className="bg-[#0f1117] p-3 rounded border border-[#2a2d3a]">
                <div className="text-muted text-xs uppercase font-semibold">Max Altitude</div>
                <div className="text-xl font-bold text-info font-tabular mt-1">{maxAlt.toFixed(1)} m</div>
              </div>
              <div className="bg-[#0f1117] p-3 rounded border border-[#2a2d3a]">
                <div className="text-muted text-xs uppercase font-semibold">Last Phase</div>
                <div className="text-xl font-bold text-accent font-tabular mt-1">{latestFrame?.flight_phase ?? '-'}</div>
              </div>
              <div className="bg-[#0f1117] p-3 rounded border border-[#2a2d3a]">
                <div className="text-muted text-xs uppercase font-semibold">Duration</div>
                <div className="text-xl font-bold text-text-primary font-tabular mt-1">
                  {frames.length >= 2
                    ? `${Math.round((new Date(frames[frames.length - 1].received_at).getTime() - new Date(frames[0].received_at).getTime()) / 60000)} min`
                    : '-'}
                </div>
              </div>
            </div>
            <FlightTimeline />
          </div>

          <div className="h-[420px] rounded-lg overflow-hidden border border-[#2a2d3a]">
            <FlightMap />
          </div>
        </div>
      )}

      {/* Live mode placeholder */}
      {isLive && (
        <div className="text-center p-12 text-muted bg-[#1e2130] rounded-lg border border-[#2a2d3a]">
          <div className="text-sm font-semibold mb-1">Currently in Live Mode</div>
          <div className="text-xs text-text-muted">Select a past flight from the dropdown above to inspect historical data, or click Export CSV when reviewing a recorded flight.</div>
        </div>
      )}
    </div>
  );
}
