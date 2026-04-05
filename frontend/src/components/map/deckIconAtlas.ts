/**
 * deckIconAtlas.ts
 *
 * Builds a single OffscreenCanvas sprite sheet for all vessel and flight
 * marker types used by the deck.gl IconLayer. Returns an ImageBitmap atlas
 * and a mapping of iconId → {x, y, width, height, anchorX, anchorY, mask}.
 *
 * Call getIconAtlas() — it returns a cached promise and only builds once.
 */

import {
  svgPlaneCyan, svgPlaneYellow, svgPlaneOrange, svgPlanePurple,
  svgFighter, svgHeli, svgHeliCyan, svgHeliDimCyan, svgHeliOrange,
  svgHeliPurple, svgHeliSlate, svgHeliAmber, svgTanker, svgRecon,
  svgPlanePink, svgPlaneAlertRed, svgPlaneDarkBlue, svgPlaneWhiteAlert,
  svgHeliPink, svgHeliAlertRed, svgHeliDarkBlue, svgHeliBlue, svgHeliLime,
  svgHeliWhiteAlert, svgPlaneBlack, svgHeliBlack, svgDrone,
  svgShipGray, svgShipRed, svgShipYellow, svgShipBlue, svgShipWhite,
  svgShipPink, svgShipGreyBlue, svgShipAmber, svgCarrier,
  svgWarning, svgThreat,
  svgPotusPlane, svgPotusHeli,
  svgAirlinerCyan, svgAirlinerDimCyan, svgAirlinerOrange, svgAirlinerPurple,
  svgAirlinerSlate, svgAirlinerYellow, svgAirlinerAmber,
  svgAirlinerPink, svgAirlinerRed, svgAirlinerDarkBlue, svgAirlinerBlue,
  svgAirlinerLime, svgAirlinerBlack, svgAirlinerWhite,
  svgTurbopropCyan, svgTurbopropDimCyan, svgTurbopropOrange, svgTurbopropPurple,
  svgTurbopropSlate, svgTurbopropYellow, svgTurbopropAmber,
  svgTurbopropPink, svgTurbopropRed, svgTurbopropDarkBlue, svgTurbopropBlue,
  svgTurbopropLime, svgTurbopropBlack, svgTurbopropWhite,
  svgBizjetCyan, svgBizjetDimCyan, svgBizjetOrange, svgBizjetPurple,
  svgBizjetSlate, svgBizjetYellow, svgBizjetAmber,
  svgBizjetPink, svgBizjetRed, svgBizjetDarkBlue, svgBizjetBlue,
  svgBizjetLime, svgBizjetBlack, svgBizjetWhite,
  svgAirlinerGrey, svgTurbopropGrey, svgBizjetGrey, svgHeliGrey,
  svgFireYellow, svgFireOrange, svgFireRed, svgFireDarkRed,
} from '@/components/map/icons/AircraftIcons';
import { makeSatSvg, makeISSSvg } from '@/components/map/icons/SatelliteIcons';

// ── Icon size in the atlas grid ────────────────────────────────────────────
const ICON_SIZE = 64;

// ── Full icon registry ─────────────────────────────────────────────────────
// Maps every iconId that the worker can emit → the SVG data URI string.
export const ICON_REGISTRY: Record<string, string> = {
  // Generic planes
  svgPlaneCyan,
  svgPlaneYellow,
  svgPlaneOrange,
  svgPlanePurple,
  svgPlanePink,
  svgPlaneAlertRed,
  svgPlaneDarkBlue,
  svgPlaneWhiteAlert,
  svgPlaneBlack,

  // Fighter / tanker / recon
  svgFighter,
  svgTanker,
  svgRecon,

  // Helis
  svgHeli,
  svgHeliCyan,
  svgHeliDimCyan,
  svgHeliOrange,
  svgHeliPurple,
  svgHeliSlate,
  svgHeliAmber,
  svgHeliPink,
  svgHeliAlertRed,
  svgHeliDarkBlue,
  svgHeliBlue,
  svgHeliLime,
  svgHeliWhiteAlert,
  svgHeliBlack,
  svgHeliGrey,

  // Airliners
  svgAirlinerCyan,
  svgAirlinerDimCyan,
  svgAirlinerOrange,
  svgAirlinerPurple,
  svgAirlinerSlate,
  svgAirlinerYellow,
  svgAirlinerAmber,
  svgAirlinerPink,
  svgAirlinerRed,
  svgAirlinerDarkBlue,
  svgAirlinerBlue,
  svgAirlinerLime,
  svgAirlinerBlack,
  svgAirlinerWhite,
  svgAirlinerGrey,

  // Turboprops
  svgTurbopropCyan,
  svgTurbopropDimCyan,
  svgTurbopropOrange,
  svgTurbopropPurple,
  svgTurbopropSlate,
  svgTurbopropYellow,
  svgTurbopropAmber,
  svgTurbopropPink,
  svgTurbopropRed,
  svgTurbopropDarkBlue,
  svgTurbopropBlue,
  svgTurbopropLime,
  svgTurbopropBlack,
  svgTurbopropWhite,
  svgTurbopropGrey,

  // Bizjets
  svgBizjetCyan,
  svgBizjetDimCyan,
  svgBizjetOrange,
  svgBizjetPurple,
  svgBizjetSlate,
  svgBizjetYellow,
  svgBizjetAmber,
  svgBizjetPink,
  svgBizjetRed,
  svgBizjetDarkBlue,
  svgBizjetBlue,
  svgBizjetLime,
  svgBizjetBlack,
  svgBizjetWhite,
  svgBizjetGrey,

  // Ships
  svgShipGray,
  svgShipRed,
  svgShipYellow,
  svgShipBlue,
  svgShipWhite,
  svgShipPink,
  svgShipGreyBlue,
  svgShipAmber,
  svgCarrier,

  // POTUS
  svgPotusPlane,
  svgPotusHeli,

  // Misc
  svgDrone,
  svgWarning,
  svgThreat,

  // NASA FIRMS fire hotspots (iconId in GeoJSON uses these keys)
  'fire-yellow': svgFireYellow,
  'fire-orange': svgFireOrange,
  'fire-red': svgFireRed,
  'fire-darkred': svgFireDarkRed,

  // Satellites — mission-type icons (iconId in GeoJSON uses these keys)
  'sat-gen': makeSatSvg('#aaaaaa'),
  'sat-mil': makeSatSvg('#ff3333'),
  'sat-sar': makeSatSvg('#00e5ff'),
  'sat-sigint': makeSatSvg('#ffffff'),
  'sat-nav': makeSatSvg('#4488ff'),
  'sat-ew': makeSatSvg('#ff00ff'),
  'sat-com': makeSatSvg('#44ff44'),
  'sat-station': makeSatSvg('#ffdd00'),
  'sat-iss': makeISSSvg(),
};

// ── Types ──────────────────────────────────────────────────────────────────

export interface IconMapping {
  x: number;
  y: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  mask: boolean;
}

export interface IconAtlasResult {
  // ImageBitmap is passed directly to deck.gl's IconLayer iconAtlas prop —
  // avoids the data-URL encode/decode path and uploads cleanly as a GPU texture.
  atlas: ImageBitmap;
  mapping: Record<string, IconMapping>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function loadSvgImage(dataUri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUri;
  });
}

// ── Builder ────────────────────────────────────────────────────────────────

export async function buildIconAtlas(): Promise<IconAtlasResult> {
  const ids = Object.keys(ICON_REGISTRY);
  const cols = Math.ceil(Math.sqrt(ids.length));
  const rows = Math.ceil(ids.length / cols);

  const canvasWidth = cols * ICON_SIZE;
  const canvasHeight = rows * ICON_SIZE;

  // Use a regular HTMLCanvasElement so we can export a data URL string.
  // deck.gl's IconLayer iconAtlas prop accepts a string URL — this ensures
  // the standard async load path runs, which creates a proper GPU texture.
  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d')!;

  const mapping: Record<string, IconMapping> = {};

  await Promise.all(
    ids.map(async (id, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = col * ICON_SIZE;
      const y = row * ICON_SIZE;

      try {
        const img = await loadSvgImage(ICON_REGISTRY[id]);
        ctx.drawImage(img, x, y, ICON_SIZE, ICON_SIZE);
      } catch {
        // Draw a fallback red square if the SVG fails to load
        ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.fillRect(x, y, ICON_SIZE, ICON_SIZE);
      }

      mapping[id] = {
        x,
        y,
        width: ICON_SIZE,
        height: ICON_SIZE,
        anchorX: ICON_SIZE / 2,
        anchorY: ICON_SIZE / 2,
        mask: false,
      };
    }),
  );

  // Convert the canvas to an ImageBitmap — deck.gl's texture system accepts this
  // directly without an encode/decode round-trip through a data URL.
  const bitmap = await createImageBitmap(canvas);
  return { atlas: bitmap, mapping };
}

// ── Singleton cache ────────────────────────────────────────────────────────

let cachedAtlasPromise: Promise<IconAtlasResult> | null = null;

export function getIconAtlas(): Promise<IconAtlasResult> {
  if (!cachedAtlasPromise) {
    cachedAtlasPromise = buildIconAtlas();
  }
  return cachedAtlasPromise;
}
