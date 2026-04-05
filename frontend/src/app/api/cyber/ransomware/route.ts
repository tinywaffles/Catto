import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ENDPOINTS = [
  'https://api.ransomware.live/v2/recentvictims',
  'https://api.ransomware.live/v1/recentvictims',
];

// Fetches recent ransomware victims from ransomware.live (v2, fallback v1).
// Shows only last 24h events globally, UNLESS Singapore is among the targets —
// in that case the full unfiltered list is returned so SG incidents are never hidden.
export async function GET() {
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) continue;
      const all = (data as Record<string, unknown>[])
        .sort((a, b) =>
          String(b.discovered ?? '').localeCompare(String(a.discovered ?? '')),
        );

      const sgTargeted = all.some(
        (v) => String(v.country ?? '').toLowerCase().includes('singapore'),
      );

      let victims: Record<string, unknown>[];
      if (sgTargeted) {
        // Show everything so Singapore incidents are visible in context
        victims = all.slice(0, 500);
      } else {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        victims = all.filter((v) => String(v.discovered ?? '') >= cutoff).slice(0, 200);
      }

      return NextResponse.json(victims);
    } catch { /* try next */ }
  }
  return NextResponse.json([]);
}
