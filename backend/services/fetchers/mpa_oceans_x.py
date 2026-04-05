"""
MPA Oceans-X vessel positions snapshot — Singapore Maritime Port Authority.

Endpoint: https://oceans-x.mpa.gov.sg/api/v1/vessel/positions/1.0.0/snapshot
Auth:     apikey header using OCEANS_X_API_KEY from environment
Poll:     every 3 minutes

Vessels from this source are always within Singapore port area so they are
tagged source='mpa_oceans_x' — the frontend skips distance/zoom thinning for
that source tag.  They are merged into the ships layer, deduplicated by MMSI
(aisstream data takes precedence where both have the same vessel).
"""

import logging
import os
import threading
import time

from services.network_utils import fetch_with_curl
from services.ais_stream import classify_vessel, get_country_from_mmsi

logger = logging.getLogger(__name__)

_API_KEY     = os.environ.get("OCEANS_X_API_KEY", "")
_VESSELS_URL = "https://oceans-x.mpa.gov.sg/api/v1/vessel/positions/1.0.0/snapshot"
_POLL_INTERVAL_S = 180  # 3 minutes

_cache: list[dict] = []
_cache_time: float = 0.0
_cache_lock = threading.Lock()


def _fetch_raw() -> list | dict | None:
    """Call the snapshot endpoint and return parsed JSON, or None on error."""
    if not _API_KEY:
        return None
    try:
        headers = {
            "apikey": _API_KEY,
            "Accept": "application/json",
        }
        resp = fetch_with_curl(_VESSELS_URL, headers=headers, timeout=20)
        if resp.status_code == 200:
            return resp.json()
        if resp.status_code == 401:
            logger.warning("MPA Oceans-X: 401 Unauthorized — check OCEANS_X_API_KEY")
        elif resp.status_code == 403:
            logger.warning("MPA Oceans-X: 403 Forbidden — key may lack snapshot permission")
        elif resp.status_code == 429:
            logger.warning("MPA Oceans-X: 429 rate-limited")
        else:
            logger.warning("MPA Oceans-X: HTTP %d — %s", resp.status_code, resp.text[:200])
    except Exception as e:
        logger.warning("MPA Oceans-X: fetch error: %s", e)
    return None


_MPA_VTYPE_MAP = {
    # MPA internal vessel-type string → Catto category
    # Based on MPA vessel type codes; map to the closest AIS-style bucket
    "TK": "tanker",   "TA": "tanker",   "TC": "tanker",   "TO": "tanker",
    "TG": "tanker",   "TP": "tanker",   "TN": "tanker",
    "CA": "cargo",    "CO": "cargo",    "CC": "cargo",    "CB": "cargo",
    "CF": "cargo",    "CG": "cargo",    "CH": "cargo",    "CM": "cargo",
    "CR": "cargo",    "CS": "cargo",    "CT": "cargo",    "CU": "cargo",
    "CV": "cargo",    "CX": "cargo",    "GC": "cargo",    "BC": "cargo",
    "PA": "passenger","PF": "passenger","PS": "passenger",
    "FE": "passenger","RO": "passenger",
    "YA": "yacht",    "YS": "yacht",    "YP": "yacht",
    "WA": "military_vessel", "NA": "military_vessel",
}


def _classify_mpa_type(vtype_code: str, mmsi: int) -> str:
    """Map MPA vessel-type code to Catto vessel category."""
    return _MPA_VTYPE_MAP.get(vtype_code.upper(), classify_vessel(0, mmsi))


def _normalize(raw) -> list[dict]:
    """
    Convert the Oceans-X snapshot response to the standard vessel dict format.

    Actual response shape (confirmed April 2026):
      Bare list of objects, each:
      {
        "vesselParticulars": {
          "vesselName": "...", "callSign": "...", "imoNumber": "...",
          "mmsiNumber": "...",  # string MMSI
          "vesselType": "TA",   # MPA string code, NOT AIS integer
          "flag": "SG", ...
        },
        "latitudeDegrees": 1.304,   # decimal degrees — use this, NOT "latitude" (radians)
        "longitudeDegrees": 103.754,
        "speed": 0.0,
        "course": 0.0,
        "heading": 0,
        "timeStamp": "2026-04-02 02:47:11"
      }
    """
    now = time.time()
    items: list = []

    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, dict):
        for key in ("VesselPositions", "vesselPositions", "vessels", "data", "items"):
            if isinstance(raw.get(key), list):
                items = raw[key]
                break

    if not items:
        logger.debug("MPA Oceans-X: empty or unrecognised response: %s", str(raw)[:300])
        return []

    result = []
    for item in items:
        if not isinstance(item, dict):
            continue
        try:
            vp = item.get("vesselParticulars") or {}

            mmsi = int(vp.get("mmsiNumber") or item.get("mmsi") or 0)
            if not mmsi:
                continue

            # Prefer the pre-converted degree fields; "latitude"/"longitude" are in radians
            lat = float(item.get("latitudeDegrees") or item.get("latitude_deg") or 0)
            lng = float(item.get("longitudeDegrees") or item.get("longitude_deg") or 0)
            if lat == 0.0 and lng == 0.0:
                continue
            if abs(lat) > 90 or abs(lng) > 180:
                continue

            name = str(vp.get("vesselName") or item.get("vesselName") or "UNKNOWN").strip() or "UNKNOWN"

            sog = float(item.get("speed") or item.get("sog") or 0)
            if sog >= 102.2:
                sog = 0.0
            cog = float(item.get("course") or item.get("cog") or 0)
            raw_hdg = float(item.get("heading") or 511)
            heading = raw_hdg if raw_hdg not in (511, 511.0) else cog

            vtype_code = str(vp.get("vesselType") or "").strip()
            imo = int(vp.get("imoNumber") or item.get("imo") or 0)
            callsign = str(vp.get("callSign") or "").strip()
            flag = str(vp.get("flag") or "").strip()

            result.append({
                "mmsi": mmsi,
                "name": name,
                "type": _classify_mpa_type(vtype_code, mmsi),
                "lat": round(lat, 5),
                "lng": round(lng, 5),
                "heading": round(heading, 1),
                "sog": round(sog, 1),
                "cog": round(cog, 1),
                "callsign": callsign,
                "destination": "UNKNOWN",
                "imo": imo,
                "country": flag or get_country_from_mmsi(mmsi),
                "source": "mpa_oceans_x",
                "_updated": now,
            })
        except (ValueError, TypeError, KeyError):
            continue

    return result


def get_mpa_vessels() -> list[dict]:
    """
    Return cached MPA vessel positions, refreshing if the cache is stale.
    Returns [] silently when OCEANS_X_API_KEY is not configured.
    """
    global _cache, _cache_time

    if not _API_KEY:
        return []

    now = time.time()
    with _cache_lock:
        if now - _cache_time < _POLL_INTERVAL_S:
            return list(_cache)

    raw = _fetch_raw()
    if raw is not None:
        vessels = _normalize(raw)
        with _cache_lock:
            _cache = vessels
            _cache_time = time.time()
        logger.info("MPA Oceans-X: %d vessels in Singapore port area", len(vessels))
        return vessels

    # On failure return stale cache (better than empty) without resetting the timer,
    # so the next call retries immediately rather than waiting another 3 minutes.
    with _cache_lock:
        return list(_cache)
