import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// CSA SingCERT security advisories — scraped from the public advisories page.
// No API key required. SingCERT publishes advisories at csa.gov.sg/singcert/advisories
export async function GET() {
  try {
    const res = await fetch('https://www.csa.gov.sg/singcert/advisories', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Catto/1.0)' },
      cache: 'no-store',
    });
    if (!res.ok) return NextResponse.json([]);
    const html = await res.text();

    type Advisory = {
      title: string;
      description: string;
      date: string;
      url: string;
      severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
      advisory_id: string;
    };
    const advisories: Advisory[] = [];

    // Extract advisory links and titles from SG Gov CMS listing
    const linkRe =
      /<a[^>]+href="(\/singcert\/advisories\/[^"#]+)"[^>]*>\s*([^<]{10,300})\s*<\/a>/gi;
    const dateRe =
      /<(?:span|div|p)[^>]*class="[^"]*(?:date|published|time)[^"]*"[^>]*>\s*([0-9A-Za-z ,\-\/]+)\s*<\/(?:span|div|p)>/gi;

    const hrefs: string[] = [];
    const titles: string[] = [];
    const dates: string[] = [];

    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(html)) !== null) {
      const title = m[2].replace(/\s+/g, ' ').trim();
      if (title.length > 8) {
        hrefs.push(`https://www.csa.gov.sg${m[1]}`);
        titles.push(title);
      }
    }
    while ((m = dateRe.exec(html)) !== null) {
      dates.push(m[1].trim());
    }

    // Classify severity from advisory title keywords
    const classify = (title: string): Advisory['severity'] => {
      const t = title.toLowerCase();
      if (t.includes('critical') || t.includes('actively exploit') || t.includes('zero-day') || t.includes('0-day')) return 'CRITICAL';
      if (t.includes('high') || t.includes('severe') || t.includes('ransomware') || t.includes('apt') || t.includes('remote code')) return 'HIGH';
      if (t.includes('medium') || t.includes('vulnerabilit') || t.includes('advisory')) return 'MEDIUM';
      return 'LOW';
    };

    // Extract advisory ID from URL path
    const extractId = (url: string): string => {
      const parts = url.split('/');
      return parts[parts.length - 1] || '';
    };

    for (let i = 0; i < Math.min(titles.length, 30); i++) {
      advisories.push({
        title: titles[i],
        description: '',
        date: dates[i] ?? '',
        url: hrefs[i] ?? '',
        severity: classify(titles[i]),
        advisory_id: extractId(hrefs[i] ?? ''),
      });
    }

    return NextResponse.json(advisories);
  } catch {
    return NextResponse.json([]);
  }
}
