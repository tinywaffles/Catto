import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 8000;

// GDELT GeoJSON API — filters news to conflict/violence mentions (last 24h)
const QUERY = encodeURIComponent(
  '(battle OR airstrike OR "air strike" OR shelling OR explosion OR ambush ' +
  'OR "military operation" OR offensive OR bombardment OR clash OR hostilities ' +
  'OR "armed conflict" OR ceasefire OR "killed in" OR "war crime")',
);
const GDELT_URL =
  `https://api.gdeltproject.org/api/v2/geo/geo?query=${QUERY}` +
  `&TIMESPAN=1440&MAXROWS=1000&OUTPUTFORMAT=GeoJSON`;

interface GdeltFeature {
  geometry?: { coordinates?: unknown };
  properties?: { name?: string; url?: string };
}

interface GdeltConflictResult {
  lat: number;
  lng: number;
  title: string;
  url: string;
  date: string;
}

export async function GET() {
  try {
    const res = await fetch(GDELT_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json([], { status: 200 });
    }

    const geojson = await res.json() as { features?: GdeltFeature[] };

    const events: GdeltConflictResult[] = (geojson.features || [])
      .map((f) => {
        const coords = f.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return null;
        const lng = Number(coords[0]);
        const lat = Number(coords[1]);
        if (isNaN(lat) || isNaN(lng)) return null;
        return {
          lat,
          lng,
          title: f.properties?.name || 'GDELT Conflict Event',
          url: f.properties?.url || '',
          date: new Date().toISOString(),
        };
      })
      .filter((e): e is GdeltConflictResult => e !== null);

    return NextResponse.json(events);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
