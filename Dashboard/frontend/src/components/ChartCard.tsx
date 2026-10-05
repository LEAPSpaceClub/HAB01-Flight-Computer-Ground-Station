import { type ReactNode } from 'react';

interface ChartCardProps {
  title: string;
  children: ReactNode;
}

export function ChartCard({ title, children }: ChartCardProps) {
  return (
    <div className="bg-[#1e2130] border border-[#2a2d3a] rounded-lg p-4 flex flex-col h-full w-full">
      <h3 className="text-[#e4e4e7] text-sm font-semibold uppercase tracking-wider mb-3">{title}</h3>
      <div className="flex-1 w-full min-h-[220px]">
        {children}
      </div>
    </div>
  );
}
