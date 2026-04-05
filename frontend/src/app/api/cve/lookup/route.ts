import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const cveId = req.nextUrl.searchParams.get('cve')?.trim().toUpperCase();
  if (!cveId || !/^CVE-\d{4}-\d{4,}$/.test(cveId)) {
    return NextResponse.json({ error: 'Invalid CVE ID. Format: CVE-YYYY-NNNNN' }, { status: 400 });
  }

  const [nvdResult, kevResult] = await Promise.allSettled([
    fetch(
      `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cveId}`,
      { cache: 'no-store' },
    ).then((r) => (r.ok ? r.json() : null)),
    fetch(
      'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json',
      { next: { revalidate: 3600 } },
    ).then((r) => (r.ok ? r.json() : null)),
  ]);

  const nvd = nvdResult.status === 'fulfilled' ? nvdResult.value : null;
  const kev = kevResult.status === 'fulfilled' ? kevResult.value : null;

  const vuln = nvd?.vulnerabilities?.[0]?.cve;
  if (!vuln) {
    return NextResponse.json({ error: 'CVE not found in NVD' }, { status: 404 });
  }

  // Prefer CVSSv3.1, fall back to v3.0, then v2
  const metrics =
    vuln.metrics?.cvssMetricV31?.[0] ??
    vuln.metrics?.cvssMetricV30?.[0] ??
    vuln.metrics?.cvssMetricV2?.[0] ??
    null;

  const cvssScore: number | null = metrics?.cvssData?.baseScore ?? null;
  const severity: string | null = metrics?.cvssData?.baseSeverity ?? null;
  const vectorString: string | null = metrics?.cvssData?.vectorString ?? null;

  const description =
    vuln.descriptions?.find((d: { lang: string; value: string }) => d.lang === 'en')?.value ?? '';

  // Extract unique products from CPE configurations
  const cpes: string[] = vuln.configurations?.flatMap(
    (conf: { nodes?: { cpeMatch?: { criteria: string }[] }[] }) =>
      conf.nodes?.flatMap((n: { cpeMatch?: { criteria: string }[] }) =>
        n.cpeMatch?.map((c: { criteria: string }) => c.criteria) ?? [],
      ) ?? [],
  ) ?? [];

  const products: string[] = [
    ...new Set(
      cpes.map((cpe: string) => {
        const parts = cpe.split(':');
        return parts.length >= 5
          ? `${parts[3]} ${parts[4]}`.replace(/_/g, ' ')
          : cpe;
      }),
    ),
  ].slice(0, 10);

  // CISA KEV check
  const kevEntry = kev?.vulnerabilities?.find(
    (v: { cveID: string }) => v.cveID === cveId,
  );

  const references = (vuln.references ?? [])
    .slice(0, 5)
    .map((r: { url: string; tags?: string[] }) => ({ url: r.url, tags: r.tags ?? [] }));

  return NextResponse.json({
    cveId,
    description,
    cvssScore,
    severity,
    vectorString,
    products,
    references,
    cisaKev: kevEntry
      ? {
          listed: true,
          dateAdded: kevEntry.dateAdded,
          dueDate: kevEntry.dueDate,
          requiredAction: kevEntry.requiredAction,
          vendorProject: kevEntry.vendorProject,
          product: kevEntry.product,
        }
      : { listed: false },
    published: vuln.published,
    lastModified: vuln.lastModified,
  });
}
