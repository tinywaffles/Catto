/// <reference lib="webworker" />

import {
  buildAcledGeoJSON,
  buildAirQualityGeoJSON,
  buildCctvGeoJSON,
  buildDataCentersGeoJSON,
  buildFirmsGeoJSON,
  buildFishingActivityGeoJSON,
  buildGdeltConflictGeoJSON,
  buildUcdpConflictGeoJSON,
  buildGdeltGeoJSON,
  buildInternetOutagesGeoJSON,
  buildKiwisdrGeoJSON,
  buildLiveuaGeoJSON,
  buildPskReporterGeoJSON,
  buildMilitaryBasesGeoJSON,
  buildPowerPlantsGeoJSON,
  buildSatnogsStationsGeoJSON,
  buildScannerGeoJSON,
  buildTrainsGeoJSON,
  buildVIIRSChangeNodesGeoJSON,
  buildVolcanoesGeoJSON,
  buildTrafficIncidentsGeoJSON,
  buildTrafficSpeedBandsGeoJSON,
  buildPsiGeoJSON,
  buildPiracyGeoJSON,
} from '@/components/map/geoJSONBuilders';
import type {
  AcledEvent,
  AirQualityStation,
  CCTVCamera,
  DataCenter,
  FireHotspot,
  FishingEvent,
  GDELTIncident,
  GdeltConflictEvent,
  UcdpConflictEvent,
  InternetOutage,
  KiwiSDR,
  LiveUAmapIncident,
  PSKSpot,
  MilitaryBase,
  PowerPlant,
  SatNOGSStation,
  Scanner,
  Train,
  VIIRSChangeNode,
  Volcano,
  TrafficIncident,
  TrafficSpeedBand,
  PsiReading,
  PiracyIncident,
} from '@/types/dashboard';

type BoundsTuple = [number, number, number, number];
type FC = GeoJSON.FeatureCollection | null;

export type StaticMapLayersDataPayload = {
  cctv?: CCTVCamera[];
  kiwisdr?: KiwiSDR[];
  pskReporter?: PSKSpot[];
  satnogsStations?: SatNOGSStation[];
  scanners?: Scanner[];
  firmsFires?: FireHotspot[];
  internetOutages?: InternetOutage[];
  datacenters?: DataCenter[];
  powerPlants?: PowerPlant[];
  viirsChangeNodes?: VIIRSChangeNode[];
  militaryBases?: MilitaryBase[];
  gdelt?: GDELTIncident[];
  gdeltConflict?: GdeltConflictEvent[];
  ucdpConflict?: UcdpConflictEvent[];
  acledEvents?: AcledEvent[];
  liveuamap?: LiveUAmapIncident[];
  airQuality?: AirQualityStation[];
  volcanoes?: Volcano[];
  fishingActivity?: FishingEvent[];
  trains?: Train[];
  roadIncidents?: TrafficIncident[];
  trafficSpeedBands?: TrafficSpeedBand[];
  psiSg?: PsiReading[];
  piracyIncidents?: PiracyIncident[];
};

export type StaticMapLayersBuildPayload = {
  bounds: BoundsTuple;
  zoom?: number;
  activeLayers: {
    cctv: boolean;
    kiwisdr: boolean;
    psk_reporter: boolean;
    satnogs: boolean;
    scanners: boolean;
    firms: boolean;
    internet_outages: boolean;
    datacenters: boolean;
    power_plants: boolean;
    viirs_nightlights: boolean;
    military_bases: boolean;
    global_incidents: boolean;
    conflict_events: boolean;
    air_quality: boolean;
    volcanoes: boolean;
    fishing_activity: boolean;
    trains: boolean;
    road_incidents: boolean;
    traffic_speed_bands: boolean;
    psi_sg: boolean;
    piracy_incidents: boolean;
  };
};

export type StaticMapLayersResult = {
  cctvGeoJSON: FC;
  kiwisdrGeoJSON: FC;
  pskReporterGeoJSON: FC;
  satnogsGeoJSON: FC;
  scannerGeoJSON: FC;
  firmsGeoJSON: FC;
  internetOutagesGeoJSON: FC;
  dataCentersGeoJSON: FC;
  powerPlantsGeoJSON: FC;
  viirsChangeNodesGeoJSON: FC;
  militaryBasesGeoJSON: FC;
  gdeltGeoJSON: FC;
  gdeltConflictGeoJSON: FC;
  ucdpConflictGeoJSON: FC;
  acledGeoJSON: FC;
  liveuaGeoJSON: FC;
  airQualityGeoJSON: FC;
  volcanoesGeoJSON: FC;
  fishingGeoJSON: FC;
  trainsGeoJSON: FC;
  roadIncidentsGeoJSON: FC;
  trafficSpeedBandsGeoJSON: FC;
  psiSgGeoJSON: FC;
  piracyGeoJSON: FC;
};

type SyncRequest = {
  id: string;
  action: 'sync_static_layers';
  payload: StaticMapLayersDataPayload;
};

type BuildRequest = {
  id: string;
  action: 'build_static_layers';
  payload: StaticMapLayersBuildPayload;
};

type WorkerRequest = SyncRequest | BuildRequest;

type WorkerResponse = {
  id: string;
  ok: boolean;
  result?: StaticMapLayersResult | true;
  error?: string;
};

let staticData: StaticMapLayersDataPayload = {};

function createInView(bounds: BoundsTuple) {
  return (lat: number, lng: number) =>
    lng >= bounds[0] && lng <= bounds[2] && lat >= bounds[1] && lat <= bounds[3];
}

// Static infra within Asia (CCTV, KiwiSDR, DCs, power plants) is pre-filtered by
// the backend to the relevant region. Pass ALWAYS_IN_VIEW so these markers are never
// hidden when the user zooms/pans — the data set is small enough not to need culling.
const ALWAYS_IN_VIEW = () => true;

function buildStaticLayers(payload: StaticMapLayersBuildPayload): StaticMapLayersResult {
  const inView = createInView(payload.bounds);

  return {
    cctvGeoJSON: payload.activeLayers.cctv ? buildCctvGeoJSON(staticData.cctv, ALWAYS_IN_VIEW) : null,
    kiwisdrGeoJSON: payload.activeLayers.kiwisdr ? buildKiwisdrGeoJSON(staticData.kiwisdr, ALWAYS_IN_VIEW) : null,
    pskReporterGeoJSON: payload.activeLayers.psk_reporter
      ? buildPskReporterGeoJSON(staticData.pskReporter, inView)
      : null,
    satnogsGeoJSON: payload.activeLayers.satnogs
      ? buildSatnogsStationsGeoJSON(staticData.satnogsStations, inView)
      : null,
    scannerGeoJSON: payload.activeLayers.scanners ? buildScannerGeoJSON(staticData.scanners, inView) : null,
    firmsGeoJSON: payload.activeLayers.firms ? buildFirmsGeoJSON(staticData.firmsFires, ALWAYS_IN_VIEW) : null,
    internetOutagesGeoJSON: payload.activeLayers.internet_outages
      ? buildInternetOutagesGeoJSON(staticData.internetOutages, inView)
      : null,
    dataCentersGeoJSON: payload.activeLayers.datacenters
      ? buildDataCentersGeoJSON(staticData.datacenters, ALWAYS_IN_VIEW)
      : null,
    powerPlantsGeoJSON: payload.activeLayers.power_plants
      ? buildPowerPlantsGeoJSON(staticData.powerPlants, ALWAYS_IN_VIEW)
      : null,
    viirsChangeNodesGeoJSON: payload.activeLayers.viirs_nightlights
      ? buildVIIRSChangeNodesGeoJSON(staticData.viirsChangeNodes, inView)
      : null,
    militaryBasesGeoJSON: payload.activeLayers.military_bases
      ? buildMilitaryBasesGeoJSON(staticData.militaryBases, inView)
      : null,
    gdeltGeoJSON: payload.activeLayers.global_incidents ? buildGdeltGeoJSON(staticData.gdelt, inView) : null,
    gdeltConflictGeoJSON: payload.activeLayers.conflict_events
      ? buildGdeltConflictGeoJSON(staticData.gdeltConflict, ALWAYS_IN_VIEW)
      : null,
    ucdpConflictGeoJSON: payload.activeLayers.conflict_events
      ? buildUcdpConflictGeoJSON(staticData.ucdpConflict, ALWAYS_IN_VIEW)
      : null,
    acledGeoJSON: payload.activeLayers.conflict_events
      ? buildAcledGeoJSON(staticData.acledEvents, ALWAYS_IN_VIEW)
      : null,
    liveuaGeoJSON: payload.activeLayers.global_incidents
      ? buildLiveuaGeoJSON(staticData.liveuamap, inView)
      : null,
    airQualityGeoJSON: payload.activeLayers.air_quality ? buildAirQualityGeoJSON(staticData.airQuality, inView) : null,
    volcanoesGeoJSON: payload.activeLayers.volcanoes ? buildVolcanoesGeoJSON(staticData.volcanoes, inView) : null,
    fishingGeoJSON: payload.activeLayers.fishing_activity
      ? buildFishingActivityGeoJSON(staticData.fishingActivity, payload.zoom, inView)
      : null,
    trainsGeoJSON: payload.activeLayers.trains ? buildTrainsGeoJSON(staticData.trains, inView) : null,
    roadIncidentsGeoJSON: payload.activeLayers.road_incidents
      ? buildTrafficIncidentsGeoJSON(staticData.roadIncidents, inView)
      : null,
    trafficSpeedBandsGeoJSON: payload.activeLayers.traffic_speed_bands
      ? buildTrafficSpeedBandsGeoJSON(staticData.trafficSpeedBands, inView)
      : null,
    psiSgGeoJSON: payload.activeLayers.psi_sg ? buildPsiGeoJSON(staticData.psiSg, inView) : null,
    piracyGeoJSON: payload.activeLayers.piracy_incidents
      ? buildPiracyGeoJSON(staticData.piracyIncidents, ALWAYS_IN_VIEW)
      : null,
  };
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const message = event.data;

  try {
    if (message.action === 'sync_static_layers') {
      staticData = message.payload;
      const response: WorkerResponse = { id: message.id, ok: true, result: true };
      self.postMessage(response);
      return;
    }

    const result = buildStaticLayers(message.payload);
    const response: WorkerResponse = {
      id: message.id,
      ok: true,
      result,
    };
    self.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      id: message.id,
      ok: false,
      error: error instanceof Error ? error.message : 'unknown_worker_error',
    };
    self.postMessage(response);
  }
};
