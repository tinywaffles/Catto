import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// LTA DataMall — BusStops endpoint, paginated at 500 per page.
// Loop with $skip until an empty page to collect all stops island-wide.
export async function GET() {
  const key = process.env.LTA_ACCOUNT_KEY;
  if (!key) return NextResponse.json([]);
  try {
    const all: Record<string, unknown>[] = [];
    let skip = 0;
    const pageSize = 500;

    while (true) {
      const res = await fetch(
        `https://datamall2.mytransport.sg/ltaodataservice/BusStops?$top=${pageSize}&$skip=${skip}`,
        {
          headers: { AccountKey: key, Accept: 'application/json' },
          cache: 'no-store',
        },
      );
      if (!res.ok) break;
      const data = await res.json();
      const page: Record<string, unknown>[] = data.value ?? [];
      if (page.length === 0) break;
      all.push(...page);
      if (page.length < pageSize) break;
      skip += pageSize;
    }

    const stops = all
      .filter((s) => s.Latitude && s.Longitude)
      .map((s) => ({
        code: String(s.BusStopCode ?? ''),
        road_name: String(s.RoadName ?? ''),
        description: String(s.Description ?? ''),
        lat: Number(s.Latitude),
        lng: Number(s.Longitude),
      }));
    return NextResponse.json(stops);
  } catch {
    return NextResponse.json([]);
  }
}
