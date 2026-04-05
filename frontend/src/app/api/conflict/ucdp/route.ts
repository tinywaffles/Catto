import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 8000;

// UCDP Georeferenced Event Dataset API (GED) — events since 2023
const UCDP_URL =
  'https://ucdpapi.pcr.uu.se/api/gedevents/24.1' +
  '?pagesize=2000&page=1&StartDate=2022-01-01';

interface UcdpRawEvent {
  id?: string | number;
  latitude?: string | number;
  longitude?: string | number;
  country?: string;
  conflict_name?: string;
  type_of_violence?: string | number;
  best?: string | number;
  deaths_best?: string | number;
  year?: string | number;
  date_start?: string;
  date_end?: string;
}

interface UcdpConflictResult {
  id: string;
  lat: number;
  lng: number;
  country: string;
  conflict_name: string;
  type_of_violence: number;
  deaths_best: number;
  year: number;
  date_start: string;
}

export async function GET() {
  try {
    const res = await fetch(UCDP_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (!res.ok) {
      return NextResponse.json([], { status: 200 });
    }

    const data = await res.json() as { Result?: UcdpRawEvent[] };
    const results: UcdpRawEvent[] = data.Result || [];

    const events: UcdpConflictResult[] = results
      .map((e) => {
        const lat = parseFloat(String(e.latitude ?? ''));
        const lng = parseFloat(String(e.longitude ?? ''));
        if (isNaN(lat) || isNaN(lng)) return null;
        if (lat === 0 && lng === 0) return null;
        return {
          id: String(e.id || ''),
          lat,
          lng,
          country: String(e.country || ''),
          conflict_name: String(e.conflict_name || ''),
          type_of_violence: Number(e.type_of_violence ?? 1),
          deaths_best: Number(e.best ?? e.deaths_best ?? 0),
          year: Number(e.year ?? new Date().getFullYear()),
          date_start: String(e.date_start || e.date_end || ''),
        };
      })
      .filter((e): e is UcdpConflictResult => e !== null);

    return NextResponse.json(events);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
