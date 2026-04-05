export const darkStyle = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

/** Satellite base style — Esri World Imagery raster tiles + imagery-ceiling slot baked in.
 *  Used when highres_satellite is active so data layers always render on top without any
 *  imperative layer injection or beforeId timing race. */
export const satelliteStyle = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    'esri-imagery': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 18,
      attribution: 'Esri, Maxar, Earthstar Geographics',
    },
  },
  layers: [
    { id: 'esri-imagery-layer', type: 'raster', source: 'esri-imagery', minzoom: 0, maxzoom: 22 },
    { id: 'imagery-ceiling', type: 'background', paint: { 'background-opacity': 0 } },
  ],
} as const;

export const lightStyle = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    'carto-light': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
    },
  },
  layers: [
    { id: 'carto-light-layer', type: 'raster', source: 'carto-light', minzoom: 0, maxzoom: 22 },
    { id: 'imagery-ceiling', type: 'background', paint: { 'background-opacity': 0 } },
  ],
};
