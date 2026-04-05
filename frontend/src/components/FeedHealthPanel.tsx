'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, Activity } from 'lucide-react';
import { useDataKeys } from '@/hooks/useDataStore';

type FeedStatus = 'green' | 'amber' | 'red' | 'init';

interface FeedDef {
  id: string;
  label: string;
  key: string;
  /** Minimum item count to be GREEN (0 = any data present is green) */
  minCount?: number;
}

const FEEDS: FeedDef[] = [
  // Fast-tier backend feeds
  { id: 'flights',   label: 'Commercial Flights', key: 'commercial_flights',  minCount: 1 },
  { id: 'military',  label: 'Military Flights',   key: 'military_flights',    minCount: 1 },
  { id: 'private',   label: 'Private / Jets',      key: 'private_flights',     minCount: 0 },
  { id: 'ships',     label: 'AIS Ships',           key: 'ships',               minCount: 1 },
  { id: 'cctv',      label: 'CCTV Cameras',        key: 'cctv',                minCount: 1 },
  { id: 'sigint',    label: 'SIGINT',              key: 'sigint',              minCount: 0 },
  // Slow-tier backend feeds
  { id: 'gdelt',     label: 'GDELT Incidents',     key: 'gdelt',               minCount: 1 },
  { id: 'sats',      label: 'Satellites',          key: 'satellites',          minCount: 1 },
  { id: 'quakes',    label: 'Earthquakes',         key: 'earthquakes',         minCount: 0 },
  { id: 'fires',     label: 'FIRMS Fires',         key: 'firms_fires',         minCount: 0 },
  { id: 'fishing',   label: 'Fishing Activity',    key: 'fishing_activity',    minCount: 0 },
  { id: 'kiwisdr',   label: 'KiwiSDR',             key: 'kiwisdr',             minCount: 0 },
  { id: 'outages',   label: 'Internet Outages',    key: 'internet_outages',    minCount: 0 },
  // Singapore frontend-polled feeds
  { id: 'scdf',      label: 'SCDF Incidents',      key: 'scdf_incidents',      minCount: 0 },
  { id: 'sgsecure',  label: 'SGSecure Alerts',     key: 'sgsecure_alerts',     minCount: 0 },
  { id: 'mrt',       label: 'MRT Alerts',          key: 'mrt_alerts',          minCount: 0 },
  { id: 'psi',       label: 'NEA PSI',             key: 'psi_sg',              minCount: 1 },
  { id: 'road',      label: 'Road Incidents',      key: 'road_incidents',      minCount: 0 },
  // Cyber feeds
  { id: 'singcert',  label: 'SingCERT',            key: 'singcert_advisories', minCount: 0 },
  { id: 'otx',       label: 'OTX Pulses',          key: 'otx_pulses',          minCount: 1 },
  { id: 'feodo',     label: 'Feodo C2',            key: 'feodo_c2',            minCount: 0 },
  { id: 'ransomware',label: 'Ransomware IOCs',     key: 'ransomware_iocs',     minCount: 0 },
  // Aviation
  { id: 'adsb_mil',  label: 'ADS-B Military',      key: 'adsb_military_flights', minCount: 0 },
  { id: 'notam',     label: 'NOTAMs',              key: 'notam_entries',       minCount: 0 },
  // Conflict intelligence
  { id: 'gdelt_conf', label: 'GDELT Conflict',     key: 'gdelt_conflict',      minCount: 0 },
  { id: 'ucdp',      label: 'UCDP Events',         key: 'ucdp_conflict',       minCount: 0 },
  { id: 'acled',     label: 'ACLED Conflict',      key: 'acled_events',        minCount: 0 },
  { id: 'tracked',   label: 'Tracked Aircraft',    key: 'tracked_flights',     minCount: 0 },
  { id: 'gps_jam',   label: 'GPS Jamming',         key: 'gps_jamming',         minCount: 0 },
  { id: 'ua_alerts', label: 'Ukraine Air Raids',   key: 'ukraine_alerts',      minCount: 0 },
  { id: 'frontline', label: 'Ukraine Frontline',   key: 'frontlines',          minCount: 0 },
  { id: 'mil_bases', label: 'Military Bases',      key: 'military_bases',      minCount: 0 },
  { id: 'piracy',    label: 'IMB Piracy Incidents', key: 'piracy_incidents',    minCount: 0 },
  { id: 'telegram',  label: 'Telegram Channels',   key: 'telegram_posts',      minCount: 0 },
  // World layers
  { id: 'wx_alerts', label: 'Severe Weather',      key: 'weather_alerts',      minCount: 0 },
  { id: 'volcanoes', label: 'Volcanoes',           key: 'volcanoes',           minCount: 0 },
  { id: 'cisa',      label: 'CISA Known Exploits', key: 'cisa_kev',            minCount: 0 },
  { id: 'dcenters',  label: 'Data Centers',        key: 'datacenters',         minCount: 0 },
  { id: 'pwr_plants',label: 'Power Plants',        key: 'power_plants',        minCount: 0 },
  { id: 'psk',       label: 'HF Digital Spots',    key: 'psk_reporter',        minCount: 0 },
  { id: 'satnogs',   label: 'SatNOGS Stations',    key: 'satnogs_stations',    minCount: 0 },
  { id: 'tinygs',    label: 'TinyGS LoRa Sats',    key: 'tinygs_satellites',   minCount: 0 },
  // Singapore additional
  { id: 'air_qual',  label: 'Air Quality',         key: 'air_quality',         minCount: 0 },
  { id: 'spd_bands', label: 'Traffic Speed',       key: 'traffic_speed_bands', minCount: 0 },
  { id: 'bus_stops', label: 'Bus Stops',           key: 'bus_stops',           minCount: 0 },
  // MPA Oceans-X
  { id: 'mpa_arr',   label: 'MPA Arrivals',        key: 'mpa_arrivals',        minCount: 0 },
  { id: 'mpa_dep',   label: 'MPA Departures',      key: 'mpa_departures',      minCount: 0 },
  { id: 'mpa_decl',  label: 'MPA Decl. (6h)',      key: 'mpa_departure_declarations', minCount: 0 },
  { id: 'mpa_vtypes',label: 'MPA Vessel Types',    key: 'mpa_vessel_types',    minCount: 1 },
  { id: 'mpa_wx',    label: 'MPA Weather 4-Day',   key: 'mpa_weather_4day',    minCount: 0 },
  { id: 'mpa_wind',  label: 'MPA Wind Readings',   key: 'mpa_wind_readings',   minCount: 0 },
];

const HEALTH_KEYS = [
  'commercial_flights', 'military_flights', 'private_flights', 'ships',
  'cctv', 'sigint', 'gdelt', 'satellites', 'earthquakes', 'firms_fires',
  'fishing_activity', 'kiwisdr', 'internet_outages', 'scdf_incidents',
  'sgsecure_alerts', 'mrt_alerts', 'psi_sg', 'road_incidents',
  'singcert_advisories', 'otx_pulses', 'feodo_c2', 'ransomware_iocs',
  'adsb_military_flights', 'notam_entries',
  'gdelt_conflict', 'ucdp_conflict', 'acled_events',
  'tracked_flights', 'gps_jamming', 'ukraine_alerts', 'frontlines',
  'military_bases', 'piracy_incidents', 'weather_alerts', 'volcanoes', 'cisa_kev',
  'datacenters', 'power_plants', 'psk_reporter', 'satnogs_stations',
  'tinygs_satellites', 'air_quality', 'traffic_speed_bands', 'bus_stops',
  'mpa_arrivals', 'mpa_departures', 'mpa_departure_declarations',
  'mpa_vessel_types', 'mpa_weather_4day', 'mpa_wind_readings',
  'telegram_posts',
  'startup_stages',
] as const;

const STATUS_DOT: Record<FeedStatus, string> = {
  green: 'bg-green-400',
  amber: 'bg-amber-400',
  red:   'bg-red-500',
  init:  'bg-blue-400',
};

const STATUS_LABEL: Record<FeedStatus, string> = {
  green: 'text-green-400',
  amber: 'text-amber-400',
  red:   'text-red-500',
  init:  'text-blue-400',
};

const STATUS_TEXT: Record<FeedStatus, string> = {
  green: 'green',
  amber: 'amber',
  red:   'red',
  init:  'init',
};

function getStatus(data: unknown, minCount: number, isPending: boolean): FeedStatus {
  if (isPending) return 'init';
  if (data === undefined || data === null) return 'red';
  if (Array.isArray(data)) {
    if (data.length === 0) return 'amber';
    if (minCount > 0 && data.length < minCount) return 'amber';
    return 'green';
  }
  return 'green';
}

export default function FeedHealthPanel() {
  const [open, setOpen] = useState(false);

  const liveData = useDataKeys(HEALTH_KEYS);
  const startupStages = (liveData as Record<string, unknown>)['startup_stages'] as Record<string, string> | undefined;

  const feedStatus = FEEDS.map((feed) => {
    const data = (liveData as Record<string, unknown>)[feed.key];
    const isPending = startupStages?.[feed.key] === 'pending';
    const status = getStatus(data, feed.minCount ?? 0, isPending);
    const count = Array.isArray(data) ? data.length : null;
    return { ...feed, status, count };
  });

  const greenCount = feedStatus.filter((f) => f.status === 'green').length;
  const amberCount = feedStatus.filter((f) => f.status === 'amber').length;
  const redCount   = feedStatus.filter((f) => f.status === 'red').length;
  const initCount  = feedStatus.filter((f) => f.status === 'init').length;

  return (
    <div className="w-full rounded border border-cyan-900/40 bg-[#06090f]/90 backdrop-blur-md overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-cyan-950/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Activity size={11} className="text-cyan-500 flex-shrink-0" />
          <span className="text-[9px] font-mono font-bold tracking-[0.18em] text-cyan-400 uppercase">
            Feed Health
          </span>
          <span className="text-[8px] font-mono text-green-400">{greenCount}↑</span>
          {initCount > 0 && (
            <span className="text-[8px] font-mono text-blue-400">{initCount}⋯</span>
          )}
          {amberCount > 0 && (
            <span className="text-[8px] font-mono text-amber-400">{amberCount}~</span>
          )}
          {redCount > 0 && (
            <span className="text-[8px] font-mono text-red-400">{redCount}✕</span>
          )}
        </div>
        {open ? (
          <ChevronUp size={11} className="text-cyan-600" />
        ) : (
          <ChevronDown size={11} className="text-cyan-600" />
        )}
      </button>

      {open && (
        <div className="px-2 pb-2">
          <table className="w-full">
            <thead>
              <tr className="text-[7px] font-mono text-cyan-800 tracking-widest uppercase">
                <th className="text-left py-1 pl-1">Feed</th>
                <th className="text-right pr-2">Items</th>
                <th className="text-right pr-1 w-16">Status</th>
              </tr>
            </thead>
            <tbody>
              {feedStatus.map((feed) => (
                <tr key={feed.id} className="border-t border-cyan-900/20">
                  <td className="py-0.5 pl-1">
                    <span className="text-[9px] font-mono text-[var(--text-secondary)]">
                      {feed.label}
                    </span>
                  </td>
                  <td className="text-right pr-2">
                    <span className="text-[8px] font-mono text-[var(--text-muted)]">
                      {feed.status === 'init'
                        ? '—'
                        : feed.count !== null
                          ? (feed.count > 0 ? feed.count : '—')
                          : '—'}
                    </span>
                  </td>
                  <td className="text-right pr-1">
                    <div className="flex items-center justify-end gap-1">
                      <span className={`text-[7px] font-mono font-bold uppercase ${STATUS_LABEL[feed.status]}`}>
                        {STATUS_TEXT[feed.status]}
                      </span>
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[feed.status]} ${
                          feed.status !== 'green' ? 'animate-pulse' : ''
                        }`}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
