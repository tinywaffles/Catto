import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const SOURCES: Record<string, { url: string; label: string }> = {
  isw: {
    url: 'https://www.understandingwar.org/sites/default/files/ISW%20Report%20-%20RSS%20Feed_4.xml',
    label: 'ISW',
  },
  bellingcat: {
    url: 'https://www.bellingcat.com/feed/',
    label: 'Bellingcat',
  },
};

function extractTag(xml: string, tag: string): string {
  // Match both CDATA and plain text content
  const cdataRe = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i');
  const plainRe  = new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i');
  const m = xml.match(cdataRe) ?? xml.match(plainRe);
  return m ? m[1].trim() : '';
}

function parseItems(xml: string, source: string) {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  return items.slice(0, 5).map((item) => ({
    source,
    title: extractTag(item, 'title'),
    link: extractTag(item, 'link'),
    pub_date: extractTag(item, 'pubDate'),
    summary: extractTag(item, 'description').replace(/<[^>]+>/g, '').slice(0, 200),
  }));
}

export async function GET(req: NextRequest) {
  const src = req.nextUrl.searchParams.get('source') ?? '';
  const def = SOURCES[src];
  if (!def) {
    return NextResponse.json({ error: 'Unknown source' }, { status: 400 });
  }

  try {
    const res = await fetch(def.url, {
      headers: { 'User-Agent': 'Catto/3.0 (+https://github.com/cattoosint/catto)' },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 900 }, // cache 15 min
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseItems(xml, def.label);
    return NextResponse.json(items, {
      headers: { 'Cache-Control': 'public, max-age=900' },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
