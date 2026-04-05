'use client';
import { useEffect, useRef } from 'react';
import { mergeData } from './useDataStore';
import type { TrafficIncident, TrafficSpeedBand, PsiReading, ScdfIncident, SgSecureAlert, BusStop, MrtAlert, SpfEstablishment } from '@/types/dashboard';
import { emitToast } from '@/lib/toastBus';

const POLL_MS = 300_000; // 5 min — Singapore feeds change slowly
const BUS_POLL_MS = 300_000; // bus stops are static — poll every 5 min
const SPF_POLL_MS = 600_000; // SPF establishments are static — poll every 10 min

interface LtaIncident {
  Type: string;
  Latitude: number;
  Longitude: number;
  Message: string;
}

interface LtaSpeedBand {
  LinkID: string;
  RoadName: string;
  SpeedBand: number;
  MinimumSpeed: number;
  MaximumSpeed: number;
  Location: string;
}

export function useSingaporeFeeds() {
  // Track MRT alert messages already toasted to avoid re-emitting on every poll
  const seenMrtRef = useRef<Set<string>>(new Set());
  const firstFetchRef = useRef(true);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let busTimer: ReturnType<typeof setTimeout>;
    let spfTimer: ReturnType<typeof setTimeout>;
    async function fetchSpfEstablishments() {
      try {
        const r = await fetch('/api/sg/spf-establishments');
        if (r.ok) {
          const data = await r.json();
          if (Array.isArray(data)) mergeData({ spf_establishments: data as SpfEstablishment[] });
        }
      } catch { /* ignore */ }
      if (!cancelled) spfTimer = setTimeout(fetchSpfEstablishments, SPF_POLL_MS);
    }

    async function fetchBusStops() {
      try {
        const r = await fetch('/api/sg/bus-arrivals');
        if (r.ok) {
          const stops = await r.json();
          if (Array.isArray(stops)) mergeData({ bus_stops: stops as BusStop[] });
        }
      } catch { /* ignore */ }
      if (!cancelled) busTimer = setTimeout(fetchBusStops, BUS_POLL_MS);
    }

async function fetchAll() {
      try {
      const [incidents, bands, psi, scdf, sgsecure, mrt] = await Promise.allSettled([
        fetch('/api/sg/road-incidents').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/sg/traffic-speed-bands').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/sg/psi').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/sg/scdf').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/sg/sgsecure').then((r) => (r.ok ? r.json() : null)),
        fetch('/api/sg/mrt-alerts').then((r) => (r.ok ? r.json() : null)),
      ]);

      if (cancelled) return;

      const patch: Record<string, unknown> = {};

      if (incidents.status === 'fulfilled' && Array.isArray(incidents.value?.value)) {
        patch.road_incidents = incidents.value.value.map(
          (i: LtaIncident): TrafficIncident => ({
            type: i.Type,
            lat: i.Latitude,
            lng: i.Longitude,
            message: i.Message,
          }),
        );
      }

      if (bands.status === 'fulfilled' && Array.isArray(bands.value?.value)) {
        patch.traffic_speed_bands = bands.value.value.map(
          (b: LtaSpeedBand): TrafficSpeedBand => ({
            link_id: b.LinkID,
            road_name: b.RoadName,
            speed_band: b.SpeedBand,
            min_speed: b.MinimumSpeed,
            max_speed: b.MaximumSpeed,
            location: b.Location,
          }),
        );
      }

      if (psi.status === 'fulfilled' && Array.isArray(psi.value)) {
        patch.psi_sg = psi.value as PsiReading[];
      }
      if (scdf.status === 'fulfilled' && Array.isArray(scdf.value)) {
        patch.scdf_incidents = scdf.value as ScdfIncident[];
      }
      if (sgsecure.status === 'fulfilled' && Array.isArray(sgsecure.value)) {
        patch.sgsecure_alerts = sgsecure.value as SgSecureAlert[];
      }

      if (mrt.status === 'fulfilled' && Array.isArray(mrt.value)) {
        const alerts = mrt.value as MrtAlert[];
        patch.mrt_alerts = alerts;
        // Emit toast for new MRT disruptions (skip on first fetch to avoid spam)
        if (!firstFetchRef.current) {
          for (const alert of alerts) {
            const key = alert.message || alert.created_date;
            if (!seenMrtRef.current.has(key)) {
              seenMrtRef.current.add(key);
              emitToast({
                id: `mrt-${key}`,
                title: alert.message || 'MRT service disruption',
                source: 'LTA MRT',
                severity: 'HIGH',
                link: 'https://www.lta.gov.sg/content/ltagov/en/getting_around/public_transport/trains.html',
              });
            }
          }
        } else {
          // Seed seen set on first fetch
          for (const alert of alerts) {
            seenMrtRef.current.add(alert.message || alert.created_date);
          }
        }
      }

      firstFetchRef.current = false;

      if (Object.keys(patch).length > 0) {
        mergeData(patch);
      }

      } catch { /* ignore unexpected errors */ }
      if (!cancelled) {
        timer = setTimeout(fetchAll, POLL_MS);
      }
    }

    void fetchAll();
    void fetchBusStops();
    void fetchSpfEstablishments();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearTimeout(busTimer);
      clearTimeout(spfTimer);
    };
  }, []);
}
