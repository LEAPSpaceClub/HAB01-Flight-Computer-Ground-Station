import React from 'react';
import { DataTable } from '../components/DataTable';

export const TelemetryLogPage: React.FC = () => {
  return (
    <div className="p-4 h-[calc(100vh-4rem)] flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-text-primary">Telemetry Log</h1>
      </div>
      <div className="flex-1 overflow-hidden">
        <DataTable />
      </div>
    </div>
  );
};
