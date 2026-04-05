import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Global Fishing Watch API v3 — returns vessel events near Singapore / global waters.
// Requires GFW_API_TOKEN env variable.
export async function GET() {
  const token = process.env.GFW_API_TOKEN;
  if (!token) return NextResponse.json([]);

  try {
    // Query fishing events in the last 24 hours globally
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const startDate = yesterday.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    const params = new URLSearchParams({
      'start-date': startDate,
      'end-date': endDate,
      limit: '200',
      offset: '0',
    });

    const res = await fetch(
      `https://gateway.api.globalfishingwatch.org/v3/events?datasets[0]=public-global-fishing-events:latest&${params}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    );

    if (!res.ok) return NextResponse.json([]);
    const body = await res.json();
    const events: Record<string, unknown>[] = body.entries ?? body.events ?? body ?? [];

    const vessels = events
      .filter((e) => {
        const pos = e.position as Record<string, unknown> | null;
        return pos && typeof pos.lat === 'number' && typeof pos.lon === 'number';
      })
      .map((e) => {
        const pos = e.position as Record<string, unknown>;
        const vessel = (e.vessel as Record<string, unknown>) ?? {};
        return {
          id: String(e.id ?? ''),
          lat: Number(pos.lat),
          lng: Number(pos.lon),
          vessel_name: String(vessel.name ?? vessel.ssvid ?? ''),
          vessel_flag: String(vessel.flag ?? ''),
          type: String(e.type ?? 'fishing'),
          start: String(e.start ?? ''),
          end: String(e.end ?? ''),
        };
      });

    return NextResponse.json(vessels);
  } catch {
    return NextResponse.json([]);
  }
}
