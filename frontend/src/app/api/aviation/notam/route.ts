import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// FAA NOTAM API — publicly accessible, no key required.
// Fetches active NOTAMs for key locations: Singapore (WSSS/WSSL),
// major conflict zones, and global TFRs/airspace restrictions.
const LOCATIONS = ['WSSS', 'WSSL', 'RCTP', 'VHHH', 'RJTT', 'OMDB', 'EGLL', 'KJFK', 'KSFO'];

// Approximate ICAO location coords for map placement
const ICAO_COORDS: Record<string, [number, number]> = {
  WSSS: [1.3592, 103.9894],
  WSSL: [1.4168, 103.8678],
  RCTP: [25.0777, 121.2328],
  VHHH: [22.3080, 113.9185],
  RJTT: [35.5533, 139.7811],
  OMDB: [25.2532, 55.3657],
  EGLL: [51.4775, -0.4614],
  KJFK: [40.6413, -73.7781],
  KSFO: [37.6213, -122.379],
};

export async function GET() {
  try {
    const results: Array<{
      id: string;
      location: string;
      notam_text: string;
      effective_start: string;
      effective_end: string;
      lat?: number;
      lng?: number;
      type: string;
      classification: string;
    }> = [];

    // Fetch NOTAMs for each location in parallel
    const fetches = LOCATIONS.map((loc) =>
      fetch(
        `https://external-api.faa.gov/notamapi/v1/notams?responseFormat=JSON&icaoLocation=${loc}&pageSize=10`,
        {
          headers: { 'User-Agent': 'Catto/1.0', Accept: 'application/json' },
          cache: 'no-store',
        },
      )
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    );

    const responses = await Promise.all(fetches);

    for (let i = 0; i < LOCATIONS.length; i++) {
      const loc = LOCATIONS[i];
      const data = responses[i];
      if (!data) continue;
      const items = data.items ?? data.notams ?? [];
      for (const n of items.slice(0, 5)) {
        const core = n.properties?.core ?? n.coreNOTAMData?.notam ?? n;
        const id = core.id ?? n.id ?? '';
        const text =
          core.text ?? core.fullText ?? core.notamText ?? JSON.stringify(core).slice(0, 200);
        const start = core.effectiveStart ?? core.startDate ?? '';
        const end = core.effectiveEnd ?? core.endDate ?? '';
        const classification = core.classification ?? core.purpose ?? 'N';
        const type = classifyNotam(text);
        const coords = ICAO_COORDS[loc];

        results.push({
          id: String(id),
          location: loc,
          notam_text: String(text).slice(0, 500),
          effective_start: String(start),
          effective_end: String(end),
          lat: coords?.[0],
          lng: coords?.[1],
          type,
          classification: String(classification),
        });
      }
    }

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}

function classifyNotam(text: string): string {
  const t = String(text).toUpperCase();
  if (t.includes('TFR') || t.includes('TEMPORARY FLIGHT RESTRICTION')) return 'TFR';
  if (t.includes('RESTRICTED') || t.includes('PROHIBITED')) return 'RESTRICTED';
  if (t.includes('MILITARY') || t.includes('MIL OPS')) return 'MIL';
  if (t.includes('RUNWAY') || t.includes('RWY')) return 'RWY';
  if (t.includes('CLOSURE') || t.includes('CLSD')) return 'CLOSURE';
  return 'INFO';
}
