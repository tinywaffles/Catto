import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ACLED_EMAIL = process.env.ACLED_EMAIL || '';
const ACLED_PASSWORD = process.env.ACLED_PASSWORD || '';
const TIMEOUT_MS = 20_000;

// ACLED region codes — pipe-separated for multi-region queries
// 6=South Asia, 7=Southeast Asia, 8=Middle East, 9=East Asia
const ACLED_REGIONS = '6|7|8|9';

function getDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { from: fmt(from), to: fmt(to) };
}

/** Login to acleddata.com (WordPress) and return session cookies. */
async function getAcledSession(): Promise<string> {
  try {
    // Seed test cookie first
    const initRes = await fetch('https://acleddata.com/wp-login.php', {
      method: 'GET',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'manual',
    });
    const initSetCookie = initRes.headers.get('set-cookie') ?? '';

    // POST credentials
    const loginRes = await fetch('https://acleddata.com/wp-login.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: `wordpress_test_cookie=WP+Cookie+check; ${initSetCookie}`,
        'User-Agent': 'Mozilla/5.0',
      },
      body: new URLSearchParams({
        log: ACLED_EMAIL,
        pwd: ACLED_PASSWORD,
        'wp-submit': 'Log In',
        redirect_to: '/wp-admin/',
        testcookie: '1',
      }).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: 'manual',
    });

    // Collect all Set-Cookie values from the login response
    const cookies: string[] = [];
    loginRes.headers.forEach((value, name) => {
      if (name.toLowerCase() === 'set-cookie') cookies.push(value.split(';')[0]);
    });
    if (initSetCookie) cookies.push(...initSetCookie.split(',').map((c) => c.split(';')[0].trim()));
    return cookies.join('; ');
  } catch {
    return '';
  }
}

interface RawAcledEvent {
  event_id_cnty?: string;
  data_id?: number | string;
  event_date?: string;
  event_type?: string;
  sub_event_type?: string;
  actor1?: string;
  actor2?: string;
  country?: string;
  location?: string;
  latitude?: string | number;
  longitude?: string | number;
  fatalities?: string | number;
  notes?: string;
  source?: string;
}

export async function GET() {
  if (!ACLED_EMAIL || !ACLED_PASSWORD) {
    return NextResponse.json([], { status: 200 });
  }

  try {
    const cookieStr = await getAcledSession();
    const { from, to } = getDateRange();

    const url = new URL('https://acleddata.com/api/acled/read');
    url.searchParams.set('limit', '500');
    url.searchParams.set('event_date', `${from}|${to}`);
    url.searchParams.set('event_date_where', 'BETWEEN');
    url.searchParams.set('region', ACLED_REGIONS);
    url.searchParams.set('email', ACLED_EMAIL);
    url.searchParams.set('format', 'json');

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0',
      'Cache-Control': 'no-store',
    };
    if (cookieStr) headers['Cookie'] = cookieStr;

    const res = await fetch(url.toString(), {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!res.ok) return NextResponse.json([], { status: 200 });

    const body = await res.json() as { data?: RawAcledEvent[]; status?: number; success?: boolean };
    const raw: RawAcledEvent[] = Array.isArray(body.data) ? body.data : [];

    const events = raw
      .map((e) => {
        const lat = parseFloat(String(e.latitude));
        const lng = parseFloat(String(e.longitude));
        if (isNaN(lat) || isNaN(lng)) return null;
        return {
          event_id: e.event_id_cnty || String(e.data_id ?? ''),
          lat,
          lng,
          event_date: e.event_date || '',
          event_type: e.event_type || 'Unknown',
          sub_event_type: e.sub_event_type || '',
          actor1: e.actor1 || '',
          actor2: e.actor2 || '',
          country: e.country || '',
          location: e.location || '',
          fatalities: Number(e.fatalities) || 0,
          notes: e.notes || '',
          source: e.source || 'ACLED',
        };
      })
      .filter(Boolean);

    return NextResponse.json(events);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
