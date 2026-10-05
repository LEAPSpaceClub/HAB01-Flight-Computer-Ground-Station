import { useFlights } from '../api/hooks';
import { useTelemetry } from '../hooks/useTelemetry';

export function FlightSelector() {
  const { data: flights } = useFlights();
  const { currentFlightId, setFlightId, clearFrames } = useTelemetry();

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted text-xs uppercase font-semibold">Flight:</span>
      <select
        className="bg-[#1e2130] border border-[#2a2d3a] rounded px-3 py-1.5 text-text-primary text-xs focus:outline-none focus:border-accent"
        value={currentFlightId ?? ''}
        onChange={(e) => {
          const val = e.target.value;
          clearFrames();
          if (val === '') {
            setFlightId(null);
          } else {
            setFlightId(parseInt(val, 10));
          }
        }}
      >
        <option value="">-- Live / Auto --</option>
        {flights?.map((f) => (
          <option key={f.id} value={f.id}>
            #{f.id} {f.name} ({new Date(f.started_at).toLocaleDateString()}) — {f.frame_count} frames
          </option>
        ))}
      </select>
    </div>
  );
}
