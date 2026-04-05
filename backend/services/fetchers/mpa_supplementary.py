"""
MPA Oceans-X supplementary data fetchers.
Base URL: https://oceans-x.mpa.gov.sg/api/v1
Auth: apikey header using OCEANS_X_API_KEY

Endpoints polled here (vessel positions handled separately in mpa_oceans_x.py):
  /vessel/arrivals/1.0.0/date/{today}             — 10 min
  /vessel/departures/1.0.0/date/{today}            — 10 min
  /vessel/departure-declarations/1.0.0/pastNhours/6 — 10 min
  /vessel/due-arrivals/1.0.0/date/{today}          — 10 min
  /vessel/due-departures/1.0.0/date/{today}        — 10 min
  /vessel/types/1.0.0/filetype/json                — 24 h (startup cache)
  /weather/1.0.0/4day-forecasts                    — 15 min
  /weather/1.0.0/wind-direction-readings           — 5 min

On-demand (not polled):
  /vessel/particulars/1.0.0/callsign/{callsign}
"""

import logging
import os
import threading
import time
from datetime import datetime, timezone

from services.network_utils import fetch_with_curl

logger = logging.getLogger(__name__)

_API_KEY  = os.environ.get("OCEANS_X_API_KEY", "")
_BASE_URL = "https://oceans-x.mpa.gov.sg/api/v1"

# ── Cache intervals ────────────────────────────────────────────────────────
_TTL_ARRIVALS = 600    # 10 min
_TTL_DEPARTURES = 600
_TTL_DECL = 600
_TTL_VTYPES = 86400    # 24 h
_TTL_WEATHER = 900     # 15 min
_TTL_WIND = 300        # 5 min

# ── Thread-safe per-key caches ─────────────────────────────────────────────
_lock = threading.Lock()

_arrivals_cache:      list  = []
_arrivals_ts:         float = 0.0
_departures_cache:    list  = []
_departures_ts:       float = 0.0
_decl_cache:          list  = []
_decl_ts:             float = 0.0
_due_arrivals_cache:  list  = []
_due_arrivals_ts:     float = 0.0
_due_departures_cache: list = []
_due_departures_ts:   float = 0.0
_vtypes_cache:        dict  = {}
_vtypes_ts:           float = 0.0
_weather_cache:       list  = []
_weather_ts:          float = 0.0
_wind_cache:          list  = []
_wind_ts:             float = 0.0


def _headers() -> dict:
    return {"apikey": _API_KEY, "Accept": "application/json"}


def _get(path: str, timeout: int = 15) -> list | dict | None:
    """GET {_BASE_URL}/{path} with apikey header. Returns parsed JSON or None."""
    if not _API_KEY:
        return None
    url = f"{_BASE_URL}/{path.lstrip('/')}"
    try:
        resp = fetch_with_curl(url, headers=_headers(), timeout=timeout)
        if resp.status_code == 200:
            return resp.json()
        if resp.status_code == 401:
            logger.warning("MPA Supplementary: 401 on %s — check OCEANS_X_API_KEY", path)
        elif resp.status_code == 404:
            logger.debug("MPA Supplementary: 404 on %s (may be no data today)", path)
        else:
            logger.warning("MPA Supplementary: HTTP %d on %s", resp.status_code, path)
    except Exception as e:
        logger.warning("MPA Supplementary fetch error (%s): %s", path, e)
    return None


def _today_sg() -> str:
    """Return today's date in SGT as YYYY-MM-DD."""
    from datetime import timezone as _tz
    import zoneinfo
    try:
        sg = zoneinfo.ZoneInfo("Asia/Singapore")
        return datetime.now(sg).strftime("%Y-%m-%d")
    except Exception:
        # Fallback: SGT = UTC+8
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _to_list(raw) -> list:
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        for k in ("data", "Data", "items", "Items", "vessels", "Vessels",
                  "arrivals", "departures", "declarations", "forecasts", "readings"):
            if isinstance(raw.get(k), list):
                return raw[k]
    return []


# ── Vessel types ─────────────────────────────────────────────────────────────

def fetch_vessel_types() -> dict:
    """Return cached vessel type code → description dict.  Refreshed every 24h."""
    global _vtypes_cache, _vtypes_ts
    with _lock:
        if _vtypes_cache and time.time() - _vtypes_ts < _TTL_VTYPES:
            return dict(_vtypes_cache)

    raw = _get("vessel/types/1.0.0/filetype/json")
    mapping: dict = {}
    if raw:
        items = _to_list(raw) if isinstance(raw, (list, dict)) else []
        # Response can be a list of {"code": "TA", "description": "..."} or a plain dict
        if isinstance(raw, dict) and not items:
            # Flat dict: {"TA": "Tanker", ...}
            mapping = {k: v for k, v in raw.items() if isinstance(v, str)}
        else:
            for item in items:
                if isinstance(item, dict):
                    code = str(item.get("code") or item.get("typeCode") or item.get("vesselTypeCode") or "").strip()
                    desc = str(item.get("description") or item.get("typeName") or item.get("vesselTypeName") or "").strip()
                    if code and desc:
                        mapping[code] = desc

    if mapping:
        with _lock:
            _vtypes_cache = mapping
            _vtypes_ts = time.time()
        logger.info("MPA vessel types cached: %d codes", len(mapping))
    else:
        logger.debug("MPA vessel types: empty or unrecognised response")

    return mapping


def get_vessel_type_name(code: str) -> str:
    """Map a short type code (e.g. 'TA') to its full description."""
    with _lock:
        return _vtypes_cache.get(code.upper(), code)


# ── Arrivals / Departures ────────────────────────────────────────────────────

def _normalise_vessel_entry(item: dict) -> dict:
    """Flatten a vessel arrival/departure record into a simple dict."""
    vp = item.get("vesselParticulars") or {}
    return {
        "vesselName":  str(vp.get("vesselName")  or item.get("vesselName")  or "UNKNOWN").strip(),
        "callSign":    str(vp.get("callSign")     or item.get("callSign")    or "").strip(),
        "imoNumber":   str(vp.get("imoNumber")    or item.get("imoNumber")   or "").strip(),
        "mmsi":        str(vp.get("mmsiNumber")   or item.get("mmsi")        or "").strip(),
        "vesselType":  str(vp.get("vesselType")   or item.get("vesselType")  or "").strip(),
        "flag":        str(vp.get("flag")         or item.get("flag")        or "").strip(),
        "eta":         str(item.get("eta")         or item.get("ETA")         or "").strip(),
        "etd":         str(item.get("etd")         or item.get("ETD")         or "").strip(),
        "berth":       str(item.get("berth")       or item.get("berthName")   or "").strip(),
        "terminal":    str(item.get("terminal")    or item.get("terminalName") or "").strip(),
        "agent":       str(item.get("agent")       or item.get("agentName")   or "").strip(),
        "timestamp":   str(item.get("timeStamp")   or item.get("timestamp")   or "").strip(),
    }


def fetch_arrivals() -> list:
    global _arrivals_cache, _arrivals_ts, _due_arrivals_cache, _due_arrivals_ts
    today = _today_sg()
    now = time.time()
    stale_arr = now - _arrivals_ts > _TTL_ARRIVALS
    stale_due = now - _due_arrivals_ts > _TTL_ARRIVALS

    if not stale_arr and not stale_due:
        with _lock:
            return list(_arrivals_cache) + list(_due_arrivals_cache)

    arr, due_arr = [], []
    if stale_arr:
        raw = _get(f"vessel/arrivals/1.0.0/date/{today}")
        arr = [_normalise_vessel_entry(i) for i in _to_list(raw) if isinstance(i, dict)]
        with _lock:
            _arrivals_cache = arr
            _arrivals_ts = now
    if stale_due:
        raw = _get(f"vessel/due-arrivals/1.0.0/date/{today}")
        due_arr = [_normalise_vessel_entry(i) for i in _to_list(raw) if isinstance(i, dict)]
        with _lock:
            _due_arrivals_cache = due_arr
            _due_arrivals_ts = now

    total = arr + due_arr
    logger.info("MPA arrivals: %d arrived + %d due", len(arr), len(due_arr))
    return total


def fetch_departures() -> list:
    global _departures_cache, _departures_ts, _due_departures_cache, _due_departures_ts
    today = _today_sg()
    now = time.time()
    stale_dep = now - _departures_ts > _TTL_DEPARTURES
    stale_due = now - _due_departures_ts > _TTL_DEPARTURES

    if not stale_dep and not stale_due:
        with _lock:
            return list(_departures_cache) + list(_due_departures_cache)

    dep, due_dep = [], []
    if stale_dep:
        raw = _get(f"vessel/departures/1.0.0/date/{today}")
        dep = [_normalise_vessel_entry(i) for i in _to_list(raw) if isinstance(i, dict)]
        with _lock:
            _departures_cache = dep
            _departures_ts = now
    if stale_due:
        raw = _get(f"vessel/due-departures/1.0.0/date/{today}")
        due_dep = [_normalise_vessel_entry(i) for i in _to_list(raw) if isinstance(i, dict)]
        with _lock:
            _due_departures_cache = due_dep
            _due_departures_ts = now

    total = dep + due_dep
    logger.info("MPA departures: %d departed + %d due", len(dep), len(due_dep))
    return total


def fetch_departure_declarations() -> list:
    global _decl_cache, _decl_ts
    now = time.time()
    with _lock:
        if _decl_cache and now - _decl_ts < _TTL_DECL:
            return list(_decl_cache)

    raw = _get("vessel/departure-declarations/1.0.0/pastNhours/6")
    items = [_normalise_vessel_entry(i) for i in _to_list(raw) if isinstance(i, dict)]
    with _lock:
        _decl_cache = items
        _decl_ts = now
    logger.info("MPA departure declarations: %d in past 6h", len(items))
    return items


# ── Weather ───────────────────────────────────────────────────────────────────

def fetch_weather_4day() -> list:
    global _weather_cache, _weather_ts
    now = time.time()
    with _lock:
        if _weather_cache and now - _weather_ts < _TTL_WEATHER:
            return list(_weather_cache)

    raw = _get("weather/1.0.0/4day-forecasts")
    items = _to_list(raw) if raw else []
    with _lock:
        _weather_cache = items
        _weather_ts = now
    logger.info("MPA 4-day weather: %d forecast entries", len(items))
    return items


def fetch_wind_readings() -> list:
    global _wind_cache, _wind_ts
    now = time.time()
    with _lock:
        if _wind_cache and now - _wind_ts < _TTL_WIND:
            return list(_wind_cache)

    raw = _get("weather/1.0.0/wind-direction-readings")
    items: list = []
    raw_list = _to_list(raw) if raw else []
    for item in raw_list:
        if not isinstance(item, dict):
            continue
        try:
            lat = float(item.get("latitude") or item.get("lat") or item.get("latitudeDegrees") or 0)
            lng = float(item.get("longitude") or item.get("lon") or item.get("longitudeDegrees") or 0)
            if lat == 0 and lng == 0:
                continue
            items.append({
                "stationId":   str(item.get("stationId")   or item.get("id")     or "").strip(),
                "stationName": str(item.get("stationName") or item.get("name")   or "").strip(),
                "lat":         round(lat, 5),
                "lng":         round(lng, 5),
                "direction":   float(item.get("windDirection") or item.get("direction") or 0),
                "speed":       float(item.get("windSpeed")    or item.get("speed")     or 0),
                "unit":        str(item.get("unit")           or "knots").strip(),
                "timestamp":   str(item.get("timeStamp")      or item.get("timestamp") or "").strip(),
            })
        except (ValueError, TypeError):
            continue

    with _lock:
        _wind_cache = items
        _wind_ts = now
    logger.info("MPA wind readings: %d stations", len(items))
    return items


# ── Vessel particulars (on-demand) ────────────────────────────────────────────

def get_vessel_particulars(callsign: str) -> dict | None:
    """Fetch vessel particulars by callsign. Not cached — called on user demand."""
    if not callsign or not _API_KEY:
        return None
    raw = _get(f"vessel/particulars/1.0.0/callsign/{callsign.upper().strip()}")
    if not raw:
        return None
    # Response might be a list or a dict
    if isinstance(raw, list) and raw:
        raw = raw[0]
    if isinstance(raw, dict):
        vp = raw.get("vesselParticulars") or raw
        return {
            "vesselName":    str(vp.get("vesselName")    or "").strip(),
            "callSign":      str(vp.get("callSign")      or callsign).strip(),
            "imoNumber":     str(vp.get("imoNumber")     or "").strip(),
            "mmsi":          str(vp.get("mmsiNumber")    or "").strip(),
            "flag":          str(vp.get("flag")          or "").strip(),
            "vesselType":    str(vp.get("vesselType")    or "").strip(),
            "vesselLength":  vp.get("vesselLength"),
            "vesselBreadth": vp.get("vesselBreadth"),
            "grossTonnage":  vp.get("grossTonnage"),
            "deadweight":    vp.get("deadweight"),
            "yearBuilt":     str(vp.get("yearBuilt")     or "").strip(),
            "operator":      str(vp.get("operator")      or raw.get("operator") or "").strip(),
        }
    return None


# ── Master refresh (called by slow-tier scheduler) ────────────────────────────

def fetch_all_supplementary():
    """Run all supplementary fetchers and store results in _store.latest_data."""
    if not _API_KEY:
        return

    from services.fetchers._store import latest_data, _data_lock, _mark_fresh

    try:
        arrivals = fetch_arrivals()
        with _data_lock:
            latest_data["mpa_arrivals"] = arrivals
        if arrivals:
            _mark_fresh("mpa_arrivals")
    except Exception as e:
        logger.warning("MPA arrivals fetch failed: %s", e)

    try:
        departures = fetch_departures()
        with _data_lock:
            latest_data["mpa_departures"] = departures
        if departures:
            _mark_fresh("mpa_departures")
    except Exception as e:
        logger.warning("MPA departures fetch failed: %s", e)

    try:
        decls = fetch_departure_declarations()
        with _data_lock:
            latest_data["mpa_departure_declarations"] = decls
        if decls:
            _mark_fresh("mpa_departure_declarations")
    except Exception as e:
        logger.warning("MPA departure declarations fetch failed: %s", e)

    try:
        wx = fetch_weather_4day()
        with _data_lock:
            latest_data["mpa_weather_4day"] = wx
        if wx:
            _mark_fresh("mpa_weather_4day")
    except Exception as e:
        logger.warning("MPA weather 4-day fetch failed: %s", e)

    try:
        wind = fetch_wind_readings()
        with _data_lock:
            latest_data["mpa_wind_readings"] = wind
        if wind:
            _mark_fresh("mpa_wind_readings")
    except Exception as e:
        logger.warning("MPA wind readings fetch failed: %s", e)

    # Vessel types — refresh if stale (24h TTL enforced inside fetch_vessel_types)
    try:
        vt = fetch_vessel_types()
        with _data_lock:
            latest_data["mpa_vessel_types"] = vt
        if vt:
            _mark_fresh("mpa_vessel_types")
    except Exception as e:
        logger.warning("MPA vessel types fetch failed: %s", e)
