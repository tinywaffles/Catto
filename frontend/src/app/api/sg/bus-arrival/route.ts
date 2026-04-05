import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// LTA DataMall — BusArrivalv3 for a single bus stop.
// Returns next 3 arrivals per service with ETA in minutes.
export async function GET(req: NextRequest) {
  const stop = req.nextUrl.searchParams.get('stop');
  if (!stop) return NextResponse.json({ services: [] }, { status: 400 });

  const key = process.env.LTA_ACCOUNT_KEY;
  if (!key) return NextResponse.json({ services: [] });

  try {
    const res = await fetch(
      `https://datamall2.mytransport.sg/ltaodataservice/v3/BusArrival?BusStopCode=${encodeURIComponent(stop)}`,
      {
        headers: { AccountKey: key, Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return NextResponse.json({ services: [] });

    const data = await res.json();
    const now = Date.now();

    function parseArrival(bus: Record<string, string>) {
      const eta = bus?.EstimatedArrival;
      if (!eta) return null;
      const ms = new Date(eta).getTime();
      if (isNaN(ms)) return null;
      return {
        eta_mins: Math.max(0, Math.round((ms - now) / 60000)),
        load: bus.Load ?? '',
        type: bus.Type ?? '',
      };
    }

    const services = (data.Services ?? []).map((s: Record<string, unknown>) => {
      const next = [
        parseArrival(s.NextBus as Record<string, string>),
        parseArrival(s.NextBus2 as Record<string, string>),
        parseArrival(s.NextBus3 as Record<string, string>),
      ].filter(Boolean);
      return {
        service_no: s.ServiceNo ?? '',
        operator: s.Operator ?? '',
        next,
      };
    });

    return NextResponse.json({ services });
  } catch {
    return NextResponse.json({ services: [] });
  }
}
