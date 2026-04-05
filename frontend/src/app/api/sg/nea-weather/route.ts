import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// NEA 2-hour weather forecast and rainfall from data.gov.sg — no key required

export async function GET() {
  const [forecastRes, rainfallRes] = await Promise.allSettled([
    fetch('https://api-open.data.gov.sg/v2/real-time/api/two-hr-forecast', {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    }).then((r) => (r.ok ? r.json() : null)),
    fetch('https://api-open.data.gov.sg/v2/real-time/api/rainfall', {
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    }).then((r) => (r.ok ? r.json() : null)),
  ]);

  const forecast = forecastRes.status === 'fulfilled' ? forecastRes.value : null;
  const rainfall = rainfallRes.status === 'fulfilled' ? rainfallRes.value : null;

  // Parse 2hr forecast
  const item = forecast?.data?.items?.[0] ?? null;
  const areaMetadata: Array<{
    name: string;
    label_location: { latitude: number; longitude: number };
  }> = forecast?.data?.area_metadata ?? [];

  const forecastByArea = (item?.forecasts ?? []).map(
    (f: { area: string; forecast: string }) => {
      const meta = areaMetadata.find((a) => a.name === f.area);
      return {
        area: f.area,
        forecast: f.forecast,
        lat: meta?.label_location?.latitude ?? null,
        lng: meta?.label_location?.longitude ?? null,
      };
    },
  );

  // Parse rainfall — only stations currently reporting rain
  const stations: Array<{
    id: string;
    name: string;
    location: { latitude: number; longitude: number };
  }> = rainfall?.data?.stations ?? [];

  const readings: Array<{ stationId: string; value: number }> =
    rainfall?.data?.readings?.[0]?.data ?? [];

  const rainfallByStation = stations
    .map((s) => {
      const reading = readings.find((r) => r.stationId === s.id);
      return {
        station: s.name,
        id: s.id,
        lat: s.location?.latitude ?? null,
        lng: s.location?.longitude ?? null,
        mm: reading?.value ?? 0,
      };
    })
    .filter((s) => s.mm > 0)
    .sort((a, b) => b.mm - a.mm);

  return NextResponse.json({
    forecast: forecastByArea,
    rainfall: rainfallByStation,
    valid_period: item?.valid_period ?? null,
    timestamp: new Date().toISOString(),
  });
}
