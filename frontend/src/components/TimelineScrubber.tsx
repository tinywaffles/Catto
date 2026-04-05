'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, Play, Pause, SkipBack, Radio } from 'lucide-react';
import { API_BASE } from '@/lib/api';

interface TimelineSnapshot {
  ts: string;
}

interface Props {
  onSnapshot: (data: Record<string, unknown> | null) => void;
  isHistorical: boolean;
  onLiveMode: () => void;
}

function formatTs(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-SG', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Singapore',
      hour12: false,
    }) + ' SGT';
  } catch {
    return iso.slice(11, 16) + 'Z';
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-SG', {
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Singapore',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function TimelineScrubber({ onSnapshot, isHistorical, onLiveMode }: Props) {
  const [snapshots, setSnapshots] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingSnap, setLoadingSnap] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const prevIndexRef = useRef<number | null>(null);

  // Load snapshot list
  const loadSnapshots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/snapshots`);
      if (res.ok) {
        const data = await res.json();
        setSnapshots((data.snapshots || []).reverse()); // oldest first for slider
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (isOpen) void loadSnapshots();
  }, [isOpen, loadSnapshots]);

  // Load snapshot data when index changes
  useEffect(() => {
    if (selectedIndex === null || selectedIndex === prevIndexRef.current) return;
    prevIndexRef.current = selectedIndex;

    const ts = snapshots[selectedIndex];
    if (!ts) return;

    setLoadingSnap(true);
    fetch(`${API_BASE}/api/snapshots/${encodeURIComponent(ts)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) onSnapshot(data); })
      .catch(() => {})
      .finally(() => setLoadingSnap(false));
  }, [selectedIndex, snapshots, onSnapshot]);

  const handleLive = () => {
    setSelectedIndex(null);
    prevIndexRef.current = null;
    onLiveMode();
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-[9px] font-mono tracking-wide border transition-colors ${
          isHistorical
            ? 'border-amber-600/60 text-amber-400 bg-amber-950/20'
            : 'border-[var(--border-primary)] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:border-cyan-800/40'
        }`}
      >
        <Clock size={9} />
        TIMELINE
        {isHistorical && selectedIndex !== null && snapshots[selectedIndex] && (
          <span className="text-amber-500 ml-1">{formatTs(snapshots[selectedIndex])}</span>
        )}
      </button>
    );
  }

  const currentTs = selectedIndex !== null ? snapshots[selectedIndex] : null;

  return (
    <div className="flex flex-col gap-1 bg-[var(--bg-panel)] border border-[var(--border-primary)] p-2 min-w-[360px] max-w-[520px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Clock size={9} className="text-cyan-500" />
          <span className="text-[9px] font-mono tracking-widest text-[var(--text-secondary)] uppercase">
            Timeline
          </span>
          {loadingSnap && (
            <div className="w-2 h-2 border border-cyan-500 border-t-transparent rounded-full animate-spin" />
          )}
        </div>
        <div className="flex items-center gap-1">
          {isHistorical && (
            <button
              onClick={handleLive}
              className="flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono border border-green-600/50 text-green-400 bg-green-950/20 hover:bg-green-950/40 transition-colors"
            >
              <Radio size={8} className="animate-pulse" />
              LIVE
            </button>
          )}
          <button
            onClick={() => setIsOpen(false)}
            className="text-[8px] font-mono text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-1"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Time label */}
      {currentTs ? (
        <div className="text-[9px] font-mono text-amber-400 tracking-wide">
          {formatDate(currentTs)} {formatTs(currentTs)}
          <span className="text-[var(--text-muted)] ml-1">(HISTORICAL)</span>
        </div>
      ) : (
        <div className="text-[9px] font-mono text-green-400 tracking-wide flex items-center gap-1">
          <Radio size={8} className="animate-pulse" /> LIVE — real-time data
        </div>
      )}

      {/* Scrubber */}
      {loading ? (
        <div className="text-[8px] font-mono text-[var(--text-muted)] py-1">Loading snapshots…</div>
      ) : snapshots.length === 0 ? (
        <div className="text-[8px] font-mono text-[var(--text-muted)] py-1">
          No snapshots yet — snapshots taken every 15 min
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <input
            type="range"
            min={0}
            max={snapshots.length - 1}
            value={selectedIndex ?? snapshots.length - 1}
            onChange={(e) => setSelectedIndex(Number(e.target.value))}
            className="w-full accent-cyan-500 h-1"
          />
          <div className="flex items-center justify-between text-[7.5px] font-mono text-[var(--text-muted)]">
            <span>{snapshots.length > 0 ? formatTs(snapshots[0]) : ''}</span>
            <span className="text-[var(--text-muted)]/60">{snapshots.length} snapshots · 24h</span>
            <span>{snapshots.length > 0 ? formatTs(snapshots[snapshots.length - 1]) : ''}</span>
          </div>
        </div>
      )}

      {/* Snapshot labels — show 5 equidistant markers */}
      {snapshots.length >= 5 && (
        <div className="flex items-center justify-between mt-0.5">
          {[0, Math.floor(snapshots.length * 0.25), Math.floor(snapshots.length * 0.5), Math.floor(snapshots.length * 0.75), snapshots.length - 1].map((idx) => (
            <button
              key={idx}
              onClick={() => setSelectedIndex(idx)}
              className={`text-[7px] font-mono px-1 py-0.5 transition-colors ${
                selectedIndex === idx
                  ? 'text-amber-400 border-b border-amber-400/50'
                  : 'text-[var(--text-muted)]/50 hover:text-[var(--text-muted)]'
              }`}
            >
              {formatTs(snapshots[idx])}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
