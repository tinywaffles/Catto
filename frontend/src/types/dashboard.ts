// ─── Catto Dashboard Data Types ─────────────────────────────────────────────
// Canonical type definitions for all data flowing from backend → frontend.
// Every `any` in the codebase should eventually be replaced with these types.

// ─── FLIGHTS ────────────────────────────────────────────────────────────────

export interface FlightBase {
  callsign: string;
  country: string;
  lat: number;
  lng: number;
  alt: number;
  heading: number;
  true_track?: number;
  speed_knots: number | null;
  registration: string;
  model: string;
  icao24: string;
  squawk?: string;
  aircraft_category?: string;
  nac_p?: number;
  _seen_at?: number;
  origin_loc?: [number, number] | null;
  dest_loc?: [number, number] | null;
  origin_name?: string;
  dest_name?: string;
  trail?: Array<{ lat: number; lng: number; alt?: number; ts?: number }>;
  holding?: boolean;
  emissions?: { fuel_gph: number; co2_kg_per_hour: number };
}

export interface CommercialFlight extends FlightBase {
  type: 'commercial_flight';
  airline_code?: string;
  supplemental_source?: string;
}

export interface PrivateFlight extends FlightBase {
  type: 'private_ga' | 'private_flight';
}

export interface PrivateJet extends FlightBase {
  type: 'private_jet';
}

export interface MilitaryFlight extends FlightBase {
  type: 'military_flight';
  military_type?: 'heli' | 'fighter' | 'bomber' | 'tanker' | 'cargo' | 'recon' | 'default';
  force?: string;
}

export interface TrackedFlight extends FlightBase {
  type: 'tracked_flight';
  alert_category?: string;
  alert_operator?: string;
  alert_special?: string;
  alert_flag?: string;
  alert_color?: string;
  alert_wiki?: string;
  alert_type?: string;
  alert_tags?: string[];
  alert_link?: string;
  alert_socials?: { twitter?: string; instagram?: string };
  tracked_name?: string;
  operator?: string;
  owner?: string;
  name?: string;
}

export interface UAV extends FlightBase {
  type: 'uav';
  uav_type?: string;
  aircraft_model?: string;
  wiki?: string;
  force?: string;
  id?: string | number;
}

export type Flight =
  | CommercialFlight
  | PrivateFlight
  | PrivateJet
  | MilitaryFlight
  | TrackedFlight
  | UAV;

// ─── SHIPS / MARITIME ───────────────────────────────────────────────────────

export interface Ship {
  mmsi: number;
  name: string;
  type:
    | 'carrier'
    | 'military_vessel'
    | 'tanker'
    | 'cargo'
    | 'passenger'
    | 'yacht'
    | 'other'
    | 'unknown';
  lat: number;
  lng: number;
  heading: number;
  sog: number;
  cog: number;
  callsign?: string;
  destination?: string;
  imo?: number;
  country: string;
  ais_type_code?: number;
  _updated?: number;
  estimated?: boolean;
  source?: string;
  source_url?: string;
  last_osint_update?: string;
  desc?: string;
  // Tracked yacht enrichment
  yacht_alert?: boolean;
  yacht_owner?: string;
  yacht_name?: string;
  yacht_category?: string;
  yacht_color?: string;
  yacht_builder?: string;
  yacht_length?: number;
  yacht_year?: number;
  yacht_link?: string;
  // PLAN/CCG vessel enrichment
  plan_name?: string;
  plan_class?: string;
  plan_force?: string;
  plan_hull?: string;
  plan_wiki?: string;
  // Carrier enrichment
  wiki?: string;
  homeport?: string;
  homeport_lat?: number;
  homeport_lng?: number;
  fallback_lat?: number;
  fallback_lng?: number;
  fallback_heading?: number;
  fallback_desc?: string;
}

// ─── SATELLITES ─────────────────────────────────────────────────────────────

export type SatelliteMission =
  | 'military_recon'
  | 'military_sar'
  | 'military_ew'
  | 'sar'
  | 'commercial_imaging'
  | 'navigation'
  | 'early_warning'
  | 'space_station'
  | 'sigint'
  | 'general';

export interface Satellite {
  id: number;
  name: string;
  mission: SatelliteMission;
  sat_type: string;
  country: string;
  wiki?: string;
  lat: number;
  lng: number;
  alt_km: number;
  speed_knots: number;
  heading: number;
}

// ─── EARTHQUAKES ────────────────────────────────────────────────────────────

export interface Earthquake {
  id: string;
  mag: number;
  lat: number;
  lng: number;
  place: string;
  title?: string;
}

// ─── GPS JAMMING ────────────────────────────────────────────────────────────

export interface GPSJammingZone {
  lat: number;
  lng: number;
  severity: 'high' | 'medium' | 'low';
  ratio: number;
  degraded: number;
  total: number;
}

// ─── FIRE HOTSPOTS (NASA FIRMS) ─────────────────────────────────────────────

export interface FireHotspot {
  lat: number;
  lng: number;
  frp: number;
  brightness: number;
  confidence: string;
  daynight: string;
  acq_date: string;
  acq_time: string;
}

// ─── TRAINS ────────────────────────────────────────────────────────────

export interface Train {
  id: string;
  name: string;
  number: string;
  source: 'amtrak' | 'digitraffic' | string;
  source_label?: string;
  operator?: string;
  country?: string;
  telemetry_quality?: string;
  lat: number;
  lng: number;
  speed_kmh: number | null;
  heading: number | null;
  status: string;
  route: string;
}

// ─── CCTV CAMERAS ───────────────────────────────────────────────────────────

export interface CCTVCamera {
  id: string | number;
  lat: number;
  lon: number;
  direction_facing?: string;
  source_agency?: string;
  media_url?: string;
  media_type?: 'image' | 'hls' | 'mjpeg';
}

// ─── KIWISDR RECEIVERS ─────────────────────────────────────────────────────

export interface KiwiSDR {
  lat: number;
  lon: number;
  name: string;
  url?: string;
  users?: number;
  users_max?: number;
  bands?: string;
  antenna?: string;
  location?: string;
}

// ─── PSK REPORTER SPOTS ─────────────────────────────────────────────────────

export interface PSKSpot {
  lat: number;
  lon: number;
  sender: string;
  receiver: string;
  frequency: number;
  mode: string;
  snr: number;
  time: string;
}

// ─── SATNOGS GROUND STATIONS ────────────────────────────────────────────────

export interface SatNOGSStation {
  id: number;
  name: string;
  lat: number;
  lng: number;
  altitude?: number;
  antenna?: string;
  observations?: number;
  status?: number;
  last_seen?: string;
}

export interface SatNOGSObservation {
  id: number;
  satellite_name: string;
  norad_id?: number;
  station_name: string;
  lat: number;
  lng: number;
  start?: string;
  end?: string;
  frequency?: number;
  mode?: string;
  waterfall?: string;
  audio?: string;
  status?: string;
}

// ─── TINYGS LORA SATELLITES ─────────────────────────────────────────────────

export interface TinyGSSatellite {
  name: string;
  lat: number;
  lng: number;
  heading?: number;
  speed_knots?: number;
  alt_km?: number;
  status?: string;
  modulation?: string;
  frequency?: string;
  sgp4_propagated?: boolean;
  tinygs_confirmed?: boolean;
}

// ─── POLICE SCANNERS (OpenMHZ) ──────────────────────────────────────────────

export interface Scanner {
  shortName: string;
  name: string;
  lat: number;
  lng: number;
  city: string;
  state: string;
  clientCount: number;
  description: string;
}

// ─── SIGINT (APRS / Meshtastic / JS8Call) ───────────────────────────────────

export interface SigintSignal {
  callsign?: string;
  lat?: number;
  lng?: number;
  source?: 'aprs' | 'meshtastic' | 'js8call' | string;
  region?: string;
  root?: string;
  channel?: string;
  confidence?: number;
  timestamp?: string;
  position_updated_at?: string;
  raw_message?: string;
  status?: string;
  comment?: string;
  station_type?: string;
  emergency?: boolean;
  emergency_keyword?: string;
  long_name?: string;
  short_name?: string;
  hardware?: string;
  role?: string;
  battery_level?: number;
  voltage?: number | string | null;
  altitude?: number | null;
  from_api?: boolean;
  snr?: number;
  frequency?: string | number;
  grid?: string;
  symbol?: string;
  altitude_ft?: number;
  speed_knots?: number;
  course?: number;
  battery_v?: number;
  power_watts?: number;
  geometry?: { coordinates?: [number, number] };
}

// ─── INTERNET OUTAGES (IODA) ────────────────────────────────────────────────

export interface InternetOutage {
  region_code: string;
  region_name: string;
  country_code: string;
  country_name: string;
  level: string;
  datasource: string;
  severity: number;
  lat: number;
  lng: number;
}

// ─── DATA CENTERS ───────────────────────────────────────────────────────────

export interface DataCenter {
  name: string;
  company: string;
  street?: string;
  city?: string;
  country?: string;
  zip?: string;
  lat: number;
  lng: number;
}

export interface PowerPlant {
  name: string;
  country: string;
  fuel_type: string;
  capacity_mw: number | null;
  owner: string;
  lat: number;
  lng: number;
}

export interface VIIRSChangeNode {
  lat: number;
  lng: number;
  mean_change_pct: number;
  severity: 'severe' | 'high' | 'moderate' | 'growth' | 'rapid_growth';
  aoi_name: string;
}

export interface MilitaryBase {
  name: string;
  country: string;
  operator: string;
  branch: string;
  lat: number;
  lng: number;
}

export interface UkraineAlert {
  id: number;
  alert_type: string;
  location_title: string;
  location_uid: string;
  name_en: string;
  started_at: string;
  color: string;
  geometry: GeoJSON.Geometry;
}

export interface WeatherAlert {
  id: string;
  event: string;
  severity: string;
  certainty: string;
  urgency: string;
  headline: string;
  description: string;
  expires: string;
  geometry: GeoJSON.Geometry;
}

export interface AirQualityStation {
  id: number;
  name: string;
  lat: number;
  lng: number;
  pm25: number;
  aqi: number;
  country: string;
}

export interface Volcano {
  name: string;
  type: string;
  country: string;
  region: string;
  elevation: number;
  last_eruption_year: number | null;
  lat: number;
  lng: number;
}

export interface FishingEvent {
  id: string;
  type: string;
  lat: number;
  lng: number;
  start: string;
  end: string;
  vessel_name: string;
  vessel_flag: string;
  duration_hrs: number;
}

// ─── CORRELATION ALERTS ────────────────────────────────────────────────────

export interface CorrelationAlert {
  lat: number;
  lng: number;
  type: 'rf_anomaly' | 'military_buildup' | 'infra_cascade' | 'maritime_threat' | 'cyber_threat';
  severity: 'high' | 'medium' | 'low';
  score: number;
  drivers: string[];
  cell_size: number | null;
}

export interface PredictionAlert {
  type: string;
  label: string;
  probability: number;
  lat: number | null;
  lng: number | null;
  horizon: string;
  drivers: string[];
  severity: 'high' | 'medium' | 'low';
}

// ─── PATTERN ALERTS (frontend-computed, not stored in DashboardData) ─────────

export type PatternAlertType = 'AIS_DARK' | 'MILITARY_GRID' | 'MULTI_DOMAIN';

export interface PatternEvidence {
  domain: 'maritime' | 'aviation' | 'conflict' | 'cyber' | 'internet';
  label: string;
  detail?: string;
  ts?: number;
}

export interface PatternAlert {
  id: string;
  type: PatternAlertType;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  region: string;
  lat: number;
  lng: number;
  title: string;
  summary: string;
  detectedAt: number;
  evidence: PatternEvidence[];
}

// ─── NEWS / GLOBAL INCIDENTS ────────────────────────────────────────────────

export interface NewsArticle {
  id: number | string;
  title: string;
  summary: string;
  source: string;
  link: string;
  pub_date: string;
  risk_score: number;
  lat: number;
  lng: number;
  region?: string;
  coords?: [number, number];
  machine_assessment?: string;
  oracle_score?: number;
  sentiment?: number;
  breaking?: boolean;
  prediction_odds?: {
    title: string;
    polymarket_pct: number | null;
    kalshi_pct: number | null;
    consensus_pct: number | null;
    match_score: number;
  } | null;
}

export interface ThreatLevel {
  score: number;
  level: 'GREEN' | 'GUARDED' | 'ELEVATED' | 'HIGH' | 'SEVERE';
  color: string;
  drivers: string[];
}

// ─── UKRAINE FRONTLINE ──────────────────────────────────────────────────────

export interface FrontlineGeoJSON {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: {
      type: 'Polygon';
      coordinates: [number, number][][];
    };
    properties: {
      name: string;
      zone_id: number;
    };
  }>;
}

// ─── GDELT INCIDENTS ────────────────────────────────────────────────────────

export interface GDELTIncident {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: {
    name: string;
    count: number;
    _urls_list: string[];
    _headlines_list: string[];
  };
}

// ─── GDELT CONFLICT EVENTS (violence/conflict filtered) ─────────────────────

export interface GdeltConflictEvent {
  lat: number;
  lng: number;
  title: string;
  url?: string;
  date?: string;
  tone?: number;
}

// ─── ACLED CONFLICT EVENTS ───────────────────────────────────────────────────

export interface AcledEvent {
  event_id: string;
  lat: number;
  lng: number;
  event_date: string;
  event_type: string;
  sub_event_type: string;
  actor1: string;
  actor2: string;
  country: string;
  location: string;
  fatalities: number;
  notes: string;
  source: string;
}

// ─── UCDP CONFLICT EVENTS ────────────────────────────────────────────────────

export interface UcdpConflictEvent {
  id: string;
  lat: number;
  lng: number;
  country: string;
  conflict_name: string;
  type_of_violence: number; // 1=state, 2=non-state, 3=one-sided
  deaths_best: number;
  year: number;
  date_start?: string;
}

// ─── SUBMARINE CABLE LANDING STATIONS ────────────────────────────────────────

// ─── LIVEUAMAP ──────────────────────────────────────────────────────────────

export interface LiveUAmapIncident {
  id: string | number;
  lat: number;
  lng: number;
  title: string;
  description?: string;
  date: string;
  timestamp?: number;
  link?: string;
  category?: string;
  region?: string;
}

// ─── STOCKS & COMMODITIES ───────────────────────────────────────────────────

export interface StockTicker {
  price: number;
  change_percent: number;
  up: boolean;
}

export type StocksData = Record<string, StockTicker>;
export type OilData = Record<string, StockTicker>;

// ─── SPACE WEATHER ──────────────────────────────────────────────────────────

export interface SpaceWeatherEvent {
  type: string;
  begin: string;
  end: string;
  classtype: string;
}

export interface SpaceWeather {
  kp_index: number | null;
  kp_text: string;
  events: SpaceWeatherEvent[];
}

// ─── WEATHER (RAINVIEWER) ───────────────────────────────────────────────────

export interface Weather {
  time: number;
  host: string;
}

// ─── AIRPORTS ───────────────────────────────────────────────────────────────

export interface Airport {
  id: string;
  name: string;
  iata: string;
  lat: number;
  lng: number;
  type: 'airport';
}

// ─── RADIO FEEDS ────────────────────────────────────────────────────────────

export interface RadioFeed {
  id: string;
  name: string;
  location: string;
  category: string;
  listeners: number;
  stream_url?: string;
}

// ─── ROUTE ──────────────────────────────────────────────────────────────────

export interface FlightRoute {
  orig_loc: [number, number];
  dest_loc: [number, number];
  origin_name: string;
  dest_name: string;
}

// ─── REGION DOSSIER ─────────────────────────────────────────────────────────

export interface RegionDossier {
  lat: number;
  lng: number;
  admin_regions?: string[];
  populated_places?: string[];
  // Dynamic properties from backend (sentinel2, weather, etc.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// ─── FRESHNESS METADATA ─────────────────────────────────────────────────────

export type FreshnessMap = Record<string, string>;

// ─── FIMI DISINFORMATION ────────────────────────────────────────────────────

export interface FimiNarrative {
  title: string;
  link: string;
  published: string;
  snippet: string;
  claims: Array<{ url: string; title: string }>;
  actors: string[];
  targets: string[];
  disinfo_keywords: string[];
}

export interface FimiData {
  narratives: FimiNarrative[];
  claims: Array<{ url: string; title: string }>;
  threat_actors: Record<string, number>;
  targets: Record<string, number>;
  disinfo_keywords: string[];
  major_wave: boolean;
  major_wave_target: string | null;
  last_fetched: string;
  source: string;
  source_url: string;
}

// ─── SINGAPORE LIVE FEEDS ───────────────────────────────────────────────────

export interface ScdfIncident {
  title: string;
  date: string;
  url: string;
  type: string;
  lat?: number;
  lng?: number;
}

export interface SgSecureAlert {
  title: string;
  date: string;
  url: string;
  severity: 'high' | 'medium' | 'low' | string;
  lat?: number;
  lng?: number;
}

export interface TrafficIncident {
  type: string;
  lat: number;
  lng: number;
  message: string;
}

export interface TrafficSpeedBand {
  link_id: string;
  road_name: string;
  speed_band: number;
  min_speed: number;
  max_speed: number;
  location: string;
}

export interface PsiReading {
  region: string;
  lat: number;
  lng: number;
  psi_24h: number;
}

// ─── MARITIME PIRACY ────────────────────────────────────────────────────────

export interface PiracyIncident {
  id: number | string;
  lat: number;
  lng: number;
  date: string;
  description: string;
  incident_number: string;
  incident_type: string;
}

// ─── TELEGRAM CHANNEL POSTS ─────────────────────────────────────────────────

export interface TelegramPost {
  channel: string;
  message_id: number;
  text: string;
  timestamp: string;
  url: string;
}

// ─── CYBER THREAT INTEL ─────────────────────────────────────────────────────

export interface OtxPulse {
  id: string;
  name: string;
  description: string;
  tags: string[];
  created: string;
  modified: string;
  tlp: string;
  indicator_count: number;
  author_name: string;
  malware_families?: Array<{ id: string; display_name: string }>;
  targeted_countries?: string[];
  industries?: string[];
}

export interface FeodoC2 {
  ip_address: string;
  port: number;
  status: 'online' | 'offline' | string;
  hostname: string | null;
  as_number: number | null;
  as_name: string | null;
  country: string | null;
  first_seen_utc: string;
  last_online: string | null;
  malware: string;
  reporter: string | null;
}

export interface RansomwareIoc {
  victim: string;
  group: string;
  discovered: string;
  domain: string;
  country: string;
  attackdate?: string;
  activity?: string;
}

export interface CisaKevEntry {
  cveID: string;
  vendorProject: string;
  product: string;
  vulnerabilityName: string;
  dateAdded: string;
  shortDescription: string;
  requiredAction?: string;
  dueDate?: string;
}

// ─── ROOT DATA OBJECT ───────────────────────────────────────────────────────

export interface DashboardData {
  // Metadata
  last_updated?: string | null;
  freshness?: FreshnessMap;
  satellite_source?: string;
  financial_source?: string;
  cctv_total?: number;
  satnogs_total?: number;
  tinygs_total?: number;
  sigint_totals?: {
    total?: number;
    meshtastic?: number;
    meshtastic_live?: number;
    meshtastic_map?: number;
    aprs?: number;
    js8call?: number;
  };

  // Fast tier
  commercial_flights?: CommercialFlight[];
  private_flights?: PrivateFlight[];
  private_jets?: PrivateJet[];
  military_flights?: MilitaryFlight[];
  tracked_flights?: TrackedFlight[];
  uavs?: UAV[];
  ships?: Ship[];
  cctv?: CCTVCamera[];
  liveuamap?: LiveUAmapIncident[];
  gps_jamming?: GPSJammingZone[];
  satellites?: Satellite[];
  sigint?: SigintSignal[];
  trains?: Train[];

  // Slow tier
  threat_level?: ThreatLevel;
  trending_markets?: Array<{
    title: string;
    consensus_pct: number | null;
    polymarket_pct: number | null;
    kalshi_pct: number | null;
    delta_pct: number | null;
    volume: number;
    volume_24h: number;
    category: string;
    sources: Array<{ name: string; pct: number }>;
    slug: string;
    outcomes?: Array<{ name: string; pct: number }>;
  }>;
  news?: NewsArticle[];
  stocks?: StocksData;
  oil?: OilData;
  unusual_whales?: {
    congress_trades?: import('@/types/unusualWhales').CongressTrade[];
    insider_transactions?: import('@/types/unusualWhales').InsiderTransaction[];
    quotes?: Record<string, { price: number; change_percent: number; up: boolean }>;
  };
  weather?: Weather | null;
  earthquakes?: Earthquake[];
  frontlines?: FrontlineGeoJSON | null;
  gdelt?: GDELTIncident[];
  airports?: Airport[];
  kiwisdr?: KiwiSDR[];
  psk_reporter?: PSKSpot[];
  satnogs_stations?: SatNOGSStation[];
  satnogs_observations?: SatNOGSObservation[];
  tinygs_satellites?: TinyGSSatellite[];
  scanners?: Scanner[];
  space_weather?: SpaceWeather | null;
  internet_outages?: InternetOutage[];
  firms_fires?: FireHotspot[];
  datacenters?: DataCenter[];
  military_bases?: MilitaryBase[];
  power_plants?: PowerPlant[];
  viirs_change_nodes?: VIIRSChangeNode[];
  ukraine_alerts?: UkraineAlert[];
  weather_alerts?: WeatherAlert[];
  air_quality?: AirQualityStation[];
  volcanoes?: Volcano[];
  fishing_activity?: FishingEvent[];
  piracy_incidents?: PiracyIncident[];
  telegram_posts?: TelegramPost[];
  /** Maps data-store key → "pending" | "active" during the first ~4 min of container startup. */
  startup_stages?: Record<string, string>;

  // Singapore live feeds (frontend-polled)
  scdf_incidents?: ScdfIncident[];
  sgsecure_alerts?: SgSecureAlert[];
  road_incidents?: TrafficIncident[];
  spf_establishments?: SpfEstablishment[];
  traffic_speed_bands?: TrafficSpeedBand[];
  psi_sg?: PsiReading[];
  bus_stops?: BusStop[];
  mrt_alerts?: MrtAlert[];

  // Aviation intelligence (frontend-polled)
  adsb_military_flights?: AdsbMilitaryFlight[];
  notam_entries?: NotamEntry[];

  // Cyber threat intel (frontend-polled)
  cisa_kev?: CisaKevEntry[];
  ransomware_iocs?: RansomwareIoc[];
  feodo_c2?: FeodoC2[];
  otx_pulses?: OtxPulse[];
  singcert_advisories?: SingCertAdvisory[];

  // Conflict intelligence (frontend-polled)
  gdelt_conflict?: GdeltConflictEvent[];
  ucdp_conflict?: UcdpConflictEvent[];
  acled_events?: AcledEvent[];

  // Cross-layer correlations + predictions
  correlations?: CorrelationAlert[];
  predictions?: PredictionAlert[];

  // FIMI disinformation
  fimi?: FimiData;

  // MPA Oceans-X supplementary
  mpa_arrivals?: MpaVesselEntry[];
  mpa_departures?: MpaVesselEntry[];
  mpa_departure_declarations?: MpaVesselEntry[];
  mpa_vessel_types?: Record<string, string>;
  mpa_weather_4day?: Record<string, unknown>[];
  mpa_wind_readings?: MpaWindReading[];
}

// ─── COMPONENT PROPS ────────────────────────────────────────────────────────

export interface BusStop {
  code: string;
  road_name: string;
  description: string;
  lat: number;
  lng: number;
}

export interface SpfEstablishment {
  lat: number;
  lng: number;
  department: string;
  type: string;
  street_name: string;
  telephone: string;
}

export interface MrtAlert {
  status: number;
  message: string;
  created_date: string;
  free_public_bus: string;
  free_mrt_shuttle: string;
  shuttle_direction: string;
  affected: Array<{ station: string; direction: string; free_bus: string }>;
}

export interface AdsbMilitaryFlight {
  hex: string;
  flight?: string;
  lat: number;
  lng: number;
  alt_baro?: number | null;
  gs?: number | null;
  track?: number | null;
  t?: string;
  desc?: string;
}

export interface NotamEntry {
  id: string;
  location: string;
  notam_text: string;
  effective_start: string;
  effective_end: string;
  lat?: number;
  lng?: number;
  type: string;
  classification: string;
}

export interface SingCertAdvisory {
  title: string;
  description: string;
  date: string;
  url: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  advisory_id?: string;
}

export interface ActiveLayers {
  flights: boolean;
  flights_us_eu: boolean;
  private: boolean;
  jets: boolean;
  military: boolean;
  tracked: boolean;
  satellites: boolean;
  ships_mpa: boolean;
  ships_military: boolean;
  ships_cargo: boolean;
  ships_civilian: boolean;
  ships_passenger: boolean;
  ships_tracked_yachts: boolean;
  ships_ais_world: boolean;
  earthquakes: boolean;
  cctv: boolean;
  cctv_global: boolean;
  ukraine_frontline: boolean;
  global_incidents: boolean;
  day_night: boolean;
  gps_jamming: boolean;
  gibs_imagery: boolean;
  highres_satellite: boolean;
  kiwisdr: boolean;
  kiwisdr_global: boolean;
  psk_reporter: boolean;
  satnogs: boolean;
  tinygs: boolean;
  scanners: boolean;
  firms: boolean;
  internet_outages: boolean;
  datacenters: boolean;
  datacenters_global: boolean;
  military_bases: boolean;
  power_plants: boolean;
  power_plants_global: boolean;
  sigint_meshtastic: boolean;
  sigint_aprs: boolean;
  ukraine_alerts: boolean;
  weather_alerts: boolean;
  air_quality: boolean;
  volcanoes: boolean;
  fishing_activity: boolean;
  sentinel_hub: boolean;
  trains: boolean;
  shodan_overlay: boolean;
  viirs_nightlights: boolean;
  correlations: boolean;
  scdf_incidents: boolean;
  sgsecure_alerts: boolean;
  road_incidents: boolean;
  spf_establishments: boolean;
  saf_installations: boolean;
  traffic_speed_bands: boolean;
  psi_sg: boolean;
  bus_arrivals: boolean;
  cisa_kev: boolean;
  ransomware_iocs: boolean;
  feodo_c2: boolean;
  otx_pulses: boolean;
  adsb_military: boolean;
  notam: boolean;
  conflict_events: boolean;
  show_us_traffic: boolean;
  piracy_incidents: boolean;
  // v8.0.0 — Regional feeds (Malaysia + SEA)
  regional_weather: boolean;
  cwa_alerts: boolean;
  reliefweb_events: boolean;
  acaps_crises: boolean;
}

export interface SelectedEntity {
  id: string | number;
  type: string;
  name?: string;
  media_url?: string;
  // Dynamic bag — varies by entity type (flight, ship, cctv, region_dossier, etc.)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extra?: Record<string, any>;
}

export interface MpaVesselEntry {
  vesselName: string;
  callSign: string;
  imoNumber: string;
  mmsi: string;
  vesselType: string;
  flag: string;
  eta: string;
  etd: string;
  berth: string;
  terminal: string;
  agent: string;
  timestamp: string;
}

export interface MpaWindReading {
  stationId: string;
  stationName: string;
  lat: number;
  lng: number;
  direction: number;
  speed: number;
  unit: string;
  timestamp: string;
}

export interface MeasurePoint {
  lat: number;
  lng: number;
}

export interface MapEffects {
  bloom: boolean;
  style?: string;
}

export interface MaplibreViewerProps {
  data: DashboardData;
  activeLayers: ActiveLayers;
  activeFilters?: Record<string, string[]>;
  effects?: MapEffects;
  onEntityClick: (entity: SelectedEntity | null) => void;
  flyToLocation: { lat: number; lng: number; zoom?: number; ts?: number } | null;
  selectedEntity: SelectedEntity | null;
  onMouseCoords: (coords: { lat: number; lng: number }) => void;
  onRightClick: (coords: { lat: number; lng: number }) => void;
  regionDossier: RegionDossier | null;
  regionDossierLoading: boolean;
  onViewStateChange?: (vs: { zoom: number; latitude: number }) => void;
  measureMode: boolean;
  onMeasureClick: (coords: { lat: number; lng: number }) => void;
  measurePoints: MeasurePoint[];
  gibsDate: string;
  gibsOpacity: number;
  sentinelDate?: string;
  sentinelOpacity?: number;
  sentinelPreset?: string;
  isEavesdropping?: boolean;
  onEavesdropClick?: (coords: { lat: number; lng: number }) => void;
  onCameraMove?: (coords: { lat: number; lng: number }) => void;
  viewBoundsRef?: React.RefObject<{
    south: number;
    west: number;
    north: number;
    east: number;
  } | null>;
  trackedSdr?: KiwiSDR | null;
  setTrackedSdr?: (sdr: KiwiSDR | null) => void;
  trackedScanner?: Scanner | null;
  setTrackedScanner?: (scanner: Scanner | null) => void;
  shodanResults?: import('@/types/shodan').ShodanSearchMatch[];
  shodanStyle?: import('@/types/shodan').ShodanStyleConfig;
  watchedEntities?: import('@/types/watchlist').WatchedEntity[];
}
