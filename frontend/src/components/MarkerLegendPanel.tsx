'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

interface LegendItem {
  color: string;
  label: string;
  desc: string;
  source?: string;
}

interface LegendGroup {
  title: string;
  items: LegendItem[];
}

const LEGEND: LegendGroup[] = [
  {
    title: 'AIRCRAFT',
    items: [
      { color: '#60a5fa', label: 'Commercial Flight', desc: 'Scheduled passenger / cargo aircraft', source: 'adsb.lol / OpenSky' },
      { color: '#f97316', label: 'Private / Bizjet', desc: 'Private aviation and business jets', source: 'adsb.lol' },
      { color: '#f43f5e', label: 'Military Aircraft', desc: 'Tracked military and government aircraft', source: 'adsb.lol / ADSB Exchange' },
      { color: '#facc15', label: 'UAV / Drone', desc: 'Unmanned aerial vehicles detected via ADS-B', source: 'adsb.lol' },
      { color: '#a78bfa', label: 'POTUS / VIP', desc: 'US presidential or high-value tracked aircraft', source: 'adsb.lol' },
    ],
  },
  {
    title: 'MARITIME',
    items: [
      { color: '#22d3ee', label: 'MPA Vessel', desc: 'Maritime Port Authority Singapore tracked vessels', source: 'MPA Oceans-X' },
      { color: '#64748b', label: 'Military Vessel', desc: 'Warships and naval carriers', source: 'AIS / USNI' },
      { color: '#34d399', label: 'Cargo / Tanker', desc: 'Commercial cargo and tanker vessels', source: 'AISstream.io' },
      { color: '#93c5fd', label: 'Passenger Ship', desc: 'Cruise and ferry vessels', source: 'AISstream.io' },
      { color: '#fbbf24', label: 'Watchlisted Vessel', desc: 'Vessel on the OSINT watchlist — monitor closely', source: 'User watchlist' },
    ],
  },
  {
    title: 'CONFLICT & THREATS',
    items: [
      { color: '#ef4444', label: 'Conflict Event', desc: 'Armed conflict or political violence incident', source: 'GDELT / ACLED / UCDP' },
      { color: '#f97316', label: 'Piracy Zone', desc: 'IMB-reported piracy or armed robbery area', source: 'IMB PRC' },
      { color: '#fb923c', label: 'Missile / SAM Site', desc: 'Known missile launch or SAM radar site', source: 'OSINT (static)' },
      { color: '#e11d48', label: 'Breaking News', desc: 'High risk-score geolocated news event', source: 'OSINT RSS feeds' },
      { color: '#dc2626', label: 'Escalation Alert', desc: 'Correlated multi-source escalation signal', source: 'Catto correlation engine' },
    ],
  },
  {
    title: 'INFRASTRUCTURE',
    items: [
      { color: '#fde047', label: 'Power Plant', desc: 'Energy infrastructure — nuclear, hydro, thermal', source: 'GeoNames / OSINT' },
      { color: '#f59e0b', label: 'Military Base', desc: 'Known military installation or airfield', source: 'OSINT (static)' },
      { color: '#86efac', label: 'Chokepoint', desc: 'Strategic maritime chokepoint or strait', source: 'OSINT (static)' },
      { color: '#67e8f9', label: 'Airport', desc: 'Airport or aerodrome', source: 'OurAirports' },
    ],
  },
  {
    title: 'INTELLIGENCE SIGNALS',
    items: [
      { color: '#a78bfa', label: 'Correlation Alert', desc: 'Cross-layer pattern detected — click for details', source: 'Catto engine' },
      { color: '#c084fc', label: 'Telegram Signal', desc: 'Post from monitored Telegram OSINT channel', source: 'Telegram MTProto' },
      { color: '#22d3ee', label: 'OTX Pulse', desc: 'AlienVault OTX threat intelligence pulse', source: 'AlienVault OTX' },
      { color: '#f43f5e', label: 'CISA KEV', desc: 'Known exploited vulnerability — active threat', source: 'CISA KEV' },
      { color: '#fb923c', label: 'Internet Outage', desc: 'BGP-level internet connectivity disruption', source: 'Cloudflare Radar' },
    ],
  },
  {
    title: 'ENVIRONMENT',
    items: [
      { color: '#f97316', label: 'Wildfire / Hotspot', desc: 'Active fire detected by satellite thermal', source: 'NASA FIRMS' },
      { color: '#fbbf24', label: 'Earthquake', desc: 'Seismic event — size = magnitude', source: 'USGS / CWA Taiwan' },
      { color: '#60a5fa', label: 'Weather Alert', desc: 'Typhoon, tropical storm or weather warning', source: 'MetMalaysia / CWA' },
      { color: '#818cf8', label: 'Satellite (orbital)', desc: 'Low-Earth orbit satellite tracked in real time', source: 'CelesTrak SGP4' },
    ],
  },
  {
    title: 'STATUS COLOURS',
    items: [
      { color: '#4ade80', label: 'No Incident', desc: 'Normal operations — no significant activity detected' },
      { color: '#facc15', label: 'Heightened', desc: 'Elevated activity in at least one monitored region' },
      { color: '#f87171', label: 'Elevated', desc: 'Active high-severity event or correlation in progress' },
    ],
  },
];

export default function MarkerLegendPanel() {
  const [isMinimized, setIsMinimized] = useState(true);
  const [openGroup, setOpenGroup] = useState<string | null>(null);

  return (
    <div className="w-full bg-[#0a0a0a]/90 backdrop-blur-sm border border-cyan-900/40 font-mono pointer-events-auto overflow-hidden flex-shrink-0">
      {/* Header */}
      <div
        className="px-3 py-2.5 border-b border-[var(--border-primary)]/50 cursor-pointer hover:bg-[var(--bg-secondary)]/30 transition-colors flex items-center justify-between"
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <h2 className="text-[10px] tracking-widest font-bold text-cyan-400 flex items-center gap-1.5">
          <HelpCircle size={11} className="flex-shrink-0" />
          MAP LEGEND
        </h2>
        <button className="text-cyan-500 hover:text-[var(--text-primary)] transition-colors">
          {isMinimized ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
      </div>

      {!isMinimized && (
        <div className="overflow-y-auto styled-scrollbar" style={{ maxHeight: '340px' }}>
          {LEGEND.map((group) => (
            <div key={group.title} className="border-b border-[var(--border-primary)]/30 last:border-0">
              {/* Group header */}
              <button
                className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-[var(--bg-secondary)]/20 transition-colors"
                onClick={() => setOpenGroup(openGroup === group.title ? null : group.title)}
              >
                <span className="text-[8px] font-bold tracking-[0.2em] text-[var(--text-muted)]">
                  {group.title}
                </span>
                <span className="text-[var(--text-muted)]">
                  {openGroup === group.title ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                </span>
              </button>

              {openGroup === group.title && (
                <div className="px-3 pb-2 flex flex-col gap-1.5">
                  {group.items.map((item) => (
                    <div key={item.label} className="flex items-start gap-2">
                      {/* Color dot */}
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5 border border-white/10"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[9px] font-bold text-[var(--text-secondary)]">{item.label}</span>
                        <span className="text-[8px] text-[var(--text-muted)] leading-snug">{item.desc}</span>
                        {item.source && (
                          <span className="text-[7px] text-cyan-700 mt-0.5">{item.source}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
