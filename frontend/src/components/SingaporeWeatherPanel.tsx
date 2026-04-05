'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, CloudRain, Wind, Ship, Anchor } from 'lucide-react';
import { useDataKeys } from '@/hooks/useDataStore';

// ── Types ────────────────────────────────────────────────────────────────────
interface ForecastArea { area: string; forecast: string; lat: number | null; lng: number | null; }
interface RainfallStation { station: string; id: string; lat: number | null; lng: number | null; mm: number; }
interface SgWeatherData { forecast: ForecastArea[]; rainfall: RainfallStation[]; valid_period: { start: string; end: string } | null; timestamp: string; }

interface VesselEntry {
  vesselName: string; callSign: string; imoNumber: string; mmsi: string;
  vesselType: string; flag: string; eta: string; etd: string;
  berth: string; terminal: string; timestamp: string;
}

interface MpaWeatherDay {
  date?: string; forecast?: string; description?: string;
  day?: string; low?: number | string; high?: number | string;
  windDirection?: string; windSpeed?: number | string; [key: string]: unknown;
}

const DATA_KEYS = ['mpa_arrivals', 'mpa_departures', 'mpa_departure_declarations',
                   'mpa_vessel_types', 'mpa_weather_4day'] as const;

const NEA_POLL_MS = 10 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────
function weatherStyle(forecast: string): { short: string; color: string } {
  const f = forecast.toLowerCase();
  if (f.includes('thunder')) return { short: 'TSTM', color: 'text-yellow-400' };
  if (f.includes('heavy rain') || f.includes('heavy showers')) return { short: 'HVY RAIN', color: 'text-blue-400' };
  if (f.includes('moderate rain') || f.includes('moderate showers')) return { short: 'MOD RAIN', color: 'text-blue-300' };
  if (f.includes('light rain') || f.includes('light showers') || f.includes('showers') || f.includes('rain')) return { short: 'RAIN', color: 'text-cyan-300' };
  if (f.includes('cloudy')) return { short: 'CLOUDY', color: 'text-slate-400' };
  if (f.includes('partly cloudy')) return { short: 'P.CLOUD', color: 'text-slate-300' };
  if (f.includes('fair') || f.includes('sunny') || f.includes('clear')) return { short: 'FAIR', color: 'text-green-400' };
  if (f.includes('hazy') || f.includes('windy')) return { short: 'HAZY', color: 'text-amber-300' };
  return { short: forecast.split('(')[0].trim().toUpperCase().slice(0, 8), color: 'text-cyan-300' };
}

const FLAG_EMOJI: Record<string, string> = {
  SG: '🇸🇬', MY: '🇲🇾', ID: '🇮🇩', CN: '🇨🇳', JP: '🇯🇵', KR: '🇰🇷',
  PH: '🇵🇭', TH: '🇹🇭', VN: '🇻🇳', IN: '🇮🇳', HK: '🇭🇰', TW: '🇹🇼',
  PA: '🇵🇦', LR: '🇱🇷', MH: '🇲🇭', BS: '🇧🇸', BH: '🇧🇭', MT: '🇲🇹',
  GB: '🇬🇧', US: '🇺🇸', DE: '🇩🇪', NL: '🇳🇱', GR: '🇬🇷', NO: '🇳🇴',
  BZ: '🇧🇿', CY: '🇨🇾', AG: '🇦🇬',
};

function flagIcon(code: string) {
  return FLAG_EMOJI[code?.toUpperCase()] ?? code ?? '';
}

function fmtTime(iso: string) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Singapore' }); }
  catch { return iso.slice(11, 16) || ''; }
}

// ── Sub-components ────────────────────────────────────────────────────────────
function VesselList({ items, label, typeMap }: { items: VesselEntry[]; label: string; typeMap: Record<string, string> }) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, 5);
  if (!items.length) return <div className="text-[8px] font-mono text-[var(--text-muted)] py-1">No {label.toLowerCase()} data</div>;
  return (
    <div className="space-y-0.5">
      {shown.map((v, i) => (
        <div key={i} className="flex items-start gap-1.5 py-0.5 border-b border-cyan-900/15 last:border-0">
          <span className="text-[8px] text-[var(--text-muted)] shrink-0 w-4 tabular-nums">{i + 1}.</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[9px] font-mono font-bold text-cyan-300 truncate">{v.vesselName || 'UNKNOWN'}</span>
              <span className="text-[7px] font-mono text-[var(--text-muted)]">{flagIcon(v.flag)} {v.flag}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[8px] font-mono text-cyan-700">{typeMap[v.vesselType] || v.vesselType || '—'}</span>
              {(v.eta || v.etd) && (
                <span className="text-[7px] font-mono text-[var(--text-muted)]">
                  {label.includes('Arr') ? 'ETA' : 'ETD'}: {fmtTime(v.eta || v.etd)}
                </span>
              )}
              {v.berth && <span className="text-[7px] font-mono text-[var(--text-muted)] truncate">B: {v.berth}</span>}
            </div>
          </div>
          {v.callSign && <span className="text-[7px] font-mono text-cyan-800 shrink-0">{v.callSign}</span>}
        </div>
      ))}
      {items.length > 5 && (
        <button onClick={() => setExpanded(e => !e)} className="text-[8px] font-mono text-cyan-700 hover:text-cyan-400 mt-1">
          {expanded ? '▲ less' : `▼ +${items.length - 5} more`}
        </button>
      )}
    </div>
  );
}

function MpaWeatherCard({ forecasts }: { forecasts: MpaWeatherDay[] }) {
  if (!forecasts.length) return <div className="text-[8px] font-mono text-[var(--text-muted)]">No forecast data</div>;
  return (
    <div className="space-y-1">
      {forecasts.slice(0, 4).map((day, i) => {
        const label = day.date || day.day || `Day ${i + 1}`;
        const desc = String(day.forecast || day.description || '').trim();
        const { short, color } = desc ? weatherStyle(desc) : { short: '—', color: 'text-cyan-700' };
        const lo = day.low != null ? String(day.low) : null;
        const hi = day.high != null ? String(day.high) : null;
        const wdir = day.windDirection ? String(day.windDirection) : null;
        const wspd = day.windSpeed != null ? String(day.windSpeed) : null;
        return (
          <div key={i} className="flex items-center gap-2 py-0.5 border-b border-cyan-900/15 last:border-0">
            <span className="text-[8px] font-mono text-[var(--text-muted)] w-16 shrink-0">{label}</span>
            <span className={`text-[8px] font-mono font-bold ${color} w-16 shrink-0`}>{short}</span>
            {(lo || hi) && <span className="text-[7px] font-mono text-cyan-700">{lo && `${lo}°`}{hi && `–${hi}°`}</span>}
            {(wdir || wspd) && <span className="text-[7px] font-mono text-cyan-800">{wdir}{wspd ? ` ${wspd}kt` : ''}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function SingaporeWeatherPanel() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'weather' | 'arrivals' | 'departures' | 'decl'>('weather');
  const [neaData, setNeaData] = useState<SgWeatherData | null>(null);
  const [neaLoading, setNeaLoading] = useState(true);

  // MPA data from slow-tier store
  const mpa = useDataKeys(DATA_KEYS) as {
    mpa_arrivals?: VesselEntry[];
    mpa_departures?: VesselEntry[];
    mpa_departure_declarations?: VesselEntry[];
    mpa_vessel_types?: Record<string, string>;
    mpa_weather_4day?: MpaWeatherDay[];
  };

  const arrivals    = mpa.mpa_arrivals ?? [];
  const departures  = mpa.mpa_departures ?? [];
  const decls       = mpa.mpa_departure_declarations ?? [];
  const typeMap     = mpa.mpa_vessel_types ?? {};
  const wx4day      = mpa.mpa_weather_4day ?? [];

  useEffect(() => {
    let cancelled = false;
    async function fetchNea() {
      try {
        const r = await fetch('/api/sg/nea-weather', { cache: 'no-store' });
        if (!cancelled && r.ok) setNeaData(await r.json());
      } catch { /* leave stale */ }
      finally { if (!cancelled) setNeaLoading(false); }
    }
    void fetchNea();
    const id = setInterval(() => void fetchNea(), NEA_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const PINNED = ['sengkang', 'punggol'];
  const sortedForecast = neaData
    ? [...neaData.forecast].sort((a, b) => {
        const pA = PINNED.indexOf(a.area.toLowerCase()), pB = PINNED.indexOf(b.area.toLowerCase());
        const pPA = pA !== -1 ? pA : PINNED.length, pPB = pB !== -1 ? pB : PINNED.length;
        if (pPA !== pPB) return pPA - pPB;
        const rs = (f: string) => { const fl = f.toLowerCase(); if (fl.includes('thunder')) return 3; if (fl.includes('heavy')) return 2; if (fl.includes('rain') || fl.includes('shower')) return 1; return 0; };
        return rs(b.forecast) - rs(a.forecast);
      })
    : [];

  const validUntil = neaData?.valid_period?.end
    ? new Date(neaData.valid_period.end).toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Singapore', hour12: false })
    : null;
  const rainyCount = neaData?.forecast.filter(a => { const f = a.forecast.toLowerCase(); return f.includes('rain') || f.includes('shower') || f.includes('thunder'); }).length ?? 0;
  const totalCount = neaData?.forecast.length ?? 0;
  const hasRain = (neaData?.rainfall.length ?? 0) > 0;

  const tabs = [
    { id: 'weather',   label: 'WX',  count: null },
    { id: 'arrivals',  label: 'ARR', count: arrivals.length },
    { id: 'departures',label: 'DEP', count: departures.length },
    { id: 'decl',      label: 'DECL',count: decls.length },
  ] as const;

  return (
    <div className="w-full rounded border border-cyan-900/40 bg-[#06090f]/90 backdrop-blur-md overflow-hidden">
      {/* Header */}
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-3 py-2 hover:bg-cyan-950/20 transition-colors">
        <div className="flex items-center gap-2 flex-wrap">
          <Ship size={11} className="text-cyan-500 flex-shrink-0" />
          <span className="text-[9px] font-mono font-bold tracking-[0.18em] text-cyan-400 uppercase">SG Port / WX</span>
          {neaLoading && !neaData
            ? <span className="text-[8px] font-mono text-cyan-800">LOADING</span>
            : neaData ? (
              <>
                {hasRain
                  ? <span className="text-[8px] font-mono text-blue-400 font-bold px-1 border border-blue-700/50 bg-blue-950/30">RAIN</span>
                  : <span className="text-[8px] font-mono text-green-500 font-bold px-1 border border-green-800/40 bg-green-950/20">FAIR</span>
                }
                {rainyCount > 0 && <span className="text-[8px] font-mono text-cyan-700">{rainyCount}/{totalCount}</span>}
              </>
            ) : <span className="text-[8px] font-mono text-red-700">NEA UNAVAIL</span>
          }
          {arrivals.length > 0 && <span className="text-[8px] font-mono text-cyan-700">{arrivals.length}↓ARR</span>}
          {departures.length > 0 && <span className="text-[8px] font-mono text-cyan-700">{departures.length}↑DEP</span>}
        </div>
        {open ? <ChevronUp size={11} className="text-cyan-600" /> : <ChevronDown size={11} className="text-cyan-600" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 max-h-96 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#164e63_transparent]">
          {/* Tab bar */}
          <div className="flex gap-1 pt-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-1 px-2 py-0.5 text-[8px] font-mono font-bold tracking-wider border transition-colors ${
                  tab === t.id
                    ? 'border-cyan-500/60 text-cyan-300 bg-cyan-950/40'
                    : 'border-cyan-900/40 text-cyan-800 hover:text-cyan-600'
                }`}
              >
                {t.label}{t.count !== null && t.count > 0 && <span className="text-[7px]">{t.count}</span>}
              </button>
            ))}
          </div>

          {/* WX tab — NEA 2hr + MPA 4-day */}
          {tab === 'weather' && (
            <div className="space-y-3">
              {neaData && (
                <>
                  {neaData.forecast.length > 0 && (
                    <div>
                      <div className="text-[8px] font-mono text-cyan-700 tracking-[0.2em] uppercase mb-1.5 flex items-center gap-1">
                        <CloudRain size={9} /> 2-Hour Forecast {validUntil && <span className="text-[var(--text-muted)]">until {validUntil}</span>}
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                        {sortedForecast.map(area => {
                          const { short, color } = weatherStyle(area.forecast);
                          return (
                            <div key={area.area} className="flex items-center justify-between gap-1">
                              <span className="text-[9px] font-mono text-[var(--text-secondary)] truncate">{area.area}</span>
                              <span className={`text-[8px] font-mono font-bold ${color} shrink-0`}>{short}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {neaData.rainfall.length > 0 && (
                    <div>
                      <div className="text-[8px] font-mono text-cyan-700 tracking-[0.2em] uppercase mb-1.5 flex items-center gap-1">
                        <Wind size={9} className="text-blue-500" /> Active Rainfall
                      </div>
                      <div className="space-y-1">
                        {neaData.rainfall.map(s => (
                          <div key={s.id} className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-mono text-[var(--text-secondary)] truncate">{s.station}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <div className="h-1.5 bg-blue-500/70 rounded-sm" style={{ width: `${Math.min(40, Math.round(s.mm * 4))}px` }} />
                              <span className="text-[9px] font-mono text-blue-300 font-bold w-10 text-right">{s.mm.toFixed(1)}mm</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {neaData.rainfall.length === 0 && neaData.forecast.length > 0 && (
                    <div className="text-[8px] font-mono text-green-600">No active rainfall</div>
                  )}
                </>
              )}
              {wx4day.length > 0 && (
                <div>
                  <div className="text-[8px] font-mono text-cyan-700 tracking-[0.2em] uppercase mb-1.5 flex items-center gap-1">
                    <CloudRain size={9} /> MPA 4-Day Maritime Forecast
                  </div>
                  <MpaWeatherCard forecasts={wx4day} />
                </div>
              )}
            </div>
          )}

          {/* Arrivals tab */}
          {tab === 'arrivals' && (
            <div>
              <div className="text-[8px] font-mono text-cyan-700 tracking-[0.2em] uppercase mb-1.5 flex items-center gap-1">
                <Anchor size={9} /> Today&apos;s Arrivals — {arrivals.length} vessels
              </div>
              <VesselList items={arrivals} label="Arrivals" typeMap={typeMap} />
            </div>
          )}

          {/* Departures tab */}
          {tab === 'departures' && (
            <div>
              <div className="text-[8px] font-mono text-cyan-700 tracking-[0.2em] uppercase mb-1.5 flex items-center gap-1">
                <Ship size={9} /> Today&apos;s Departures — {departures.length} vessels
              </div>
              <VesselList items={departures} label="Departures" typeMap={typeMap} />
            </div>
          )}

          {/* Declaration declarations tab */}
          {tab === 'decl' && (
            <div>
              <div className="text-[8px] font-mono text-cyan-700 tracking-[0.2em] uppercase mb-1.5">
                Departure Declarations — past 6h ({decls.length})
              </div>
              <VesselList items={decls} label="Declarations" typeMap={typeMap} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
