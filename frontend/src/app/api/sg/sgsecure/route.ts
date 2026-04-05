import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// SGSecure alerts from the Ministry of Home Affairs (MHA) — no key required.
// MHA does not publish a machine-readable real-time alerts API.
// This route scrapes the SGSecure / news-and-announcements page from mha.gov.sg
// and extracts security-relevant announcements.

const SG_CENTER = { lat: 1.3521, lng: 103.8198 };

// Extract a likely location string from a press release title
function extractLocation(title: string): string | null {
  const patterns = [
    /\bat\s+([A-Z][A-Za-z\s]+(?:Road|Street|Avenue|Drive|Lane|Crescent|Place|Way|Close|Link|Walk|Path|Rise|Estate|Town|Centre|Center)?)/,
    /\bin\s+([A-Z][A-Za-z\s]{3,30})/,
    /\balong\s+([A-Z][A-Za-z\s]+(?:Road|Street|Avenue|Expressway|Highway))/,
  ];
  for (const re of patterns) {
    const m = title.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

// OneMap geocoding — Singapore Land Authority, no key required
async function geocodeOneMap(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://www.onemap.gov.sg/api/common/elastic/search?searchVal=${encodeURIComponent(query)}&returnGeom=Y&getAddrDetails=Y&pageNum=1`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Catto/1.0)' },
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const data = await r.json();
    const result = data?.results?.[0];
    if (!result) return null;
    const lat = parseFloat(result.LATITUDE);
    const lng = parseFloat(result.LONGITUDE);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const res = await fetch(
      'https://www.mha.gov.sg/mediaroom/press-releases',
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Catto/1.0)' },
        cache: 'no-store',
      },
    );
    if (!res.ok) return NextResponse.json([]);
    const html = await res.text();

    const rawAlerts: Array<{
      title: string;
      date: string;
      url: string;
      severity: string;
    }> = [];

    // MHA uses a standard SG government CMS listing structure
    const linkRe =
      /<a[^>]+href="(\/mediaroom\/press-releases\/[^"#]+)"[^>]*>\s*([^<]{10,200})\s*<\/a>/gi;
    const dateRe = /<span[^>]*class="[^"]*date[^"]*"[^>]*>([0-9A-Za-z ,]+)<\/span>/gi;

    let m: RegExpExecArray | null;
    const hrefs: string[] = [];
    const titles: string[] = [];

    while ((m = linkRe.exec(html)) !== null) {
      const title = m[2].replace(/\s+/g, ' ').trim();
      if (title.length > 10) {
        hrefs.push(`https://www.mha.gov.sg${m[1]}`);
        titles.push(title);
      }
    }

    const dates: string[] = [];
    while ((m = dateRe.exec(html)) !== null) {
      dates.push(m[1].trim());
    }

    const SECURITY_KEYWORDS = [
      'sgsecure', 'terror', 'threat', 'security', 'suspicious',
      'alert', 'bomb', 'attack', 'extremis', 'scam', 'fraud',
    ];

    const classify = (title: string): string => {
      const t = title.toLowerCase();
      if (t.includes('terror') || t.includes('attack') || t.includes('extremis')) return 'high';
      if (t.includes('threat') || t.includes('bomb') || t.includes('suspicious')) return 'medium';
      return 'low';
    };

    for (let i = 0; i < Math.min(titles.length, 20); i++) {
      const title = titles[i];
      const tl = title.toLowerCase();
      if (!SECURITY_KEYWORDS.some((kw) => tl.includes(kw))) continue;
      rawAlerts.push({
        title,
        date: dates[i] ?? '',
        url: hrefs[i] ?? '',
        severity: classify(title),
      });
    }

    // Geocode up to 6 alerts via OneMap
    const geocodeLimit = 6;
    const alerts: Array<typeof rawAlerts[number] & { lat: number; lng: number }> = [];

    await Promise.all(
      rawAlerts.slice(0, geocodeLimit).map(async (alert) => {
        const loc = extractLocation(alert.title);
        const coords = loc ? await geocodeOneMap(loc) : null;
        alerts.push({
          ...alert,
          lat: coords?.lat ?? SG_CENTER.lat,
          lng: coords?.lng ?? SG_CENTER.lng,
        });
      }),
    );

    for (let i = geocodeLimit; i < rawAlerts.length; i++) {
      alerts.push({ ...rawAlerts[i], lat: SG_CENTER.lat, lng: SG_CENTER.lng });
    }

    // Restore original order
    alerts.sort((a, b) => {
      const ai = rawAlerts.findIndex((r) => r.url === a.url);
      const bi = rawAlerts.findIndex((r) => r.url === b.url);
      return ai - bi;
    });

    return NextResponse.json(alerts);
  } catch {
    return NextResponse.json([]);
  }
}
