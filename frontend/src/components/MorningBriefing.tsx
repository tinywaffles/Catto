'use client';

import { useState, useEffect } from 'react';
import { X, Shield } from 'lucide-react';
import { useDataKeys } from '@/hooks/useDataStore';
import type {
  GdeltConflictEvent, OtxPulse, CisaKevEntry,
  SgSecureAlert, ScdfIncident, MrtAlert,
} from '@/types/dashboard';

const STORAGE_KEY = 'catto:briefing-date';

const KEYS = [
  'gdelt_conflict', 'otx_pulses', 'cisa_kev',
  'sgsecure_alerts', 'scdf_incidents', 'mrt_alerts',
  'ransomware_iocs',
] as const;

const SEA_COUNTRIES = new Set(['SG', 'MY', 'TH', 'ID', 'PH', 'VN', 'MM', 'BN', 'KH', 'LA', 'TL']);

interface RegionalHeadline { source?: string; title?: string }
interface PsiReading { region: string; psi_24h: number }
interface WeatherArea { area: string; forecast: string }
interface CommodityQuote { price: number | null; change_pct: number | null }

function SectionLabel({ label, color }: { label: string; color: string }) {
  return (
    <div className={`text-[7.5px] font-mono tracking-[0.25em] uppercase font-bold mb-1.5 ${color} border-b border-current/20 pb-0.5`}>
      {label}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[8.5px] font-mono text-gray-300 leading-snug py-0.5 border-b border-white/5 last:border-0">
      {children}
    </div>
  );
}

export default function MorningBriefing() {
  const [visible, setVisible] = useState(false);

  // SGT time — client-side only to avoid SSR/Docker clock issues
  const [sgtTime, setSgtTime] = useState('');
  const [sgtHour, setSgtHour] = useState(12);

  // Feed data
  const [headlines, setHeadlines] = useState<RegionalHeadline[]>([]);
  const [psi, setPsi] = useState<PsiReading[]>([]);
  const [weather, setWeather] = useState<WeatherArea[]>([]);
  const [commodities, setCommodities] = useState<{ gold: CommodityQuote; crude: CommodityQuote; sgdusd: CommodityQuote } | null>(null);

  const { gdelt_conflict, otx_pulses, cisa_kev, sgsecure_alerts, scdf_incidents, mrt_alerts, ransomware_iocs } = useDataKeys(KEYS);

  useEffect(() => {
    // Show once per calendar day (SGT = UTC+8)
    const now = new Date();
    const sgtDateStr = new Date(now.getTime() + 8 * 3600 * 1000)
      .toISOString()
      .slice(0, 10); // YYYY-MM-DD in SGT
    if (localStorage.getItem(STORAGE_KEY) === sgtDateStr) return;
    setVisible(true);

    // Compute SGT purely from UTC+8 offset — client-side only (reuse `now`)
    const h = (now.getUTCHours() + 8) % 24;
    const m = now.getUTCMinutes();
    setSgtHour(h);
    setSgtTime(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} SGT`);

    // Fetch supplementary feeds in parallel
    fetch('/api/regional-news')
      .then((r) => r.ok ? r.json() : [])
      .then((d: RegionalHeadline[]) => setHeadlines(d.slice(0, 6)))
      .catch(() => {});

    fetch('/api/sg/psi')
      .then((r) => r.ok ? r.json() : [])
      .then((d: PsiReading[]) => setPsi(d))
      .catch(() => {});

    fetch('/api/sg/nea-weather')
      .then((r) => r.ok ? r.json() : null)
      .then((d: { forecast?: WeatherArea[] } | null) => {
        if (d?.forecast) setWeather(d.forecast.slice(0, 3));
      })
      .catch(() => {});

    fetch('/api/commodities')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setCommodities(d); })
      .catch(() => {});
  }, []);

  const dismiss = () => {
    const now = new Date();
    const sgtDateStr = new Date(now.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
    localStorage.setItem(STORAGE_KEY, sgtDateStr);
    setVisible(false);
  };

  if (!visible) return null;

  const greeting = sgtHour < 12 ? 'MORNING' : sgtHour < 17 ? 'AFTERNOON' : 'EVENING';

  // Conflict data
  const gdelt = (gdelt_conflict as GdeltConflictEvent[] | undefined) ?? [];
  const topConflict = [...gdelt].sort((a, b) => (a.tone ?? 0) - (b.tone ?? 0)).slice(0, 4);
  const hasConflict = headlines.length > 0 || topConflict.length > 0;

  // Cyber data
  const otx = (otx_pulses as OtxPulse[] | undefined) ?? [];
  const kev = (cisa_kev as CisaKevEntry[] | undefined) ?? [];
  const kevLatest = [...kev].sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()).slice(0, 2);

  // Ransomware SG/SEA victims
  type RansomVictim = { victim: string; group: string; discovered: string; domain: string; country: string };
  const allVictims = (ransomware_iocs as unknown as RansomVictim[] | undefined) ?? [];
  const seaVictims = allVictims
    .filter((v) => SEA_COUNTRIES.has((v.country || '').toUpperCase()))
    .sort((a, b) => (b.discovered || '').localeCompare(a.discovered || ''))
    .slice(0, 5);

  // Singapore data
  const sgSec = (sgsecure_alerts as SgSecureAlert[] | undefined) ?? [];
  const scdf = (scdf_incidents as ScdfIncident[] | undefined) ?? [];
  const mrt = (mrt_alerts as MrtAlert[] | undefined) ?? [];
  const psiMax = psi.length > 0 ? Math.max(...psi.map((p) => p.psi_24h)) : null;
  const psiLabel = psiMax === null ? null
    : psiMax <= 50 ? `${psiMax} Good`
    : psiMax <= 100 ? `${psiMax} Moderate`
    : psiMax <= 200 ? `${psiMax} Unhealthy`
    : `${psiMax} Very Unhealthy`;
  const psiColor = psiMax === null ? 'text-gray-400'
    : psiMax <= 50 ? 'text-green-400'
    : psiMax <= 100 ? 'text-yellow-400'
    : 'text-red-400';

  function fmtPrice(q: CommodityQuote | undefined, prefix = '', decimals = 2) {
    if (!q?.price) return '—';
    const chg = q.change_pct !== null ? ` (${q.change_pct >= 0 ? '+' : ''}${q.change_pct.toFixed(1)}%)` : '';
    return `${prefix}${q.price.toFixed(decimals)}${chg}`;
  }

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center pointer-events-auto">
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={dismiss} />

      {/* Modal */}
      <div className="relative z-10 w-[560px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-4rem)] overflow-y-auto styled-scrollbar bg-[#07090e]/98 border border-cyan-800/60 shadow-[0_0_60px_rgba(0,200,255,0.08)] font-mono">

        {/* Header */}
        <div className="sticky top-0 bg-[#07090e]/98 border-b border-cyan-900/40 px-5 py-3 flex items-center gap-3 z-10">
          <Shield size={12} className="text-cyan-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold tracking-[0.3em] text-white uppercase">
              {greeting} BRIEFING
            </div>
            <div className="text-[7.5px] text-gray-400 tracking-[0.2em] mt-0.5">
              CATTO GLOBAL THREAT INTERCEPT{sgtTime ? ` · ${sgtTime}` : ''}
            </div>
          </div>
          <button onClick={dismiss} className="text-gray-500 hover:text-gray-300 flex-shrink-0">
            <X size={12} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* ── CONFLICT & WAR ── */}
          {hasConflict && (
            <section>
              <SectionLabel label="Conflict &amp; War" color="text-red-400" />
              {headlines.map((h, i) => (
                <Row key={`h-${i}`}>
                  {h.source && <span className="text-gray-500">[{h.source}] </span>}
                  {h.title}
                </Row>
              ))}
              {topConflict.map((e, i) => (
                <Row key={`g-${i}`}>
                  <span className="text-orange-400/70">GDELT </span>
                  <span className="text-gray-300">{e.title}</span>
                </Row>
              ))}
            </section>
          )}

          {/* ── CYBER THREATS ── */}
          {(otx.length > 0 || kevLatest.length > 0) && (
            <section>
              <SectionLabel label="Cyber Threats" color="text-cyan-400" />
              {otx.slice(0, 3).map((p, i) => (
                <Row key={`otx-${i}`}>
                  {p.name}
                  {p.malware_families?.length ? <span className="text-cyan-600"> [{p.malware_families[0].display_name}]</span> : ''}
                </Row>
              ))}
              {kevLatest.map((k, i) => (
                <Row key={`kev-${i}`}>
                  <span className="text-yellow-500">{k.cveID} </span>{k.vulnerabilityName}
                </Row>
              ))}
            </section>
          )}

          {/* ── RANSOMWARE SG/SEA ── */}
          {seaVictims.length > 0 && (
            <section>
              <SectionLabel label="Ransomware — SG / SEA" color="text-red-500" />
              {seaVictims.map((v, i) => (
                <Row key={`rsea-${i}`}>
                  <span className="text-red-400/80">[{v.country.toUpperCase()}] </span>
                  <span className="text-gray-300">{v.victim}</span>
                  <span className="text-gray-500"> · {v.group}</span>
                </Row>
              ))}
            </section>
          )}

          {/* ── SINGAPORE STATUS ── */}
          <section>
            <SectionLabel label="Singapore Status" color="text-amber-400" />

            {/* PSI + Weather */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mb-1">
              {psiLabel && (
                <div className="text-[8.5px] font-mono">
                  <span className="text-gray-500">PSI 24h </span>
                  <span className={psiColor}>{psiLabel}</span>
                </div>
              )}
              {weather.length > 0 && (
                <div className="text-[8.5px] font-mono text-gray-300">
                  <span className="text-gray-500">Wx </span>
                  {weather[0].forecast}
                </div>
              )}
            </div>

            {/* Markets */}
            <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 mt-1 pt-1 border-t border-white/5">
              <div className="text-[8px] font-mono">
                <div className="text-gray-500 mb-0.5">SGD/USD</div>
                <div className="text-green-300">{fmtPrice(commodities?.sgdusd, '$', 4)}</div>
              </div>
              <div className="text-[8px] font-mono">
                <div className="text-gray-500 mb-0.5">Gold (SGD/g)</div>
                <div className="text-yellow-300">{fmtPrice(commodities?.gold, 'S$')}</div>
              </div>
              <div className="text-[8px] font-mono">
                <div className="text-gray-500 mb-0.5">Oil (Brent)</div>
                <div className="text-orange-300">{fmtPrice(commodities?.crude, '$')}</div>
              </div>
            </div>

            {/* SG incidents */}
            {(sgSec.length > 0 || scdf.length > 0 || mrt.length > 0) && (
              <div className="mt-1.5 space-y-0.5">
                {sgSec.filter((i) => i.severity === 'high').slice(0, 2).map((i, idx) => (
                  <Row key={`sg-${idx}`}><span className="text-red-400">[SGSecure] </span>{i.title}</Row>
                ))}
                {scdf.slice(0, 1).map((i, idx) => (
                  <Row key={`scdf-${idx}`}><span className="text-orange-400">[SCDF] </span>{i.title}</Row>
                ))}
                {mrt.slice(0, 1).map((i, idx) => (
                  <Row key={`mrt-${idx}`}><span className="text-amber-400">[MRT] </span>{(i as unknown as Record<string, string>).title ?? 'Service disruption'}</Row>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Footer buttons */}
        <div className="sticky bottom-0 bg-[#07090e]/98 border-t border-cyan-900/40 px-5 py-3 flex gap-3 justify-end">
          <button
            onClick={dismiss}
            className="px-4 py-2 text-[9px] font-mono tracking-[0.2em] text-gray-400 border border-gray-700 hover:border-gray-500 hover:text-gray-200 transition-colors"
          >
            DISMISS
          </button>
          <button
            onClick={dismiss}
            className="px-4 py-2 text-[9px] font-mono tracking-[0.2em] text-cyan-300 border border-cyan-700 hover:border-cyan-500 hover:bg-cyan-950/40 transition-colors"
          >
            ENTER
          </button>
        </div>
      </div>
    </div>
  );
}
