import { NextResponse } from 'next/server';
import type { PsiReading } from '@/types/dashboard';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const res = await fetch('https://api.data.gov.sg/v1/environment/psi', {
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json([]);
    const data = await res.json();
    const latest = data.items?.[0];
    if (!latest) return NextResponse.json([]);

    const readings: PsiReading[] = (data.region_metadata ?? [])
      .filter((r: { name: string }) => r.name !== 'national')
      .map((r: { name: string; label_location: { latitude: number; longitude: number } }) => ({
        region: r.name,
        lat: r.label_location.latitude,
        lng: r.label_location.longitude,
        psi_24h: latest.readings?.psi_twenty_four_hourly?.[r.name] ?? 0,
      }));

    return NextResponse.json(readings);
  } catch {
    return NextResponse.json([]);
  }
}
