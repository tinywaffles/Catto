/**
 * Granular reactive data store — replaces the monolithic `data` prop cascade.
 *
 * Components subscribe to individual keys via useDataKey("ships") or
 * useDataKeys(["ships", "sigint"]) and ONLY re-render when those specific
 * keys change.  This eliminates the re-render cascade where every 15-second
 * fast poll forced all 8+ dashboard components to reconcile.
 *
 * Built on React 18 useSyncExternalStore — zero dependencies, tear-free reads.
 */
import { useSyncExternalStore, useRef, useMemo } from "react";
import type { DashboardData } from "@/types/dashboard";
import type { BackendStatus } from "./useDataPolling";

// ── Store singleton ──────────────────────────────────────────────────────
type Listener = () => void;

/** Per-key listener sets — only listeners subscribed to changed keys fire. */
const keyListeners = new Map<string, Set<Listener>>();
/** Global listeners — fire on ANY key change (used by useDataSnapshot). */
const globalListeners = new Set<Listener>();

const store: Record<string, unknown> = {};

/** Per-key client-side timestamps (ms epoch) — updated on every mergeData write. */
const dataTimestamps: Record<string, number> = {};

let backendStatus: BackendStatus = "connecting";
const statusListeners = new Set<Listener>();

// ── Playback history ─────────────────────────────────────────────────────────

/** Keys whose values are snapshotted for historical playback. */
const PLAYBACK_KEYS = new Set([
  'gdelt_conflict', 'gdelt',
  'otx_pulses', 'feodo_c2', 'cisa_kev', 'ransomware_iocs', 'singcert_advisories',
]);

const MAX_SNAPSHOTS_PER_KEY  = 96;              // max entries per key (~8 h at 5 min, 24 h at 15 min)
const MIN_SNAPSHOT_INTERVAL  = 5 * 60 * 1000;  // dedupe: at most one snapshot per key per 5 min
const HISTORY_WINDOW_MS      = 24 * 60 * 60 * 1000;

type HistoryEntry = { ts: number; data: unknown };
const playbackHistory  = new Map<string, HistoryEntry[]>();
const lastSnapshotTime = new Map<string, number>();

function recordHistoryEntry(key: string, data: unknown) {
  const now = Date.now();
  if (now - (lastSnapshotTime.get(key) ?? 0) < MIN_SNAPSHOT_INTERVAL) return;
  lastSnapshotTime.set(key, now);
  let buf = playbackHistory.get(key);
  if (!buf) { buf = []; playbackHistory.set(key, buf); }
  // Shallow-copy arrays so mutations to the live store don't corrupt history
  buf.push({ ts: now, data: Array.isArray(data) ? [...(data as unknown[])] : data });
  // Prune by count and age
  const cutoff = now - HISTORY_WINDOW_MS;
  while (buf.length > MAX_SNAPSHOTS_PER_KEY || (buf.length > 0 && buf[0].ts < cutoff)) buf.shift();
}

/** Binary-search for the latest snapshot at or before `ts`. */
function findSnapshotAt(key: string, ts: number): unknown | undefined {
  const buf = playbackHistory.get(key);
  if (!buf || buf.length === 0) return undefined;
  let lo = 0, hi = buf.length - 1, best: HistoryEntry | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (buf[mid].ts <= ts) { best = buf[mid]; lo = mid + 1; } else hi = mid - 1;
  }
  return best?.data;
}

// ── Playback state ────────────────────────────────────────────────────────────

/** When non-empty, these values shadow the live store for PLAYBACK_KEYS. */
const playbackOverlay = new Map<string, unknown>();
const playbackStateListeners = new Set<Listener>();
let _playbackState: { isActive: boolean; ts: number | null } = { isActive: false, ts: null };

/**
 * Cached merged snapshot for useDataSnapshot — rebuilt only when playback
 * state changes or when mergeData fires while overlay is active.
 *
 * React's useSyncExternalStore requires getSnapshot to return the SAME
 * reference between store updates.  Creating { ...store } on every call
 * violates that contract and throws "The result of getSnapshot should be
 * cached to avoid an infinite loop", crashing every component that calls
 * useDataSnapshot (including MaplibreViewer).
 */
let _overlaySnapshot: Record<string, unknown> | null = null;

function _rebuildOverlaySnapshot() {
  if (playbackOverlay.size === 0) {
    _overlaySnapshot = null;
    return;
  }
  const merged: Record<string, unknown> = { ...store };
  for (const [k, v] of playbackOverlay) {
    // Don't overwrite live data with undefined — means no snapshot for this key
    if (v !== undefined) merged[k] = v;
  }
  _overlaySnapshot = merged;
}

function _applyPlaybackOverlay(ts: number) {
  playbackOverlay.clear();
  for (const key of PLAYBACK_KEYS) {
    const snap = findSnapshotAt(key, ts);
    // Fall back to live data if no history exists yet for this time
    playbackOverlay.set(key, snap !== undefined ? snap : store[key]);
  }
}

function _notifyPlayback() {
  // Rebuild the cached overlay snapshot BEFORE notifying subscribers so that
  // any getSnapshot call during the notification sees the new stable reference.
  _rebuildOverlaySnapshot();
  // Notify per-key subscribers for every playback key
  for (const key of PLAYBACK_KEYS) {
    const set = keyListeners.get(key);
    if (set) for (const fn of set) fn();
  }
  for (const fn of globalListeners) fn();
  for (const fn of playbackStateListeners) fn();
}

export function activatePlayback(ts: number) {
  _applyPlaybackOverlay(ts);
  _playbackState = { isActive: true, ts };
  _notifyPlayback();
}

export function deactivatePlayback() {
  playbackOverlay.clear();
  _overlaySnapshot = null;
  _playbackState = { isActive: false, ts: null };
  _notifyPlayback();
}

/** Returns the earliest timestamp for which any playback key has a snapshot. */
export function getPlaybackHistoryOldest(): number | null {
  let oldest: number | null = null;
  for (const buf of playbackHistory.values()) {
    if (buf.length > 0 && (oldest === null || buf[0].ts < oldest)) oldest = buf[0].ts;
  }
  return oldest;
}

export function usePlaybackState(): { isActive: boolean; ts: number | null } {
  const sub  = (cb: Listener) => { playbackStateListeners.add(cb); return () => { playbackStateListeners.delete(cb); }; };
  const snap = () => _playbackState;
  return useSyncExternalStore(sub, snap, snap);
}

// ── Per-key refresh TTL (static / slow-changing feeds) ───────────────────
/** Keys listed here are skipped in mergeData until their TTL elapses.
 *  Prevents unnecessary re-renders for feeds that update rarely. */
const KEY_TTL_MS: Partial<Record<string, number>> = {
  military_bases: 24 * 60 * 60 * 1000, // 24 h — static reference data
  power_plants:   24 * 60 * 60 * 1000, // 24 h — static reference data
  satellites:     10 * 60 * 1000,      // 10 min — TLE positions
};
const keyLastUpdated = new Map<string, number>();

// ── Write API (called from useDataPolling) ───────────────────────────────

/** Merge a partial payload into the store, notifying only affected keys.
 *  Keys with a configured TTL are skipped until their TTL elapses, preventing
 *  unnecessary re-renders for static reference datasets. */
export function mergeData(patch: Record<string, unknown>) {
  const changedKeys: string[] = [];
  for (const key of Object.keys(patch)) {
    const ttl = KEY_TTL_MS[key];
    // Skip this key if it has a TTL and is not yet stale
    if (ttl && store[key] !== undefined) {
      const age = Date.now() - (keyLastUpdated.get(key) ?? 0);
      if (age < ttl) continue;
    }
    const next = patch[key];
    if (store[key] !== next) {
      store[key] = next;
      changedKeys.push(key);
      if (PLAYBACK_KEYS.has(key)) recordHistoryEntry(key, next);
    }
    dataTimestamps[key] = Date.now();
    if (ttl) keyLastUpdated.set(key, Date.now());
  }
  // Notify per-key subscribers
  for (const key of changedKeys) {
    const set = keyListeners.get(key);
    if (set) for (const fn of set) fn();
  }
  // Notify global subscribers only if something actually changed
  if (changedKeys.length > 0) {
    // If playback overlay is active the merged snapshot must be rebuilt so that
    // getSnapshot returns a fresh stable reference reflecting the new store state.
    if (playbackOverlay.size > 0) _rebuildOverlaySnapshot();
    for (const fn of globalListeners) fn();
  }
}

export function setBackendStatus(next: BackendStatus) {
  if (backendStatus === next) return;
  backendStatus = next;
  for (const fn of statusListeners) fn();
}

// ── Read API (hooks) ─────────────────────────────────────────────────────

/** Subscribe to a single data key.  Component only re-renders when that key's
 *  reference identity changes. */
export function useDataKey<K extends keyof DashboardData>(key: K): DashboardData[K] {
  const subscribe = useMemo(() => {
    return (onStoreChange: Listener) => {
      let set = keyListeners.get(key as string);
      if (!set) {
        set = new Set();
        keyListeners.set(key as string, set);
      }
      set.add(onStoreChange);
      return () => {
        set!.delete(onStoreChange);
        if (set!.size === 0) keyListeners.delete(key as string);
      };
    };
  }, [key]);

  const getSnapshot = useMemo(() => {
    return () => {
      const k = key as string;
      if (playbackOverlay.size > 0 && PLAYBACK_KEYS.has(k)) {
        return (playbackOverlay.get(k) ?? store[k]) as DashboardData[K];
      }
      return store[k] as DashboardData[K];
    };
  }, [key]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Subscribe to multiple keys.  Returns a stable object whose identity only
 *  changes when any of the subscribed keys change. */
export function useDataKeys<K extends keyof DashboardData>(
  keys: readonly K[],
): Pick<DashboardData, K> {
  // Stable key list — avoid re-subscribing on every render
  const keysRef = useRef(keys);
  const keysStr = keys.join(",");
  const stableKeys = useMemo(() => {
    keysRef.current = keys;
    return keys;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysStr]);

  const subscribe = useMemo(() => {
    return (onStoreChange: Listener) => {
      const unsubs: (() => void)[] = [];
      for (const key of stableKeys) {
        let set = keyListeners.get(key as string);
        if (!set) {
          set = new Set();
          keyListeners.set(key as string, set);
        }
        set.add(onStoreChange);
        unsubs.push(() => {
          set!.delete(onStoreChange);
          if (set!.size === 0) keyListeners.delete(key as string);
        });
      }
      return () => { for (const u of unsubs) u(); };
    };
  }, [stableKeys]);

  // Build a snapshot object whose identity is stable across renders when the
  // underlying values haven't changed.
  const prevRef = useRef<Pick<DashboardData, K> | null>(null);
  const getSnapshot = useMemo(() => {
    return () => {
      const prev = prevRef.current;
      let same = prev !== null;
      const obj = {} as Record<string, unknown>;
      for (const key of stableKeys) {
        const k = key as string;
        const val = (playbackOverlay.size > 0 && PLAYBACK_KEYS.has(k))
          ? (playbackOverlay.get(k) ?? store[k])
          : store[k];
        obj[k] = val;
        if (same && prev![key as string as K] !== val) same = false;
      }
      if (same) return prev!;
      const next = obj as Pick<DashboardData, K>;
      prevRef.current = next;
      return next;
    };
  }, [stableKeys]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Subscribe to backend connection status. */
export function useBackendStatus(): BackendStatus {
  const subscribe = useMemo(() => {
    return (onStoreChange: Listener) => {
      statusListeners.add(onStoreChange);
      return () => { statusListeners.delete(onStoreChange); };
    };
  }, []);
  const getSnapshot = useMemo(() => () => backendStatus, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Non-reactive getter for client-side per-key timestamps.
 *  Components using useDataSnapshot() will already re-render on data changes,
 *  so they can call getDataTimestamp() at render-time to get current values. */
export function getDataTimestamp(key: string): number | undefined {
  return dataTimestamps[key];
}

/** Full snapshot — used only by components that genuinely need everything
 *  (e.g. MaplibreViewer).  Re-renders on ANY key change, same as before.
 *
 *  getSnapshot returns _overlaySnapshot (rebuilt by _notifyPlayback /
 *  mergeData) when playback is active, or the live store singleton otherwise.
 *  Both are stable references — satisfying useSyncExternalStore's caching
 *  requirement and preventing the infinite-loop crash. */
export function useDataSnapshot(): Record<string, unknown> {
  const subscribe = useMemo(() => {
    return (onStoreChange: Listener) => {
      globalListeners.add(onStoreChange);
      return () => { globalListeners.delete(onStoreChange); };
    };
  }, []);
  // Stable function reference — returns pre-built snapshot, never allocates inline
  const getSnapshot = useMemo(() => () => _overlaySnapshot ?? store, []);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
