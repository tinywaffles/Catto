import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:8000';

export async function GET(req: NextRequest) {
  const callsign = req.nextUrl.searchParams.get('callsign');
  if (!callsign) return NextResponse.json({ error: 'callsign required' }, { status: 400 });

  try {
    const resp = await fetch(
      `${BACKEND}/api/mpa/vessel-particulars?callsign=${encodeURIComponent(callsign)}`,
      { headers: { Accept: 'application/json' }, next: { revalidate: 0 } },
    );
    if (resp.status === 404) return NextResponse.json(null, { status: 404 });
    if (!resp.ok) return NextResponse.json(null, { status: resp.status });
    return NextResponse.json(await resp.json());
  } catch {
    return NextResponse.json(null, { status: 503 });
  }
}
