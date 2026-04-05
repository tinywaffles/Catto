import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// data.gov.sg now uses a two-step download API:
// 1. POST/GET initiate-download → signed S3 URL
// 2. Fetch GeoJSON from S3 URL
// The resource is a GeoJSON FeatureCollection with Point geometry.

const DATASET_ID = 'd_c69e6d27d72f765fabfbeea362299378';

export async function GET() {
  try {
    // Step 1: initiate download to get signed S3 URL
    const initRes = await fetch(
      `https://api-open.data.gov.sg/v1/public/api/datasets/${DATASET_ID}/initiate-download`,
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Catto/1.0)' },
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      },
    );
    if (!initRes.ok) return NextResponse.json([]);
    const initData = await initRes.json();
    const s3Url: string | undefined = initData?.data?.url;
    if (!s3Url) return NextResponse.json([]);

    // Step 2: fetch GeoJSON from S3
    const geoRes = await fetch(s3Url, {
      signal: AbortSignal.timeout(12000),
      cache: 'no-store',
    });
    if (!geoRes.ok) return NextResponse.json([]);
    const geoData = await geoRes.json();

    const features: unknown[] = geoData?.features;
    if (!Array.isArray(features)) return NextResponse.json([]);

    const out = features
      .map((f: unknown) => {
        const feat = f as {
          geometry?: { coordinates?: [number, number] };
          properties?: Record<string, unknown>;
        };
        const coords = feat?.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) return null;
        const [lng, lat] = coords;
        if (typeof lng !== 'number' || typeof lat !== 'number') return null;
        const p = feat.properties ?? {};
        return {
          lat,
          lng,
          department: String(p.DEPARTMENT ?? ''),
          type: String(p.TYPE ?? ''),
          street_name: String(p.STREET_NAME ?? ''),
          telephone: String(p.TELEPHONE ?? ''),
        };
      })
      .filter(Boolean);

    return NextResponse.json(out);
  } catch {
    return NextResponse.json([]);
  }
}
