'use client';
import { useEffect } from 'react';
import { mergeData } from './useDataStore';
import type { AdsbMilitaryFlight, FishingEvent, NotamEntry } from '@/types/dashboard';

const MILITARY_POLL_MS = 30_000;   // ADS-B military — refresh every 30s
const NOTAM_POLL_MS   = 600_000;  // NOTAMs — refresh every 10 min
const FISHING_POLL_MS = 300_000;  // GFW fishing — refresh every 5 min (within 3000km of SG)
const FISHING_FAR_MS  =  60_000;  // GFW fishing — 60s when all events are beyond 3000km of SG

// Singapore reference for distance-based adaptive polling
const _SG_LAT = 1.35;
const _SG_LNG = 103.82;
const _SG_KM_FISH = 3000;

function _fishingNearSG(events: unknown[]): boolean {
  for (const e of events) {
    const ev = e as { lat?: number; lng?: number };
    if (ev.lat == null || ev.lng == null) continue;
    const R = 6371;
    const dLat = ((ev.lat - _SG_LAT) * Math.PI) / 180;
    const dLng = ((ev.lng - _SG_LNG) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((_SG_LAT * Math.PI) / 180) * Math.cos((ev.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (dist <= _SG_KM_FISH) return true;
  }
  return false;
}

export function useAviationFeeds() {
  useEffect(() => {
    let cancelled = false;
    let militaryTimer: ReturnType<typeof setTimeout>;
    let notamTimer: ReturnType<typeof setTimeout>;
    let fishingTimer: ReturnType<typeof setTimeout>;

    async function fetchMilitary() {
      try {
        const r = await fetch('/api/aviation/adsb-military');
        if (r.ok) {
          const flights = await r.json();
          if (Array.isArray(flights)) {
            mergeData({ adsb_military_flights: flights as AdsbMilitaryFlight[] });
          }
        }
      } catch { /* ignore */ }
      if (!cancelled) militaryTimer = setTimeout(fetchMilitary, MILITARY_POLL_MS);
    }

    async function fetchNotam() {
      try {
        const r = await fetch('/api/aviation/notam');
        if (r.ok) {
          const entries = await r.json();
          if (Array.isArray(entries)) {
            // Filter to Singapore FIR region (lat -5 to 15N, lon 95 to 120E)
            // Also accept entries with no lat/lng but location starting with WS/WM/WI (SG/Malaysia/Indonesia FIR)
            const sgFir = (entries as NotamEntry[]).filter((n) => {
              if (n.lat != null && n.lng != null) {
                return n.lat >= -5 && n.lat <= 15 && n.lng >= 95 && n.lng <= 120;
              }
              return n.location?.match(/^(WS|WM|WI|VH)/i) != null;
            });
            mergeData({ notam_entries: sgFir });
          }
        }
      } catch { /* ignore */ }
      if (!cancelled) notamTimer = setTimeout(fetchNotam, NOTAM_POLL_MS);
    }

    async function fetchFishing() {
      let nextMs = FISHING_POLL_MS;
      try {
        const r = await fetch('/api/fishing');
        if (r.ok) {
          const events = await r.json();
          if (Array.isArray(events)) {
            mergeData({ fishing_activity: events as FishingEvent[] });
            // Use shorter 60s interval if no fishing events are near Singapore
            if (events.length > 0 && !_fishingNearSG(events)) nextMs = FISHING_FAR_MS;
          }
        }
      } catch { /* ignore */ }
      if (!cancelled) fishingTimer = setTimeout(fetchFishing, nextMs);
    }

    void fetchMilitary();
    void fetchNotam();
    void fetchFishing();

    return () => {
      cancelled = true;
      clearTimeout(militaryTimer);
      clearTimeout(notamTimer);
      clearTimeout(fishingTimer);
    };
  }, []);
}
