'use client';
import { useEffect, useRef } from 'react';
import { mergeData } from './useDataStore';
import type { CisaKevEntry, RansomwareIoc, FeodoC2, OtxPulse, SingCertAdvisory } from '@/types/dashboard';
import { emitToast } from '@/lib/toastBus';

const POLL_MS      = 300_000;   // 5 min — ransomware IOCs, OTX, SingCERT
const KEV_POLL_MS  = 3_600_000; // 1 hour — CISA KEV updates daily
const FEODO_POLL_MS = 1_800_000; // 30 min — Feodo C2 blocklist

export function useCyberFeeds() {
  const seenCertRef = useRef<Set<string>>(new Set());
  const firstFetchRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let kevTimer: ReturnType<typeof setTimeout>;
    let feodoTimer: ReturnType<typeof setTimeout>;

    // ── CISA KEV — hourly ─────────────────────────────────────────────────
    async function fetchKev() {
      try {
        const r = await fetch('/api/cyber/cisa-kev');
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data)) mergeData({ cisa_kev: data as CisaKevEntry[] });
        }
      } catch { /* ignore */ }
      if (!cancelled) kevTimer = setTimeout(fetchKev, KEV_POLL_MS);
    }

    // ── Feodo C2 blocklist — 30 min ───────────────────────────────────────
    async function fetchFeodo() {
      try {
        const r = await fetch('/api/cyber/feodo');
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data)) mergeData({ feodo_c2: data as FeodoC2[] });
        }
      } catch { /* ignore */ }
      if (!cancelled) feodoTimer = setTimeout(fetchFeodo, FEODO_POLL_MS);
    }

    // ── Ransomware IOCs, OTX pulses, SingCERT — 5 min ───────────────────
    async function fetchAll() {
      try {
        const [ransomware, otx, singcert] = await Promise.allSettled([
          fetch('/api/cyber/ransomware').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/cyber/otx').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/cyber/singcert').then((r) => (r.ok ? r.json() : null)),
        ]);

        if (cancelled) return;

        const patch: Record<string, unknown> = {};

        if (ransomware.status === 'fulfilled' && Array.isArray(ransomware.value)) {
          patch.ransomware_iocs = ransomware.value as RansomwareIoc[];
        }
        if (otx.status === 'fulfilled' && Array.isArray(otx.value)) {
          patch.otx_pulses = otx.value as OtxPulse[];
        }
        if (singcert.status === 'fulfilled' && Array.isArray(singcert.value)) {
          const advisories = singcert.value as SingCertAdvisory[];
          patch.singcert_advisories = advisories;
          if (!firstFetchRef.current) {
            for (const a of advisories) {
              if (a.severity !== 'CRITICAL' && a.severity !== 'HIGH') continue;
              const key = a.advisory_id || a.url || a.title;
              if (!seenCertRef.current.has(key)) {
                seenCertRef.current.add(key);
                emitToast({
                  id: `singcert-${key}`,
                  title: a.title,
                  source: 'SingCERT',
                  severity: a.severity,
                  link: a.url || 'https://www.csa.gov.sg/singcert/advisories',
                });
              }
            }
          } else {
            for (const a of advisories) {
              seenCertRef.current.add(a.advisory_id || a.url || a.title);
            }
          }
        }

        firstFetchRef.current = false;
        if (Object.keys(patch).length > 0) mergeData(patch);
      } catch { /* ignore */ }
      if (!cancelled) timer = setTimeout(fetchAll, POLL_MS);
    }

    void fetchKev();
    void fetchFeodo();
    void fetchAll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(kevTimer);
      clearTimeout(feodoTimer);
    };
  }, []);
}
