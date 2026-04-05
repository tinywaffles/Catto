'use client';

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

function formatTime(date: Date, tz: string): string {
  return date.toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: tz,
    hour12: false,
  });
}

export default function SgtClockWidget() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const sgt = now ? formatTime(now, 'Asia/Singapore') : '--:--:--';
  const utc = now ? formatTime(now, 'UTC') : '--:--:--';

  return (
    <div className="bg-[var(--bg-panel)] border border-cyan-900/40 backdrop-blur-sm px-3 py-1.5 flex items-center gap-3 pointer-events-none select-none">
      <Clock size={9} className="text-cyan-600 flex-shrink-0" />
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-center">
          <span className="text-[7px] font-mono text-[var(--text-muted)] tracking-[0.2em] leading-none">SGT</span>
          <span className="text-[11px] font-mono text-cyan-400 font-bold tracking-wide leading-none mt-0.5">{sgt}</span>
        </div>
        <div className="w-px h-4 bg-cyan-900/60" />
        <div className="flex flex-col items-center">
          <span className="text-[7px] font-mono text-[var(--text-muted)] tracking-[0.2em] leading-none">UTC</span>
          <span className="text-[11px] font-mono text-[var(--text-secondary)] tracking-wide leading-none mt-0.5">{utc}</span>
        </div>
      </div>
    </div>
  );
}
