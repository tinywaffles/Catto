import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type IOCType = 'ip' | 'domain' | 'hash' | 'url' | 'unknown';

function detectType(indicator: string): IOCType {
  const s = indicator.trim();
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(s)) return 'ip';
  if (/^[a-f0-9]{32}$/i.test(s) || /^[a-f0-9]{40}$/i.test(s) || /^[a-f0-9]{64}$/i.test(s)) return 'hash';
  if (/^https?:\/\//i.test(s)) return 'url';
  if (/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z]{2,})+$/i.test(s)) return 'domain';
  return 'unknown';
}

async function checkVirusTotal(indicator: string, type: IOCType, apiKey: string) {
  try {
    let endpoint = '';
    const enc = encodeURIComponent(indicator);
    if (type === 'ip') endpoint = `https://www.virustotal.com/api/v3/ip_addresses/${enc}`;
    else if (type === 'domain') endpoint = `https://www.virustotal.com/api/v3/domains/${enc}`;
    else if (type === 'hash') endpoint = `https://www.virustotal.com/api/v3/files/${enc}`;
    else if (type === 'url') {
      const b64 = Buffer.from(indicator).toString('base64url').replace(/=+$/, '');
      endpoint = `https://www.virustotal.com/api/v3/urls/${b64}`;
    } else return null;

    const res = await fetch(endpoint, {
      headers: { 'x-apikey': apiKey },
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const stats = data?.data?.attributes?.last_analysis_stats ?? {};
    const malicious = stats.malicious ?? 0;
    const total = (Object.values(stats) as number[]).reduce((a, b) => a + b, 0);
    return { malicious, suspicious: stats.suspicious ?? 0, total };
  } catch { return null; }
}

async function checkOTX(indicator: string, type: IOCType, apiKey: string) {
  try {
    let section = '';
    if (type === 'ip') section = `IPv4/${indicator}/general`;
    else if (type === 'domain') section = `domain/${indicator}/general`;
    else if (type === 'hash') section = `file/${indicator}/general`;
    else if (type === 'url') section = `url/${encodeURIComponent(indicator)}/general`;
    else return null;

    const res = await fetch(
      `https://otx.alienvault.com/api/v1/indicators/${section}`,
      { headers: { 'X-OTX-API-KEY': apiKey }, cache: 'no-store', signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return { pulseCount: data?.pulse_info?.count ?? 0 };
  } catch { return null; }
}

async function checkFeodo(ip: string) {
  try {
    const res = await fetch('https://feodotracker.abuse.ch/downloads/ipblocklist.txt', {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const text = await res.text();
    const listed = text
      .split('\n')
      .some((line) => !line.startsWith('#') && line.trim() === ip);
    return { listed };
  } catch { return null; }
}

async function checkAbuseIPDB(ip: string, apiKey: string) {
  try {
    const res = await fetch(
      `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`,
      {
        headers: { Key: apiKey, Accept: 'application/json' },
        cache: 'no-store',
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return {
      score: data?.data?.abuseConfidenceScore ?? 0,
      reports: data?.data?.totalReports ?? 0,
      country: data?.data?.countryCode ?? null,
      isp: data?.data?.isp ?? null,
    };
  } catch { return null; }
}

async function checkIntelX(indicator: string, type: IOCType, apiKey: string) {
  if (type !== 'ip' && type !== 'domain') return null;
  try {
    const target = type === 'ip' ? 3 : 0; // 0=domain, 3=ip
    const searchRes = await fetch('https://2.intelx.io/phonebook/search', {
      method: 'POST',
      headers: { 'x-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ term: indicator, maxresults: 100, media: 0, target }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });
    if (!searchRes.ok) return null;
    const { id } = await searchRes.json() as { id?: string };
    if (!id) return null;

    const resultRes = await fetch(
      `https://2.intelx.io/phonebook/search/result?id=${encodeURIComponent(id)}&limit=100`,
      { headers: { 'x-key': apiKey }, cache: 'no-store', signal: AbortSignal.timeout(8000) },
    );
    if (!resultRes.ok) return null;
    const data = await resultRes.json() as { selectors?: unknown[]; status?: number };
    const count = Array.isArray(data.selectors) ? data.selectors.length : 0;
    return { count, found: count > 0 };
  } catch { return null; }
}

async function checkHIBP(domain: string) {
  try {
    const res = await fetch(
      `https://haveibeenpwned.com/api/v3/breaches?domain=${encodeURIComponent(domain)}`,
      {
        headers: { 'User-Agent': 'Catto-OSINT/1.0' },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      },
    );
    if (res.status === 404) return { breachCount: 0, breaches: [] as { name: string; date: string }[] };
    if (!res.ok) return null;
    const breaches = await res.json() as { Name: string; BreachDate: string }[];
    return {
      breachCount: breaches.length,
      breaches: breaches.slice(0, 5).map((b) => ({ name: b.Name, date: b.BreachDate })),
    };
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const indicator = req.nextUrl.searchParams.get('q')?.trim();
  if (!indicator) return NextResponse.json({ error: 'Missing indicator' }, { status: 400 });

  const vtKey = process.env.VIRUSTOTAL_API_KEY;
  const otxKey = process.env.OTX_API_KEY;
  const abuseKey = process.env.ABUSEIPDB_API_KEY;
  const intelxKey = process.env.INTELX_API_KEY;

  const type = detectType(indicator);

  const [vtResult, otxResult, feodoResult, abuseResult, intelxResult, hibpResult] = await Promise.allSettled([
    vtKey ? checkVirusTotal(indicator, type, vtKey) : Promise.resolve(null),
    otxKey ? checkOTX(indicator, type, otxKey) : Promise.resolve(null),
    type === 'ip' ? checkFeodo(indicator) : Promise.resolve(null),
    type === 'ip' && abuseKey ? checkAbuseIPDB(indicator, abuseKey) : Promise.resolve(null),
    (type === 'ip' || type === 'domain') && intelxKey ? checkIntelX(indicator, type, intelxKey) : Promise.resolve(null),
    type === 'domain' ? checkHIBP(indicator) : Promise.resolve(null),
  ]);

  const vt = vtResult.status === 'fulfilled' ? vtResult.value : null;
  const otx = otxResult.status === 'fulfilled' ? otxResult.value : null;
  const feodo = feodoResult.status === 'fulfilled' ? feodoResult.value : null;
  const abuse = abuseResult.status === 'fulfilled' ? abuseResult.value : null;
  const intelx = intelxResult.status === 'fulfilled' ? intelxResult.value : null;
  const hibp = hibpResult.status === 'fulfilled' ? hibpResult.value : null;

  // Verdict logic
  let verdict: 'MALICIOUS' | 'SUSPICIOUS' | 'CLEAN' | 'UNKNOWN' = 'UNKNOWN';
  if (feodo?.listed) {
    verdict = 'MALICIOUS';
  } else if (vt && vt.malicious > 0) {
    verdict = 'MALICIOUS';
  } else if (
    (vt && vt.suspicious > 0) ||
    (otx && otx.pulseCount > 0) ||
    (abuse && abuse.score > 25) ||
    (intelx && intelx.found)
  ) {
    verdict = 'SUSPICIOUS';
  } else if (vt && vt.total > 0) {
    verdict = 'CLEAN';
  }

  return NextResponse.json({
    indicator,
    type,
    verdict,
    sources: {
      virustotal: vt,
      otx,
      feodo: type === 'ip' ? feodo : null,
      abuseipdb: abuse,
      intelx,
      hibp: type === 'domain' ? hibp : null,
    },
  });
}
