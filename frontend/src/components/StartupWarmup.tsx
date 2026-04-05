'use client';

import { useEffect, useState } from 'react';
import { FAST_STARTUP_DELAY_MS, SLOW_STARTUP_DELAY_MS } from '@/hooks/useDataPolling';

const TOTAL_MS = SLOW_STARTUP_DELAY_MS; // 45s full warmup window

export default function StartupWarmup() {
  const [progress, setProgress] = useState(0);   // 0–100
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const start = Date.now();
    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / TOTAL_MS) * 100, 100);
      setProgress(pct);
      if (pct >= 100) {
        clearInterval(tick);
        // Fade out after a brief hold
        setTimeout(() => setVisible(false), 800);
      }
    }, 250);
    return () => clearInterval(tick);
  }, []);

  if (!visible) return null;

  // Milestones shown on the bar
  const fastPct  = (FAST_STARTUP_DELAY_MS / TOTAL_MS) * 100;  // 33%

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none"
      style={{ opacity: progress >= 100 ? 0 : 1, transition: 'opacity 0.8s ease' }}
    >
      {/* Progress track */}
      <div className="h-[3px] w-full bg-slate-800/80">
        <div
          className="h-full bg-cyan-500 transition-all duration-300 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Status label */}
      <div className="absolute top-[6px] right-3 flex items-center gap-2">
        <span className="text-[10px] font-mono text-cyan-400/70 tracking-widest">
          {progress < fastPct
            ? `WARMING UP — LIVE DATA IN ${Math.ceil((FAST_STARTUP_DELAY_MS - (progress / 100) * TOTAL_MS) / 1000)}s`
            : progress < 100
              ? `LOADING FEEDS — ${Math.ceil((TOTAL_MS - (progress / 100) * TOTAL_MS) / 1000)}s`
              : 'ONLINE'}
        </span>
        {progress < 100 && (
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        )}
      </div>
    </div>
  );
}
