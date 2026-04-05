'use client';

import { useMemo, useRef } from 'react';
import { useDataKeys } from '@/hooks/useDataStore';
import type { GdeltConflictEvent, MilitaryFlight, GDELTIncident, UcdpConflictEvent } from '@/types/dashboard';

export type RegionName =
  | 'Middle East'
  | 'East Asia'
  | 'Europe'
  | 'Southeast Asia'
  | 'South Asia'
  | 'Africa'
  | 'Americas';

export type SituationType =
  | 'MULTI-DOMAIN ALERT'
  | 'CONFLICT ESCALATION'
  | 'MILITARY ACTIVITY'
  | 'CIVIL UNREST';

/** Granular breakdown of the signals that triggered a situation. */
export interface SituationDetails {
  /** GDELT conflict events in region within 6-hour window */
  conflictEvents: Array<{ title: string; url?: string; date?: string; tone?: number }>;
  /** Total conflict event count (may exceed displayed items) */
  conflictCount: number;

  /** Military flights currently in region */
  militaryFlights: Array<{ callsign: string; military_type?: string; force?: string; country: string }>;
  militaryCount: number;

  /** GDELT news clusters in region */
  newsItems: Array<{ name: string; topHeadline?: string; url?: string }>;
  newsCount: number;

  /** Thresholds used for spike detection */
  thresholds: { conflict: number; military: number; news: number };

  /** Which signal types spiked */
  spikes: { conflict: boolean; military: boolean; news: boolean };
}

export interface Situation {
  id: string;
  region: RegionName;
  type: SituationType;
  signalCount: number;
  firstDetected: number; // epoch ms
  center: [number, number]; // [lat, lng]
  details: SituationDetails;
}

export type RegionStatus = 'green' | 'amber' | 'red';

interface RegionDef {
  bounds: [number, number, number, number]; // [minLat, maxLat, minLng, maxLng]
  center: [number, number]; // [lat, lng]
}

export const REGIONS: Record<RegionName, RegionDef> = {
  'Middle East':    { bounds: [12,  42,  25,   65],  center: [30,   45]  },
  'East Asia':      { bounds: [20,  55,  100,  145], center: [35,   120] },
  'Europe':         { bounds: [35,  72,  -12,  45],  center: [52,   15]  },
  'Southeast Asia': { bounds: [-10, 25,  90,   142], center: [5,    115] },
  'South Asia':     { bounds: [5,   38,  60,   95],  center: [20,   75]  },
  'Africa':         { bounds: [-35, 38,  -20,  55],  center: [5,    20]  },
  'Americas':       { bounds: [-60, 72,  -170, -30], center: [15,   -90] },
};

// Thresholds for a signal type to count as a "spike"
const THRESHOLDS = {
  conflictEvents:  3,  // gdelt_conflict events in region (within 6h window)
  militaryFlights: 2,  // military flights currently in region
  newsVolume:      4,  // GDELT news clusters in region
};

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

function inRegion(lat: number, lng: number, b: [number, number, number, number]): boolean {
  return lat >= b[0] && lat <= b[1] && lng >= b[2] && lng <= b[3];
}

const DETECTOR_KEYS = ['gdelt_conflict', 'military_flights', 'gdelt', 'ucdp_conflict'] as const;

export function useSituationDetector(): {
  situations: Situation[];
  regionStatus: Record<RegionName, RegionStatus>;
} {
  const data = useDataKeys(DETECTOR_KEYS);

  // Track first-detection timestamps per situation block-id (keyed per 6-hour block)
  const firstDetectedRef = useRef<Map<string, number>>(new Map());

  return useMemo(() => {
    const gdeltConflict = (data.gdelt_conflict as GdeltConflictEvent[] | undefined) ?? [];
    const militaryFlights = (data.military_flights as MilitaryFlight[] | undefined) ?? [];
    const gdeltNews = (data.gdelt as GDELTIncident[] | undefined) ?? [];
    const ucdpConflict = (data.ucdp_conflict as UcdpConflictEvent[] | undefined) ?? [];

    const now = Date.now();
    const sixHoursAgo = now - SIX_HOURS_MS;

    const situations: Situation[] = [];
    const regionStatus = {} as Record<RegionName, RegionStatus>;

    for (const [regionName, def] of Object.entries(REGIONS) as [RegionName, RegionDef][]) {
      const { bounds, center } = def;

      // Conflict events — respect 6-hour window if date is available
      const conflictInRegion = gdeltConflict.filter((e) => {
        if (!inRegion(e.lat, e.lng, bounds)) return false;
        if (e.date) {
          const ts = new Date(e.date).getTime();
          if (!isNaN(ts) && ts < sixHoursAgo) return false;
        }
        return true;
      });

      // Military flights — live positions
      const militaryInRegion = militaryFlights.filter((f) =>
        inRegion(f.lat, f.lng, bounds),
      );

      // GDELT news clusters — GeoJSON features, coords are [lng, lat]
      const newsInRegion = gdeltNews.filter((e) => {
        const [lng, lat] = e.geometry.coordinates;
        return inRegion(lat, lng, bounds);
      });

      // UCDP events — used only for status scoring, not spike detection
      const ucdpInRegion = ucdpConflict.filter((e) =>
        inRegion(e.lat, e.lng, bounds),
      ).length;

      // Counts
      const conflictCount  = conflictInRegion.length;
      const militaryCount  = militaryInRegion.length;
      const newsCount      = newsInRegion.length;

      // Spike flags
      const conflictSpike = conflictCount >= THRESHOLDS.conflictEvents;
      const militarySpike = militaryCount >= THRESHOLDS.militaryFlights;
      const newsSpike     = newsCount     >= THRESHOLDS.newsVolume;
      const spikeCount = (conflictSpike ? 1 : 0) + (militarySpike ? 1 : 0) + (newsSpike ? 1 : 0);

      // Situation fires when 2+ signal types spike simultaneously
      if (spikeCount >= 2) {
        let type: SituationType;
        if (spikeCount === 3)                    type = 'MULTI-DOMAIN ALERT';
        else if (conflictSpike && militarySpike) type = 'CONFLICT ESCALATION';
        else if (militarySpike && newsSpike)     type = 'MILITARY ACTIVITY';
        else                                     type = 'CIVIL UNREST';

        // ID resets every 6-hour block — dismissed situations re-surface after TTL
        const blockId = `${regionName}_${Math.floor(now / SIX_HOURS_MS)}`;

        if (!firstDetectedRef.current.has(blockId)) {
          firstDetectedRef.current.set(blockId, now);
        }

        // Build signal detail — cap lists for display, keep actual counts
        const details: SituationDetails = {
          conflictEvents: conflictInRegion.slice(0, 6).map((e) => ({
            title: e.title,
            url:   e.url,
            date:  e.date,
            tone:  e.tone,
          })),
          conflictCount,

          militaryFlights: militaryInRegion.slice(0, 8).map((f) => ({
            callsign:      f.callsign || f.icao24 || '—',
            military_type: f.military_type,
            force:         f.force,
            country:       f.country,
          })),
          militaryCount,

          newsItems: newsInRegion.slice(0, 5).map((e) => ({
            name:        e.properties.name,
            topHeadline: e.properties._headlines_list?.[0],
            url:         e.properties._urls_list?.[0],
          })),
          newsCount,

          thresholds: {
            conflict: THRESHOLDS.conflictEvents,
            military: THRESHOLDS.militaryFlights,
            news:     THRESHOLDS.newsVolume,
          },

          spikes: { conflict: conflictSpike, military: militarySpike, news: newsSpike },
        };

        situations.push({
          id: blockId,
          region: regionName,
          type,
          signalCount: conflictCount + militaryCount + newsCount,
          firstDetected: firstDetectedRef.current.get(blockId)!,
          center,
          details,
        });
      }

      // Region status dot: weighted conflict score
      const conflictScore = conflictCount + ucdpInRegion + militaryCount * 2;
      if (conflictScore >= 8)      regionStatus[regionName] = 'red';
      else if (conflictScore >= 3) regionStatus[regionName] = 'amber';
      else                         regionStatus[regionName] = 'green';
    }

    // Sort: most severe first
    situations.sort((a, b) => {
      const order: Record<SituationType, number> = {
        'MULTI-DOMAIN ALERT':    0,
        'CONFLICT ESCALATION':   1,
        'MILITARY ACTIVITY':     2,
        'CIVIL UNREST':          3,
      };
      return order[a.type] - order[b.type];
    });

    return { situations, regionStatus };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
}
