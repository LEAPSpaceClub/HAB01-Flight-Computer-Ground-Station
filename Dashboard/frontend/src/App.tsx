import { BrowserRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TelemetryProvider } from './hooks/useTelemetry';
import { StatusHeader } from './components/StatusHeader';
import { OverviewPage } from './pages/OverviewPage';
import { MapPage } from './pages/MapPage';
import { TelemetryLogPage } from './pages/TelemetryLogPage';
import { ChartsPage } from './pages/ChartsPage';
import { FlightHistoryPage } from './pages/FlightHistoryPage';

const queryClient = new QueryClient();

const NAV_ITEMS = [
  { label: 'Overview', path: '/overview' },
  { label: 'Map', path: '/map' },
  { label: 'Telemetry', path: '/telemetry' },
  { label: 'Charts', path: '/charts' },
  { label: 'History', path: '/history' },
];

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TelemetryProvider>
        <BrowserRouter>
          <div className="flex flex-col h-screen bg-bg-primary text-text-primary">
            {/* Pinned status header — rendered once at app shell level */}
            <StatusHeader />

            {/* Navigation tab bar */}
            <nav className="bg-[#1a1d27] border-b border-[#2a2d3a] px-4 flex gap-1 shrink-0">
              {NAV_ITEMS.map(({ label, path }) => (
                <NavLink
                  key={path}
                  to={path}
                  className={({ isActive }) =>
                    `py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                      isActive
                        ? 'border-accent text-accent'
                        : 'border-transparent text-[#a1a1aa] hover:text-[#e4e4e7]'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>

            {/* Routed page views */}
            <main className="flex-1 overflow-hidden relative">
              <div className="absolute inset-0 overflow-y-auto">
                <Routes>
                  <Route path="/" element={<Navigate to="/overview" replace />} />
                  <Route path="/overview" element={<OverviewPage />} />
                  <Route path="/map" element={<MapPage />} />
                  <Route path="/telemetry" element={<TelemetryLogPage />} />
                  <Route path="/charts" element={<ChartsPage />} />
                  <Route path="/history" element={<FlightHistoryPage />} />
                </Routes>
              </div>
            </main>
          </div>
        </BrowserRouter>
      </TelemetryProvider>
    </QueryClientProvider>
  );
}
