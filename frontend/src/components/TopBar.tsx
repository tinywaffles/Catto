'use client';

import { Settings } from 'lucide-react';
import SgtClockWidget from '@/components/SgtClockWidget';
import TopRightControls from '@/components/TopRightControls';

interface TopBarProps {
  overallStatus: 'green' | 'amber' | 'red';
  onSettingsClick: () => void;
}

export default function TopBar({ onSettingsClick }: TopBarProps) {
  return (
    <div className="absolute top-0 left-0 right-0 h-12 z-[210] flex items-center justify-between px-4 bg-[var(--bg-primary)]/95 backdrop-blur-sm border-b border-[var(--border-primary)] hud-zone pointer-events-auto">

      {/* LEFT — Cat Logo + Tagline */}
      <div className="flex items-center gap-2.5 select-none pointer-events-none min-w-[180px]">
        <div className="w-6 h-6 flex items-center justify-center flex-shrink-0">
          {/* Geometric cat head — two triangular ears + rounded head */}
          <svg width="20" height="19" viewBox="0 0 20 19" fill="none">
            <path
              d="M2.5 10 L5 2.5 L8 10 L12 10 L15 2.5 L17.5 10 Q19.5 10 19.5 13.5 Q19.5 18 10 18 Q0.5 18 0.5 13.5 Q0.5 10 2.5 10 Z"
              fill="#3b82f6"
              fillOpacity="0.65"
            />
          </svg>
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-[12px] font-bold tracking-[0.35em] text-[var(--text-heading)] font-mono">
            C A T T O
          </span>
          <span className="text-[7px] text-[var(--text-muted)] font-mono tracking-[0.25em] mt-0.5">
            SITUATIONAL AWARENESS
          </span>
        </div>
      </div>

      {/* CENTER — Clock only */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <SgtClockWidget />
      </div>

      {/* RIGHT — Update controls + Settings */}
      <div className="flex items-center gap-1.5 min-w-[180px] justify-end">
        <TopRightControls />
        <button
          onClick={onSettingsClick}
          className="flex items-center justify-center w-7 h-7 border border-[var(--border-primary)] hover:border-cyan-500/50 hover:bg-[var(--hover-accent)] transition-all text-[var(--text-muted)] hover:text-cyan-400 flex-shrink-0"
          title="Settings"
        >
          <Settings size={12} />
        </button>
      </div>
    </div>
  );
}
