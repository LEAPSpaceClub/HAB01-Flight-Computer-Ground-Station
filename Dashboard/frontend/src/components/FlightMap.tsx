import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { useTelemetry } from '../hooks/useTelemetry';
import type { FlightPhase } from '../types/telemetry';

// Fix Leaflet's default icon path issues
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

/** Haversine distance in metres */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const PHASE_COLORS: Record<FlightPhase, string> = {
  PRELAUNCH: '#64748b',
  ASCENT: '#22c55e',
  NEAR_APOGEE: '#f59e0b',
  DESCENT: '#3b82f6',
  LANDED: '#ef4444',
};

/** Fly map to the given center whenever it changes */
function MapController({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, map.getZoom(), { animate: false });
    }
  }, [center, map]);
  return null;
}

export function FlightMap() {
  const { frames, latestFrame } = useTelemetry();

  // Extract valid GPS positions — never plot (0,0) or null coordinates
  const positions = useMemo(() =>
    frames
      .filter(f => f.gps_fix_valid && f.gps_lat != null && f.gps_lon != null && !(f.gps_lat === 0 && f.gps_lon === 0))
      .map(f => [f.gps_lat!, f.gps_lon!] as [number, number]),
    [frames]
  );

  const currentPos: [number, number] | null =
    latestFrame?.gps_fix_valid && latestFrame.gps_lat != null && latestFrame.gps_lon != null
    && !(latestFrame.gps_lat === 0 && latestFrame.gps_lon === 0)
      ? [latestFrame.gps_lat, latestFrame.gps_lon]
      : null;

  const firstPos = positions.length > 0 ? positions[0] : null;
  const distance = firstPos && currentPos ? haversine(firstPos[0], firstPos[1], currentPos[0], currentPos[1]) : 0;
  const isGpsStale = latestFrame?.gps_stale === true;
  const hasFix = currentPos !== null;

  // Phase-colored custom marker icon
  const currentPhase = (latestFrame?.flight_phase as FlightPhase) ?? 'PRELAUNCH';
  const markerColor = PHASE_COLORS[currentPhase] ?? '#3b82f6';

  const markerIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-phase-marker',
      html: `
        <div style="
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background-color: ${markerColor};
          border: 2px solid #ffffff;
          box-shadow: 0 0 12px ${markerColor}, 0 2px 5px rgba(0,0,0,0.6);
          position: relative;
        ">
          <div style="
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background-color: #ffffff;
          "></div>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });
  }, [markerColor]);

  return (
    <div className="relative w-full h-full bg-[#0f1117] rounded-lg overflow-hidden border border-[#2a2d3a]">
      {/* Explicit state: No GPS fix yet */}
      {!hasFix && (
        <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-[#0f1117]/85 pointer-events-none">
          <div className="bg-[#1e2130] p-4 rounded-lg border border-warning text-center">
            <div className="text-warning font-bold text-sm">NO GPS FIX</div>
            <div className="text-text-muted text-xs mt-1">Waiting for valid satellite coordinates...</div>
          </div>
        </div>
      )}

      {/* Explicit state: GPS stale */}
      {isGpsStale && hasFix && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
          <span className="text-warning font-bold bg-[#1e2130]/95 px-3 py-1 rounded-md border border-warning text-xs shadow-lg">
            ⚠ GPS STALE — coordinates may be outdated
          </span>
        </div>
      )}

      <MapContainer
        center={currentPos ?? [20, 78]}
        zoom={13}
        className="w-full h-full dark-tiles"
        zoomControl={true}
      >
        {/* Standard OpenStreetMap tiles — zero external credentials, no API keys */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Flight path polyline */}
        {positions.length > 0 && (
          <Polyline positions={positions} color="#3b82f6" weight={3} opacity={0.8} />
        )}

        {/* Current position marker — phase-colored, muted opacity when stale */}
        {currentPos && (
          <Marker position={currentPos} icon={markerIcon} opacity={isGpsStale ? 0.45 : 1}>
            <Popup>
              <div className="text-xs font-tabular text-[#0f1117] p-1">
                <strong className="block mb-1 text-sm font-bold" style={{ color: markerColor }}>
                  {currentPhase}
                </strong>
                <div>Alt: {latestFrame?.gps_alt_m?.toFixed(1) ?? '---'} m</div>
                <div>Speed: {latestFrame?.gps_speed_kmh?.toFixed(1) ?? '---'} km/h</div>
                <div>Sats: {latestFrame?.gps_satellites ?? 0}</div>
                <div>Distance: {(distance / 1000).toFixed(2)} km</div>
              </div>
            </Popup>
          </Marker>
        )}

        <MapController center={currentPos} />
      </MapContainer>

      {/* Stats overlay */}
      {currentPos && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-[#1a1d27]/90 backdrop-blur-sm border border-[#2a2d3a] p-3 rounded shadow-lg text-xs pointer-events-none font-tabular min-w-[200px]">
          <div className="text-muted mb-1.5 uppercase text-[10px] font-bold tracking-wider">Flight Data</div>
          <div className="flex justify-between gap-4 py-0.5">
            <span className="text-muted">Altitude:</span>
            <span className="text-info font-bold">{latestFrame?.gps_alt_m?.toFixed(0) ?? 0} m</span>
          </div>
          <div className="flex justify-between gap-4 py-0.5">
            <span className="text-muted">Speed:</span>
            <span className="font-semibold">{latestFrame?.gps_speed_kmh?.toFixed(0) ?? 0} km/h</span>
          </div>
          <div className="flex justify-between gap-4 py-0.5">
            <span className="text-muted">Dist from Fix:</span>
            <span className="font-semibold">{(distance / 1000).toFixed(2)} km</span>
          </div>
          <div className="flex justify-between gap-4 py-0.5">
            <span className="text-muted">Lat / Lon:</span>
            <span>{currentPos[0].toFixed(4)}, {currentPos[1].toFixed(4)}</span>
          </div>
          <div className="flex justify-between gap-4 py-0.5">
            <span className="text-muted">Satellites:</span>
            <span>{latestFrame?.gps_satellites ?? 0}</span>
          </div>
        </div>
      )}
    </div>
  );
}
