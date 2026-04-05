'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Radio, Volume2, VolumeX } from 'lucide-react';
import { useDataKeys } from '@/hooks/useDataStore';
import type { GdeltConflictEvent } from '@/types/dashboard';

const SOUND_KEY = 'catto_alert_sound_enabled';

function playAlertTone() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    // Two short descending beeps
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880 - i * 110, now + i * 0.18);
      gain.gain.setValueAtTime(0, now + i * 0.18);
      gain.gain.linearRampToValueAtTime(0.25, now + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.16);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.18);
    }
    // Close context after tones complete
    setTimeout(() => ctx.close(), 600);
  } catch { /* AudioContext not available */ }
}

const KEYS = ['gdelt_conflict'] as const;
const SPIKE_THRESHOLD = 3;   // new events in a region to trigger
const DISMISS_SECS = 30;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 min between popups for same region

// Approximate region buckets [name, latMin, latMax, lngMin, lngMax]
const REGIONS: [string, number, number, number, number][] = [
  ['Ukraine / Russia',   44,  57,  22,  45],
  ['Israel / Gaza',      29,  34,  33,  36],
  ['Iran / Middle East', 20,  38,  35,  63],
  ['Taiwan Strait',      22,  27, 118, 123],
  ['Korean Peninsula',   34,  43, 124, 132],
  ['South China Sea',     5,  25, 105, 125],
  ['Red Sea / Yemen',     8,  22,  32,  55],
  ['South Asia',          5,  38,  60,  98],
  ['East Africa',        -5,  20,  30,  52],
  ['Europe',             36,  72, -15,  32],
  ['West Africa',       -10,  20, -20,  20],
  ['Americas',          -60,  72,-170, -30],
];

function regionForEvent(lat: number, lng: number): string | null {
  for (const [name, latMin, latMax, lngMin, lngMax] of REGIONS) {
    if (lat >= latMin && lat <= latMax && lng >= lngMin && lng <= lngMax) return name;
  }
  return null;
}

interface BreakingAlert {
  id: string;
  region: string;
  count: number;
  topEvent: string;
  tone: number;
}

export default function BreakingEventPopup() {
  const [alert, setAlert] = useState<BreakingAlert | null>(null);
  const [pinned, setPinned] = useState(false);
  const [countdown, setCountdown] = useState(DISMISS_SECS);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(SOUND_KEY);
    return stored === null ? true : stored === 'true';
  });

  const seenTitles = useRef<Set<string>>(new Set());
  const initialized = useRef(false);
  const lastFiredRegion = useRef<Record<string, number>>({});
  const soundEnabledRef = useRef(soundEnabled);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  const { gdelt_conflict } = useDataKeys(KEYS);

  const checkSpike = useCallback(() => {
    const events = (gdelt_conflict as GdeltConflictEvent[] | undefined) ?? [];
    if (events.length === 0) return;

    if (!initialized.current) {
      // Seed seen set on first load — no popup
      events.forEach((e) => seenTitles.current.add(e.title));
      initialized.current = true;
      return;
    }

    // Find new events not previously seen
    const newEvents = events.filter((e) => !seenTitles.current.has(e.title));
    newEvents.forEach((e) => seenTitles.current.add(e.title));
    if (newEvents.length === 0) return;

    // Group by region
    const byRegion: Record<string, GdeltConflictEvent[]> = {};
    for (const e of newEvents) {
      const r = regionForEvent(e.lat, e.lng);
      if (!r) continue;
      if (!byRegion[r]) byRegion[r] = [];
      byRegion[r].push(e);
    }

    // Find region with largest spike that isn't on cooldown
    const now = Date.now();
    let best: { region: string; events: GdeltConflictEvent[] } | null = null;
    for (const [region, evts] of Object.entries(byRegion)) {
      if (evts.length < SPIKE_THRESHOLD) continue;
      const lastFired = lastFiredRegion.current[region] ?? 0;
      if (now - lastFired < COOLDOWN_MS) continue;
      if (!best || evts.length > best.events.length) {
        best = { region, events: evts };
      }
    }

    if (!best) return;

    lastFiredRegion.current[best.region] = now;
    // Pick most alarming event (most negative tone)
    const sorted = best.events.sort((a, b) => (a.tone ?? 0) - (b.tone ?? 0));
    setAlert({
      id: `${best.region}-${now}`,
      region: best.region,
      count: best.events.length,
      topEvent: sorted[0].title,
      tone: sorted[0].tone ?? 0,
    });
    setPinned(false);
    setCountdown(DISMISS_SECS);
    // Play alert sound if enabled
    if (soundEnabledRef.current) playAlertTone();
  }, [gdelt_conflict]);

  useEffect(() => {
    checkSpike();
  }, [checkSpike]);

  // Countdown timer
  useEffect(() => {
    if (!alert || pinned) return;
    if (countdown <= 0) { setAlert(null); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [alert, pinned, countdown]);

  if (!alert) return null;

  const progress = (countdown / DISMISS_SECS) * 100;

  return (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] pointer-events-auto w-[460px] max-w-[calc(100vw-2rem)]"
      onClick={() => setPinned(true)}
    >
      <div className="bg-[#0a0005]/96 border border-red-500/60 backdrop-blur-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-red-500/30">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          <Radio size={10} className="text-red-400 flex-shrink-0" />
          <span className="text-[9px] font-mono font-bold tracking-[0.25em] text-red-400 uppercase flex-1">
            Breaking — {alert.region}
          </span>
          <span className="text-[7.5px] font-mono text-red-300/60">
            {alert.count} new event{alert.count !== 1 ? 's' : ''}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              const next = !soundEnabled;
              setSoundEnabled(next);
              localStorage.setItem(SOUND_KEY, String(next));
            }}
            className="text-red-400/40 hover:text-red-300 flex-shrink-0"
            title={soundEnabled ? 'Mute alert sound' : 'Enable alert sound'}
          >
            {soundEnabled ? <Volume2 size={9} /> : <VolumeX size={9} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setAlert(null); }}
            className="text-red-400/60 hover:text-red-300 ml-1 flex-shrink-0"
          >
            <X size={10} />
          </button>
        </div>

        {/* Event text */}
        <div className="px-4 py-3">
          <p className="text-[10px] font-mono text-gray-100 leading-relaxed">
            {alert.topEvent}
          </p>
          {alert.count > 1 && (
            <p className="text-[7.5px] font-mono text-gray-400 mt-1">
              +{alert.count - 1} additional event{alert.count - 1 !== 1 ? 's' : ''} detected in region
            </p>
          )}
          {!pinned && (
            <p className="text-[7px] font-mono text-red-400/50 mt-1.5">
              Click to keep · dismissing in {countdown}s
            </p>
          )}
        </div>

        {/* Countdown bar */}
        {!pinned && (
          <div className="h-0.5 bg-red-900/40">
            <div
              className="h-full bg-red-500/70 transition-all duration-1000 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
