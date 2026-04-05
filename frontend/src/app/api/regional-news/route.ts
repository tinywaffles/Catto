import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Fetches regional news RSS feeds focused on Singapore, SE Asia, and active conflicts.
// Prioritises: CNA, Straits Times, Al Jazeera, Reuters Asia, SCMP.
const FEEDS = [
  { source: 'CNA',         url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6511' },
  { source: 'CNA Asia',    url: 'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6512' },
  { source: 'Al Jazeera',  url: 'https://www.aljazeera.com/xml/rss/all.xml' },
  { source: 'BBC Asia',    url: 'https://feeds.bbci.co.uk/news/world/asia/rss.xml' },
  { source: 'SCMP',        url: 'https://www.scmp.com/rss/91/feed' },
  { source: 'Straits Times', url: 'https://www.straitstimes.com/news/asia/rss.xml' },
];

function parseISO(s: string | null) {
  if (!s) return '';
  try { return new Date(s).toISOString(); } catch { return s; }
}

function extractItems(xml: string, source: string): { source: string; title: string; link: string; published: string; description: string }[] {
  const items: { source: string; title: string; link: string; published: string; description: string }[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
      return m ? m[1].trim() : '';
    };
    const title = get('title');
    const link = get('link') || get('guid');
    const pubDate = get('pubDate') || get('dc:date') || get('published');
    const desc = get('description').replace(/<[^>]+>/g, '').slice(0, 200);
    if (title && link) {
      items.push({ source, title, link, published: parseISO(pubDate), description: desc });
    }
    if (items.length >= 8) break;
  }
  return items;
}

export async function GET() {
  const results = await Promise.allSettled(
    FEEDS.map(async ({ source, url }) => {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CattoBot/1.0)' },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      const xml = await res.text();
      return extractItems(xml, source);
    }),
  );

  const all = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  // Sort newest first
  all.sort((a, b) => {
    const ta = a.published ? new Date(a.published).getTime() : 0;
    const tb = b.published ? new Date(b.published).getTime() : 0;
    return tb - ta;
  });

  return NextResponse.json(all.slice(0, 40));
}
