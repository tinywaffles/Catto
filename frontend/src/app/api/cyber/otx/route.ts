import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Fetches recent subscribed pulses from AlienVault OTX.
// Requires OTX_API_KEY in the environment (from https://otx.alienvault.com/).
export async function GET() {
  const key = process.env.OTX_API_KEY;
  if (!key) return NextResponse.json([]);
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const res = await fetch(
      `https://otx.alienvault.com/api/v1/pulses/subscribed?modified_since=${encodeURIComponent(since)}&limit=50`,
      {
        headers: { 'X-OTX-API-KEY': key },
        cache: 'no-store',
      },
    );
    if (!res.ok) return NextResponse.json([]);
    const data = await res.json();
    return NextResponse.json(data.results ?? []);
  } catch {
    return NextResponse.json([]);
  }
}
