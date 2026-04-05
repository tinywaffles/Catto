import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Fetches active botnet C2 servers from Feodo Tracker (abuse.ch) — no key required.
// JSON blocklist includes IP, port, country, malware family, and first/last seen.
export async function GET() {
  try {
    const res = await fetch(
      'https://feodotracker.abuse.ch/downloads/ipblocklist.json',
      { cache: 'no-store' },
    );
    if (!res.ok) return NextResponse.json([]);
    const data = await res.json();
    if (!Array.isArray(data)) return NextResponse.json([]);
    return NextResponse.json(data);
  } catch {
    return NextResponse.json([]);
  }
}
