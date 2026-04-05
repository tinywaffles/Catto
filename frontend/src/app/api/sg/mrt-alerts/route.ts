import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// LTA DataMall — TrainServiceAlerts returns active MRT disruption alerts.
// Returns empty array when no disruptions are active (Status === 1 = normal).
// Requires LTA_ACCOUNT_KEY env variable.
export async function GET() {
  const key = process.env.LTA_ACCOUNT_KEY;
  if (!key) return NextResponse.json([]);
  try {
    const res = await fetch(
      'https://datamall2.mytransport.sg/ltaodataservice/TrainServiceAlerts',
      {
        headers: { AccountKey: key, Accept: 'application/json' },
        cache: 'no-store',
      },
    );
    if (!res.ok) return NextResponse.json([]);
    const data = await res.json();
    const v = data.value ?? data;
    // Status 1 = normal operation, 2 = disruption
    if (!v || v.Status === 1 || !v.AffectedSegments?.length) {
      return NextResponse.json([]);
    }
    return NextResponse.json([
      {
        status: v.Status ?? 2,
        message: v.Message ?? '',
        created_date: v.CreatedDate ?? new Date().toISOString(),
        free_public_bus: v.FreePublicBus ?? '',
        free_mrt_shuttle: v.FreeMRTShuttle ?? '',
        shuttle_direction: v.MRTShuttleDirection ?? '',
        affected: (v.AffectedSegments ?? []).map((s: Record<string, unknown>) => ({
          station: String(s.Station ?? ''),
          direction: String(s.Direction ?? ''),
          free_bus: String(s.FreeBusService ?? ''),
        })),
      },
    ]);
  } catch {
    return NextResponse.json([]);
  }
}
