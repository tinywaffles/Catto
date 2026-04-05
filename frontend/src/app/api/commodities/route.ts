import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface CommodityQuote {
  price: number | null;
  change_pct: number | null;
}

const TIMEOUT_MS = 6000;
const TROY_OZ_PER_GRAM = 31.1035;

// Fetch SGD/USD rate from open.er-api.com — no key required
async function fetchSgdRate(): Promise<number | null> {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const data = await r.json();
    const sgdPerUsd = data?.rates?.SGD as number | undefined;
    if (!sgdPerUsd || sgdPerUsd <= 0) return null;
    return sgdPerUsd; // SGD per 1 USD
  } catch {
    return null;
  }
}

// Fetch gold (XAU/USD) from Yahoo Finance — no key required
async function fetchGoldUsd(): Promise<{ price: number; prevClose: number } | null> {
  try {
    const r = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=2d',
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: 'no-store',
      },
    );
    if (!r.ok) return null;
    const data = await r.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') return null;
    return {
      price: meta.regularMarketPrice as number,
      prevClose: (meta.chartPreviousClose as number) || meta.regularMarketPrice,
    };
  } catch {
    return null;
  }
}

// Fetch WTI crude oil spot price from EIA, falling back to Yahoo Finance CL=F
async function fetchCrudeOil(): Promise<CommodityQuote> {
  // ── Attempt 1: EIA v2 spot price (no key required for public data) ──────
  try {
    const url =
      'https://api.eia.gov/v2/petroleum/pri/spt/data/' +
      '?frequency=daily' +
      '&data%5B0%5D=value' +
      '&sort%5B0%5D%5Bcolumn%5D=period' +
      '&sort%5B0%5D%5Bdirection%5D=desc' +
      '&offset=0&length=5';
    const r = await fetch(url, {
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });
    if (r.ok) {
      const data = await r.json();
      const rows = (data?.response?.data ?? []) as Array<{
        period: string;
        value: string;
        'series-description'?: string;
        'product-name'?: string;
      }>;

      // Filter for WTI (Cushing, Oklahoma)
      const wtiRows = rows.filter((row) => {
        const desc = (row['series-description'] ?? row['product-name'] ?? '').toLowerCase();
        return desc.includes('wti') || desc.includes('cushing') || desc.includes('west texas');
      });

      const candidates = wtiRows.length > 0 ? wtiRows : rows;
      const todayStr = candidates[0]?.value;
      if (todayStr) {
        const today = parseFloat(todayStr);
        if (!isNaN(today)) {
          let change_pct: number | null = null;
          if (candidates.length >= 2) {
            const prev = parseFloat(candidates[1].value);
            if (!isNaN(prev) && prev !== 0) {
              change_pct = Math.round(((today - prev) / prev) * 100 * 10000) / 10000;
            }
          }
          return { price: Math.round(today * 100) / 100, change_pct };
        }
      }
    }
  } catch { /* fall through to Yahoo Finance */ }

  // ── Attempt 2: Yahoo Finance CL=F (WTI crude oil futures) ───────────────
  try {
    const r = await fetch(
      'https://query1.finance.yahoo.com/v8/finance/chart/CL%3DF?interval=1d&range=2d',
      {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: 'no-store',
      },
    );
    if (!r.ok) return { price: null, change_pct: null };
    const data = await r.json();
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') return { price: null, change_pct: null };

    const price = meta.regularMarketPrice as number;
    const prevClose = (meta.chartPreviousClose as number) || price;
    const change_pct =
      prevClose !== 0
        ? Math.round(((price - prevClose) / prevClose) * 100 * 10000) / 10000
        : null;

    return { price: Math.round(price * 100) / 100, change_pct };
  } catch {
    return { price: null, change_pct: null };
  }
}

export async function GET() {
  const [sgdRate, goldData, crudeData] = await Promise.all([
    fetchSgdRate(),
    fetchGoldUsd(),
    fetchCrudeOil(),
  ]);

  // Gold: convert from USD/troy oz → SGD/gram
  let gold: CommodityQuote = { price: null, change_pct: null };
  if (goldData && sgdRate) {
    const goldSgdPerGram = (goldData.price * sgdRate) / TROY_OZ_PER_GRAM;
    const prevGoldSgdPerGram = (goldData.prevClose * sgdRate) / TROY_OZ_PER_GRAM;
    const change_pct =
      prevGoldSgdPerGram !== 0
        ? Math.round(((goldSgdPerGram - prevGoldSgdPerGram) / prevGoldSgdPerGram) * 100 * 10000) /
          10000
        : null;
    gold = {
      price: Math.round(goldSgdPerGram * 100) / 100,
      change_pct,
    };
  }

  // SGD/USD: display as USD per 1 SGD (e.g. 0.74)
  const sgdusd: CommodityQuote = sgdRate
    ? { price: Math.round((1 / sgdRate) * 10000) / 10000, change_pct: null }
    : { price: null, change_pct: null };

  return NextResponse.json({ gold, crude: crudeData, sgdusd });
}
