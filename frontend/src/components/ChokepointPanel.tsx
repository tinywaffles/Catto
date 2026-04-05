'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Anchor } from 'lucide-react';
import { useDataKey } from '@/hooks/useDataStore';

// ─── Chokepoint Definitions ──────────────────────────────────────────────────

type StatusLevel = 'GREEN' | 'AMBER' | 'RED';

interface Chokepoint {
  name: string;
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
  baseline?: StatusLevel;
  /** Elevate to AMBER if count drops BELOW this threshold */
  lowCountAmberBelow?: number;
}

const CHOKEPOINTS: Chokepoint[] = [
  {
    name: 'Malacca Strait',
    latMin: 1.0, latMax: 5.5, lngMin: 98.0, lngMax: 104.5,
  },
  {
    name: 'Strait of Hormuz',
    latMin: 24.0, latMax: 27.5, lngMin: 54.5, lngMax: 59.0,
  },
  {
    name: 'Suez Canal',
    latMin: 29.5, latMax: 32.5, lngMin: 31.5, lngMax: 34.0,
    lowCountAmberBelow: 5,
  },
  {
    name: 'Taiwan Strait',
    latMin: 22.0, latMax: 26.0, lngMin: 118.0, lngMax: 122.5,
    baseline: 'AMBER',
  },
  {
    name: 'Bab el-Mandeb',
    latMin: 11.5, latMax: 14.0, lngMin: 42.5, lngMax: 45.5,
    baseline: 'AMBER',
  },
];

// ─── Status helpers ───────────────────────────────────────────────────────────

function computeStatus(cp: Chokepoint, count: number): StatusLevel {
  let status: StatusLevel = 'GREEN';

  if (count > 60) {
    status = 'RED';
  } else if (count > 25) {
    status = 'AMBER';
  }

  // Elevate if baseline demands it
  if (cp.baseline === 'AMBER' && status === 'GREEN') {
    status = 'AMBER';
  }
  if (cp.baseline === 'RED') {
    status = 'RED';
  }

  // Low count blockage indicator (e.g. Suez)
  if (cp.lowCountAmberBelow !== undefined && count < cp.lowCountAmberBelow && status === 'GREEN') {
    status = 'AMBER';
  }

  return status;
}

const STATUS_BADGE: Record<StatusLevel, string> = {
  GREEN: 'text-green-400 border-green-700/60 bg-green-950/40',
  AMBER: 'text-amber-400 border-amber-700/60 bg-amber-950/40',
  RED:   'text-red-400 border-red-700/60 bg-red-950/40',
};

const STATUS_DOT: Record<StatusLevel, string> = {
  GREEN: 'bg-green-400',
  AMBER: 'bg-amber-400',
  RED:   'bg-red-400',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChokepointPanel() {
  const [open, setOpen] = useState(false);
  const ships = useDataKey('ships');

  const rows = useMemo(() => {
    const shipArr = (ships ?? []) as any[];
    return CHOKEPOINTS.map((cp) => {
      const count = shipArr.filter(
        (s) =>
          typeof s.lat === 'number' &&
          typeof s.lng === 'number' &&
          s.lat >= cp.latMin &&
          s.lat <= cp.latMax &&
          s.lng >= cp.lngMin &&
          s.lng <= cp.lngMax,
      ).length;
      return { ...cp, count, status: computeStatus(cp, count) };
    });
  }, [ships]);

  const updatedAt = useMemo(() => {
    const now = new Date();
    const h = (now.getUTCHours() + 8) % 24;
    const m = now.getUTCMinutes();
    const s = now.getUTCSeconds();
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} SGT`;
  }, [rows]);

  const highestStatus: StatusLevel = rows.reduce<StatusLevel>((acc, r) => {
    if (r.status === 'RED') return 'RED';
    if (r.status === 'AMBER' && acc !== 'RED') return 'AMBER';
    return acc;
  }, 'GREEN');

  return (
    <div className="w-full rounded border border-cyan-900/40 bg-[#06090f]/90 backdrop-blur-md overflow-hidden">
      {/* Header / toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-cyan-950/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Anchor size={11} className="text-cyan-500 flex-shrink-0" />
          <span className="text-[9px] font-mono font-bold tracking-[0.18em] text-cyan-400 uppercase">
            Chokepoint Status
          </span>
          {/* Summary indicator in header when collapsed */}
          {!open && (
            <span
              className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border ${STATUS_BADGE[highestStatus]}`}
            >
              {highestStatus}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* Pulsing dot when any non-GREEN status */}
          {highestStatus !== 'GREEN' && (
            <span
              className={`w-1.5 h-1.5 rounded-full animate-pulse ${STATUS_DOT[highestStatus]}`}
            />
          )}
          {open ? (
            <ChevronUp size={11} className="text-cyan-600" />
          ) : (
            <ChevronDown size={11} className="text-cyan-600" />
          )}
        </div>
      </button>

      {/* Collapsible body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="chokepoint-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-cyan-900/30 px-3 pt-2 pb-3 flex flex-col gap-1.5">
              {rows.map((row) => (
                <div
                  key={row.name}
                  className="flex items-center justify-between gap-2 py-1 border-b border-cyan-900/20 last:border-0"
                >
                  {/* Name */}
                  <span className="text-[10px] font-mono text-slate-300 leading-tight">
                    {row.name}
                  </span>

                  {/* Right side: status badge + vessel count */}
                  <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                    <div className="flex items-center gap-1">
                      {row.status !== 'GREEN' && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full animate-pulse ${STATUS_DOT[row.status]}`}
                        />
                      )}
                      <span
                        className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border ${STATUS_BADGE[row.status]}`}
                      >
                        {row.status}
                      </span>
                    </div>
                    <span className="text-[8px] font-mono text-slate-500 leading-none">
                      {row.count} vessel{row.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ))}

              {/* Footer metadata */}
              <div className="mt-1 flex flex-col gap-0.5">
                <p className="text-[7px] font-mono text-slate-600 leading-tight">
                  Based on AIS vessel density + conflict baseline
                </p>
                <p className="text-[7px] font-mono text-slate-600 leading-tight">
                  Updated {updatedAt}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
