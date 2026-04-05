'use client';

/**
 * DeckGLOverlay.tsx
 *
 * Attaches a deck.gl MapboxOverlay to the MapLibre GL map and renders
 * migrated point layers (ships, military flights, commercial flights,
 * private flights, tracked flights) as deck.gl IconLayers.
 *
 * Constraints enforced:
 * - Single icon atlas (built once via getIconAtlas())
 * - updateTriggers keyed to data reference identity — no timestamps
 * - Click events forward to the existing onEntityClick handler
 * - Worker GeoJSON FeatureCollections are consumed as .features arrays
 */

import { useEffect, useRef, useState } from 'react';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { IconLayer, ScatterplotLayer } from '@deck.gl/layers';
import type { MapRef } from 'react-map-gl/maplibre';
import type maplibregl from 'maplibre-gl';
import { getIconAtlas, type IconAtlasResult } from './deckIconAtlas';

// ── Constants ──────────────────────────────────────────────────────────────

// Separate base sizes for flights (larger, remade icons) vs ships (original size).
const FLIGHT_ICON_SIZE = 48;
const SHIP_ICON_SIZE = 26;

// Zoom scale for flights — enlarged stops.
function flightZoomScale(zoom: number): number {
  const stops: [number, number][] = [[2, 0.3], [5, 0.5], [8, 0.75], [12, 1.0], [15, 1.3]];
  if (zoom <= stops[0][0]) return stops[0][1];
  if (zoom >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [z0, s0] = stops[i];
    const [z1, s1] = stops[i + 1];
    if (zoom >= z0 && zoom <= z1) return s0 + ((zoom - z0) / (z1 - z0)) * (s1 - s0);
  }
  return 1;
}

// Zoom scale for ships — original MapLibre stops.
function shipZoomScale(zoom: number): number {
  const stops: [number, number][] = [[2, 0.25], [5, 0.4], [8, 0.65], [12, 0.9], [15, 1.1]];
  if (zoom <= stops[0][0]) return stops[0][1];
  if (zoom >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [z0, s0] = stops[i];
    const [z1, s1] = stops[i + 1];
    if (zoom >= z0 && zoom <= z1) return s0 + ((zoom - z0) / (z1 - z0)) * (s1 - s0);
  }
  return 1;
}

// ── Types ──────────────────────────────────────────────────────────────────

type GeoJSONFeature = GeoJSON.Feature<GeoJSON.Point, Record<string, unknown>>;
type FeatureCollection = GeoJSON.FeatureCollection | null;

export interface DeckGLOverlayProps {
  mapRef: React.RefObject<MapRef | null>;
  mapZoom: number;
  shipsGeoJSON: FeatureCollection;
  commercialFlightsGeoJSON: FeatureCollection;
  privateFlightsGeoJSON: FeatureCollection;
  privateJetsGeoJSON: FeatureCollection;
  militaryFlightsGeoJSON: FeatureCollection;
  trackedFlightsGeoJSON: FeatureCollection;
  // Session 2 migrated layers
  gdeltConflictGeoJSON: FeatureCollection;
  ucdpConflictGeoJSON: FeatureCollection;
  satellitesGeoJSON: FeatureCollection;
  earthquakesGeoJSON: FeatureCollection;
  firmsGeoJSON: FeatureCollection;
  piracyGeoJSON: FeatureCollection;
  onEntityClick: (entity: { id: string | number; type: string; name?: string; extra: Record<string, unknown> } | null) => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getFeatures(fc: FeatureCollection): GeoJSONFeature[] {
  return (fc?.features as GeoJSONFeature[]) ?? [];
}

function makeIconLayer(
  id: string,
  data: GeoJSONFeature[],
  atlas: IconAtlasResult,
  dataRef: unknown,
  scale: number,
  onClickFn: (info: { object?: GeoJSONFeature }) => void,
  baseSize: number = SHIP_ICON_SIZE,
) {
  const base = baseSize * scale;
  return new IconLayer<GeoJSONFeature>({
    id,
    data,
    pickable: true,
    getPosition: (f) => f.geometry.coordinates as [number, number],
    getIcon: (f) => {
      const iconId = f.properties.iconId as string;
      return (iconId && atlas.mapping[iconId]) ? iconId : 'svgShipBlue';
    },
    iconAtlas: atlas.atlas as unknown as string,
    iconMapping: atlas.mapping,
    getSize: (f) => (f.properties.watchlisted === 1 ? 1.5 * base : base),
    getAngle: (f) => -(f.properties.rotation as number ?? 0),
    sizeUnits: 'pixels',
    sizeMinPixels: 10,
    sizeMaxPixels: 64,
    onClick: onClickFn,
    updateTriggers: {
      getIcon: [dataRef],
      getSize: [dataRef, scale],
      getAngle: [dataRef],
      getPosition: [dataRef],
    },
  });
}

function makeWatchlistRingLayer(
  id: string,
  data: GeoJSONFeature[],
  dataRef: unknown,
  scale: number,
  baseSize: number = SHIP_ICON_SIZE,
) {
  // Gold ring rendered as a ScatterplotLayer outline around each watchlisted entity.
  // More reliable than TextLayer Unicode (★ requires specific font atlas config).
  const radius = baseSize * scale * 1.1;
  return new ScatterplotLayer<GeoJSONFeature>({
    id,
    data,
    getPosition: (f) => f.geometry.coordinates as [number, number],
    getRadius: radius,
    radiusUnits: 'pixels',
    filled: false,
    stroked: true,
    getLineColor: [251, 191, 36, 255] as [number, number, number, number],
    lineWidthMinPixels: 2,
    lineWidthMaxPixels: 3,
    updateTriggers: {
      getPosition: [dataRef],
      getRadius: [scale],
    },
  });
}

// Piecewise-linear interpolation helper (mirrors MapLibre interpolate stops)
function piecewiseLinear(stops: [number, number][], value: number): number {
  if (value <= stops[0][0]) return stops[0][1];
  if (value >= stops[stops.length - 1][0]) return stops[stops.length - 1][1];
  for (let i = 0; i < stops.length - 1; i++) {
    const [x0, y0] = stops[i];
    const [x1, y1] = stops[i + 1];
    if (value >= x0 && value <= x1) return y0 + ((value - x0) / (x1 - x0)) * (y1 - y0);
  }
  return stops[stops.length - 1][1];
}

function makeGdeltConflictLayer(
  data: GeoJSONFeature[],
  dataRef: unknown,
  zoom: number,
  onClickFn: (info: { object?: GeoJSONFeature }) => void,
) {
  const radius = piecewiseLinear([[2, 4], [8, 7]], zoom);
  return new ScatterplotLayer<GeoJSONFeature>({
    id: 'deck-gdelt-conflict',
    data,
    pickable: true,
    getPosition: (f) => f.geometry.coordinates as [number, number],
    getRadius: radius,
    radiusUnits: 'pixels',
    getFillColor: [229, 57, 53, 204] as [number, number, number, number],
    stroked: true,
    getLineColor: [255, 107, 107, 255] as [number, number, number, number],
    lineWidthMinPixels: 1,
    lineWidthMaxPixels: 1.5,
    onClick: onClickFn,
    updateTriggers: {
      getPosition: [dataRef],
      getRadius: [zoom],
    },
  });
}

function makeUcdpConflictLayer(
  data: GeoJSONFeature[],
  dataRef: unknown,
  onClickFn: (info: { object?: GeoJSONFeature }) => void,
) {
  return new ScatterplotLayer<GeoJSONFeature>({
    id: 'deck-ucdp-conflict',
    data,
    pickable: true,
    getPosition: (f) => f.geometry.coordinates as [number, number],
    getRadius: (f) => {
      const deaths = (f.properties.deaths as number) ?? 0;
      return piecewiseLinear([[0, 5], [100, 9], [1000, 13]], deaths);
    },
    radiusUnits: 'pixels',
    getFillColor: (f) => {
      const hex = (f.properties.color as string) ?? '#ff8800';
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b, 191] as [number, number, number, number];
    },
    stroked: true,
    getLineColor: [255, 255, 255, 102] as [number, number, number, number],
    lineWidthMinPixels: 1,
    onClick: onClickFn,
    updateTriggers: {
      getPosition: [dataRef],
      getRadius: [dataRef],
      getFillColor: [dataRef],
    },
  });
}

function makeSatelliteLayer(
  data: GeoJSONFeature[],
  atlas: IconAtlasResult,
  dataRef: unknown,
  zoom: number,
  onClickFn: (info: { object?: GeoJSONFeature }) => void,
) {
  const scale = piecewiseLinear([[0, 0.4], [3, 0.5], [6, 0.7], [10, 1.0]], zoom);
  const size = FLIGHT_ICON_SIZE * scale;
  return new IconLayer<GeoJSONFeature>({
    id: 'deck-satellites',
    data,
    pickable: true,
    getPosition: (f) => f.geometry.coordinates as [number, number],
    getIcon: (f) => {
      const iconId = f.properties.iconId as string;
      return atlas.mapping[iconId] ? iconId : 'sat-gen';
    },
    iconAtlas: atlas.atlas as unknown as string,
    iconMapping: atlas.mapping,
    getSize: size,
    sizeUnits: 'pixels',
    sizeMinPixels: 10,
    sizeMaxPixels: 36,
    onClick: onClickFn,
    updateTriggers: {
      getIcon: [dataRef],
      getSize: [zoom],
      getPosition: [dataRef],
    },
  });
}

function makeSatelliteIssHaloLayer(
  data: GeoJSONFeature[],
  dataRef: unknown,
  zoom: number,
) {
  const radius = piecewiseLinear([[0, 10], [3, 14], [6, 18], [10, 24]], zoom);
  return new ScatterplotLayer<GeoJSONFeature>({
    id: 'deck-satellites-iss-halo',
    data,
    getPosition: (f) => f.geometry.coordinates as [number, number],
    getRadius: radius,
    radiusUnits: 'pixels',
    filled: false,
    stroked: true,
    getLineColor: [255, 221, 0, 204] as [number, number, number, number],
    lineWidthMinPixels: 2,
    lineWidthMaxPixels: 2,
    updateTriggers: {
      getPosition: [dataRef],
      getRadius: [zoom],
    },
  });
}

function makeEarthquakeLayer(
  data: GeoJSONFeature[],
  atlas: IconAtlasResult,
  dataRef: unknown,
  onClickFn: (info: { object?: GeoJSONFeature }) => void,
) {
  return new IconLayer<GeoJSONFeature>({
    id: 'deck-earthquakes',
    data,
    pickable: true,
    getPosition: (f) => f.geometry.coordinates as [number, number],
    getIcon: () => 'svgThreat',
    iconAtlas: atlas.atlas as unknown as string,
    iconMapping: atlas.mapping,
    getSize: FLIGHT_ICON_SIZE * 0.5,
    sizeUnits: 'pixels',
    sizeMinPixels: 10,
    sizeMaxPixels: 30,
    onClick: onClickFn,
    updateTriggers: {
      getPosition: [dataRef],
    },
  });
}

function makeFirmsLayer(
  data: GeoJSONFeature[],
  atlas: IconAtlasResult,
  dataRef: unknown,
  zoom: number,
  onClickFn: (info: { object?: GeoJSONFeature }) => void,
) {
  const scale = piecewiseLinear([[2, 0.4], [5, 0.6], [8, 0.8], [12, 1.0]], zoom);
  const size = FLIGHT_ICON_SIZE * scale;
  return new IconLayer<GeoJSONFeature>({
    id: 'deck-firms',
    data,
    pickable: true,
    getPosition: (f) => f.geometry.coordinates as [number, number],
    getIcon: (f) => {
      const iconId = f.properties.iconId as string;
      return atlas.mapping[iconId] ? iconId : 'fire-yellow';
    },
    iconAtlas: atlas.atlas as unknown as string,
    iconMapping: atlas.mapping,
    getSize: size,
    sizeUnits: 'pixels',
    sizeMinPixels: 8,
    sizeMaxPixels: 28,
    onClick: onClickFn,
    updateTriggers: {
      getIcon: [dataRef],
      getSize: [zoom],
      getPosition: [dataRef],
    },
  });
}

function makePiracyLayer(
  data: GeoJSONFeature[],
  dataRef: unknown,
  zoom: number,
  onClickFn: (info: { object?: GeoJSONFeature }) => void,
) {
  const radius = piecewiseLinear([[2, 5], [6, 7], [10, 10]], zoom);
  return new ScatterplotLayer<GeoJSONFeature>({
    id: 'deck-piracy',
    data,
    pickable: true,
    getPosition: (f) => f.geometry.coordinates as [number, number],
    getRadius: radius,
    radiusUnits: 'pixels',
    getFillColor: (f) => {
      const hex = (f.properties.color as string) ?? '#ef4444';
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b, 217] as [number, number, number, number];
    },
    stroked: true,
    getLineColor: (f) => {
      const hex = (f.properties.color as string) ?? '#ef4444';
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      return [r, g, b, 128] as [number, number, number, number];
    },
    lineWidthMinPixels: 1.5,
    lineWidthMaxPixels: 1.5,
    onClick: onClickFn,
    updateTriggers: {
      getPosition: [dataRef],
      getRadius: [zoom],
      getFillColor: [dataRef],
      getLineColor: [dataRef],
    },
  });
}

// ── Component ──────────────────────────────────────────────────────────────

export function DeckGLOverlay({
  mapRef,
  mapZoom,
  shipsGeoJSON,
  commercialFlightsGeoJSON,
  privateFlightsGeoJSON,
  privateJetsGeoJSON,
  militaryFlightsGeoJSON,
  trackedFlightsGeoJSON,
  gdeltConflictGeoJSON,
  ucdpConflictGeoJSON,
  satellitesGeoJSON,
  earthquakesGeoJSON,
  firmsGeoJSON,
  piracyGeoJSON,
  onEntityClick,
}: DeckGLOverlayProps) {
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const onEntityClickRef = useRef(onEntityClick);
  useEffect(() => { onEntityClickRef.current = onEntityClick; });
  const [atlas, setAtlas] = useState<IconAtlasResult | null>(null);
  // Flip to true once the MapboxOverlay has been addControl'd — this triggers
  // the layer-update effect which skips when overlayRef.current is null.
  const [overlayMounted, setOverlayMounted] = useState(false);

  // Load atlas once
  useEffect(() => {
    getIconAtlas().then(setAtlas).catch(console.error);
  }, []);

  // Create and attach overlay to map once.
  // Uses a retry loop (100 ms interval) because mapRef.current may be null on
  // the first render — the MapRef is assigned asynchronously by react-map-gl.
  useEffect(() => {
    let cancelled = false;
    let attachedOverlay: MapboxOverlay | null = null;

    const tryAttach = () => {
      const map = mapRef.current?.getMap();
      if (!map) {
        if (!cancelled) setTimeout(tryAttach, 100);
        return;
      }

      const overlay = new MapboxOverlay({ interleaved: false, layers: [] });

      const doMount = () => {
        if (cancelled) return;
        map.addControl(overlay as unknown as maplibregl.IControl);
        // Lower the deck.gl canvas container's z-index so MapLibre popups (z-index 3)
        // always appear on top. deck.gl canvas has pointer-events:none so clicks pass through.
        setTimeout(() => {
          const mapContainer = map.getContainer();
          mapContainer.querySelectorAll('canvas').forEach((c) => {
            if (!c.classList.contains('maplibregl-canvas') && c.parentElement) {
              c.parentElement.style.zIndex = '1';
            }
          });
        }, 0);
        overlayRef.current = overlay;
        attachedOverlay = overlay;
        setOverlayMounted(true);
      };

      if (map.loaded()) {
        doMount();
      } else {
        map.once('load', doMount);
      }
    };

    tryAttach();

    return () => {
      cancelled = true;
      if (attachedOverlay) {
        try {
          mapRef.current?.getMap()?.removeControl(attachedOverlay as unknown as maplibregl.IControl);
        } catch { /* map may already be destroyed */ }
      }
      overlayRef.current = null;
      setOverlayMounted(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update layers whenever data or atlas changes
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !atlas) return;

    const handleClick = (info: { object?: GeoJSONFeature }) => {
      if (!info.object) return;
      const props = info.object.properties;
      onEntityClickRef.current({
        id: props.id as string | number,
        type: props.type as string,
        name: props.name as string | undefined,
        extra: props,
      });
    };

    const scale = shipZoomScale(mapZoom);
    const fScale = flightZoomScale(mapZoom);
    const shipFeatures = getFeatures(shipsGeoJSON);
    const commFeatures = getFeatures(commercialFlightsGeoJSON);
    const privFeatures = getFeatures(privateFlightsGeoJSON);
    const jetsFeatures = getFeatures(privateJetsGeoJSON);
    const milFeatures = getFeatures(militaryFlightsGeoJSON);
    const trackedFeatures = getFeatures(trackedFlightsGeoJSON);
    const gdeltConflictFeatures = getFeatures(gdeltConflictGeoJSON);
    const ucdpConflictFeatures = getFeatures(ucdpConflictGeoJSON);
    const satFeatures = getFeatures(satellitesGeoJSON);
    const issFeatures = satFeatures.filter(f => f.properties.isISS === true);
    const eqFeatures = getFeatures(earthquakesGeoJSON);
    const firmsFeatures = getFeatures(firmsGeoJSON);
    const piracyFeatures = getFeatures(piracyGeoJSON);

    // Pre-compute watchlisted subsets once to avoid inline O(n) filters per layer pair.
    const isWatchlisted = (f: GeoJSONFeature) => f.properties.watchlisted === 1;
    const wShips    = shipFeatures.filter(isWatchlisted);
    const wMil      = milFeatures.filter(isWatchlisted);
    const wComm     = commFeatures.filter(isWatchlisted);
    const wPriv     = privFeatures.filter(isWatchlisted);
    const wJets     = jetsFeatures.filter(isWatchlisted);
    const wTracked  = trackedFeatures.filter(isWatchlisted);

    const layers = [
      // Session 2 layers — rendered below flight/ship layers
      makeGdeltConflictLayer(gdeltConflictFeatures, gdeltConflictGeoJSON, mapZoom, handleClick),
      makeUcdpConflictLayer(ucdpConflictFeatures, ucdpConflictGeoJSON, handleClick),
      makePiracyLayer(piracyFeatures, piracyGeoJSON, mapZoom, handleClick),
      makeEarthquakeLayer(eqFeatures, atlas, earthquakesGeoJSON, handleClick),
      makeFirmsLayer(firmsFeatures, atlas, firmsGeoJSON, mapZoom, handleClick),
      makeSatelliteIssHaloLayer(issFeatures, satellitesGeoJSON, mapZoom),
      makeSatelliteLayer(satFeatures, atlas, satellitesGeoJSON, mapZoom, handleClick),

      // Ships — original size
      makeIconLayer('deck-ships', shipFeatures, atlas, shipsGeoJSON, scale, handleClick, SHIP_ICON_SIZE),
      makeWatchlistRingLayer('deck-ships-ring', wShips, shipsGeoJSON, scale),

      // Military flights — enlarged
      makeIconLayer('deck-military-flights', milFeatures, atlas, militaryFlightsGeoJSON, fScale, handleClick, FLIGHT_ICON_SIZE),
      makeWatchlistRingLayer('deck-military-flights-ring', wMil, militaryFlightsGeoJSON, fScale, FLIGHT_ICON_SIZE),

      // Commercial flights — enlarged
      makeIconLayer('deck-commercial-flights', commFeatures, atlas, commercialFlightsGeoJSON, fScale, handleClick, FLIGHT_ICON_SIZE),
      makeWatchlistRingLayer('deck-commercial-flights-ring', wComm, commercialFlightsGeoJSON, fScale, FLIGHT_ICON_SIZE),

      // Private flights — enlarged
      makeIconLayer('deck-private-flights', privFeatures, atlas, privateFlightsGeoJSON, fScale, handleClick, FLIGHT_ICON_SIZE),
      makeWatchlistRingLayer('deck-private-flights-ring', wPriv, privateFlightsGeoJSON, fScale, FLIGHT_ICON_SIZE),

      // Private jets — enlarged
      makeIconLayer('deck-private-jets', jetsFeatures, atlas, privateJetsGeoJSON, fScale, handleClick, FLIGHT_ICON_SIZE),
      makeWatchlistRingLayer('deck-private-jets-ring', wJets, privateJetsGeoJSON, fScale, FLIGHT_ICON_SIZE),

      // Tracked flights (top — always visible) — enlarged
      makeIconLayer('deck-tracked-flights', trackedFeatures, atlas, trackedFlightsGeoJSON, fScale, handleClick, FLIGHT_ICON_SIZE),
      makeWatchlistRingLayer('deck-tracked-flights-ring', wTracked, trackedFlightsGeoJSON, fScale, FLIGHT_ICON_SIZE),
    ];

    overlay.setProps({ layers });
  }, [
    overlayMounted,
    mapZoom,
    atlas,
    shipsGeoJSON,
    commercialFlightsGeoJSON,
    privateFlightsGeoJSON,
    privateJetsGeoJSON,
    militaryFlightsGeoJSON,
    trackedFlightsGeoJSON,
    gdeltConflictGeoJSON,
    ucdpConflictGeoJSON,
    satellitesGeoJSON,
    earthquakesGeoJSON,
    firmsGeoJSON,
    piracyGeoJSON,
    // onEntityClick intentionally omitted — accessed via onEntityClickRef to avoid
    // rebuilding all layers on every parent render when the callback identity changes.
  ]);

  // This component renders nothing into the React tree — the overlay attaches
  // directly to the MapLibre canvas via addControl.
  return null;
}
