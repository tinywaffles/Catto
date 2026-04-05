'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Bot, X } from 'lucide-react';
import WorldviewLeftPanel from '@/components/WorldviewLeftPanel';

import NewsFeed from '@/components/NewsFeed';
import MarketsPanel from '@/components/MarketsPanel';
import MarkerLegendPanel from '@/components/MarkerLegendPanel';
import FindLocateBar from '@/components/FindLocateBar';
import TopBar from '@/components/TopBar';
import SettingsPanel from '@/components/SettingsPanel';
import MapLegend from '@/components/MapLegend';
import ScaleBar from '@/components/ScaleBar';
import ShodanPanel from '@/components/ShodanPanel';
import FeedHealthPanel from '@/components/FeedHealthPanel';
import SingaporeWeatherPanel from '@/components/SingaporeWeatherPanel';
import SituationPopup from '@/components/SituationPopup';
import WatchlistPanel from '@/components/WatchlistPanel';
import WatchlistCards from '@/components/WatchlistCards';
import MorningBriefing from '@/components/MorningBriefing';
import MapContextMenu from '@/components/MapContextMenu';
import BreakingEventPopup from '@/components/BreakingEventPopup';
import GlobalTicker from '@/components/GlobalTicker';
import ToastNotifications from '@/components/ToastNotifications';
import ErrorBoundary from '@/components/ErrorBoundary';

import ThreatIntelPanel from '@/components/ThreatIntelPanel';
import CorrelationPanel from '@/components/CorrelationPanel';
import CattoIntelPanel from '@/components/CattoIntelPanel';
import TimelineScrubber from '@/components/TimelineScrubber';
import EscalationPopup, { useEscalationMonitor, markSuppressed, setDnd } from '@/components/EscalationPopup';
import type { EscalationEvent } from '@/components/EscalationPopup';
import CrisisTracker from '@/components/CrisisTracker';
import type { CrisisInput } from '@/components/CrisisTracker';
import OnboardingModal, { useOnboarding } from '@/components/OnboardingModal';
import ChangelogModal, { useChangelog } from '@/components/ChangelogModal';
import type { ActiveLayers, KiwiSDR, Scanner, SelectedEntity } from '@/types/dashboard';
import type { ShodanSearchMatch } from '@/types/shodan';
import { NOMINATIM_DEBOUNCE_MS } from '@/lib/constants';
import { API_BASE } from '@/lib/api';
import { useDataPolling, LAYER_TOGGLE_EVENT } from '@/hooks/useDataPolling';
import { useBackendStatus, useDataKey } from '@/hooks/useDataStore';
import { useWatchlist } from '@/hooks/useWatchlist';
import { useSituationDetector } from '@/hooks/useSituationDetector';
import { useSingaporeFeeds } from '@/hooks/useSingaporeFeeds';
import { useCyberFeeds } from '@/hooks/useCyberFeeds';
import { useAviationFeeds } from '@/hooks/useAviationFeeds';
import { useConflictFeeds } from '@/hooks/useConflictFeeds';
import { useReverseGeocode } from '@/hooks/useReverseGeocode';
import { useRegionDossier } from '@/hooks/useRegionDossier';
import {
  hasSentinelInfoBeenSeen,
  markSentinelInfoSeen,
  hasSentinelCredentials,
  getSentinelUsage,
} from '@/lib/sentinelHub';

// Use dynamic loads for Maplibre to avoid SSR window is not defined errors
const MaplibreViewer = dynamic(() => import('@/components/MaplibreViewer'), { ssr: false });
const StartupWarmup = dynamic(() => import('@/components/StartupWarmup'), { ssr: false });

/* ── LOCATE BAR ── coordinate / place-name search above bottom status bar ── */
function LocateBar({ onLocate, onOpenChange }: { onLocate: (lat: number, lng: number) => void; onOpenChange?: (open: boolean) => void }) {
  const [open, setOpen] = useState(false);

  useEffect(() => { onOpenChange?.(open); }, [open]);
  const [value, setValue] = useState('');
  const [results, setResults] = useState<{ label: string; lat: number; lng: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setValue('');
        setResults([]);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Parse raw coordinate input: "31.8, 34.8" or "31.8 34.8" or "-12.3, 45.6"
  const parseCoords = (s: string): { lat: number; lng: number } | null => {
    const m = s.trim().match(/^([+-]?\d+\.?\d*)[,\s]+([+-]?\d+\.?\d*)$/);
    if (!m) return null;
    const lat = parseFloat(m[1]),
      lng = parseFloat(m[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
    return null;
  };

  const handleSearch = async (q: string) => {
    setValue(q);
    // Check for raw coordinates first
    const coords = parseCoords(q);
    if (coords) {
      setResults([{ label: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`, ...coords }]);
      return;
    }
    // Geocode with Nominatim (debounced)
    if (timerRef.current) clearTimeout(timerRef.current);
    if (searchAbortRef.current) searchAbortRef.current.abort();
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      searchAbortRef.current = new AbortController();
      const signal = searchAbortRef.current.signal;
      try {
        // Try backend proxy first (has caching + rate-limit compliance)
        const res = await fetch(
          `${API_BASE}/api/geocode/search?q=${encodeURIComponent(q)}&limit=5`,
          { signal },
        );
        if (res.ok) {
          const data = await res.json();
          const mapped = (data?.results || []).map(
            (r: { label: string; lat: number; lng: number }) => ({
              label: r.label,
              lat: r.lat,
              lng: r.lng,
            }),
          );
          setResults(mapped);
        } else {
          // Backend proxy returned an error — fall back to direct Nominatim
          console.warn(`[Locate] Proxy returned HTTP ${res.status}, falling back to Nominatim`);
          const directRes = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
            { headers: { 'Accept-Language': 'en' }, signal },
          );
          const data = await directRes.json();
          setResults(
            data.map((r: { display_name: string; lat: string; lon: string }) => ({
              label: r.display_name,
              lat: parseFloat(r.lat),
              lng: parseFloat(r.lon),
            })),
          );
        }
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') {
          // Proxy completely failed — try direct Nominatim as last resort
          try {
            const directRes = await fetch(
              `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
              { headers: { 'Accept-Language': 'en' } },
            );
            const data = await directRes.json();
            setResults(
              data.map((r: { display_name: string; lat: string; lon: string }) => ({
                label: r.display_name,
                lat: parseFloat(r.lat),
                lng: parseFloat(r.lon),
              })),
            );
          } catch {
            setResults([]);
          }
        } else {
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, NOMINATIM_DEBOUNCE_MS);
  };

  const handleSelect = (r: { lat: number; lng: number }) => {
    onLocate(r.lat, r.lng);
    setOpen(false);
    setValue('');
    setResults([]);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-[var(--bg-primary)]/80 border border-[var(--border-primary)] px-5 py-2 text-[11px] font-mono tracking-[0.15em] text-[var(--text-muted)] hover:text-cyan-400 hover:border-cyan-800 transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        LOCATE
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative w-[520px]">
      <div className="flex items-center gap-2 bg-[var(--bg-primary)] border border-cyan-800/60 px-4 py-2.5 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-cyan-500 flex-shrink-0"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpen(false);
              setValue('');
              setResults([]);
            }
            if (e.key === 'Enter' && results.length > 0) handleSelect(results[0]);
          }}
          placeholder="Enter coordinates (31.8, 34.8) or place name..."
          className="flex-1 bg-transparent text-[12px] text-[var(--text-primary)] font-mono tracking-wider outline-none placeholder:text-[var(--text-muted)]"
        />
        {loading && (
          <div className="w-3 h-3 border border-cyan-500 border-t-transparent rounded-full animate-spin" />
        )}
        <button
          onClick={() => {
            setOpen(false);
            setValue('');
            setResults([]);
          }}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
      {results.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] overflow-hidden shadow-[0_-8px_30px_rgba(0,0,0,0.4)] max-h-[200px] overflow-y-auto styled-scrollbar">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => handleSelect(r)}
              className="w-full text-left px-3 py-2 hover:bg-cyan-950/40 transition-colors border-b border-[var(--border-primary)]/50 last:border-0 flex items-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-cyan-500 flex-shrink-0"
              >
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="text-[11px] text-[var(--text-secondary)] font-mono truncate">
                {r.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const viewBoundsRef = useRef<{ south: number; west: number; north: number; east: number } | null>(null);
  const { mouseCoords, locationLabel, handleMouseCoords } = useReverseGeocode();
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity | null>(null);
  const [trackedSdr, setTrackedSdr] = useState<KiwiSDR | null>(null);
  const [trackedScanner, setTrackedScanner] = useState<Scanner | null>(null);
  const { regionDossier, regionDossierLoading, handleMapRightClick } = useRegionDossier(
    selectedEntity,
    setSelectedEntity,
  );


  const [uiVisible, setUiVisible] = useState(true);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [tickerOpen, setTickerOpen] = useState(true);

  // Persist UI panel states
  useEffect(() => {
    const l = localStorage.getItem('sb_left_open');
    const r = localStorage.getItem('sb_right_open');
    const t = localStorage.getItem('sb_ticker_open');
    if (l !== null) setLeftOpen(l === 'true');
    if (r !== null) setRightOpen(r === 'true');
    if (t !== null) setTickerOpen(t === 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem('sb_left_open', leftOpen.toString());
  }, [leftOpen]);

  useEffect(() => {
    localStorage.setItem('sb_right_open', rightOpen.toString());
  }, [rightOpen]);

  useEffect(() => {
    localStorage.setItem('sb_ticker_open', tickerOpen.toString());
  }, [tickerOpen]);
  // F key — toggle fullscreen map (hides all panels)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'f' && e.key !== 'F') return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      setMapFullscreen((prev) => !prev);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [mapView, setMapView] = useState({ zoom: 5, latitude: 1.3521 });
  const [locateBarOpen, setLocateBarOpen] = useState(false);
  const [measureMode, setMeasureMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<{ lat: number; lng: number }[]>([]);


  const [activeLayers, setActiveLayers] = useState<ActiveLayers>({
    // Aircraft — Asia-Pacific ON; US/EU civilian OFF (high volume, opt-in)
    flights: true,
    flights_us_eu: false,
    private: true,
    jets: true,
    military: true,
    tracked: true,
    gps_jamming: true,
    // Maritime — MPA ON by default, world AIS OFF
    ships_mpa: true,
    ships_military: true,
    ships_cargo: true,
    ships_civilian: true,
    ships_passenger: true,
    ships_tracked_yachts: true,
    ships_ais_world: false,
    fishing_activity: true,
    // Space — only satellites
    satellites: true,
    gibs_imagery: false,
    highres_satellite: false,
    sentinel_hub: false,
    viirs_nightlights: false,
    // Hazards — fire ON
    earthquakes: true,
    firms: true,
    ukraine_alerts: false,
    weather_alerts: true,
    volcanoes: true,
    air_quality: true,
    // Singapore — SG ON, global CCTV OFF by default (perf: 13K non-SG cameras)
    cctv: true,
    cctv_global: false,
    scdf_incidents: true,
    sgsecure_alerts: true,
    road_incidents: true,
    spf_establishments: false,
    saf_installations: false,
    traffic_speed_bands: true,
    psi_sg: true,
    // Cyber — all ON
    cisa_kev: true,
    ransomware_iocs: true,
    feodo_c2: true,
    otx_pulses: true,
    datacenters: true,
    datacenters_global: false,
    internet_outages: true,
    power_plants: true,
    power_plants_global: false,
    shodan_overlay: true,
    kiwisdr: false,
    kiwisdr_global: false,
    psk_reporter: false,
    satnogs: true,
    tinygs: true,
    sigint_meshtastic: true,
    sigint_aprs: false,   // OFF by default: 10K global APRS stations, mostly non-Asia
    // Infrastructure
    military_bases: true,
    // Other
    trains: false,
    scanners: false,
    bus_arrivals: false,
    adsb_military: true,
    notam: true,
    conflict_events: true,
    show_us_traffic: false,
    piracy_incidents: true,
    // Overlays — Ukraine off by default (outside Asia)
    ukraine_frontline: false,
    global_incidents: true,
    day_night: true,
    correlations: true,
    // v8.0.0 — Regional feeds (Malaysia + SEA) — ON by default
    regional_weather: true,
    cwa_alerts: true,
    reliefweb_events: true,
    acaps_crises: true,
  });
  const [shodanResults, setShodanResults] = useState<ShodanSearchMatch[]>([]);
  const [, setShodanQueryLabel] = useState('');
  const [shodanStyle, setShodanStyle] = useState<import('@/types/shodan').ShodanStyleConfig>({ shape: 'circle', color: '#16a34a', size: 'md' });
  useDataPolling();
  useSingaporeFeeds();
  useCyberFeeds();
  useAviationFeeds();
  useConflictFeeds();
  const { entries: watchlistEntries, addEntry: addWatchlistEntry, removeEntry: removeWatchlistEntry, watchedEntities } = useWatchlist();
  const backendStatus = useBackendStatus();
  const spaceWeather = useDataKey('space_weather');
  const newsForBrief = useDataKey('news') as Array<{ title: string; source?: string }> | null;
  const telegramForBrief = useDataKey('telegram_posts') as Array<{ text?: string; channel?: string; date?: number }> | null;
  const { regionStatus } = useSituationDetector();
  const overallStatus = Object.values(regionStatus).includes('red')
    ? 'red'
    : Object.values(regionStatus).includes('amber')
      ? 'amber'
      : 'green';
  const STATUS_LABEL = { green: 'NO INCIDENT', amber: 'HEIGHTENED', red: 'ELEVATED' } as const;
  const STATUS_COLOR = { green: 'text-green-400', amber: 'text-yellow-400', red: 'text-red-400' } as const;

  // Notify backend of layer toggles so it can skip disabled fetchers / stop streams.
  // After the POST completes, dispatch a custom event so useDataPolling immediately
  // refetches slow-tier data — this makes toggled layers (power plants, GDELT, etc.)
  // appear instantly instead of waiting up to 120 seconds.
  const layersTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLayerSyncRef = useRef(false);
  useEffect(() => {
    const syncLayers = (triggerRefetch: boolean) =>
      fetch(`${API_BASE}/api/layers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layers: activeLayers }),
      }).then(() => {
        if (triggerRefetch) {
          window.dispatchEvent(new Event(LAYER_TOGGLE_EVENT));
        }
      }).catch((e) => console.error('Failed to update backend layers:', e));

    if (layersTimerRef.current) clearTimeout(layersTimerRef.current);
    if (!initialLayerSyncRef.current) {
      initialLayerSyncRef.current = true;
      void syncLayers(false);
    } else {
      layersTimerRef.current = setTimeout(() => {
        void syncLayers(true);
      }, 250);
    }
    return () => {
      if (layersTimerRef.current) clearTimeout(layersTimerRef.current);
    };
  }, [activeLayers]);

  // Left panel accordion state
  const [leftDataMinimized, setLeftDataMinimized] = useState(false);
  const [leftShodanMinimized, setLeftShodanMinimized] = useState(true);

  // Right panel: which panel is "focused" (expanded). null = none focused, all normal.
  const [rightFocusedPanel, setRightFocusedPanel] = useState<string | null>(null);

  // Crisis Tracker overlay — null = closed
  const [crisisTrackerInput, setCrisisTrackerInput] = useState<CrisisInput | null>(null);

  // Auto-expand Data Layers when user starts tracking an SDR/Scanner
  useEffect(() => {
    if (trackedSdr || trackedScanner) {
      setLeftDataMinimized(false);
      setLeftOpen(true);
    }
  }, [trackedSdr, trackedScanner]);

  // NASA GIBS satellite imagery state
  const [gibsDate, setGibsDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [gibsOpacity, setGibsOpacity] = useState(0.6);

  // Sentinel Hub satellite imagery state (user-provided Copernicus CDSE credentials)
  const [sentinelDate, setSentinelDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 5); // Sentinel-2 has ~5-day revisit
    return d.toISOString().slice(0, 10);
  });
  const [sentinelOpacity, setSentinelOpacity] = useState(0.6);
  const [sentinelPreset, setSentinelPreset] = useState('TRUE-COLOR');
  const [showSentinelInfo, setShowSentinelInfo] = useState(false);

  // Map context menu (right-click)
  const [mapContextMenu, setMapContextMenu] = useState<{ lat: number; lng: number; x: number; y: number } | null>(null);
  const lastRightClickPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => { lastRightClickPos.current = { x: e.clientX, y: e.clientY }; };
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, []);
  const prevSentinelRef = useRef(false);

  // Show info modal the first time sentinel_hub is toggled on
  useEffect(() => {
    if (activeLayers.sentinel_hub && !prevSentinelRef.current) {
      if (!hasSentinelInfoBeenSeen()) {
        setShowSentinelInfo(true);
        markSentinelInfoSeen();
      }
      if (!hasSentinelCredentials()) {
        // No creds — open settings instead
        setSettingsOpen(true);
      }
    }
    prevSentinelRef.current = activeLayers.sentinel_hub;
  }, [activeLayers.sentinel_hub]);

  const [effects] = useState({
    bloom: true,
  });

  const [activeStyle, setActiveStyle] = useState('DEFAULT');

  const memoizedEffects = useMemo(
    () => ({ ...effects, bloom: effects.bloom && activeStyle !== 'DEFAULT', style: activeStyle }),
    [effects, activeStyle],
  );

  const handleFlyTo = useCallback(
    (lat: number, lng: number) => setFlyToLocation({ lat, lng, ts: Date.now() }),
    [],
  );

  const handleMeasureClick = useCallback(
    (pt: { lat: number; lng: number }) => {
      setMeasurePoints((prev) => (prev.length >= 3 ? prev : [...prev, pt]));
    },
    [],
  );

  const stylesList = ['DEFAULT', 'SATELLITE'];

  const cycleStyle = () => {
    setActiveStyle((prev) => {
      const idx = stylesList.indexOf(prev);
      const next = stylesList[(idx + 1) % stylesList.length];
      // Auto-toggle High-Res Satellite layer with SATELLITE style
      setActiveLayers((l) => ({ ...l, highres_satellite: next === 'SATELLITE' }));
      return next;
    });
  };

  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [flyToLocation, setFlyToLocation] = useState<{
    lat: number;
    lng: number;
    ts: number;
  } | null>(null);

  // Eavesdrop Mode State
  const [isEavesdropping] = useState(false);
  const [, setEavesdropLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [, setCameraCenter] = useState<{ lat: number; lng: number } | null>(null);

  // Timeline / Snapshot state (Feature 3)
  const [isHistorical, setIsHistorical] = useState(false);
  const [historicalData, setHistoricalData] = useState<Record<string, unknown> | null>(null);

  // Escalation popup queue (Feature 6)
  const [escalationQueue, setEscalationQueue] = useState<EscalationEvent[]>([]);
  const correlationsForEscalation = useDataKey('correlations') as Array<{ type: string; severity: string; lat: number | null; lng: number | null; drivers: string[]; score: number }> || [];
  useEscalationMonitor(correlationsForEscalation, useCallback((e: EscalationEvent) => {
    setEscalationQueue((q) => [...q, e]);
  }, []));

  // Onboarding & connection status
  const { showOnboarding, setShowOnboarding } = useOnboarding();
  const { showChangelog, setShowChangelog } = useChangelog();

  // Intelligence Brief modal state
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefText, setBriefText] = useState('');
  const [briefLoading, setBriefLoading] = useState(false);
  const [briefStarted, setBriefStarted] = useState(false);
  const briefAbortRef = useRef<AbortController | null>(null);

  // Build situational brief context for the BRIEF button
  const situationalBriefContext = useMemo(() => {
    const lines: string[] = [`Global status: ${STATUS_LABEL[overallStatus] ?? overallStatus}`];
    if (correlationsForEscalation.length > 0) {
      lines.push('\nACTIVE CORRELATION ALERTS:');
      correlationsForEscalation.slice(0, 8).forEach((c) => {
        lines.push(`- [${c.severity.toUpperCase()}] ${c.type} score:${c.score} — ${c.drivers.slice(0, 3).join('; ')}`);
      });
    }
    if (newsForBrief && newsForBrief.length > 0) {
      lines.push('\nRECENT NEWS HEADLINES:');
      newsForBrief.slice(0, 12).forEach((n) => {
        lines.push(`- ${n.title}${n.source ? ` (${n.source})` : ''}`);
      });
    }
    if (telegramForBrief && telegramForBrief.length > 0) {
      const recent = telegramForBrief
        .filter((p) => p.text && p.text.length > 10)
        .slice(0, 8);
      if (recent.length > 0) {
        lines.push('\nTELEGRAM SIGNAL FEED:');
        recent.forEach((p) => {
          lines.push(`- [${p.channel || 'unknown'}] ${(p.text ?? '').slice(0, 120)}`);
        });
      }
    }
    return lines.join('\n');
  }, [overallStatus, correlationsForEscalation, newsForBrief, telegramForBrief]);

  const runBrief = useCallback(async () => {
    // Abort any in-flight brief before starting a new one
    briefAbortRef.current?.abort();
    const abort = new AbortController();
    briefAbortRef.current = abort;

    // Hard 90-second frontend timeout — prevents runaway resource use
    const timeoutId = setTimeout(() => abort.abort(), 90_000);

    setBriefLoading(true);
    setBriefText('');
    setBriefStarted(true);

    try {
      const res = await fetch(`${API_BASE}/api/ollama/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Generate a comprehensive intelligence brief covering: (1) most critical active alert and what it signals, (2) key patterns across news and Telegram feeds and what they indicate, (3) current threat trajectory and escalation risk, (4) what to watch in the next 12-24 hours. Be specific, analytical, and actionable.',
          context: situationalBriefContext,
        }),
        signal: abort.signal,
      });

      if (!res.ok || !res.body) { setBriefText('ERROR: Could not reach Catto AI.'); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value, { stream: true }).split('\n').filter(Boolean)) {
          try {
            const d = JSON.parse(line);
            if (d.response) { text += d.response; setBriefText(text); }
            if (d.error) { setBriefText(`AI OFFLINE: ${d.error}`); reader.cancel(); return; }
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        setBriefText((t) => t || 'Brief cancelled.');
      } else {
        setBriefText('ERROR: Could not connect to Catto AI.');
      }
    } finally {
      clearTimeout(timeoutId);
      setBriefLoading(false);
    }
  }, [situationalBriefContext]);

  useEffect(() => {
    if (briefOpen && !briefStarted) {
      runBrief();
    }
  }, [briefOpen, briefStarted, runBrief]);

  return (
    <>
      {/* Startup warmup progress — counts to 45s while polling is delayed */}
      <StartupWarmup />
      <main className="fixed inset-0 w-full h-full bg-[var(--bg-primary)] overflow-hidden font-sans">
        {/* MAPLIBRE WEBGL OVERLAY */}
        <ErrorBoundary name="Map">
          <MaplibreViewer
            activeLayers={activeLayers}
            activeFilters={activeFilters}
            effects={memoizedEffects}
            onEntityClick={setSelectedEntity}
            selectedEntity={selectedEntity}
            flyToLocation={flyToLocation}
            gibsDate={gibsDate}
            gibsOpacity={gibsOpacity}
            sentinelDate={sentinelDate}
            sentinelOpacity={sentinelOpacity}
            sentinelPreset={sentinelPreset}
            isEavesdropping={isEavesdropping}
            onEavesdropClick={setEavesdropLocation}
            onCameraMove={setCameraCenter}
            onMouseCoords={handleMouseCoords}
            onRightClick={(coords) => setMapContextMenu({ ...coords, ...lastRightClickPos.current })}
            regionDossier={regionDossier}
            regionDossierLoading={regionDossierLoading}
            onViewStateChange={setMapView}
            measureMode={measureMode}
            onMeasureClick={handleMeasureClick}
            measurePoints={measurePoints}
            viewBoundsRef={viewBoundsRef}
            trackedSdr={trackedSdr}
            setTrackedSdr={setTrackedSdr}
            trackedScanner={trackedScanner}
            setTrackedScanner={setTrackedScanner}
            shodanResults={shodanResults}
            shodanStyle={shodanStyle}
            watchedEntities={watchedEntities}
          />
        </ErrorBoundary>

        {/* TOP BAR — logo, clock, status, controls */}
        <TopBar
          overallStatus={overallStatus}
          onSettingsClick={() => setSettingsOpen(true)}
        />

        {/* FULLSCREEN HINT */}
        {mapFullscreen && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[200] pointer-events-none">
            <span className="text-[7px] font-mono text-cyan-800/60 tracking-[0.2em]">PRESS F TO RESTORE UI</span>
          </div>
        )}

        {uiVisible && !mapFullscreen && (
          <>
            {/* LEFT HUD CONTAINER — full screen height, single scroll unit */}
            <motion.div
              className="absolute left-6 top-0 bottom-0 w-[240px] flex flex-col gap-3 z-[200] pointer-events-auto overflow-y-auto styled-scrollbar px-2 pt-12 pb-10 hud-zone"
              animate={{ x: leftOpen ? 0 : -280 }}
              transition={{ type: 'spring', damping: 30, stiffness: 250 }}
            >
              {/* 1. DATA LAYERS */}
              <div className="flex-shrink-0">
                <ErrorBoundary name="WorldviewLeftPanel">
                  <WorldviewLeftPanel
                    activeLayers={activeLayers}
                    setActiveLayers={setActiveLayers}
                    shodanResultCount={shodanResults.length}
                    onSettingsClick={() => setSettingsOpen(true)}
                    onLegendClick={() => setLegendOpen(true)}
                    gibsDate={gibsDate}
                    setGibsDate={setGibsDate}
                    gibsOpacity={gibsOpacity}
                    setGibsOpacity={setGibsOpacity}
                    sentinelDate={sentinelDate}
                    setSentinelDate={setSentinelDate}
                    sentinelOpacity={sentinelOpacity}
                    setSentinelOpacity={setSentinelOpacity}
                    sentinelPreset={sentinelPreset}
                    setSentinelPreset={setSentinelPreset}
                    onEntityClick={setSelectedEntity}
                    onFlyTo={handleFlyTo}
                    trackedSdr={trackedSdr}
                    setTrackedSdr={setTrackedSdr}
                    trackedScanner={trackedScanner}
                    setTrackedScanner={setTrackedScanner}
                    isMinimized={leftDataMinimized}
                    onMinimizedChange={setLeftDataMinimized}
                  />
                </ErrorBoundary>
              </div>

              {/* 2. CORRELATION + PREDICTIONS */}
              <div className="flex-shrink-0">
                <ErrorBoundary name="CorrelationPanel">
                  <CorrelationPanel
                    onFlyTo={(lat, lng) => setFlyToLocation({ lat, lng, ts: Date.now() })}
                  />
                </ErrorBoundary>
              </div>

              {/* 3. SIGINT */}
              <div className="flex-shrink-0">
                <ErrorBoundary name="CattoIntelPanel">
                  <CattoIntelPanel
                    onOpenTracker={(input) => setCrisisTrackerInput(input)}
                    onFlyTo={(lat, lng) => setFlyToLocation({ lat, lng, ts: Date.now() })}
                  />
                </ErrorBoundary>
              </div>

              {/* 4. WATCHLIST */}
              <div className="flex-shrink-0">
                <ErrorBoundary name="WatchlistPanel">
                  <WatchlistPanel
                    entries={watchlistEntries}
                    addEntry={addWatchlistEntry}
                    removeEntry={removeWatchlistEntry}
                    watchedEntities={watchedEntities}
                  />
                </ErrorBoundary>
              </div>

              {/* 5. THREAT INTEL — IOC + CVE */}
              <div className="flex-shrink-0">
                <ErrorBoundary name="ThreatIntelPanel">
                  <ThreatIntelPanel />
                </ErrorBoundary>
              </div>

            </motion.div>

            {/* LEFT SIDEBAR TOGGLE TAB — aligns with Data Layers section */}
            <motion.div
              className="absolute left-0 top-[12.5rem] z-[201] pointer-events-auto hud-zone"
              animate={{ x: leftOpen ? 264 : 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 250 }}
            >
              <button
                onClick={() => setLeftOpen(!leftOpen)}
                className="flex flex-col items-center gap-1.5 py-5 px-1.5 bg-cyan-950/40 border border-cyan-800/50 border-l-0 rounded-r text-cyan-700 hover:text-cyan-400 hover:bg-cyan-950/60 hover:border-cyan-500/40 transition-colors"
              >
                {leftOpen ? <ChevronLeft size={10} /> : <ChevronRight size={10} />}
                <span
                  className="text-[7px] font-mono tracking-[0.2em] font-bold"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  LAYERS
                </span>
              </button>
            </motion.div>

            {/* RIGHT SIDEBAR TOGGLE TAB — aligns with Oracle Predictions section */}
            <motion.div
              className="absolute right-0 top-[12.5rem] z-[201] pointer-events-auto hud-zone"
              animate={{ x: rightOpen ? -364 : 0 }}
              transition={{ type: 'spring', damping: 30, stiffness: 250 }}
            >
              <button
                onClick={() => setRightOpen(!rightOpen)}
                className="flex flex-col items-center gap-1.5 py-5 px-1.5 bg-cyan-950/40 border border-cyan-800/50 border-r-0 rounded-l text-cyan-700 hover:text-cyan-400 hover:bg-cyan-950/60 hover:border-cyan-500/40 transition-colors"
              >
                {rightOpen ? <ChevronRight size={10} /> : <ChevronLeft size={10} />}
                <span
                  className="text-[7px] font-mono tracking-[0.2em] font-bold"
                  style={{ writingMode: 'vertical-rl' }}
                >
                  INTEL
                </span>
              </button>
            </motion.div>

            {/* RIGHT HUD CONTAINER — slides off right edge when hidden */}
            <motion.div
              className="absolute right-6 top-12 bottom-9 w-[340px] flex flex-col gap-4 z-[200] pointer-events-auto overflow-y-auto styled-scrollbar pr-2 pl-2 hud-zone"
              animate={{ x: rightOpen ? 0 : 380 }}
              transition={{ type: 'spring', damping: 30, stiffness: 250 }}
            >
              {/* FEED HEALTH — moved from left sidebar */}
              <div className="flex-shrink-0">
                <ErrorBoundary name="FeedHealthPanel">
                  <FeedHealthPanel />
                </ErrorBoundary>
              </div>

              {/* FIND / LOCATE */}
              <div className="flex-shrink-0">
              <FindLocateBar
                onLocate={(lat, lng, _entityId, _entityType) => {
                  setFlyToLocation({ lat, lng, ts: Date.now() });
                }}
                onFilter={(filterKey, value) => {
                    setActiveFilters((prev) => {
                      const current = prev[filterKey] || [];
                      if (!current.includes(value)) {
                        return { ...prev, [filterKey]: [...current, value] };
                      }
                      return prev;
                    });
                  }}
                />
              </div>

              {/* GLOBAL TICKER REPLACES MARKETS PANEL - RENDERED OUTSIDE THIS DIV */}

              {/* MAP LEGEND */}
              <div className="flex-shrink-0">
                <MarkerLegendPanel />
              </div>


              {/* BOTTOM RIGHT - NEWS FEED (fills remaining space) */}
              <div className={`flex-shrink-0 ${rightFocusedPanel ? 'hidden' : ''}`}>
                <ErrorBoundary name="NewsFeed">
                  <NewsFeed
                    selectedEntity={selectedEntity}
                    regionDossier={regionDossier}
                    regionDossierLoading={regionDossierLoading}
                    onArticleClick={(idx, lat, lng) => {
                      if (lat !== undefined && lng !== undefined) {
                        setFlyToLocation({ lat, lng, ts: Date.now() });
                      }
                    }}
                  />
                </ErrorBoundary>
              </div>
            </motion.div>

            {/* BOTTOM CENTER COORDINATE / LOCATION BAR — hidden when fullscreen overlays are open */}
            {!(selectedEntity?.type === 'region_dossier' && regionDossier?.sentinel2) && selectedEntity?.type !== 'cctv' && selectedEntity?.type !== 'news' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1, duration: 1 }}
                className="absolute bottom-9 left-1/2 -translate-x-1/2 z-[200] pointer-events-auto flex flex-col items-center gap-2 hud-zone"
              >
                {/* TIMELINE SCRUBBER — 24h snapshot history */}
                <TimelineScrubber
                  isHistorical={isHistorical}
                  onSnapshot={(data) => {
                    setHistoricalData(data);
                    setIsHistorical(true);
                  }}
                  onLiveMode={() => {
                    setIsHistorical(false);
                    setHistoricalData(null);
                  }}
                />

                {/* LOCATE BAR — search by coordinates or place name */}
                <LocateBar
                  onLocate={(lat, lng) => setFlyToLocation({ lat, lng, ts: Date.now() })}
                  onOpenChange={setLocateBarOpen}
                />

                <div
                  className="bg-[#0a0a0a]/90 border border-cyan-900/40 px-5 py-1.5 flex items-center gap-5 border-b-2 border-b-cyan-800 cursor-pointer backdrop-blur-sm"
                  onClick={cycleStyle}
                >
                  {/* Coordinates */}
                  <div className="flex flex-col items-center min-w-[120px]">
                    <div className="text-[8px] text-[var(--text-muted)] font-mono tracking-[0.2em]">
                      COORDINATES
                    </div>
                    <div className="text-[11px] text-cyan-400 font-mono font-bold tracking-wide">
                      {mouseCoords
                        ? `${mouseCoords.lat.toFixed(4)}, ${mouseCoords.lng.toFixed(4)}`
                        : '0.0000, 0.0000'}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="w-px h-6 bg-[var(--border-primary)]" />

                  {/* Location name */}
                  <div className="flex flex-col items-center min-w-[160px] max-w-[280px]">
                    <div className="text-[8px] text-[var(--text-muted)] font-mono tracking-[0.2em]">
                      LOCATION
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)] font-mono truncate max-w-[280px]">
                      {locationLabel || 'Hover over map...'}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="w-px h-6 bg-[var(--border-primary)]" />

                  {/* Style preset (compact) */}
                  <div className="flex flex-col items-center">
                    <div className="text-[8px] text-[var(--text-muted)] font-mono tracking-[0.2em]">
                      STYLE
                    </div>
                    <div className="text-[11px] text-cyan-400 font-mono font-bold">
                      {activeStyle}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="w-px h-6 bg-[var(--border-primary)]" />

                  {/* Global Status */}
                  <div className="flex flex-col items-center">
                    <div className="text-[8px] text-[var(--text-muted)] font-mono tracking-[0.2em]">
                      STATUS
                    </div>
                    <div className={`text-[11px] font-mono font-bold ${STATUS_COLOR[overallStatus]}`}>
                      {STATUS_LABEL[overallStatus]}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="w-px h-6 bg-[var(--border-primary)]" />

                  {/* Situational Brief — opens full-screen modal */}
                  <div
                    className="flex flex-col items-center justify-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); setBriefOpen(true); setBriefStarted(false); }}
                      className="inline-flex items-center gap-1 px-2 py-0.5 border text-[9px] font-mono tracking-wide transition-colors border-cyan-800/50 text-cyan-400 hover:bg-cyan-900/20 hover:border-cyan-600/60"
                    >
                      <Bot size={8} />
                      BRIEF
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}

        {/* ESCALATION POPUP (Feature 6) — one at a time, queued */}
        {escalationQueue.length > 0 && (
          <EscalationPopup
            event={escalationQueue[0]}
            onEscalate={(lat, lng) => {
              setFlyToLocation({ lat, lng, ts: Date.now() });
              markSuppressed(escalationQueue[0].type, lat, lng);
              setEscalationQueue((q) => q.slice(1));
            }}
            onDismiss={(id) => {
              const e = escalationQueue.find((ev) => ev.id === id);
              if (e) markSuppressed(e.type, e.lat, e.lng);
              setEscalationQueue((q) => q.filter((ev) => ev.id !== id));
            }}
            onDnd={() => {
              setDnd();
              setEscalationQueue([]);
            }}
          />
        )}

        {/* RESTORE UI BUTTON (If Hidden) */}
        {!uiVisible && (
          <button
            onClick={() => setUiVisible(true)}
            className="absolute bottom-9 right-6 z-[200] bg-[var(--bg-primary)]/80 border border-[var(--border-primary)] px-4 py-2 text-[10px] font-mono tracking-widest text-cyan-500 hover:text-cyan-300 hover:border-cyan-800 transition-colors pointer-events-auto"
          >
            RESTORE UI
          </button>
        )}

        {/* SG PORT / WX — floating bottom-left widget */}
        {uiVisible && !mapFullscreen && (
          <div className="absolute bottom-9 left-4 z-[200] pointer-events-auto hud-zone">
            <ErrorBoundary name="SingaporeWeatherPanel">
              <SingaporeWeatherPanel />
            </ErrorBoundary>
          </div>
        )}

        {/* DYNAMIC SCALE BAR — hidden when fullscreen overlays or locate bar are open */}
        {!(selectedEntity?.type === 'region_dossier' && regionDossier?.sentinel2) && selectedEntity?.type !== 'cctv' && selectedEntity?.type !== 'news' && !locateBarOpen && (
        <div className="absolute bottom-[7rem] left-[17rem] z-[201] pointer-events-auto">
          <ScaleBar
            zoom={mapView.zoom}
            latitude={mapView.latitude}
            measureMode={measureMode}
            measurePoints={measurePoints}
            onToggleMeasure={() => {
              setMeasureMode((m) => !m);
              if (measureMode) setMeasurePoints([]);
            }}
            onClearMeasure={() => setMeasurePoints([])}
          />
        </div>
        )}

        {/* STATIC CRT VIGNETTE */}
        <div
          className="absolute inset-0 pointer-events-none z-[2]"
          style={{
            background: 'radial-gradient(circle, transparent 40%, rgba(0,0,0,0.8) 100%)',
          }}
        />

        {/* SCANLINES OVERLAY */}
        <div
          className="absolute inset-0 pointer-events-none z-[3] opacity-[0.08] bg-[linear-gradient(rgba(255,255,255,0.1)_1px,transparent_1px)]"
          style={{ backgroundSize: '100% 4px' }}
        ></div>

        {/* SETTINGS PANEL */}
        <ErrorBoundary name="SettingsPanel">
          <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </ErrorBoundary>

        {/* MAP LEGEND */}
        <ErrorBoundary name="MapLegend">
          <MapLegend isOpen={legendOpen} onClose={() => setLegendOpen(false)} />
        </ErrorBoundary>

        {/* ONBOARDING MODAL */}
        {showOnboarding && (
          <OnboardingModal
            onClose={() => setShowOnboarding(false)}
            onOpenSettings={() => {
              setShowOnboarding(false);
              setSettingsOpen(true);
            }}
          />
        )}

        {/* v0.4 CHANGELOG MODAL — shows once per version after onboarding */}
        {!showOnboarding && showChangelog && (
          <ChangelogModal onClose={() => setShowChangelog(false)} />
        )}

        {/* SENTINEL HUB — first-time info modal */}
        {showSentinelInfo && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/90"
              onClick={() => setShowSentinelInfo(false)}
            />
            <div className="relative z-[10001] w-[520px] max-h-[80vh] bg-[var(--bg-secondary)] border border-purple-500/30 shadow-2xl shadow-purple-900/20 overflow-y-auto styled-scrollbar">
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold tracking-wider text-purple-300 font-mono">
                    SENTINEL HUB IMAGERY
                  </h2>
                  <button
                    onClick={() => setShowSentinelInfo(false)}
                    className="text-[var(--text-muted)] hover:text-white transition-colors text-xl leading-none"
                  >
                    &times;
                  </button>
                </div>

                <p className="text-[11px] text-[var(--text-secondary)] font-mono leading-relaxed">
                  You now have access to ESA Sentinel-2 satellite imagery directly on the map.
                  This uses the Copernicus Data Space Ecosystem with your own credentials.
                </p>

                <div className="space-y-2">
                  <h3 className="text-[10px] font-mono text-purple-400 tracking-widest">AVAILABLE LAYERS</h3>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { name: 'True Color', desc: 'Natural RGB — see terrain, cities, water' },
                      { name: 'False Color IR', desc: 'Near-infrared — vegetation in red' },
                      { name: 'NDVI', desc: 'Vegetation health index (green = healthy)' },
                      { name: 'Moisture Index', desc: 'Soil & vegetation moisture levels' },
                    ].map((l) => (
                      <div key={l.name} className="p-2 border border-purple-900/30 bg-purple-950/10">
                        <div className="text-[10px] font-mono text-white">{l.name}</div>
                        <div className="text-[9px] text-[var(--text-muted)]">{l.desc}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-[10px] font-mono text-purple-400 tracking-widest">USAGE LIMITS (FREE TIER)</h3>
                  <div className="p-3 border border-[var(--border-primary)] bg-[var(--bg-primary)]/40 space-y-1.5">
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-[var(--text-muted)]">Monthly budget</span>
                      <span className="text-purple-300">10,000 requests</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-[var(--text-muted)]">Cost per tile</span>
                      <span className="text-purple-300">0.25 PU (256&times;256px)</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-[var(--text-muted)]">~Viewport loads/month</span>
                      <span className="text-purple-300">~500 (20 tiles each)</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-mono">
                      <span className="text-[var(--text-muted)]">Empty tiles</span>
                      <span className="text-green-400">FREE (no data = no charge)</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-[10px] font-mono text-purple-400 tracking-widest">HOW IT WORKS</h3>
                  <ul className="text-[10px] text-[var(--text-secondary)] font-mono leading-relaxed space-y-1 list-disc list-inside">
                    <li>Sentinel-2 revisits every ~5 days — not every location has data every day</li>
                    <li>The date slider picks the end of a time window; zoomed out uses wider windows</li>
                    <li>Black patches = no satellite pass on that date range (normal)</li>
                    <li>Best results at zoom 8-14 — closer = sharper imagery (10m resolution)</li>
                    <li>Cloud filter auto-skips tiles with {'>'} 30% cloud cover</li>
                  </ul>
                </div>

                <button
                  onClick={() => setShowSentinelInfo(false)}
                  className="w-full py-2.5 bg-purple-500/20 border border-purple-500/40 text-purple-300 hover:bg-purple-500/30 transition-colors text-[11px] font-mono tracking-wider"
                >
                  GOT IT
                </button>
              </div>
            </div>
          </div>
        )}


        {/* BACKEND DISCONNECTED BANNER */}
        {backendStatus === 'disconnected' && (
          <div className="absolute top-0 left-0 right-0 z-[9000] flex items-center justify-center py-2 bg-red-950/90 border-b border-red-500/40 backdrop-blur-sm">
            <span className="text-[10px] font-mono tracking-widest text-red-400">
              BACKEND OFFLINE — Cannot reach backend server. Check that the backend container is
              running and BACKEND_URL is correct.
            </span>
          </div>
        )}
        {/* BOTTOM TICKER TOGGLE TAB — moved to right to avoid Shodan overlap */}
        <motion.div
           className={`absolute bottom-0 right-[22rem] z-[8001] pointer-events-auto hud-zone transition-opacity duration-300 ${tickerOpen ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}
           animate={{ y: tickerOpen ? -28 : 0 }}
           transition={{ type: 'spring', damping: 30, stiffness: 250 }}
        >
          <button
            onClick={() => setTickerOpen(!tickerOpen)}
            className="flex items-center gap-2 px-3 py-1 bg-cyan-950/40 border border-cyan-800/50 border-b-0 rounded-t text-cyan-700 hover:text-cyan-400 hover:bg-cyan-950/60 hover:border-cyan-500/40 transition-colors"
          >
            <div className="text-[7.5px] font-mono tracking-[0.25em] font-bold uppercase">
              MARKETS
            </div>
            {tickerOpen ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
          </button>
        </motion.div>


        {/* TOAST NOTIFICATIONS — top right, HIGH/CRITICAL, auto-dismiss 10s */}
        <ToastNotifications />

        {/* MORNING BRIEFING MODAL — first load each session */}
        <ErrorBoundary name="MorningBriefing">
          <MorningBriefing />
        </ErrorBoundary>

        {/* BREAKING EVENT POPUP — GDELT spike detection, top-center, auto-dismiss 30s */}
        {uiVisible && (
          <ErrorBoundary name="BreakingEventPopup">
            <BreakingEventPopup />
          </ErrorBoundary>
        )}

        {/* SITUATION POPUP — bottom-center, dismissible, rule-based multi-signal spike detection */}
        {uiVisible && (
          <SituationPopup
            onFlyTo={(lat, lng) => setFlyToLocation({ lat, lng, ts: Date.now() })}
            onOpenTracker={(input) => setCrisisTrackerInput(input)}
          />
        )}

        {/* CRISIS TRACKER — full-screen overlay for deep-dive event timeline */}
        {crisisTrackerInput && (
          <CrisisTracker
            input={crisisTrackerInput}
            onClose={() => setCrisisTrackerInput(null)}
            onFlyTo={(lat, lng) => { setFlyToLocation({ lat, lng, ts: Date.now() }); setCrisisTrackerInput(null); }}
          />
        )}

        {/* MAP CONTEXT MENU — right-click on map */}
        {mapContextMenu && (
          <MapContextMenu
            lat={mapContextMenu.lat}
            lng={mapContextMenu.lng}
            x={mapContextMenu.x}
            y={mapContextMenu.y}
            onRegionDossier={(coords) => { handleMapRightClick(coords); setMapContextMenu(null); }}
            onClose={() => setMapContextMenu(null)}
          />
        )}

        {/* WATCHLIST CARDS — floating entity tracking cards, bottom-right */}
        {uiVisible && (
          <WatchlistCards
            entities={watchedEntities}
            onFlyTo={(lat, lng) => setFlyToLocation({ lat, lng, ts: Date.now() })}
            onRemoveEntry={removeWatchlistEntry}
          />
        )}

        {/* GLOBAL MARKETS TICKER (BOTTOM ANCHOR) */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 z-[8000] h-7"
          animate={{ y: tickerOpen ? 0 : 28 }}
          transition={{ type: 'spring', damping: 30, stiffness: 250 }}
        >
          <ErrorBoundary name="GlobalTicker">
            <GlobalTicker />
          </ErrorBoundary>
        </motion.div>

      </main>

      {/* INTELLIGENCE BRIEF MODAL */}
      {briefOpen && (
        <div className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/80 backdrop-blur-sm pointer-events-auto">
          <div className="w-full max-w-2xl max-h-[80vh] bg-[#060a12] border border-cyan-800/50 flex flex-col font-mono shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-cyan-800/40">
              <div className="flex items-center gap-2">
                <Bot size={14} className="text-cyan-400" />
                <span className="text-[13px] font-bold tracking-[0.2em] text-cyan-400">INTELLIGENCE BRIEF</span>
                {briefLoading && <div className="w-3 h-3 border border-cyan-500 border-t-transparent rounded-full animate-spin" />}
              </div>
              <button onClick={() => { briefAbortRef.current?.abort(); setBriefOpen(false); }} className="text-[var(--text-muted)] hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            {/* Status/timestamp */}
            <div className="px-5 py-2 border-b border-[var(--border-primary)] flex items-center justify-between">
              <span className={`text-[9px] font-mono font-bold tracking-widest ${STATUS_COLOR[overallStatus]}`}>
                GLOBAL STATUS: {STATUS_LABEL[overallStatus]}
              </span>
              <span className="text-[8px] text-[var(--text-muted)] font-mono">{new Date().toUTCString()}</span>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 styled-scrollbar">
              {!briefStarted && !briefLoading && !briefText && (
                <div className="flex flex-col items-center justify-center h-32 gap-3">
                  <button
                    onClick={runBrief}
                    className="px-6 py-2.5 bg-cyan-950/40 border border-cyan-700/50 text-cyan-400 text-[11px] font-mono tracking-widest hover:bg-cyan-900/30 transition-colors"
                  >
                    GENERATE INTELLIGENCE BRIEF
                  </button>
                  <p className="text-[8px] text-[var(--text-muted)] text-center">Synthesises all live Catto feeds into finished intelligence</p>
                </div>
              )}
              {briefText && (
                <div className="text-[11px] text-[var(--text-secondary)] font-mono leading-relaxed whitespace-pre-wrap">
                  {briefText}
                  {briefLoading && <span className="animate-pulse text-cyan-500">▊</span>}
                </div>
              )}
              {briefLoading && !briefText && (
                <div className="flex items-center gap-2 text-[10px] text-cyan-500 font-mono">
                  <div className="w-3 h-3 border border-cyan-500 border-t-transparent rounded-full animate-spin" />
                  Analysing feeds...
                </div>
              )}
            </div>
            {/* Footer */}
            {briefText && !briefLoading && (
              <div className="px-5 py-2 border-t border-[var(--border-primary)] flex justify-between items-center">
                <button onClick={runBrief} className="text-[9px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors">↺ REFRESH</button>
                <button onClick={() => { briefAbortRef.current?.abort(); setBriefOpen(false); setBriefText(''); setBriefStarted(false); }} className="text-[9px] font-mono text-[var(--text-muted)] hover:text-white transition-colors">CLOSE</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
