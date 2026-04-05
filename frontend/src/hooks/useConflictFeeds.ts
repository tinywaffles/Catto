'use client';
import { useEffect } from 'react';
import { mergeData } from './useDataStore';
import type { AcledEvent, GdeltConflictEvent, UcdpConflictEvent } from '@/types/dashboard';

const GDELT_POLL_MS = 1_800_000;  // 30 minutes — GDELT updates every 15 min
const UCDP_POLL_MS  = 1_800_000;  // 30 minutes — UCDP is semi-static
const ACLED_POLL_MS = 21_600_000; // 6 hours — ACLED is polled infrequently

export function useConflictFeeds() {
  // GDELT + UCDP — 30 minute cadence
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function fetchGdeltUcdp() {
      const [gdelt, ucdp] = await Promise.allSettled([
        fetch('/api/conflict/gdelt').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/conflict/ucdp').then((r) => (r.ok ? r.json() : null)),
      ]);

      if (cancelled) return;

      const patch: Record<string, unknown> = {};
      if (gdelt.status === 'fulfilled' && Array.isArray(gdelt.value)) {
        patch.gdelt_conflict = gdelt.value as GdeltConflictEvent[];
      }
      if (ucdp.status === 'fulfilled' && Array.isArray(ucdp.value)) {
        patch.ucdp_conflict = ucdp.value as UcdpConflictEvent[];
      }
      if (Object.keys(patch).length > 0) mergeData(patch);
      if (!cancelled) timer = setTimeout(fetchGdeltUcdp, Math.max(GDELT_POLL_MS, UCDP_POLL_MS));
    }

    void fetchGdeltUcdp();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  // ACLED — 6 hour cadence
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function fetchAcled() {
      try {
        const res = await fetch('/api/conflict/acled');
        if (!cancelled && res.ok) {
          const events = await res.json() as AcledEvent[];
          if (Array.isArray(events) && events.length > 0) {
            mergeData({ acled_events: events });
          }
        }
      } catch { /* non-fatal */ }
      if (!cancelled) timer = setTimeout(fetchAcled, ACLED_POLL_MS);
    }

    void fetchAcled();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);
}
