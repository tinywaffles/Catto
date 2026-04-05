// ─── Watchlist entity tracking types ─────────────────────────────────────────

export interface WatchlistEntry {
  id: string;
  query: string;    // user-supplied search string
  addedAt: number;  // epoch ms
  // Optional metadata saved from aircraft popup
  callsign?: string;
  registration?: string;
  aircraftType?: string;
}

export interface WatchedEntity {
  watchId: string;       // id of the WatchlistEntry that produced this match
  query: string;         // original query string
  entityType: 'flight' | 'ship';
  key: string;           // unique dedup key (callsign or mmsi.toString())
  label: string;         // primary display name
  subLabel?: string;     // aircraft model / vessel type / force
  lat: number;
  lng: number;
  altitude?: number;     // ft (flights)
  speed?: number;        // knots
  heading?: number;      // degrees true
  origin?: string;       // airport code or name
  destination?: string;  // airport code, port, or destination name
  registration?: string; // tail number
  country?: string;
  etaStr?: string;       // computed ETA e.g. "2h 15m"
  color: string;         // hex color for map highlight ring
}
