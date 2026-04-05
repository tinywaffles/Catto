import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// SCDF (Singapore Civil Defence Force) does not publish a real-time incidents API.
// This route scrapes their latest media release summaries from the public website
// and parses structured incident data where available.

const SG_CENTER = { lat: 1.3521, lng: 103.8198 };

// Extract a likely location string from an incident title
function extractLocation(title: string): string | null {
  // Patterns: "at Jurong West", "in Bishan", "along Orchard Road", "at Blk 123 Tampines"
  const patterns = [
    /\bat\s+((?:Blk\s+\d+\s+)?[A-Z][A-Za-z\s]+(?:Road|Street|Avenue|Drive|Lane|Crescent|Place|Way|Close|Link|Walk|Path|Rise|Hill|View|Grove|Court|Loop|Terrace)?)/,
    /\bin\s+([A-Z][A-Za-z\s]{3,30}(?:Town|Estate|Village|Industrial Park)?)/,
    /\balong\s+([A-Z][A-Za-z\s]+(?:Road|Street|Avenue|Expressway|Highway))/,
    /\bnear\s+([A-Z][A-Za-z\s]+)/,
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
      'https://www.scdf.gov.sg/home/about-us/media-releases',
      {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Catto/1.0)' },
        cache: 'no-store',
      },
    );
    if (!res.ok) return NextResponse.json([]);
    const html = await res.text();

    // Parse article titles and dates from SCDF media releases page
    const incidents: Array<{
      title: string;
      date: string;
      url: string;
      type: string;
      lat: number;
      lng: number;
    }> = [];

    // SCDF uses a standard SG government CMS — extract listing items
    const itemRe =
      /<a[^>]+href="(\/home\/about-us\/media-releases\/[^"]+)"[^>]*>\s*<[^>]+>([^<]+)<\/[^>]+>\s*<\/a>/gi;
    const dateRe = /<span[^>]*class="[^"]*date[^"]*"[^>]*>([^<]+)<\/span>/gi;

    let m: RegExpExecArray | null;
    const hrefs: string[] = [];
    const titles: string[] = [];

    while ((m = itemRe.exec(html)) !== null) {
      hrefs.push(`https://www.scdf.gov.sg${m[1]}`);
      titles.push(m[2].trim());
    }

    const dates: string[] = [];
    while ((m = dateRe.exec(html)) !== null) {
      dates.push(m[1].trim());
    }

    // Classify incident type from title keywords
    const classify = (title: string): string => {
      const t = title.toLowerCase();
      if (t.includes('fire')) return 'Fire';
      if (t.includes('accident') || t.includes('crash') || t.includes('collision'))
        return 'Road Traffic Accident';
      if (t.includes('flood') || t.includes('water')) return 'Flooding';
      if (t.includes('rescue')) return 'Rescue';
      if (t.includes('explosion') || t.includes('blast')) return 'Explosion';
      if (t.includes('hazmat') || t.includes('chemical')) return 'HazMat';
      return 'Incident';
    };

    const rawIncidents = titles.slice(0, 20).map((title, i) => ({
      title,
      date: dates[i] ?? '',
      url: hrefs[i] ?? '',
      type: classify(title),
    }));

    // Geocode up to 8 incidents with extracted location strings via OneMap
    const geocodeLimit = 8;
    await Promise.all(
      rawIncidents.slice(0, geocodeLimit).map(async (inc) => {
        const loc = extractLocation(inc.title);
        const coords = loc ? await geocodeOneMap(loc) : null;
        incidents.push({
          ...inc,
          lat: coords?.lat ?? SG_CENTER.lat,
          lng: coords?.lng ?? SG_CENTER.lng,
        });
      }),
    );

    // Remaining incidents without geocoding get Singapore centre
    for (let i = geocodeLimit; i < rawIncidents.length; i++) {
      incidents.push({ ...rawIncidents[i], lat: SG_CENTER.lat, lng: SG_CENTER.lng });
    }

    // Sort by original order (Promise.all may resolve out of order for geocoded batch)
    incidents.sort((a, b) => {
      const ai = rawIncidents.findIndex((r) => r.url === a.url);
      const bi = rawIncidents.findIndex((r) => r.url === b.url);
      return ai - bi;
    });

    return NextResponse.json(incidents);
  } catch {
    return NextResponse.json([]);
  }
}
