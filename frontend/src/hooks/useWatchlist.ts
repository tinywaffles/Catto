'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useDataKeys } from '@/hooks/useDataStore';
import { emitToast } from '@/lib/toastBus';
import type { WatchlistEntry, WatchedEntity } from '@/types/watchlist';
import type {
  CommercialFlight, PrivateFlight, PrivateJet,
  MilitaryFlight, TrackedFlight, Ship,
} from '@/types/dashboard';

// Colors assigned to watchlist entries in rotation
export const WATCH_COLORS = [
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#f97316', // orange
  '#ef4444', // red
  '#a855f7', // purple
];

const LS_KEY = 'catto:watchlist';

function readEntries(): WatchlistEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as WatchlistEntry[]) : [];
  } catch {
    return [];
  }
}

function writeEntries(entries: WatchlistEntry[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(entries));
  } catch { /* ignore */ }
}

// ── Matching ─────────────────────────────────────────────────────────────────

function matchesQuery(query: string, ...fields: (string | number | undefined | null)[]): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return false;
  for (const f of fields) {
    if (f == null) continue;
    if (typeof f === 'number') {
      if (f.toString() === q) return true;
    } else {
      if (f.toLowerCase().includes(q)) return true;
    }
  }
  return false;
}

// ── ETA calculation ───────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeEta(
  lat: number,
  lng: number,
  destLoc: [number, number] | null | undefined,
  speedKnots: number | null | undefined,
): string | undefined {
  if (!destLoc || !speedKnots || speedKnots < 10) return undefined;
  // destLoc is [lng, lat]
  const distKm = haversineKm(lat, lng, destLoc[1], destLoc[0]);
  const speedKmh = speedKnots * 1.852;
  const hours = distKm / speedKmh;
  if (hours < 0 || hours > 72) return undefined;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

// ── Data keys ─────────────────────────────────────────────────────────────────

const WATCHLIST_DATA_KEYS = [
  'commercial_flights',
  'private_flights',
  'private_jets',
  'military_flights',
  'tracked_flights',
  'ships',
] as const;

// Suppress "entity appeared" toasts for 60 s after mount — covers warmup period
// where all data arrives at once and would fire a toast flood.
const TOAST_SUPPRESS_MS = 60_000;
// Once an entity has fired a toast, don't fire again for 72 h to avoid
// repeated notifications when ships drop in/out of AIS coverage.
const TOAST_COOLDOWN_MS = 72 * 60 * 60 * 1000;

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface UseWatchlistReturn {
  entries: WatchlistEntry[];
  addEntry: (query: string, meta?: { callsign?: string; registration?: string; aircraftType?: string }) => void;
  removeEntry: (id: string) => void;
  watchedEntities: WatchedEntity[];
}

export function useWatchlist(): UseWatchlistReturn {
  // Initialize empty to avoid SSR/client hydration mismatch (#418).
  // localStorage is read in useEffect after mount.
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const data = useDataKeys(WATCHLIST_DATA_KEYS);

  useEffect(() => {
    setEntries(readEntries());
  }, []);

  const addEntry = useCallback((query: string, meta?: { callsign?: string; registration?: string; aircraftType?: string }) => {
    const q = query.trim();
    if (!q) return;
    setEntries((prev) => {
      // Prevent duplicate queries (case-insensitive)
      if (prev.some((e) => e.query.toLowerCase() === q.toLowerCase())) return prev;
      const next = [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          query: q,
          addedAt: Date.now(),
          ...(meta?.callsign ? { callsign: meta.callsign } : {}),
          ...(meta?.registration ? { registration: meta.registration } : {}),
          ...(meta?.aircraftType ? { aircraftType: meta.aircraftType } : {}),
        },
      ];
      writeEntries(next);
      return next;
    });
  }, []);

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      writeEntries(next);
      return next;
    });
  }, []);

  const watchedEntities = useMemo<WatchedEntity[]>(() => {
    if (entries.length === 0) return [];

    const commercial = (data.commercial_flights as CommercialFlight[] | undefined) ?? [];
    const privateFlights = (data.private_flights as PrivateFlight[] | undefined) ?? [];
    const privateJets = (data.private_jets as PrivateJet[] | undefined) ?? [];
    const military = (data.military_flights as MilitaryFlight[] | undefined) ?? [];
    const tracked = (data.tracked_flights as TrackedFlight[] | undefined) ?? [];
    const ships = (data.ships as Ship[] | undefined) ?? [];

    const results: WatchedEntity[] = [];
    // Dedup: one entity can only match one watchlist entry (first match wins)
    const matchedKeys = new Set<string>();

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const color = WATCH_COLORS[i % WATCH_COLORS.length];

      // ── Flights ──
      type AnyFlight = CommercialFlight | PrivateFlight | PrivateJet | MilitaryFlight | TrackedFlight;
      const allFlights: AnyFlight[] = [...commercial, ...privateFlights, ...privateJets, ...military, ...tracked];

      for (const f of allFlights) {
        const key = (f.callsign || f.icao24 || '').trim();
        if (!key || matchedKeys.has(key)) continue;

        const trackedName = (f as TrackedFlight).tracked_name;
        const force = (f as MilitaryFlight).force;

        if (!matchesQuery(entry.query, f.callsign, f.registration, f.icao24, trackedName)) continue;

        matchedKeys.add(key);

        const etaStr = computeEta(f.lat, f.lng, f.dest_loc, f.speed_knots);

        results.push({
          watchId: entry.id,
          query: entry.query,
          entityType: 'flight',
          key,
          label: f.callsign || f.registration || f.icao24 || '—',
          subLabel: [f.model, force].filter(Boolean).join(' · ') || undefined,
          lat: f.lat,
          lng: f.lng,
          altitude: f.alt > 0 ? f.alt : undefined,
          speed: f.speed_knots ?? undefined,
          heading: f.heading ?? undefined,
          origin: f.origin_name ?? (f.origin_loc ? `${f.origin_loc[1].toFixed(1)},${f.origin_loc[0].toFixed(1)}` : undefined),
          destination: f.dest_name ?? (f.dest_loc ? `${f.dest_loc[1].toFixed(1)},${f.dest_loc[0].toFixed(1)}` : undefined),
          registration: f.registration || f.icao24 || undefined,
          country: f.country,
          etaStr,
          color,
        });
      }

      // ── Ships ──
      for (const s of ships) {
        const key = s.mmsi != null ? String(s.mmsi).trim() : '';
        if (!key || matchedKeys.has(key)) continue;

        if (!matchesQuery(entry.query, s.name, s.callsign, s.mmsi)) continue;

        matchedKeys.add(key);

        results.push({
          watchId: entry.id,
          query: entry.query,
          entityType: 'ship',
          key,
          label: s.name || `MMSI ${s.mmsi}`,
          subLabel: [s.type, s.country].filter(Boolean).join(' · ') || undefined,
          lat: s.lat,
          lng: s.lng,
          speed: s.sog,
          heading: s.cog,
          destination: s.destination || undefined,
          country: s.country,
          color,
        });
      }
    }

    return results;
  }, [entries, data]);

  // Toast notification when a watchlisted entity appears live on the map.
  // Rules:
  //  1. Suppress all toasts for TOAST_SUPPRESS_MS after mount (startup warmup).
  //  2. Fire at most 1 toast per watchlist entry — batches multiple matches.
  //  3. Per-entity cooldown of TOAST_COOLDOWN_MS prevents repeated toasts when
  //     vessels drop in/out of AIS coverage between poll cycles.
  const mountTimeRef = useRef<number>(Date.now());
  const prevEntityKeysRef = useRef<Set<string>>(new Set());
  // Maps entity key → timestamp of last toast fire
  const toastCooldownRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const now = Date.now();
    // Suppress toast flood during startup warmup
    if (now - mountTimeRef.current < TOAST_SUPPRESS_MS) {
      // Still update prevEntityKeysRef so we have a baseline after warmup
      prevEntityKeysRef.current = new Set(watchedEntities.map((e) => e.key));
      return;
    }

    const prev = prevEntityKeysRef.current;
    const cooldowns = toastCooldownRef.current;
    const current = new Set(watchedEntities.map((e) => e.key));

    // Group newly-appeared entities by watchlist entry id
    const newByEntry = new Map<string, WatchedEntity[]>();
    for (const e of watchedEntities) {
      if (prev.has(e.key)) continue;
      const lastFired = cooldowns.get(e.key) ?? 0;
      if (now - lastFired < TOAST_COOLDOWN_MS) continue;
      const arr = newByEntry.get(e.watchId) ?? [];
      arr.push(e);
      newByEntry.set(e.watchId, arr);
    }

    // Fire at most 1 toast per watchlist entry
    for (const [watchId, matched] of newByEntry) {
      const first = matched[0];
      const extra = matched.length - 1;
      const title = extra > 0
        ? `${first.label} (+${extra} more) matched on map`
        : `${first.label} is live on map`;
      emitToast({
        id: `watchlist-appear-${watchId}-${now}`,
        title,
        source: 'WATCHLIST',
        severity: 'HIGH',
      });
      // Mark cooldown for each entity that triggered this toast
      for (const e of matched) cooldowns.set(e.key, now);
    }

    prevEntityKeysRef.current = current;
  }, [watchedEntities]);

  return { entries, addEntry, removeEntry, watchedEntities };
}
