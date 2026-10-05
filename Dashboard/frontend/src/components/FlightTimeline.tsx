import { useTelemetry } from '../hooks/useTelemetry';
import type { FlightPhase } from '../types/telemetry';

const PHASES: FlightPhase[] = ['PRELAUNCH', 'ASCENT', 'NEAR_APOGEE', 'DESCENT', 'LANDED'];

export function FlightTimeline() {
  const { latestFrame, phaseTimes } = useTelemetry();
  const currentPhase = latestFrame?.flight_phase ?? 'PRELAUNCH';
  const currentIndex = PHASES.indexOf(currentPhase);

  return (
    <div className="bg-[#1e2130] border border-[#2a2d3a] rounded-lg p-4">
      <h3 className="text-xs font-semibold text-muted uppercase tracking-wider mb-4">Mission Timeline</h3>
      <div className="relative flex justify-between items-start w-full mt-2">
        {/* Background track */}
        <div className="absolute top-2 left-0 w-full h-[2px] bg-[#2a2d3a] -z-10" />
        {/* Progress track */}
        <div
          className="absolute top-2 left-0 h-[2px] bg-accent -z-10 transition-all duration-300"
          style={{ width: `${(Math.max(0, currentIndex) / (PHASES.length - 1)) * 100}%` }}
        />

        {PHASES.map((phase, i) => {
          const isReached = i <= currentIndex;
          const isCurrent = i === currentIndex;
          const time = phaseTimes[phase];

          return (
            <div key={phase} className="flex flex-col items-center flex-1">
              <div
                className={`w-4 h-4 rounded-full mb-2 ${
                  isCurrent
                    ? 'bg-accent shadow-[0_0_10px_rgba(59,130,246,0.6)]'
                    : isReached
                      ? 'bg-success'
                      : 'bg-[#2a2d3a]'
                }`}
              />
              <div className={`text-[10px] font-bold text-center uppercase tracking-wider ${isReached ? 'text-text-primary' : 'text-muted'}`}>
                {phase.replace('_', ' ')}
              </div>
              <div className="text-[10px] text-muted font-tabular mt-1 h-3">
                {time ?? ''}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
