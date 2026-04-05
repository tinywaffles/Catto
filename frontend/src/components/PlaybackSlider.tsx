'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Clock } from 'lucide-react';
import {
  activatePlayback,
  deactivatePlayback,
  getPlaybackHistoryOldest,
  usePlaybackState,
} from '@/hooks/useDataStore';

const HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore',
  });
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', timeZone: 'Asia/Singapore',
  });
}

export default function PlaybackSlider() {
  const { isActive, ts: playbackTs } = usePlaybackState();

  // 0 = oldest available (or now-24h), 100 = now
  const [sliderVal, setSliderVal] = useState(100);
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const now = Date.now();
  const oldestRaw = getPlaybackHistoryOldest();
  const hasHistory = oldestRaw !== null;
  const oldest = oldestRaw ?? (now - HISTORY_WINDOW_MS);
  const windowMs = Math.max(now - oldest, 1); // guard against division-by-zero

  // Convert slider (0–100) to epoch ms
  const sliderToTs = useCallback((val: number) => {
    return oldest + (val / 100) * windowMs;
  }, [oldest, windowMs]);

  const tsToSlider = useCallback((ts: number) => {
    return Math.round(((ts - oldest) / windowMs) * 100);
  }, [oldest, windowMs]);

  const applySlider = useCallback((val: number) => {
    setSliderVal(val);
    if (val >= 100) {
      deactivatePlayback();
    } else {
      activatePlayback(sliderToTs(val));
    }
  }, [sliderToTs]);

  // Auto-play: advance 1% per 500 ms
  useEffect(() => {
    if (!isPlaying) return;
    playIntervalRef.current = setInterval(() => {
      setSliderVal((prev) => {
        const next = prev + 1;
        if (next >= 100) {
          setIsPlaying(false);
          deactivatePlayback();
          return 100;
        }
        activatePlayback(sliderToTs(next));
        return next;
      });
    }, 500);
    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, sliderToTs]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (isPlaying) {
      setIsPlaying(false);
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    }
    applySlider(Number(e.target.value));
  }, [isPlaying, applySlider]);

  const togglePlay = useCallback(() => {
    if (sliderVal >= 100) {
      // Start from oldest
      setSliderVal(0);
      activatePlayback(oldest);
      setIsPlaying(true);
    } else {
      setIsPlaying((p) => !p);
    }
  }, [sliderVal, oldest]);

  const reset = useCallback(() => {
    setIsPlaying(false);
    if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    setSliderVal(100);
    deactivatePlayback();
  }, []);

  const displayTs = sliderVal >= 100 ? now : sliderToTs(sliderVal);

  return (
    <div className={`bg-[var(--bg-panel)] border backdrop-blur-sm ${isActive ? 'border-amber-500/40' : 'border-[var(--border-primary)]'} px-3 py-2`}>
      {/* Header — always shown */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Clock size={9} className={isActive ? 'text-amber-400' : 'text-[var(--text-muted)]'} />
          <span className={`text-[9px] font-mono font-bold tracking-[0.2em] uppercase ${isActive ? 'text-amber-400' : 'text-[var(--text-muted)]'}`}>
            Playback
          </span>
          {isActive && (
            <span className="text-[7px] font-mono px-1 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 tracking-wider">
              HISTORICAL
            </span>
          )}
        </div>
        {hasHistory && (
          <div className="flex items-center gap-1">
            <button
              onClick={togglePlay}
              className={`p-1 border transition-colors ${isActive || isPlaying
                ? 'border-amber-700/50 text-amber-400 hover:border-amber-500/60'
                : 'border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
              }`}
              aria-label={isPlaying ? 'Pause playback' : 'Play playback'}
            >
              {isPlaying ? <Pause size={9} /> : <Play size={9} />}
            </button>
            {isActive && (
              <button
                onClick={reset}
                className="p-1 border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors"
                aria-label="Return to live"
              >
                <RotateCcw size={9} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* No history yet — friendly message */}
      {!hasHistory ? (
        <div className="text-[8px] font-mono text-[var(--text-muted)] leading-snug py-1">
          Historical data is being collected —<br />
          check back in a few hours.
        </div>
      ) : (
        /* Slider */
        <div className="flex flex-col gap-1">
          <input
            type="range"
            min={0}
            max={100}
            value={sliderVal}
            onChange={handleSliderChange}
            className="w-full h-1 appearance-none cursor-pointer bg-white/10 rounded-none"
            style={{ accentColor: isActive ? '#f59e0b' : '#6b7280' }}
          />
          {/* Time labels */}
          <div className="flex items-center justify-between">
            <div className="text-[7px] font-mono text-[var(--text-muted)]">
              <div>{fmtDate(oldest)}</div>
              <div>{fmtTime(oldest)} SGT</div>
            </div>
            <div className={`text-[8px] font-mono tabular-nums ${isActive ? 'text-amber-400' : 'text-[var(--text-muted)]'} text-center`}>
              {sliderVal >= 100 ? (
                <span className="text-green-400/70">LIVE</span>
              ) : (
                <>
                  <div>{fmtDate(displayTs)}</div>
                  <div>{fmtTime(displayTs)} SGT</div>
                </>
              )}
            </div>
            <div className="text-[7px] font-mono text-[var(--text-muted)] text-right">
              <div>{fmtDate(now)}</div>
              <div>{fmtTime(now)} SGT</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
