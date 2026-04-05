import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch(
      'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
      { cache: 'no-store' },
    );
    if (!res.ok) return NextResponse.json([]);
    const data = await res.json();
    // Return up to 200 most recent (list is newest-first from CISA)
    return NextResponse.json((data.vulnerabilities ?? []).slice(0, 200));
  } catch {
    return NextResponse.json([]);
  }
}
