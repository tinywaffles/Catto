"""
VesselFinder public map scrape — fallback vessel source for Singapore Strait.

Used when aisstream.io WebSocket delivers zero vessels (currently broken, March–April 2026).
Polls VesselFinder's public map endpoint every 45s for bbox 1.0N–1.5N, 103.5E–104.5E.

Integration: geo.py merges these into the ships list, deduplicating by MMSI against
any aisstream.io vessels. Once aisstream.io recovers (start returning vessels), this
fallback is silently superseded — aisstream data takes precedence per MMSI.

To remove: delete this file and remove the import/merge block in geo.py (marked FALLBACK).
"""

import logging
import time
import threading

from services.network_utils import fetch_with_curl
from services.ais_stream import classify_vessel, get_country_from_mmsi

logger = logging.getLogger(__name__)

# Singapore Strait bounding box
_SG_MINLAT = 1.0
_SG_MINLON = 103.5
_SG_MAXLAT = 1.5
_SG_MAXLON = 104.5

# Poll no more than once every 45 seconds
_POLL_INTERVAL_S = 45

_cache: list[dict] = []
_cache_time: float = 0.0
_cache_lock = threading.Lock()

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Referer": "https://www.vesselfinder.com/",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "en-US,en;q=0.9",
    "X-Requested-With": "XMLHttpRequest",
}


def _fetch_raw() -> list:
    """
    VesselFinder /vesselsonmap endpoint returns 404 as of April 2026 — their public
    map scrape endpoint has been removed or moved behind auth.  This function is a
    no-op stub kept so the module can be re-activated if a working endpoint is found.
    MPA Oceans-X (mpa_oceans_x.py) now covers Singapore vessel data.
    """
    return []


def _normalize_item(item, now: float) -> dict | None:
    """
    Convert one VesselFinder item to the ais_stream vessel dict format.

    VesselFinder's vesselsonmap returns one of two shapes depending on zoom/version:
      - List (positional): [mmsi, lat, lon, name, speed*10, course*10, imo, type, callsign, ...]
      - Dict (object):     {"MMSI":…, "LAT":…, "LON":…, "NAME":…, …}
      - Nested dict:       {"AIS": {"MMSI":…, …}, "CALLSIGN":…, …}
    """
    try:
        if isinstance(item, list):
            # Positional array — VesselFinder scales speed×10, course×10
            if len(item) < 4:
                return None
            mmsi = int(item[0])
            lat = float(item[1])
            lng = float(item[2])
            name = str(item[3]).strip() if len(item) > 3 else "UNKNOWN"
            # Speed and course are ×10 in some versions, raw floats in others
            raw_speed = float(item[4]) if len(item) > 4 else 0
            sog = raw_speed / 10.0 if raw_speed > 102 else raw_speed
            raw_course = float(item[5]) if len(item) > 5 else 0
            cog = raw_course / 10.0 if raw_course > 360 else raw_course
            imo = int(item[6]) if len(item) > 6 else 0
            ais_type = int(item[7]) if len(item) > 7 else 0
            callsign = str(item[8]).strip() if len(item) > 8 else ""
        elif isinstance(item, dict):
            # Object form — look under "AIS" nested key or flat
            ais = item.get("AIS") or item
            mmsi = int(ais.get("MMSI") or ais.get("mmsi") or 0)
            lat = float(ais.get("LAT") or ais.get("lat") or 0)
            lng = float(ais.get("LON") or ais.get("lon") or 0)
            name = str(ais.get("NAME") or ais.get("name") or "UNKNOWN").strip()
            sog = float(ais.get("SPEED") or ais.get("speed") or 0)
            cog = float(ais.get("COURSE") or ais.get("cog") or 0)
            imo = int(ais.get("IMO") or ais.get("imo") or 0)
            ais_type = int(ais.get("TYPE") or ais.get("type") or 0)
            callsign = str(item.get("CALLSIGN") or ais.get("CALLSIGN") or ais.get("callsign") or "").strip()
        else:
            return None

        if not mmsi:
            return None
        # Reject invalid/placeholder coordinates
        if lat == 0.0 and lng == 0.0:
            return None
        if abs(lat) > 90 or abs(lng) > 180:
            return None
        # AIS 102.3 kn = "speed not available"
        if sog >= 102.2:
            sog = 0.0
        if not name or name.upper() in ("", "@@@@@@@@@@@@@@@", "UNKNOWN", "N/A"):
            name = "UNKNOWN"

        return {
            "mmsi": mmsi,
            "name": name or "UNKNOWN",
            "type": classify_vessel(ais_type, mmsi),
            "lat": round(lat, 5),
            "lng": round(lng, 5),
            "heading": cog,   # VesselFinder map view rarely carries true heading
            "sog": round(sog, 1),
            "cog": round(cog, 1),
            "callsign": callsign,
            "destination": "UNKNOWN",
            "imo": imo,
            "country": get_country_from_mmsi(mmsi),
            "_source": "vesselfinder_fallback",
            "_updated": now,
        }
    except (ValueError, TypeError, KeyError, IndexError):
        return None


def _parse(raw: list) -> list[dict]:
    now = time.time()
    vessels = []
    for item in raw:
        v = _normalize_item(item, now)
        if v:
            vessels.append(v)
    return vessels


def get_fallback_vessels() -> list[dict]:
    """
    Return cached fallback vessels for the Singapore Strait, refreshing if stale.
    Thread-safe; returns the previous cache while a refresh is in progress.
    """
    global _cache, _cache_time

    now = time.time()
    with _cache_lock:
        if now - _cache_time < _POLL_INTERVAL_S:
            return list(_cache)

    raw = _fetch_raw()
    vessels = _parse(raw)

    with _cache_lock:
        _cache = vessels
        _cache_time = time.time()

    if vessels:
        logger.info(f"VesselFinder fallback: {len(vessels)} vessels in Singapore Strait")
    else:
        logger.debug("VesselFinder fallback: 0 vessels returned (response may be empty or format changed)")

    return vessels
