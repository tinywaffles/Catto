"""Regional feeds — Malaysia + SEA supplementary data sources.

Fetchers:
  - MetMalaysia: weather and rainfall for Malaysia (open data, no key)
  - CWA Taiwan: earthquake + typhoon alerts (api.cwa.gov.tw, no key for basic)
  - ReliefWeb: humanitarian crisis data covering SEA (free)
  - ACAPS: crisis severity data (free, public endpoint)
"""

import logging
import threading
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

try:
    import requests
    _REQUESTS_OK = True
except ImportError:
    _REQUESTS_OK = False

_TIMEOUT = 15
_lock = threading.Lock()

# ---------------------------------------------------------------------------
# Shared store references
# ---------------------------------------------------------------------------
from services.fetchers._store import latest_data, _data_lock, _mark_fresh


# ---------------------------------------------------------------------------
# MetMalaysia — open data weather API
# Docs: https://api.met.gov.my/
# ---------------------------------------------------------------------------

def fetch_metmalaysia_weather():
    """Fetch current weather observations from MetMalaysia stations."""
    if not _REQUESTS_OK:
        return

    try:
        # MetMalaysia open data — weather station observations (no key)
        url = "https://api.met.gov.my/v2.1/data?datasetid=OBS_STATION&datacategoryid=WEATHER&limit=200&startdate=TODAY&enddate=TODAY"
        resp = requests.get(url, timeout=_TIMEOUT, headers={"User-Agent": "CattoOSINT/8.0"})

        items = []
        if resp.status_code == 200:
            raw = resp.json()
            results = raw.get("results", []) if isinstance(raw, dict) else raw
            for r in results:
                try:
                    items.append({
                        "id": str(r.get("stationid") or r.get("station_id") or ""),
                        "name": r.get("stationname") or r.get("station_name") or "Malaysia Station",
                        "lat": float(r.get("latitude") or r.get("lat") or 0),
                        "lng": float(r.get("longitude") or r.get("lon") or r.get("lng") or 0),
                        "temp_c": r.get("temperature"),
                        "rainfall_mm": r.get("rainfall"),
                        "humidity_pct": r.get("humidity"),
                        "wind_speed": r.get("wind_speed"),
                        "wind_dir": r.get("wind_direction"),
                        "source": "MetMalaysia",
                        "type": "weather_station",
                        "timestamp": r.get("date") or datetime.now(timezone.utc).isoformat(),
                    })
                except Exception:
                    continue

        if not items:
            # Fallback: static representative Malaysia stations
            items = _malaysia_fallback_stations()

        with _data_lock:
            latest_data["regional_weather"] = items  # type: ignore[typeddict-unknown-key]
        _mark_fresh("regional_weather")
        logger.info("MetMalaysia: %d weather stations", len(items))

    except Exception as e:
        logger.warning("MetMalaysia fetch failed: %s", e)
        with _data_lock:
            if not latest_data.get("regional_weather"):  # type: ignore[typeddict-unknown-key]
                latest_data["regional_weather"] = _malaysia_fallback_stations()  # type: ignore[typeddict-unknown-key]


def _malaysia_fallback_stations() -> list:
    """Static Malaysia weather station locations for offline/error fallback."""
    return [
        {"id": "MY001", "name": "Kuala Lumpur (WMKK)", "lat": 3.1412, "lng": 101.6865, "source": "MetMalaysia", "type": "weather_station"},
        {"id": "MY002", "name": "Penang (WMKP)", "lat": 5.3000, "lng": 100.2767, "source": "MetMalaysia", "type": "weather_station"},
        {"id": "MY003", "name": "Johor Bahru", "lat": 1.4927, "lng": 103.7414, "source": "MetMalaysia", "type": "weather_station"},
        {"id": "MY004", "name": "Kota Kinabalu (WBKK)", "lat": 5.9275, "lng": 116.0518, "source": "MetMalaysia", "type": "weather_station"},
        {"id": "MY005", "name": "Kuching (WBGG)", "lat": 1.4803, "lng": 110.3364, "source": "MetMalaysia", "type": "weather_station"},
        {"id": "MY006", "name": "Ipoh (WMKI)", "lat": 4.5679, "lng": 101.0964, "source": "MetMalaysia", "type": "weather_station"},
    ]


# ---------------------------------------------------------------------------
# CWA Taiwan — earthquake + typhoon alerts
# Docs: https://opendata.cwa.gov.tw/dist/opendata-swagger.html
# No authorization key required for public endpoints
# ---------------------------------------------------------------------------

def fetch_cwa_taiwan():
    """Fetch Taiwan earthquake and typhoon alerts from CWA open data."""
    if not _REQUESTS_OK:
        return

    items = []

    # Earthquake alerts (last 30 days, no key)
    try:
        eq_url = "https://opendata.cwa.gov.tw/api/v1/rest/datastore/E-A0015-001?format=JSON&limit=20"
        resp = requests.get(eq_url, timeout=_TIMEOUT, headers={"User-Agent": "CattoOSINT/8.0"})
        if resp.status_code == 200:
            raw = resp.json()
            records = (raw.get("records") or {})
            eq_list = records.get("earthquake") or []
            for eq in eq_list:
                try:
                    info = eq.get("EarthquakeInfo") or {}
                    epicenter = info.get("Epicenter") or {}
                    mag = info.get("EarthquakeMagnitude") or {}
                    loc = epicenter.get("Location") or ""
                    lat = float(epicenter.get("EpicenterLatitude") or 0)
                    lng = float(epicenter.get("EpicenterLongitude") or 0)
                    if not lat or not lng:
                        continue
                    items.append({
                        "id": str(eq.get("EarthquakeNo") or ""),
                        "type": "earthquake_alert",
                        "source": "CWA Taiwan",
                        "lat": lat,
                        "lng": lng,
                        "magnitude": float(mag.get("MagnitudeValue") or 0),
                        "depth_km": float(info.get("FocalDepth") or 0),
                        "location": loc,
                        "timestamp": eq.get("OriginTime") or datetime.now(timezone.utc).isoformat(),
                        "severity": "high" if float(mag.get("MagnitudeValue") or 0) >= 5.5 else "medium",
                    })
                except Exception:
                    continue
    except Exception as e:
        logger.warning("CWA earthquake fetch failed: %s", e)

    # Typhoon/tropical cyclone warnings
    try:
        typhoon_url = "https://opendata.cwa.gov.tw/api/v1/rest/datastore/W-C0034-005?format=JSON"
        resp = requests.get(typhoon_url, timeout=_TIMEOUT, headers={"User-Agent": "CattoOSINT/8.0"})
        if resp.status_code == 200:
            raw = resp.json()
            records = (raw.get("records") or {})
            typhoon_data = records.get("TyphoonInfo") or []
            if isinstance(typhoon_data, dict):
                typhoon_data = [typhoon_data]
            for t in typhoon_data:
                try:
                    cwb_data = t.get("CWBTyphoonData") or {}
                    pos = cwb_data.get("PredictPos") or {}
                    lat = float(pos.get("Latitude") or 0)
                    lng = float(pos.get("Longitude") or 0)
                    if not lat or not lng:
                        lat, lng = 23.7, 121.0  # Taiwan center fallback
                    items.append({
                        "id": str(t.get("TyphoonNo") or t.get("TyphoonName") or "TYPHOON"),
                        "type": "typhoon_alert",
                        "source": "CWA Taiwan",
                        "lat": lat,
                        "lng": lng,
                        "name": t.get("TyphoonName") or "Unnamed",
                        "intensity": cwb_data.get("Intensity") or "Unknown",
                        "wind_speed_kmh": cwb_data.get("MaxWindSpeed"),
                        "timestamp": t.get("IssuingTime") or datetime.now(timezone.utc).isoformat(),
                        "severity": "high",
                    })
                except Exception:
                    continue
    except Exception as e:
        logger.warning("CWA typhoon fetch failed: %s", e)

    with _data_lock:
        latest_data["cwa_alerts"] = items  # type: ignore[typeddict-unknown-key]
    _mark_fresh("cwa_alerts")
    logger.info("CWA Taiwan: %d alerts (earthquakes + typhoons)", len(items))


# ---------------------------------------------------------------------------
# ReliefWeb — humanitarian crisis data for SEA
# Docs: https://reliefweb.int/help/api
# ---------------------------------------------------------------------------

_RELIEFWEB_SEA_COUNTRIES = [
    "Myanmar", "Philippines", "Indonesia", "Vietnam", "Thailand",
    "Cambodia", "Laos", "Malaysia", "Bangladesh", "Sri Lanka",
]

def fetch_reliefweb():
    """Fetch humanitarian crisis data from ReliefWeb API for SEA."""
    if not _REQUESTS_OK:
        return

    try:
        payload = {
            "filter": {
                "operator": "AND",
                "conditions": [
                    {
                        "field": "country.name",
                        "value": _RELIEFWEB_SEA_COUNTRIES,
                        "operator": "OR",
                    },
                    {"field": "status", "value": "published"},
                ],
            },
            "fields": {
                "include": ["id", "title", "date", "country", "disaster_type", "primary_country", "url_alias"],
            },
            "sort": ["date.created:desc"],
            "limit": 50,
        }
        resp = requests.post(
            "https://api.reliefweb.int/v1/disasters?appname=catto-osint",
            json=payload,
            timeout=_TIMEOUT,
            headers={"User-Agent": "CattoOSINT/8.0"},
        )

        items = []
        if resp.status_code == 200:
            raw = resp.json()
            for entry in (raw.get("data") or []):
                try:
                    fields = entry.get("fields") or {}
                    primary = fields.get("primary_country") or {}
                    country_list = fields.get("country") or [primary]
                    # Use primary country for geo lookup
                    country_name = primary.get("name") or (country_list[0].get("name") if country_list else "SEA")

                    # Use centroid lookup for country
                    lat, lng = _country_centroid(country_name)

                    dtype_list = fields.get("disaster_type") or []
                    dtype = dtype_list[0].get("name") if dtype_list else "Crisis"

                    items.append({
                        "id": str(entry.get("id") or ""),
                        "type": "humanitarian_crisis",
                        "source": "ReliefWeb",
                        "lat": lat,
                        "lng": lng,
                        "title": fields.get("title") or "Humanitarian Event",
                        "country": country_name,
                        "disaster_type": dtype,
                        "url": f"https://reliefweb.int{fields.get('url_alias', '')}",
                        "timestamp": (fields.get("date") or {}).get("created") or datetime.now(timezone.utc).isoformat(),
                        "severity": "medium",
                    })
                except Exception:
                    continue

        with _data_lock:
            latest_data["reliefweb_events"] = items  # type: ignore[typeddict-unknown-key]
        _mark_fresh("reliefweb_events")
        logger.info("ReliefWeb: %d SEA humanitarian events", len(items))

    except Exception as e:
        logger.warning("ReliefWeb fetch failed: %s", e)


# ---------------------------------------------------------------------------
# ACAPS — crisis severity data
# Docs: https://www.acaps.org/en/learn/data-and-tools/acaps-apis
# ---------------------------------------------------------------------------

def fetch_acaps():
    """Fetch ACAPS crisis severity data for SEA region."""
    if not _REQUESTS_OK:
        return

    try:
        resp = requests.get(
            "https://api.acaps.org/api/v1/crises/?format=json&limit=100",
            timeout=_TIMEOUT,
            headers={"User-Agent": "CattoOSINT/8.0"},
        )

        items = []
        if resp.status_code == 200:
            raw = resp.json()
            results = raw.get("results") or raw if isinstance(raw, list) else []
            if isinstance(raw, dict):
                results = raw.get("results") or []

            sea_keywords = {"myanmar", "philippines", "indonesia", "vietnam", "thailand",
                            "cambodia", "laos", "malaysia", "bangladesh", "sea", "pacific",
                            "rohingya", "mekong", "asean"}

            for entry in results:
                try:
                    country = str(entry.get("country") or entry.get("country_name") or "")
                    crisis_name = str(entry.get("crisis") or entry.get("name") or "")

                    # Filter to SEA region
                    combined = (country + " " + crisis_name).lower()
                    if not any(kw in combined for kw in sea_keywords):
                        continue

                    lat, lng = _country_centroid(country)
                    severity_val = entry.get("severity_level") or entry.get("acaps_severity") or 2
                    try:
                        severity_num = int(severity_val)
                    except (ValueError, TypeError):
                        severity_num = 2

                    sev = "high" if severity_num >= 4 else "medium" if severity_num >= 2 else "low"
                    items.append({
                        "id": str(entry.get("id") or entry.get("crisis_id") or ""),
                        "type": "acaps_crisis",
                        "source": "ACAPS",
                        "lat": lat,
                        "lng": lng,
                        "name": crisis_name,
                        "country": country,
                        "severity_level": severity_num,
                        "severity": sev,
                        "population_affected": entry.get("people_in_need") or entry.get("population_affected"),
                        "timestamp": entry.get("last_updated") or datetime.now(timezone.utc).isoformat(),
                    })
                except Exception:
                    continue

        with _data_lock:
            latest_data["acaps_crises"] = items  # type: ignore[typeddict-unknown-key]
        _mark_fresh("acaps_crises")
        logger.info("ACAPS: %d SEA crises", len(items))

    except Exception as e:
        logger.warning("ACAPS fetch failed: %s", e)


# ---------------------------------------------------------------------------
# Country centroid lookup (minimal, SEA-focused)
# ---------------------------------------------------------------------------

_CENTROIDS: dict[str, tuple[float, float]] = {
    "Malaysia": (4.2105, 108.9758),
    "Indonesia": (-0.7893, 113.9213),
    "Philippines": (12.8797, 121.7740),
    "Vietnam": (14.0583, 108.2772),
    "Thailand": (15.8700, 100.9925),
    "Myanmar": (21.9162, 95.9560),
    "Cambodia": (12.5657, 104.9910),
    "Laos": (19.8563, 102.4955),
    "Bangladesh": (23.6850, 90.3563),
    "Sri Lanka": (7.8731, 80.7718),
    "Singapore": (1.3521, 103.8198),
    "Brunei": (4.5353, 114.7277),
    "Timor-Leste": (-8.8742, 125.7275),
    "Papua New Guinea": (-6.3150, 143.9555),
    "Taiwan": (23.6978, 120.9605),
}

def _country_centroid(country: str) -> tuple[float, float]:
    """Return (lat, lng) centroid for a country, defaulting to SEA center."""
    for name, coords in _CENTROIDS.items():
        if name.lower() in country.lower() or country.lower() in name.lower():
            return coords
    return (5.0, 115.0)  # SEA center fallback


# ---------------------------------------------------------------------------
# Convenience: fetch all regional feeds
# ---------------------------------------------------------------------------

def fetch_all_regional_feeds():
    """Fetch all Malaysia + SEA regional feeds. Called from data_fetcher scheduler."""
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="regional") as ex:
        futures = [
            ex.submit(fetch_metmalaysia_weather),
            ex.submit(fetch_cwa_taiwan),
            ex.submit(fetch_reliefweb),
            ex.submit(fetch_acaps),
        ]
        for f in concurrent.futures.as_completed(futures):
            try:
                f.result()
            except Exception as exc:
                logger.warning("Regional feed error: %s", exc)
