import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// ADS-B Exchange — unfiltered military flight feed.
// Uses ADSBX_API_KEY (RapidAPI key for adsbexchange-com1.p.rapidapi.com).
// Falls back to the public adsb.lol /v2/mil endpoint if no key.
export async function GET() {
  const apiKey = process.env.ADSBX_API_KEY;

  try {
    if (apiKey) {
      // RapidAPI / ADS-B Exchange paid tier — unfiltered global military
      const res = await fetch(
        'https://adsbexchange-com1.p.rapidapi.com/v2/mil/',
        {
          headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': 'adsbexchange-com1.p.rapidapi.com',
          },
          cache: 'no-store',
        },
      );
      if (!res.ok) return NextResponse.json([]);
      const data = await res.json();
      const ac = data.ac ?? data.aircraft ?? [];
      return NextResponse.json(
        ac
          .filter((a: Record<string, unknown>) => a.lat != null && a.lon != null)
          .map((a: Record<string, unknown>) => ({
            hex: String(a.hex ?? a.icao ?? ''),
            flight: String(a.flight ?? a.callsign ?? '').trim(),
            lat: Number(a.lat),
            lng: Number(a.lon),
            alt_baro: a.alt_baro != null ? Number(a.alt_baro) : null,
            gs: a.gs != null ? Number(a.gs) : null,
            track: a.track != null ? Number(a.track) : null,
            t: String(a.t ?? a.type ?? ''),
            desc: String(a.desc ?? a.r ?? ''),
          })),
      );
    }

    // Free fallback: adsb.lol military endpoint
    const res = await fetch('https://api.adsb.lol/v2/mil', {
      headers: { 'User-Agent': 'Catto/1.0' },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json([]);
    const data = await res.json();
    const ac = data.ac ?? [];
    return NextResponse.json(
      ac
        .filter((a: Record<string, unknown>) => a.lat != null && a.lon != null)
        .map((a: Record<string, unknown>) => ({
          hex: String(a.hex ?? ''),
          flight: String(a.flight ?? '').trim(),
          lat: Number(a.lat),
          lng: Number(a.lon),
          alt_baro: a.alt_baro != null ? Number(a.alt_baro) : null,
          gs: a.gs != null ? Number(a.gs) : null,
          track: a.track != null ? Number(a.track) : null,
          t: String(a.t ?? ''),
          desc: String(a.desc ?? a.r ?? ''),
        })),
    );
  } catch {
    return NextResponse.json([]);
  }
}
