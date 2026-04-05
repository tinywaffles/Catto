import { useEffect, useRef } from "react";
import { API_BASE } from "@/lib/api";
import { mergeData, setBackendStatus as setStoreBackendStatus } from "./useDataStore";

export type BackendStatus = 'connecting' | 'connected' | 'disconnected';

// ── Startup timing ────────────────────────────────────────────────────────────
// Delaying the first fetches prevents startup OOM: the browser finishes
// rendering the shell + map tiles before heavy JSON payloads arrive.
export const FAST_STARTUP_DELAY_MS = 15_000;  // first fast fetch at 15s
export const SLOW_STARTUP_DELAY_MS = 45_000;  // first slow fetch at 45s

// ── Steady-state polling intervals ───────────────────────────────────────────
const FAST_STEADY_NEAR_MS  = 30_000;  // 30s when live data is near Singapore
const FAST_STEADY_FAR_MS   = 60_000;  // 60s when everything is far from SG
const SLOW_STEADY_MS       = 120_000; // 2 min — slow tier is large, infrequent

// ── Exponential backoff on errors ────────────────────────────────────────────
// First failure retries after 5s, doubling up to 60s max.
const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS  = 60_000;
function backoffDelay(failCount: number): number {
  return Math.min(BACKOFF_BASE_MS * Math.pow(2, failCount - 1), BACKOFF_MAX_MS);
}

type FastDataProbe = {
  commercial_flights?: unknown[];
  military_flights?: unknown[];
  tracked_flights?: unknown[];
  ships?: unknown[];
  sigint?: unknown[];
  cctv?: unknown[];
};

function hasMeaningfulFastData(json: FastDataProbe): boolean {
  return (
    (json.commercial_flights?.length || 0) > 100 ||
    (json.military_flights?.length || 0) > 25 ||
    (json.tracked_flights?.length || 0) > 10 ||
    (json.ships?.length || 0) > 100 ||
    (json.sigint?.length || 0) > 100 ||
    (json.cctv?.length || 0) > 100
  );
}

const _SG_LAT = 1.35;
const _SG_LNG = 103.82;
const _SG_KM = 3000;

function _sgDist(lat: number, lng: number): number {
  const R = 6371;
  const dLat = ((lat - _SG_LAT) * Math.PI) / 180;
  const dLng = ((lng - _SG_LNG) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((_SG_LAT * Math.PI) / 180) * Math.cos((lat as number) * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hasNearSingaporeEntity(json: FastDataProbe): boolean {
  type LatLng = { lat?: number; lng?: number };
  const lists = [
    json.commercial_flights as LatLng[] | undefined,
    json.ships as LatLng[] | undefined,
  ];
  for (const list of lists) {
    if (!list) continue;
    for (const e of list) {
      if (e.lat != null && e.lng != null && _sgDist(e.lat, e.lng) <= _SG_KM) return true;
    }
  }
  return false;
}

/**
 * Event name dispatched by page.tsx when a layer toggle changes.
 * useDataPolling listens for this to immediately refetch slow-tier data
 * so toggled layers (power plants, GDELT, etc.) appear without the usual
 * 120-second wait.
 */
export const LAYER_TOGGLE_EVENT = 'sb:layer-toggle';

/**
 * Polls the backend for fast and slow data tiers with startup delay and
 * exponential backoff on failure.
 *
 * Startup sequence:
 *   t=0s   — hook mounts, no fetches yet (browser renders map shell)
 *   t=15s  — first fast-tier fetch fires
 *   t=45s  — first slow-tier fetch fires
 *
 * Steady-state intervals:
 *   fast  — 30s nearSG / 60s farSG
 *   slow  — 120s
 *
 * On failure: exponential backoff starting at 5s, capped at 60s.
 */
export function useDataPolling() {
  const fastEtag = useRef<string | null>(null);
  const slowEtag = useRef<string | null>(null);

  useEffect(() => {
    let hasData = false;
    let nearSG = true;
    let fastFailCount = 0;
    let slowFailCount = 0;
    let fastTimerId: ReturnType<typeof setTimeout> | null = null;
    let slowTimerId: ReturnType<typeof setTimeout> | null = null;
    const fastAbortRef = { current: null as AbortController | null };
    const slowAbortRef = { current: null as AbortController | null };

    const fetchFastData = async () => {
      if (fastTimerId) { clearTimeout(fastTimerId); fastTimerId = null; }
      if (fastAbortRef.current) return;
      const controller = new AbortController();
      fastAbortRef.current = controller;
      try {
        const headers: Record<string, string> = {};
        if (fastEtag.current) headers['If-None-Match'] = fastEtag.current;
        const res = await fetch(`${API_BASE}/api/live-data/fast`, {
          headers,
          signal: controller.signal,
        });
        if (res.status === 304) {
          setStoreBackendStatus('connected');
          fastFailCount = 0;
          scheduleNext('fast');
          return;
        }
        if (res.ok) {
          setStoreBackendStatus('connected');
          fastEtag.current = res.headers.get('etag') || null;
          const json = await res.json();
          mergeData(json);
          if (hasMeaningfulFastData(json)) hasData = true;
          nearSG = hasNearSingaporeEntity(json);
          fastFailCount = 0;
        } else {
          fastFailCount++;
        }
      } catch (e) {
        const aborted =
          typeof e === 'object' && e !== null && 'name' in e &&
          (e as { name?: string }).name === 'AbortError';
        if (!aborted) {
          console.error("Failed fetching fast live data", e);
          setStoreBackendStatus('disconnected');
          fastFailCount++;
        }
      } finally {
        if (fastAbortRef.current === controller) fastAbortRef.current = null;
      }
      scheduleNext('fast');
    };

    const fetchSlowData = async () => {
      if (slowAbortRef.current) return;
      const controller = new AbortController();
      slowAbortRef.current = controller;
      try {
        const headers: Record<string, string> = {};
        if (slowEtag.current) headers['If-None-Match'] = slowEtag.current;
        const res = await fetch(`${API_BASE}/api/live-data/slow`, {
          headers,
          signal: controller.signal,
        });
        if (res.status === 304) { slowFailCount = 0; scheduleNext('slow'); return; }
        if (res.ok) {
          slowEtag.current = res.headers.get('etag') || null;
          const json = await res.json();
          mergeData(json);
          slowFailCount = 0;
        } else {
          slowFailCount++;
        }
      } catch (e) {
        const aborted =
          typeof e === 'object' && e !== null && 'name' in e &&
          (e as { name?: string }).name === 'AbortError';
        if (!aborted) {
          console.error("Failed fetching slow live data", e);
          slowFailCount++;
        }
      } finally {
        if (slowAbortRef.current === controller) slowAbortRef.current = null;
      }
      scheduleNext('slow');
    };

    const scheduleNext = (tier: 'fast' | 'slow') => {
      if (tier === 'fast') {
        const delay = fastFailCount > 0
          ? backoffDelay(fastFailCount)
          : (nearSG ? FAST_STEADY_NEAR_MS : FAST_STEADY_FAR_MS);
        fastTimerId = setTimeout(fetchFastData, delay);
      } else {
        const delay = slowFailCount > 0
          ? backoffDelay(slowFailCount)
          : SLOW_STEADY_MS;
        slowTimerId = setTimeout(fetchSlowData, delay);
      }
    };

    const onLayerToggle = () => {
      slowEtag.current = null;
      if (slowTimerId) clearTimeout(slowTimerId);
      slowTimerId = null;
      fetchSlowData();
    };
    window.addEventListener(LAYER_TOGGLE_EVENT, onLayerToggle);

    // Staggered startup — fast tier at 15s, slow tier at 45s
    fastTimerId = setTimeout(fetchFastData, FAST_STARTUP_DELAY_MS);
    slowTimerId = setTimeout(fetchSlowData, SLOW_STARTUP_DELAY_MS);

    return () => {
      window.removeEventListener(LAYER_TOGGLE_EVENT, onLayerToggle);
      if (fastTimerId) clearTimeout(fastTimerId);
      if (slowTimerId) clearTimeout(slowTimerId);
      if (fastAbortRef.current) fastAbortRef.current.abort();
      if (slowAbortRef.current) slowAbortRef.current.abort();
    };
  }, []);
}
