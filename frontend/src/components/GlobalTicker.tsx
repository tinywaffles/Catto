'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface Commodity {
  price: number | null;
  change_pct: number | null;
}

interface CommodityData {
  gold: Commodity;
  crude: Commodity;
  sgdusd: Commodity;
}

const REFRESH_MS = 5 * 60 * 1000; // 5 minutes

function CommodityItem({ label, unit, value, changePct, decimals = 2, suffix = '' }: {
  label: string;
  unit: string;
  value: number | null;
  changePct: number | null;
  decimals?: number;
  suffix?: string;
}) {
  const up = (changePct ?? 0) > 0;
  const down = (changePct ?? 0) < 0;
  const colorClass = up ? 'text-green-400' : down ? 'text-red-400' : 'text-white';

  return (
    <div className="flex items-center gap-2 font-mono">
      <span className="text-[9px] font-bold tracking-widest text-cyan-400 uppercase">{label}</span>
      <span className="text-[12px] font-bold text-white">
        {value != null
          ? `${unit}${value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`
          : '—'}
      </span>
      {changePct != null && (
        <span className={`flex items-center gap-0.5 text-[10px] font-bold ${colorClass}`}>
          {up ? <ArrowUpRight size={11} /> : down ? <ArrowDownRight size={11} /> : null}
          {Math.abs(changePct).toFixed(2)}%
        </span>
      )}
    </div>
  );
}

export default function GlobalTicker() {
  const [data, setData] = useState<CommodityData | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function load() {
      try {
        const r = await fetch('/api/commodities');
        if (!cancelled && r.ok) setData(await r.json());
      } catch { /* ignore */ }
      if (!cancelled) timer = setTimeout(load, REFRESH_MS);
    }

    void load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  const items = data ? [
    { label: 'GOLD', unit: 'SGD$', value: data.gold?.price ?? null, changePct: data.gold?.change_pct ?? null, decimals: 2, suffix: '/g' },
    { label: 'OIL', unit: '$', value: data.crude?.price ?? null, changePct: data.crude?.change_pct ?? null, decimals: 2, suffix: '/bbl' },
    { label: 'SGD/USD', unit: '', value: data.sgdusd?.price ?? null, changePct: data.sgdusd?.change_pct ?? null, decimals: 4 },
  ] : [];

  return (
    <div className="absolute bottom-0 left-0 right-0 h-7 bg-[#0a0a0a]/95 border-t border-cyan-900/40 shadow-[0_-5px_15px_rgba(0,0,0,0.6)] z-[8000] flex items-center overflow-hidden pointer-events-auto backdrop-blur-xl">
      {/* Label */}
      <div className="flex-shrink-0 px-3 flex items-center gap-1.5 border-r border-cyan-900/40 h-full bg-cyan-950/20">
        <span className="text-[8px] font-mono font-bold tracking-[0.2em] text-cyan-600 uppercase">MARKETS</span>
      </div>

      {items.length === 0 ? (
        <span className="text-[9px] font-mono text-[var(--text-muted)] pl-4 animate-pulse">FETCHING MARKET DATA...</span>
      ) : (
        <div className="flex-1 flex items-center justify-evenly px-4">
          {items.map((item, i) => (
            <CommodityItem key={i} {...item} />
          ))}
        </div>
      )}
    </div>
  );
}
