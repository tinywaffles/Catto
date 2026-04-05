'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Globe,
  Shield,
  Bug,
  Eye,
  Zap,
  Plane,
  Clock,
  Heart,
  Radar,
} from 'lucide-react';

const CURRENT_VERSION = '7.0.0';
const STORAGE_KEY = `catto_changelog_v${CURRENT_VERSION}`;
const RELEASE_TITLE = 'Catto 0.7 — deck.gl Migration & Feed Filters';

const HEADLINE_FEATURE = {
  icon: <Eye size={20} className="text-amber-400" />,
  title: 'Watchlist Toast Flood Fix',
  subtitle: 'Adding a vessel or flight to the watchlist no longer triggers a burst of toast notifications. Toasts are now suppressed during the 60-second startup warmup and rate-limited per entry.',
  details: [
    'Startup suppression: no watchlist toasts fire during the first 60 seconds — covers the period when all AIS/flight data arrives at once.',
    'One toast per watchlist entry: if a search term matches 20 vessels, a single "VESSEL (+19 more) matched on map" notification fires instead of 20 simultaneous toasts.',
    '72-hour cooldown per entity: vessels that briefly drop out of AIS coverage and reappear do not re-trigger their notification.',
    'Baseline tracking: on first load, existing saved watchlist entries silently build their match baseline without any notifications.',
  ],
  callToAction: 'WATCHLIST ALERTS NOW FIRE ONCE PER ENTRY, NOT PER VESSEL',
};

const NEW_FEATURES = [
  {
    icon: <Plane size={18} className="text-cyan-400" />,
    title: 'Regional Flight Control (v6.0)',
    desc: 'USA and Europe civilian flights moved to Others tab, OFF by default. Asia-Pacific commercial, private, and jet traffic remains ON. Flights with no filed destination outside Asia are hidden by default.',
    color: 'cyan',
  },
  {
    icon: <Shield size={18} className="text-rose-400" />,
    title: 'POTUS Airborne Alert (v6.0)',
    desc: 'When Air Force One ICAO hex (adfdf8–adfdff) appears in tracked flights, a CRITICAL toast fires immediately. Resets on landing. Tracked flights and POTUS icons are never filtered by region.',
    color: 'rose',
  },
  {
    icon: <Globe size={18} className="text-amber-400" />,
    title: 'Windows Auto-Installer (v6.0)',
    desc: 'install.bat checks WSL, Docker Desktop, and Node.js; builds containers; installs Electron; creates desktop shortcut. Full API key guidance with registration links shown during setup.',
    color: 'amber',
  },
  {
    icon: <Zap size={18} className="text-cyan-400" />,
    title: 'Staggered Startup & Font Cache (v6.0)',
    desc: 'Data fetches delayed to t+15s/t+45s — prevents startup OOM. Warmup progress bar. CARTO font proxy caches glyph tiles in memory; zero upstream requests after warmup.',
    color: 'cyan',
  },
];

const BUG_FIXES = [
  'Watchlist: adding a vessel/flight no longer floods the UI with simultaneous toast notifications',
  'Watchlist: toasts suppressed for 60 s at startup — data load surge no longer triggers alerts',
  'Watchlist: 72-hour cooldown per entity prevents re-alerts when ships drop out of AIS coverage',
  'Watchlist: multiple matches batched into one "X (+N more) matched" notification per entry',
  'USA/Europe flights no longer pollute Asia-Pacific view on startup',
  'POTUS alert fires once on detection, resets on landing — no duplicate toasts',
  'OOM crash on zoom-out eliminated — viewport culling + 8 GB heap',
  'Exponential backoff on failed fetches — 5s → 10s → 20s → 40s → 60s max',
];

const VERSION_HISTORY = [
  {
    version: 'v7.0.0',
    title: 'Full deck.gl Migration',
    items: [
      'All vessel and flight layers migrated to deck.gl IconLayer (Session 1) — MPA vessels, AIS world ships, commercial, private, private jet, military, tracked flights',
      'GDELT, UCDP, satellites, earthquakes, piracy, NASA FIRMS migrated to deck.gl (Session 2)',
      'SPF, SAF, power stations, CCTV, all static markers migrated to deck.gl (Session 3)',
      'GDELT conflict markers → deck.gl ScatterplotLayer (global, no viewport cull)',
      'UCDP conflict markers → deck.gl ScatterplotLayer (global, deaths-scaled radius)',
      'Satellites → deck.gl IconLayer with 9 mission-type icons + ISS gold halo ring',
      'USGS earthquakes → deck.gl IconLayer (MapLibre clustering removed)',
      'IMB piracy markers → deck.gl ScatterplotLayer (incident-type colour coding)',
      'NASA FIRMS fire hotspots → deck.gl IconLayer (4 colours by brightness temperature)',
      'All hard caps and marker limits removed — GPU-accelerated rendering for all point layers',
      'New plane icon design — all aircraft icons remade as top-down silhouettes; heading shown via rotation; fighter jet uses delta-wing shape; tanker has nose probe; recon has sensor overlay',
      'Split icon sizes — flights use enlarged icon size (48px base); ships retain original size (26px base) with separate zoom scales',
      'Piracy filter — ICC-CCS incidents filtered to last 14 days (API updates weekly; 24h was always empty)',
      'Ransomware filter — feed filtered to last 24 hours globally; if Singapore is among targeted countries, full list shown so SG incidents are never hidden',
      'GDELT cap removed — raised from 250 to 1,000 events',
      'UCDP cap removed — raised from 500 to 2,000 events; start date extended to 2022',
      'FIRMS cap raised — from 5,000 to 15,000 hotspots',
      'Earthquake cap removed — no longer limited to 50 features',
      'ACLED global render — changed from viewport-culled to ALWAYS_IN_VIEW, consistent with GDELT/UCDP',
      'Watchlist gold star highlighting via deck.gl TextLayer; icon atlas sprite sheet for all entity types',
      'updateTriggers for live data — no full layer rebuilds on every frame',
      'MapLibre retained for: base tiles, NFZ polygons, undersea cables, popups, controls',
      'Performance fixes — watchlist ring subsets pre-computed once per frame; onEntityClick moved to ref; dead _haversineKm function removed',
      'Full codebase audit completed',
    ],
  },
  {
    version: 'v6.1.0',
    title: 'Watchlist & Map Fixes',
    items: [
      'Watchlist gold ring highlight — static ScatterplotLayer, no animation, no GPU leak',
      'Toast notifications for watchlisted entity sightings',
      'Map initial view fixed to Singapore on every launch',
      'LayerUpdate model fixed to include ships_mpa/ships_ais_world keys',
      'Polling intervals optimised: CISA KEV 3600s, Feodo 1800s, SG feeds 300s',
      'Watchlist toast suppression fixed — one toast per entity, not 50 on startup',
      'Imperative map updates via setData() bypass for high-volume layers',
    ],
  },
  {
    version: 'v6.0.0',
    title: 'Performance & Stability',
    items: [
      'USA/Europe civilian flights moved to Others tab, OFF by default — Asia-Pacific flights remain ON',
      'POTUS airborne alert — CRITICAL toast notification when Air Force One ICAO detected in tracked flights',
      'Comprehensive Windows installer — install.bat with WSL/Docker/Node checks, API key guidance, desktop shortcut',
      'start_catto.bat — one-click launch: starts Docker if needed, waits for readiness, launches Electron',
      'Staggered backend startup — 5 stages over 5 minutes',
      'Viewport culling — markers outside viewport removed from render tree; hard marker budget 1500',
      'Zoom-based layer switching; rate limiting on Next.js API routes',
      'Payload reduced from 8–13 MB to 4.9–5.2 MB',
      'Backend memory stable at 926 MB–1.06 GB / 3 GB limit; WSL memory capped at 8 GB via .wslconfig',
      'Stale data preservation on fetcher errors; exponential backoff 5s → 10s → 20s → 40s → 60s',
      'Font proxy /api/glyphs fixed — CARTO fonts served locally; server-side glyph cache, 1yr browser cache',
      'Watchlist startup suppression (60 s), per-entity 72 hr cooldown',
      'Full codebase audit: all shadow--broker references replaced',
    ],
  },
  {
    version: 'v5.0.0',
    title: 'Electron Desktop App',
    items: [
      'Electron wrapper with custom titlebar "CATTO // GLOBAL INTELLIGENCE"',
      'System tray icon with minimize-to-tray; window position memory; F11 fullscreen toggle',
      'install.bat and start_catto.bat for one-click startup',
      'V8 heap raised to 8 GB; --disable-renderer-backgrounding; --memory-pressure-off',
      'Viewport culling engine — military flights/vessels bypass cull, SAF/satellite always global',
      'Fast fetch at t+15s, slow at t+45s; warmup progress bar',
      'Fast tier 30s steady-state polling; exponential backoff on failures',
    ],
  },
  {
    version: 'v4.1.1',
    title: 'Telegram & Feed Fixes',
    items: [
      'Telegram dead channels replaced',
      'liveuamap exception handler broadened',
    ],
  },
  {
    version: 'v4.1.0',
    title: 'Map & MPA Fixes',
    items: [
      'Map centred on Singapore zoom 11 on every launch',
      'MPA/World Ships toggles added to layer panel',
      'CARTO font CORS fixed',
      'React hydration fix',
    ],
  },
  {
    version: 'v4.0',
    title: 'Conflict Intelligence & Telegram',
    items: [
      'Telegram conflict monitor via Telethon',
      'Channels: intelslava, rybar, militarylandnet, warmonitor, middleeasteye, AlArabiya_Eng',
      'SIGINT panel for Telegram keyword alerts',
      'Tor SOCKS5 routing for dark feed access',
      'Global infrastructure layers moved to Others (OFF by default)',
      'USA/Europe civilian flights moved to Others (OFF by default)',
    ],
  },
  {
    version: 'v3.0',
    title: 'Singapore Intelligence Layer',
    items: [
      'CAAS NFZ polygons via OneMap API',
      '5 km exclusion circles around Changi, Paya Lebar, Tengah, Sembawang airbases',
      'SAF/RSAF/RSN installations — 20 bases including Pulau Tekong BMTC',
      'SPF Establishments from data.gov.sg GeoJSON',
      'IMB Piracy feed (OFF by default, within 1000 km SG)',
      'USGS Earthquakes (magnitude 4.5+)',
      'NASA FIRMS SE Asia fire hotspots',
      'Bellingcat RSS in OSINT Feeds',
    ],
  },
  {
    version: 'v2.0',
    title: 'MPA OCEANS-X Integration',
    items: [
      'MPA OCEANS-X vessel tracking — 1,200+ live vessels with 3-minute refresh',
      'Vessel Positions Snapshot API with JWT auth (365-day token)',
      'Horsburgh Lighthouse / Pedra Branca marker (1.3303N, 104.4058E)',
      'MPA toggle in Singapore pillar (ON by default); World Ships AIS in Others (OFF)',
      'MPA port arrivals/departures panels; maritime weather and wind overlay',
    ],
  },
  {
    version: 'v1.0',
    title: 'Identity & Branding',
    items: [
      'Full shadow--broker identity removal; Catto 1.0.0 versioning across all files',
      'Sentence case layer names; dead code removal; satellite layer fix',
      'SG weather and feed health moved to left sidebar',
      'Docker memory limits; polling frequency optimisation',
    ],
  },
  {
    version: 'v0.9',
    title: 'Conflict Layer',
    items: [
      'GDELT conflict event filter; UCDP conflict feed',
      'SG weather panel always visible; conflict layers always on by default',
    ],
  },
  {
    version: 'v0.8',
    title: 'Feed Health & Polish',
    items: [
      'Feed health panel added to sidebar',
      'Mesh/wormhole UI hidden by default; TOP SECRET header removed',
      'Region dossier fix; Sengkang/Punggol weather priority',
    ],
  },
  {
    version: 'v0.7',
    title: 'Cleanup & Markets',
    items: [
      'Removed Oracle/FLIR/police scanners/celebrity jets',
      'Markets ticker: gold, oil, SGD/USD in SGT',
      'NEA rainfall and 2 hr weather forecast in right-click popup',
      'OneMap geocoding for SG locations',
    ],
  },
  {
    version: 'v0.6',
    title: 'Alerts & Aviation',
    items: [
      'Alert ticker and toast notifications',
      'LTA bus arrivals and MRT alerts',
      'CSA/SingCERT feed',
      'CII (Critical Information Infrastructure) filter — ON by default',
      'Global Fishing Watch',
      'ADS-B Exchange military flights',
      'NOTAM integration',
      'Airframes.io tracked flights',
      'Cyber panel priority sorting',
    ],
  },
  {
    version: 'v0.5',
    title: 'Cyber Pillar',
    items: [
      'CISA KEV (Known Exploited Vulnerabilities)',
      'Abuse.ch ransomware tracker',
      'Feodo C2 botnet tracker',
      'AlienVault OTX threat intelligence',
      'Shodan integration activated',
    ],
  },
  {
    version: 'v0.4',
    title: 'Singapore Feeds',
    items: [
      'LTA road incidents and traffic speed bands',
      'NEA PSI air quality',
      'Incident popups on map click',
    ],
  },
  {
    version: 'v0.3',
    title: 'Four Pillars',
    items: [
      'Singapore / Cyber / Conflict / World layer panel',
      'Singapore set as default map center (1.35N, 103.82E, zoom 11)',
      'Carto Dark Matter default map tiles',
    ],
  },
  {
    version: 'v0.2',
    title: 'Warroom Theme',
    items: [
      'Warroom aesthetic overhaul (dark, minimal, operational)',
      'Local build fix',
      'Removed cyberpunk styling',
    ],
  },
  {
    version: 'v0.1',
    title: 'Foundation',
    items: [
      'Forked from shadow--broker v0.9.6',
      'Docker isolation with custom project name and ports',
      'Initial rename and cleanup',
    ],
  },
];

export function useChangelog() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) setShow(true);
  }, []);
  return { showChangelog: show, setShowChangelog: setShow };
}

interface ChangelogModalProps {
  onClose: () => void;
}

const ChangelogModal = React.memo(function ChangelogModal({ onClose }: ChangelogModalProps) {
  const [activeTab, setActiveTab] = useState<'whats-new' | 'roadmap' | 'history' | 'credits'>('whats-new');

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    onClose();
  };

  return (
    <AnimatePresence>
      <motion.div
        key="changelog-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[10000]"
        onClick={handleDismiss}
      />
      <motion.div
        key="changelog-modal"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed inset-0 z-[10001] flex items-center justify-center pointer-events-none"
      >
        <div
          className="w-[700px] max-h-[90vh] bg-[var(--bg-secondary)]/98 border border-cyan-900/50 pointer-events-auto flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-5 pb-0 border-b border-[var(--border-primary)]/80">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="flex items-center gap-3">
                  <div className="px-2.5 py-1 bg-cyan-500/15 border border-cyan-500/30 text-xs font-mono font-bold text-cyan-400 tracking-widest">
                    v{CURRENT_VERSION}
                  </div>
                  <h2 className="text-base font-bold tracking-[0.15em] text-[var(--text-primary)] font-mono">
                    CATTO CHANGELOG
                  </h2>
                </div>
                <p className="text-[11px] text-cyan-500/70 font-mono tracking-widest mt-1">
                  {RELEASE_TITLE.toUpperCase()}
                </p>
              </div>
              <button
                onClick={handleDismiss}
                className="w-8 h-8 border border-[var(--border-primary)] hover:border-red-500/50 flex items-center justify-center text-[var(--text-muted)] hover:text-red-400 transition-all hover:bg-red-950/20"
              >
                <X size={14} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 -mb-px">
              <button
                onClick={() => setActiveTab('whats-new')}
                className={`px-4 py-2 text-xs font-mono tracking-[0.15em] border-t border-l border-r transition-all ${
                  activeTab === 'whats-new'
                    ? 'border-cyan-500/40 text-cyan-400 bg-cyan-950/30'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                WHAT&apos;S NEW
              </button>
              <button
                onClick={() => setActiveTab('roadmap')}
                className={`px-4 py-2 text-xs font-mono tracking-[0.15em] border-t border-l border-r transition-all flex items-center gap-1.5 ${
                  activeTab === 'roadmap'
                    ? 'border-cyan-500/40 text-cyan-400 bg-cyan-950/30'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <Radar size={11} />
                ROADMAP
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-4 py-2 text-xs font-mono tracking-[0.15em] border-t border-l border-r transition-all flex items-center gap-1.5 ${
                  activeTab === 'history'
                    ? 'border-cyan-500/40 text-cyan-400 bg-cyan-950/30'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <Clock size={11} />
                VERSION HISTORY
              </button>
              <button
                onClick={() => setActiveTab('credits')}
                className={`px-4 py-2 text-xs font-mono tracking-[0.15em] border-t border-l border-r transition-all flex items-center gap-1.5 ${
                  activeTab === 'credits'
                    ? 'border-cyan-500/40 text-cyan-400 bg-cyan-950/30'
                    : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
              >
                <Heart size={11} />
                CREDITS
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto styled-scrollbar p-5">
            {activeTab === 'roadmap' && (
              <div className="space-y-4">
                <p className="text-[11px] font-mono text-[var(--text-muted)] tracking-widest">
                  CATTO IS ACTIVELY DEVELOPED — THIS IS WHAT&apos;S COMING NEXT
                </p>

                {/* Active development notice */}
                <div className="border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-xs font-mono text-cyan-300 font-bold tracking-wide">ACTIVELY IN DEVELOPMENT</span>
                  </div>
                  <p className="text-xs font-mono text-[var(--text-secondary)] leading-relaxed">
                    Catto is a personal passion project and is continuously being improved.
                    Features, feeds, and coverage will expand over time — especially if the
                    project gains traction and community interest.
                  </p>
                  <p className="text-xs font-mono text-[var(--text-muted)] leading-relaxed">
                    If you find Catto useful, contributions, feedback, and suggestions are
                    welcome via the GitHub repository.
                  </p>
                </div>

                {/* Planned features */}
                {[
                  {
                    label: 'EXPANDED COUNTRY COVERAGE',
                    color: 'text-amber-400',
                    items: [
                      'Malaysia — PDRM alerts, road incidents, JKR feeds, Petronas infrastructure',
                      'Indonesia — BMKG earthquakes/weather, BNPB disaster alerts, Pertamina assets',
                      'Philippines — PAGASA weather, PHIVOLCS seismic, AFP/PCG maritime activity',
                      'Taiwan — CWA weather, MOFA alerts, cross-strait military activity layer',
                      'Japan — JMA earthquake/tsunami, JASDF/JMSDF activity, J-Alert integration',
                      'More countries added based on community interest and traction',
                    ],
                  },
                  {
                    label: 'INTELLIGENCE FEEDS',
                    color: 'text-cyan-400',
                    items: [
                      'ACLED sub-event filtering and timeline playback',
                      'MITRE ATT&CK technique mapping on cyber events',
                      'Dark web market monitoring (Tor-routed, opt-in)',
                      'Expanded OSINT RSS sources by region',
                      'Nuclear/radiological incident feed integration',
                    ],
                  },
                  {
                    label: 'PLATFORM & UX',
                    color: 'text-green-400',
                    items: [
                      'Mobile-responsive layout for field use',
                      'Shared watchlists and collaborative analyst sessions',
                      'Custom alert rules — notify on any feed condition',
                      'Export to PDF/SITREP format',
                      'Multi-language UI support',
                    ],
                  },
                ].map((section) => (
                  <div key={section.label} className="border border-[var(--border-primary)]/40 p-4 space-y-2">
                    <div className={`text-xs font-mono tracking-[0.2em] font-bold mb-3 ${section.color}`}>
                      {section.label}
                    </div>
                    {section.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-cyan-600 text-xs mt-0.5 flex-shrink-0">—</span>
                        <span className="text-xs font-mono text-[var(--text-muted)] leading-relaxed">{item}</span>
                      </div>
                    ))}
                  </div>
                ))}

                <div className="border border-[var(--border-primary)]/20 p-3">
                  <p className="text-[11px] font-mono text-[var(--text-muted)] leading-relaxed text-center">
                    Priorities shift based on feedback and traction. Star the repo or open an issue on GitHub to influence what gets built next.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'whats-new' && (
              <div className="space-y-5">
                {/* === HEADLINE === */}
                <div className="border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 border border-cyan-500/40 bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                      {HEADLINE_FEATURE.icon}
                    </div>
                    <div>
                      <div className="text-sm font-mono text-cyan-300 font-bold tracking-wide">
                        {HEADLINE_FEATURE.title}
                      </div>
                      <div className="text-xs font-mono text-cyan-500/80 mt-0.5">
                        {HEADLINE_FEATURE.subtitle}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {HEADLINE_FEATURE.details.map((para, i) => (
                      <p key={i} className="text-xs font-mono text-[var(--text-secondary)] leading-relaxed">
                        {para}
                      </p>
                    ))}
                  </div>
                  <div className="text-center pt-1">
                    <span className="text-[11px] font-mono text-cyan-400 tracking-[0.25em] font-bold">
                      {HEADLINE_FEATURE.callToAction}
                    </span>
                  </div>
                </div>

                {/* === New Features === */}
                <div>
                  <div className="text-xs font-mono tracking-[0.2em] text-cyan-400 font-bold mb-3 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    NEW CAPABILITIES
                  </div>
                  <div className="space-y-2">
                    {NEW_FEATURES.map((f) => (
                      <div
                        key={f.title}
                        className="flex items-start gap-3 p-3 border border-[var(--border-primary)]/50 bg-[var(--bg-primary)]/30 hover:border-[var(--border-secondary)] transition-colors"
                      >
                        <div className="mt-0.5 flex-shrink-0">{f.icon}</div>
                        <div>
                          <div className="text-[13px] font-mono text-[var(--text-primary)] font-bold">
                            {f.title}
                          </div>
                          <div className="text-xs font-mono text-[var(--text-muted)] leading-relaxed mt-0.5">
                            {f.desc}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bug Fixes */}
                <div>
                  <div className="text-xs font-mono tracking-[0.2em] text-green-400 font-bold mb-3 flex items-center gap-2">
                    <Bug size={14} className="text-green-400" />
                    FIXES &amp; IMPROVEMENTS
                  </div>
                  <div className="space-y-1.5">
                    {BUG_FIXES.map((fix, i) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-1.5">
                        <span className="text-green-500 text-xs mt-0.5 flex-shrink-0">+</span>
                        <span className="text-xs font-mono text-[var(--text-secondary)] leading-relaxed">
                          {fix}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'credits' && (
              <div className="space-y-4">
                <p className="text-[11px] font-mono text-[var(--text-muted)] tracking-widest">
                  CATTO IS BUILT ON THE SHOULDERS OF OPEN-SOURCE WORK
                </p>

                {/* ShadowBroker credit */}
                <div className="border border-cyan-500/30 bg-cyan-950/20 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 border border-cyan-500/40 bg-cyan-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Heart size={18} className="text-cyan-400" />
                    </div>
                    <div>
                      <div className="text-sm font-mono text-cyan-300 font-bold tracking-wide">
                        bigbodycobain
                      </div>
                      <div className="text-xs font-mono text-cyan-500/80 mt-0.5">
                        Original author of shadow--broker OSINT Dashboard
                      </div>
                    </div>
                  </div>

                  <p className="text-xs font-mono text-[var(--text-secondary)] leading-relaxed">
                    Catto began as a fork of{' '}
                    <span className="text-cyan-400 font-bold">shadow--broker</span> — an open-source
                    OSINT situational awareness dashboard created by{' '}
                    <span className="text-cyan-300 font-bold">bigbodycobain</span>. The original
                    project laid the architectural foundation for the multi-pillar feed system,
                    the warroom aesthetic, and the Singapore-centric intelligence focus that Catto
                    continues to build on today.
                  </p>

                  <p className="text-[11px] font-mono text-[var(--text-muted)] leading-relaxed italic">
                    Note: shadow--broker is an independent OSINT project and is unaffiliated with
                    the threat actor group of the same name. The project name is stylised with a
                    double dash (shadow--broker) but may appear as &ldquo;shadowbroker&rdquo; in
                    some references to avoid GitHub flagging the name as related to the threat actor.
                  </p>

                  <a
                    href="https://gitlab.com/bigbodycobain/Shadowbroker"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-mono tracking-widest transition-all"
                  >
                    <Globe size={12} />
                    gitlab.com/bigbodycobain/Shadowbroker
                  </a>
                </div>

                {/* Generic open-source thanks */}
                <div className="border border-[var(--border-primary)]/40 p-4 space-y-2">
                  <div className="text-xs font-mono text-[var(--text-muted)] tracking-[0.2em] font-bold mb-3">
                    OPEN-SOURCE LIBRARIES & DATA SOURCES
                  </div>
                  {[
                    'MapLibre GL JS — open-source map rendering engine',
                    'deck.gl — GPU-accelerated geospatial visualisation (Uber / vis.gl)',
                    'Next.js / React — frontend framework (Vercel)',
                    'Electron — desktop application wrapper (OpenJS Foundation)',
                    'CISA KEV, UCDP, GDELT, NASA FIRMS — public intelligence feeds',
                    'MPA OCEANS-X, LTA DataMall, data.gov.sg — Singapore government APIs',
                    'Abuse.ch, AlienVault OTX, Feodo Tracker — community threat intelligence',
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-cyan-600 text-xs mt-0.5 flex-shrink-0">—</span>
                      <span className="text-xs font-mono text-[var(--text-muted)] leading-relaxed">
                        {item}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Disclaimer */}
                <div className="border border-amber-500/20 bg-amber-950/10 p-4">
                  <div className="text-xs font-mono text-amber-400/80 tracking-[0.2em] font-bold mb-2">
                    DISCLAIMER
                  </div>
                  <p className="text-[11px] font-mono text-[var(--text-muted)] leading-relaxed">
                    Catto is developed strictly for <span className="text-amber-400">educational and research purposes</span>.
                    All data displayed is sourced from publicly available feeds and APIs.
                    The author is not liable for any misuse, damage, or consequences arising from
                    the use of this software. Use responsibly and in accordance with the laws and
                    regulations of your jurisdiction.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-1">
                <p className="text-[11px] font-mono text-[var(--text-muted)] tracking-widest mb-4">
                  OSINT SITUATIONAL AWARENESS DASHBOARD — COMPLETE VERSION HISTORY
                </p>
                {VERSION_HISTORY.map((release, idx) => (
                  <div key={release.version} className="border border-[var(--border-primary)]/40 hover:border-cyan-900/60 transition-colors">
                    <div className="flex items-center gap-3 px-3 py-2.5 bg-[var(--bg-primary)]/20">
                      <span className="text-xs font-mono font-bold text-cyan-400 tracking-widest w-14 flex-shrink-0">
                        {release.version}
                      </span>
                      <span className="text-xs font-mono text-[var(--text-primary)] font-bold tracking-wide">
                        {release.title}
                      </span>
                      {idx === 0 && (
                        <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 tracking-widest">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <div className="px-3 pb-2.5 pt-1 space-y-1">
                      {release.items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-cyan-600 text-xs mt-0.5 flex-shrink-0">—</span>
                          <span className="text-xs font-mono text-[var(--text-muted)] leading-relaxed">
                            {item}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-[var(--border-primary)]/80 flex items-center justify-center">
            <button
              onClick={handleDismiss}
              className="px-8 py-2.5 bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 hover:bg-cyan-500/25 text-xs font-mono tracking-[0.2em] transition-all"
            >
              ACKNOWLEDGED
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
});

export default ChangelogModal;
