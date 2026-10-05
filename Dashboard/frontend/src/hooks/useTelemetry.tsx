import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchJson } from '../api/client';
import type { TelemetryFrame, FlightPhase } from '../types/telemetry';
import { parseSensorHealth } from '../types/telemetry';

export type LinkTrend = 'nominal' | 'stable' | 'degrading' | 'critical';

export interface LinkQuality {
  ok: number;
  bad: number;
  ratio: number;
  trend: LinkTrend;
  recentErrors: number;
}

interface TelemetryContextType {
  frames: TelemetryFrame[];
  latestFrame: TelemetryFrame | null;
  isConnected: boolean;
  currentFlightId: number | null;
  setFlightId: (id: number | null) => void;
  isLive: boolean;
  clearFrames: () => void;
  phaseTimes: Partial<Record<FlightPhase, string>>;
  gapDetected: boolean;
  lastGapSeconds: number | null;
  sensorHealth: Record<string, boolean>;
  linkQuality: LinkQuality;
  isStale: boolean;
}

const TelemetryContext = createContext<TelemetryContextType | null>(null);

const MAX_FRAMES = 5000;

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [liveFrames, setLiveFrames] = useState<TelemetryFrame[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [manualFlightId, setManualFlightId] = useState<number | null>(null);
  const [liveFlightId, setLiveFlightId] = useState<number | null>(null);
  const [lastReceivedTime, setLastReceivedTime] = useState<number | null>(null);

  const isLive = manualFlightId === null;
  const currentFlightId = isLive ? liveFlightId : manualFlightId;

  // Fetch historical frames when a specific flight is selected
  const { data: historicalFrames = [] } = useQuery<TelemetryFrame[]>({
    queryKey: ['frames', manualFlightId],
    queryFn: () => fetchJson<TelemetryFrame[]>(`/flights/${manualFlightId}/frames?limit=5000&order=asc`),
    enabled: !isLive && manualFlightId !== null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<number | null>(null);

  // WebSocket connection — always active regardless of mode
  useEffect(() => {
    const connect = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/live`;
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsConnected(true);
        if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'frame' && msg.data) {
            const frame = msg.data as TelemetryFrame;
            setLiveFlightId(msg.flight_id ?? null);
            setLiveFrames((prev) => {
              const next = [...prev, frame];
              return next.length > MAX_FRAMES ? next.slice(next.length - MAX_FRAMES) : next;
            });
            setLastReceivedTime(Date.now());
          }
        } catch (e) {
          console.error('Failed to parse WS message', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        reconnectTimeout.current = window.setTimeout(connect, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // The single source of frames — live WS frames or historical REST frames
  const frames = isLive ? liveFrames : historicalFrames;
  const latestFrame = frames.length > 0 ? frames[frames.length - 1] : null;

  const clearFrames = useCallback(() => {
    setLiveFrames([]);
  }, []);

  const setFlightId = useCallback((id: number | null) => {
    setManualFlightId(id);
  }, []);

  // Derive phase first-reached timestamps
  const phaseTimes = useMemo(() => {
    const times: Partial<Record<FlightPhase, string>> = {};
    for (const f of frames) {
      if (!times[f.flight_phase]) {
        times[f.flight_phase] = new Date(f.received_at).toLocaleTimeString();
      }
    }
    return times;
  }, [frames]);

  // Gap detection between the last two frames (>6s exceeds ~2s cadence)
  const lastGapSeconds = useMemo(() => {
    if (frames.length < 2) return null;
    const f1 = frames[frames.length - 2];
    const f2 = frames[frames.length - 1];
    const t1 = new Date(f1.received_at).getTime();
    const t2 = new Date(f2.received_at).getTime();
    const diff = (t2 - t1) / 1000;
    return diff > 6 ? Math.round(diff) : null;
  }, [frames]);

  const gapDetected = lastGapSeconds !== null;

  // Stale detection — check periodically if last frame was >6s ago
  const [isStale, setIsStale] = useState(false);
  useEffect(() => {
    if (!isLive || !lastReceivedTime) {
      setIsStale(false);
      return;
    }
    const checkStale = () => {
      setIsStale(Date.now() - lastReceivedTime > 6000);
    };
    checkStale();
    const interval = setInterval(checkStale, 1000);
    return () => clearInterval(interval);
  }, [lastReceivedTime, isLive]);

  // Parse sensor health from latest frame
  const sensorHealth = useMemo(() => {
    if (!latestFrame) return {};
    return parseSensorHealth(latestFrame.sensor_health_hex);
  }, [latestFrame]);

  // Link quality from latest frame + trend analysis
  const linkQuality = useMemo((): LinkQuality => {
    if (!latestFrame) {
      return { ok: 0, bad: 0, ratio: 1, trend: 'nominal', recentErrors: 0 };
    }
    const ok = latestFrame.rx_frames_ok ?? 0;
    const bad = latestFrame.rx_frames_bad_checksum ?? 0;
    const total = ok + bad;
    const ratio = total > 0 ? ok / total : 1;

    // Check errors in the last ~15 frames for trend
    let recentErrors = 0;
    if (frames.length >= 2) {
      const windowFrames = frames.slice(-15);
      const firstBad = windowFrames[0].rx_frames_bad_checksum ?? 0;
      const lastBad = windowFrames[windowFrames.length - 1].rx_frames_bad_checksum ?? 0;
      recentErrors = Math.max(0, lastBad - firstBad);
    }

    let trend: LinkTrend = 'nominal';
    if (ratio < 0.85 || recentErrors >= 4) {
      trend = 'critical';
    } else if (ratio < 0.95 || recentErrors > 0) {
      trend = 'degrading';
    } else if (ratio < 0.99) {
      trend = 'stable';
    }

    return {
      ok,
      bad,
      ratio,
      trend,
      recentErrors,
    };
  }, [latestFrame, frames]);

  const value: TelemetryContextType = {
    frames,
    latestFrame,
    isConnected,
    currentFlightId,
    setFlightId,
    isLive,
    clearFrames,
    phaseTimes,
    gapDetected,
    lastGapSeconds,
    sensorHealth,
    linkQuality,
    isStale,
  };

  return (
    <TelemetryContext.Provider value={value}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry() {
  const context = useContext(TelemetryContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
}
