'use client';

import { useState } from 'react';
import { Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { useSituationDetector } from '@/hooks/useSituationDetector';
import type { RegionName, RegionStatus } from '@/hooks/useSituationDetector';

const REGION_ORDER: RegionName[] = [
  'Middle East',
  'East Asia',
  'Europe',
  'Southeast Asia',
  'South Asia',
  'Africa',
  'Americas',
];

const STATUS_DOT: Record<RegionStatus, string> = {
  green: 'bg-green-400',
  amber: 'bg-amber-400',
  red:   'bg-red-500',
};

const STATUS_TEXT: Record<RegionStatus, string> = {
  green: 'text-green-400',
  amber: 'text-amber-400',
  red:   'text-red-400',
};

export default function GlobalSituationPanel() {
  const { regionStatus } = useSituationDetector();
  const [open, setOpen] = useState(false);

  const redCount   = REGION_ORDER.filter((r) => regionStatus[r] === 'red').length;
  const amberCount = REGION_ORDER.filter((r) => regionStatus[r] === 'amber').length;

  return (
    <div className="w-full rounded border border-cyan-900/40 bg-[#06090f]/90 backdrop-blur-md overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-cyan-950/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Globe size={11} className="text-cyan-500 flex-shrink-0" />
          <span className="text-[9px] font-mono font-bold tracking-[0.18em] text-cyan-400 uppercase">
            Global Situation
          </span>
          {redCount > 0 && (
            <span className="text-[8px] font-mono text-red-400">{redCount}✕</span>
          )}
          {amberCount > 0 && (
            <span className="text-[8px] font-mono text-amber-400">{amberCount}~</span>
          )}
        </div>
        {open ? (
          <ChevronUp size={11} className="text-cyan-600" />
        ) : (
          <ChevronDown size={11} className="text-cyan-600" />
        )}
      </button>

      {open && (
        <div className="px-2 pb-2">
          <div className="flex flex-col">
            {REGION_ORDER.map((region) => {
              const status: RegionStatus = regionStatus[region] ?? 'green';
              return (
                <div
                  key={region}
                  className="flex items-center justify-between py-0.5 border-t border-cyan-900/20"
                >
                  <div className="flex items-center gap-2 pl-1">
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[status]} ${
                        status !== 'green' ? 'animate-pulse' : ''
                      }`}
                    />
                    <span className="text-[9px] font-mono text-[var(--text-secondary)]">
                      {region}
                    </span>
                  </div>
                  <span
                    className={`text-[7px] font-mono font-bold uppercase pr-1 ${STATUS_TEXT[status]}`}
                  >
                    {status}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-1.5 pt-1 border-t border-cyan-900/20 pl-1">
            <span className="text-[7px] font-mono text-[var(--text-muted)]/50 tracking-wider">
              GDELT · UCDP · MILITARY
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
