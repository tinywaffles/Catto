import { NextRequest, NextResponse } from 'next/server';

// Server-side in-memory font cache — persists for the lifetime of the Next.js process.
// PBF glyph tiles are immutable (same font+range always returns same bytes), so we
// cache indefinitely. Typical usage: ~30–60 unique tiles per map style.
const fontCache = new Map<string, ArrayBuffer>();

// Concurrency limiter — cap upstream CARTO/demotiles fetches to 20 at once.
// MapLibre can fire dozens of parallel /api/glyphs requests on zoom-out; without
// this, those all hit CARTO simultaneously and can pile up in Node's fetch queue.
let _inflight = 0;
const _queue: Array<() => void> = [];
const MAX_CONCURRENT = 20;

// During initial warmup, space out releases by 100ms to prevent a burst of
// parallel upstream requests before the browser has finished rendering.
// After the first 30 tiles are served (cache is warm), releases are instant.
let _tilesServed = 0;
const WARMUP_TILES = 30;
const WARMUP_RELEASE_DELAY_MS = 100;

function acquireSemaphore(): Promise<void> {
  if (_inflight < MAX_CONCURRENT) {
    _inflight++;
    return Promise.resolve();
  }
  return new Promise((resolve) => _queue.push(resolve));
}

function releaseSemaphore(): void {
  _tilesServed++;
  const next = _queue.shift();
  if (next) {
    if (_tilesServed <= WARMUP_TILES) {
      // Stagger releases during warmup to prevent upstream request storm
      setTimeout(next, WARMUP_RELEASE_DELAY_MS);
    } else {
      next(); // warm — release immediately
    }
  } else {
    _inflight--;
  }
}

const FALLBACK_FONT_MAP: Record<string, string> = {
  'Noto Sans Bold': 'Noto Sans Regular',
  'Noto Sans Italic': 'Noto Sans Regular',
};

async function fetchFont(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      // Reuse connections — important when 50+ requests are queued
      keepalive: true,
    });
    if (res.ok) return res.arrayBuffer();
  } catch { /* fall through to next source */ }
  return null;
}

async function resolveFont(fontPath: string): Promise<ArrayBuffer | null> {
  // 1. Check in-process cache first — no upstream fetch needed
  const cached = fontCache.get(fontPath);
  if (cached) return cached;

  // 2. Acquire semaphore slot before any network I/O
  await acquireSemaphore();
  try {
    // Double-check after acquiring in case a parallel request already populated it
    const cachedNow = fontCache.get(fontPath);
    if (cachedNow) return cachedNow;

    // 3. Try CARTO primary
    let data = await fetchFont(`https://tiles.basemaps.cartocdn.com/fonts/${fontPath}`);

    // 4. Fallback mapping for fonts CARTO doesn't carry
    if (!data) {
      const parts = fontPath.split('/');
      const fontName = decodeURIComponent(parts[0]);
      const range = parts[1] ?? '0-255.pbf';
      const fallbackName = FALLBACK_FONT_MAP[fontName];
      if (fallbackName) {
        data = await fetchFont(
          `https://tiles.basemaps.cartocdn.com/fonts/${encodeURIComponent(fallbackName)}/${range}`,
        );
      }
      // 5. Last resort: demotiles
      if (!data) {
        data = await fetchFont(`https://demotiles.maplibre.org/font/${fontPath}`);
      }
    }

    if (data) fontCache.set(fontPath, data);
    return data;
  } finally {
    releaseSemaphore();
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const fontPath = path.join('/');

  const data = await resolveFont(fontPath);

  if (!data) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(data, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-protobuf',
      'Access-Control-Allow-Origin': '*',
      // Fonts are immutable — cache aggressively in browser and CDN
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
