import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const key = process.env.LTA_ACCOUNT_KEY;
  if (!key) return NextResponse.json({ value: [] });
  try {
    const res = await fetch(
      'https://datamall2.mytransport.sg/ltaodataservice/TrafficIncidents',
      { headers: { AccountKey: key, accept: 'application/json' }, cache: 'no-store' },
    );
    if (!res.ok) return NextResponse.json({ value: [] });
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ value: [] });
  }
}
