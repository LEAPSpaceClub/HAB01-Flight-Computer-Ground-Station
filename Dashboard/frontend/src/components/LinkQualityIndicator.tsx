import { useTelemetry } from '../hooks/useTelemetry';

export function LinkQualityIndicator() {
  const { linkQuality } = useTelemetry();
  const { ok, bad, ratio, trend, recentErrors } = linkQuality;
  const pct = ratio * 100;

  let colorClass = 'text-success';
  let badgeClass = 'bg-success/20 text-success border-success/40';
  let trendLabel = 'NOMINAL';

  if (trend === 'critical' || pct < 90) {
    colorClass = 'text-danger';
    badgeClass = 'bg-danger/20 text-danger border-danger/40';
    trendLabel = 'CRITICAL';
  } else if (trend === 'degrading' || pct < 95) {
    colorClass = 'text-warning';
    badgeClass = 'bg-warning/20 text-warning border-warning/40';
    trendLabel = 'DEGRADING';
  } else if (trend === 'stable') {
    trendLabel = 'STABLE';
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-[#1e2130] p-3 rounded-lg border border-[#2a2d3a]">
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-muted font-bold uppercase tracking-wider">Link:</span>
        <div className="flex items-center gap-2 font-tabular text-xs">
          <span className="text-success font-semibold">{ok} OK</span>
          <span className="text-text-muted">/</span>
          <span className="text-danger font-semibold">{bad} BAD</span>
          <span className={`font-bold ${colorClass}`}>({pct.toFixed(1)}%)</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {recentErrors > 0 && (
          <span className="text-[10px] text-warning font-mono">+{recentErrors} err/window</span>
        )}
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${badgeClass}`}>
          {trendLabel}
        </span>
      </div>
    </div>
  );
}
