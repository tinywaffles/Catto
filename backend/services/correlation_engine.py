"""
Emergent Intelligence — Cross-layer correlation engine.

Scans co-located events across multiple data layers and emits composite
alerts that no single source could generate alone.

Correlation types:
  - RF Anomaly:          GPS jamming + internet outage (both required)
  - Military Buildup:    Military flights + naval vessels + GDELT conflict events
  - Infrastructure Cascade: Internet outage + KiwiSDR offline in same zone
  - Maritime Threat:     Vessel within 50km of active IMB piracy incident
  - Escalation Alert:    GDELT conflict spike + military flights in 200km radius
  - Signal Amplifier:    Telegram location mention + GDELT/UCDP event within 6hrs
  - Domestic Cyber:      CISA KEV spike (3+ new in 24h) — high-severity advisory
  - Watchlist Alert:     Watchlisted vessel in active piracy zone
  - Breaking Signal:     Multiple news sources report same incident within 1hr
"""

import logging
import math
from collections import defaultdict
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Grid cell size in degrees — 1° ≈ 111 km at equator.
# Tighter than the previous 2° to reduce false co-locations.
_CELL_SIZE = 1

# Quality gates for RF anomaly correlation — only high-confidence inputs.
# GPS jamming + internet outage overlap in a 111km cell is easily a coincidence
# (IODA returns ~100 regional outages; GPS NACp dips are common in busy airspace).
# Only fire when the evidence is strong enough to indicate deliberate RF interference.
_RF_CORR_MIN_GPS_RATIO = 0.60   # Need strong jamming signal, not marginal NACp dips
_RF_CORR_MIN_OUTAGE_PCT = 40    # Need a serious outage, not routine BGP fluctuation
_RF_CORR_MIN_INDICATORS = 3     # Require 3+ corroborating signals (not just GPS+outage)


def _cell_key(lat: float, lng: float) -> str:
    """Convert lat/lng to a grid cell key."""
    clat = int(lat // _CELL_SIZE) * _CELL_SIZE
    clng = int(lng // _CELL_SIZE) * _CELL_SIZE
    return f"{clat},{clng}"


def _coords(item: dict) -> tuple[float | None, float | None]:
    """Extract (lat, lng) from a dict, handling flat, GeoJSON, and GDELT API formats."""
    lat = item.get("lat") or item.get("latitude") or item.get("actionGeo_Lat")
    lng = item.get("lng") or item.get("lon") or item.get("longitude") or item.get("actionGeo_Long")
    # GeoJSON format: {"geometry": {"type": "Point", "coordinates": [lng, lat]}}
    if lat is None or lng is None:
        geom = item.get("geometry")
        if isinstance(geom, dict) and geom.get("type") == "Point":
            c = geom.get("coordinates")
            if c and len(c) >= 2:
                lng, lat = c[0], c[1]  # GeoJSON is [lng, lat]
    if lat is None or lng is None:
        return None, None
    try:
        return float(lat), float(lng)
    except (ValueError, TypeError):
        return None, None


def _cell_center(key: str) -> tuple[float, float]:
    """Get center lat/lng from a cell key."""
    parts = key.split(",")
    return float(parts[0]) + _CELL_SIZE / 2, float(parts[1]) + _CELL_SIZE / 2


def _severity(indicator_count: int) -> str:
    if indicator_count >= 3:
        return "high"
    if indicator_count >= 2:
        return "medium"
    return "low"


def _severity_score(sev: str) -> float:
    return {"high": 90, "medium": 60, "low": 30}.get(sev, 0)


def _outage_pct(outage: dict) -> float:
    """Extract outage severity percentage from an outage dict."""
    return float(outage.get("severity", 0) or outage.get("severity_pct", 0) or 0)


# ---------------------------------------------------------------------------
# RF Anomaly: GPS jamming + internet outage (both must be present)
# ---------------------------------------------------------------------------


def _detect_rf_anomalies(data: dict) -> list[dict]:
    gps_jamming = data.get("gps_jamming") or []
    internet_outages = data.get("internet_outages") or []

    if not gps_jamming:
        return []  # No GPS jamming → no RF anomalies possible

    # Build grid of indicators
    cells: dict[str, dict] = defaultdict(lambda: {
        "gps_jam": False, "gps_ratio": 0.0,
        "outage": False, "outage_pct": 0.0,
    })

    for z in gps_jamming:
        lat, lng = z.get("lat"), z.get("lng")
        if lat is None or lng is None:
            continue
        ratio = z.get("ratio", 0)
        if ratio < _RF_CORR_MIN_GPS_RATIO:
            continue  # Skip marginal jamming zones
        key = _cell_key(lat, lng)
        cells[key]["gps_jam"] = True
        cells[key]["gps_ratio"] = max(cells[key]["gps_ratio"], ratio)

    for o in internet_outages:
        lat = o.get("lat") or o.get("latitude")
        lng = o.get("lng") or o.get("lon") or o.get("longitude")
        if lat is None or lng is None:
            continue
        pct = _outage_pct(o)
        if pct < _RF_CORR_MIN_OUTAGE_PCT:
            continue  # Skip minor outages (ISP maintenance noise)
        key = _cell_key(float(lat), float(lng))
        cells[key]["outage"] = True
        cells[key]["outage_pct"] = max(cells[key]["outage_pct"], pct)

    # PSK Reporter: presence = healthy RF.  Only used as a bonus indicator,
    # NOT as a standalone trigger (absence is normal in most cells).
    psk_reporter = data.get("psk_reporter") or []
    psk_cells: set[str] = set()
    for s in psk_reporter:
        lat, lng = s.get("lat"), s.get("lon")
        if lat is not None and lng is not None:
            psk_cells.add(_cell_key(lat, lng))

    # When PSK data is unavailable, we can't get a 3rd indicator, so require
    # an even higher GPS jamming ratio to compensate (real EW shows 75%+).
    psk_available = len(psk_reporter) > 0

    alerts: list[dict] = []
    for key, c in cells.items():
        # GPS jamming is the anchor — required for every RF anomaly alert
        if not c["gps_jam"]:
            continue
        if not c["outage"]:
            continue  # Both GPS jamming AND outage are always required

        indicators = 2  # GPS jamming + outage
        drivers: list[str] = [f"GPS jamming {int(c['gps_ratio'] * 100)}%"]
        pct = c["outage_pct"]
        drivers.append(f"Internet outage{f' {pct:.0f}%' if pct else ''}")

        # PSK absence confirms RF environment is disrupted
        if psk_available and key not in psk_cells:
            indicators += 1
            drivers.append("No HF digital activity (PSK Reporter)")

        if indicators < _RF_CORR_MIN_INDICATORS:
            # Without PSK data, only allow through if GPS ratio is extreme
            # (75%+ indicates deliberate, sustained jamming — not noise)
            if not psk_available and c["gps_ratio"] >= 0.75 and pct >= 50:
                pass  # Allow this high-confidence 2-indicator alert through
            else:
                continue

        lat, lng = _cell_center(key)
        sev = _severity(indicators)
        alerts.append({
            "lat": lat,
            "lng": lng,
            "type": "rf_anomaly",
            "severity": sev,
            "score": _severity_score(sev),
            "drivers": drivers[:3],
            "cell_size": _CELL_SIZE,
        })

    return alerts


# ---------------------------------------------------------------------------
# Military Buildup: flights + ships + GDELT conflict
# ---------------------------------------------------------------------------


def _detect_military_buildups(data: dict) -> list[dict]:
    mil_flights = data.get("military_flights") or []
    ships = data.get("ships") or []
    gdelt = data.get("gdelt") or []

    cells: dict[str, dict] = defaultdict(lambda: {
        "mil_flights": 0, "mil_ships": 0, "gdelt_events": 0,
    })

    for f in mil_flights:
        lat = f.get("lat") or f.get("latitude")
        lng = f.get("lng") or f.get("lon") or f.get("longitude")
        if lat is None or lng is None:
            continue
        try:
            key = _cell_key(float(lat), float(lng))
            cells[key]["mil_flights"] += 1
        except (ValueError, TypeError):
            continue

    mil_ship_types = {"military_vessel", "military", "warship", "patrol", "destroyer",
                      "frigate", "corvette", "carrier", "submarine", "cruiser"}
    for s in ships:
        stype = (s.get("type") or s.get("ship_type") or "").lower()
        if not any(mt in stype for mt in mil_ship_types):
            continue
        lat = s.get("lat") or s.get("latitude")
        lng = s.get("lng") or s.get("lon") or s.get("longitude")
        if lat is None or lng is None:
            continue
        try:
            key = _cell_key(float(lat), float(lng))
            cells[key]["mil_ships"] += 1
        except (ValueError, TypeError):
            continue

    for g in gdelt:
        lat, lng = _coords(g)
        if lat is None or lng is None:
            continue
        try:
            key = _cell_key(lat, lng)
            # GDELT GeoJSON features carry an event count in properties
            count = 1
            props = g.get("properties")
            if isinstance(props, dict):
                count = int(props.get("count", 1) or 1)
            cells[key]["gdelt_events"] += count
        except (ValueError, TypeError):
            continue

    alerts: list[dict] = []
    for key, c in cells.items():
        mil_total = c["mil_flights"] + c["mil_ships"]
        has_gdelt = c["gdelt_events"] > 0

        # Need meaningful military presence AND a conflict indicator
        if mil_total < 3 or not has_gdelt:
            continue

        drivers: list[str] = []
        if c["mil_flights"]:
            drivers.append(f"{c['mil_flights']} military aircraft")
        if c["mil_ships"]:
            drivers.append(f"{c['mil_ships']} military vessels")
        if c["gdelt_events"]:
            drivers.append(f"{c['gdelt_events']} conflict events")

        if mil_total >= 11:
            sev = "high"
        elif mil_total >= 6:
            sev = "medium"
        else:
            sev = "low"

        lat, lng = _cell_center(key)
        alerts.append({
            "lat": lat,
            "lng": lng,
            "type": "military_buildup",
            "severity": sev,
            "score": _severity_score(sev),
            "drivers": drivers[:3],
            "cell_size": _CELL_SIZE,
        })

    return alerts


# ---------------------------------------------------------------------------
# Infrastructure Cascade: outage + KiwiSDR co-location
#
# Power plants are removed from this detector — with 35K plants globally,
# virtually every 2° cell contains one, making every outage a false hit.
# KiwiSDR receivers (~300 worldwide) are sparse enough to be meaningful:
# an outage in the same cell as a KiwiSDR indicates real infrastructure
# disruption affecting radio monitoring capability.
# ---------------------------------------------------------------------------


def _detect_infra_cascades(data: dict) -> list[dict]:
    internet_outages = data.get("internet_outages") or []
    kiwisdr = data.get("kiwisdr") or []

    if not kiwisdr:
        return []

    # Build set of cells with KiwiSDR receivers
    kiwi_cells: set[str] = set()
    for k in kiwisdr:
        lat, lng = k.get("lat"), k.get("lon") or k.get("lng")
        if lat is not None and lng is not None:
            try:
                kiwi_cells.add(_cell_key(float(lat), float(lng)))
            except (ValueError, TypeError):
                pass

    if not kiwi_cells:
        return []

    alerts: list[dict] = []
    for o in internet_outages:
        lat = o.get("lat") or o.get("latitude")
        lng = o.get("lng") or o.get("lon") or o.get("longitude")
        if lat is None or lng is None:
            continue
        try:
            key = _cell_key(float(lat), float(lng))
        except (ValueError, TypeError):
            continue

        if key not in kiwi_cells:
            continue

        pct = _outage_pct(o)
        drivers = [f"Internet outage{f' {pct:.0f}%' if pct else ''}",
                    "KiwiSDR receivers in affected zone"]

        lat_c, lng_c = _cell_center(key)
        alerts.append({
            "lat": lat_c,
            "lng": lng_c,
            "type": "infra_cascade",
            "severity": "medium",
            "score": _severity_score("medium"),
            "drivers": drivers,
            "cell_size": _CELL_SIZE,
        })

    return alerts


# ---------------------------------------------------------------------------
# Maritime Threat: piracy incidents + vessel clustering in same zone
# ---------------------------------------------------------------------------


def _detect_maritime_threats(data: dict) -> list[dict]:
    piracy = data.get("piracy_incidents") or []
    ships = data.get("ships") or []

    if not piracy:
        return []

    # Build piracy incident list with coordinates
    piracy_points: list[tuple[float, float]] = []
    piracy_cells: dict[str, int] = defaultdict(int)
    for p in piracy:
        lat = p.get("lat") or p.get("latitude")
        lng = p.get("lng") or p.get("lon") or p.get("longitude")
        if lat is None or lng is None:
            continue
        try:
            flat, flng = float(lat), float(lng)
            piracy_points.append((flat, flng))
            piracy_cells[_cell_key(flat, flng)] += 1
        except (ValueError, TypeError):
            pass

    if not piracy_points:
        return []

    # Find vessels within 50km of any piracy incident (haversine)
    vessel_near_piracy: dict[str, dict] = defaultdict(lambda: {"count": 0, "piracy_count": 0})
    for s in ships:
        vlat = s.get("lat") or s.get("latitude")
        vlng = s.get("lng") or s.get("lon") or s.get("longitude")
        if vlat is None or vlng is None:
            continue
        try:
            vflat, vflng = float(vlat), float(vlng)
        except (ValueError, TypeError):
            continue

        # Check 50km proximity to any piracy incident
        for (plat, plng) in piracy_points:
            if _haversine_km(vflat, vflng, plat, plng) <= 50:
                key = _cell_key(plat, plng)
                vessel_near_piracy[key]["count"] += 1
                vessel_near_piracy[key]["piracy_count"] = piracy_cells[key]
                vessel_near_piracy[key]["lat"] = plat
                vessel_near_piracy[key]["lng"] = plng
                break  # Count vessel once per piracy zone

    alerts: list[dict] = []
    for key, info in vessel_near_piracy.items():
        if info["count"] < 1:
            continue

        piracy_count = info["piracy_count"]
        vessel_count = info["count"]
        drivers = [
            f"{piracy_count} piracy incident{'s' if piracy_count > 1 else ''}",
            f"{vessel_count} vessel{'s' if vessel_count > 1 else ''} within 50km",
        ]
        sev = "high" if piracy_count >= 3 else "medium" if piracy_count >= 2 else "low"
        alerts.append({
            "lat": info.get("lat", 0),
            "lng": info.get("lng", 0),
            "type": "maritime_threat",
            "severity": sev,
            "score": _severity_score(sev),
            "drivers": drivers,
            "cell_size": _CELL_SIZE,
        })

    return alerts


# ---------------------------------------------------------------------------
# Haversine distance helper (km)
# ---------------------------------------------------------------------------

def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng / 2) ** 2
    return R * 2 * math.asin(math.sqrt(a))


# ---------------------------------------------------------------------------
# Escalation Alert: GDELT spike + military flights within 200km
# ---------------------------------------------------------------------------


def _detect_escalation_alerts(data: dict) -> list[dict]:
    mil_flights = data.get("military_flights") or []
    gdelt = data.get("gdelt") or []

    if not mil_flights or not gdelt:
        return []

    # Use 2° cells ≈ 222 km to capture 200km radius overlaps
    _LARGE_CELL = 2

    def _large_key(lat: float, lng: float) -> str:
        return f"{int(lat // _LARGE_CELL) * _LARGE_CELL},{int(lng // _LARGE_CELL) * _LARGE_CELL}"

    def _large_center(key: str) -> tuple[float, float]:
        parts = key.split(",")
        return float(parts[0]) + _LARGE_CELL / 2, float(parts[1]) + _LARGE_CELL / 2

    # Build GDELT density by large cell
    gdelt_cells: dict[str, int] = defaultdict(int)
    for g in gdelt:
        lat, lng = _coords(g)
        if lat is None or lng is None:
            continue
        count = 1
        props = g.get("properties")
        if isinstance(props, dict):
            try:
                count = int(props.get("count", 1) or 1)
            except (ValueError, TypeError):
                count = 1
        gdelt_cells[_large_key(lat, lng)] += count

    # Build military flight density by large cell
    mil_cells: dict[str, int] = defaultdict(int)
    for f in mil_flights:
        lat = f.get("lat") or f.get("latitude")
        lng = f.get("lng") or f.get("lon") or f.get("longitude")
        if lat is None or lng is None:
            continue
        try:
            mil_cells[_large_key(float(lat), float(lng))] += 1
        except (ValueError, TypeError):
            pass

    alerts: list[dict] = []
    for key, gdelt_count in gdelt_cells.items():
        if gdelt_count < 5:
            continue  # Need meaningful conflict event density
        mil_count = mil_cells.get(key, 0)
        if mil_count < 2:
            continue

        lat, lng = _large_center(key)
        sev = "high" if gdelt_count >= 20 and mil_count >= 5 else "medium"
        alerts.append({
            "lat": lat,
            "lng": lng,
            "type": "escalation_alert",
            "severity": sev,
            "score": _severity_score(sev),
            "drivers": [
                f"{gdelt_count} GDELT conflict events",
                f"{mil_count} military aircraft in region",
                "GDELT conflict spike + military presence",
            ],
            "cell_size": _LARGE_CELL,
        })

    return alerts


# ---------------------------------------------------------------------------
# Signal Amplifier: Telegram location mention + GDELT/UCDP event within 6hrs
# ---------------------------------------------------------------------------


def _parse_iso(ts: str | None) -> float | None:
    """Parse ISO timestamp to UTC epoch seconds."""
    if not ts:
        return None
    try:
        dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
        return dt.timestamp()
    except Exception:
        return None


def _detect_signal_amplifiers(data: dict) -> list[dict]:
    telegram_posts = data.get("telegram_posts") or []
    gdelt = data.get("gdelt") or []
    ucdp = data.get("ucdp") or []

    if not telegram_posts:
        return []

    now_ts = datetime.now(timezone.utc).timestamp()
    six_hours = 6 * 3600

    # Build recent GDELT/UCDP events with geo (within 6hrs)
    recent_events: list[tuple[float, float, str]] = []  # (lat, lng, source)
    for g in gdelt:
        lat, lng = _coords(g)
        if lat is None or lng is None:
            continue
        ts = g.get("pub_date") or g.get("date") or g.get("event_date")
        event_ts = _parse_iso(ts)
        if event_ts and (now_ts - event_ts) <= six_hours:
            recent_events.append((float(lat), float(lng), "GDELT"))

    for u in ucdp:
        lat, lng = _coords(u)
        if lat is None or lng is None:
            continue
        ts = u.get("date_start") or u.get("event_date")
        event_ts = _parse_iso(ts)
        # UCDP is weekly — include if within 6 hours or if event is recent
        if event_ts is None or (now_ts - event_ts) <= six_hours:
            recent_events.append((float(lat), float(lng), "UCDP"))

    if not recent_events:
        return []

    # Find Telegram posts with geo that are recent
    alerts: list[dict] = []
    for post in telegram_posts:
        post_lat = post.get("lat") or post.get("latitude")
        post_lng = post.get("lng") or post.get("lon") or post.get("longitude")
        if post_lat is None or post_lng is None:
            continue

        post_ts = _parse_iso(post.get("date") or post.get("timestamp"))
        if post_ts and (now_ts - post_ts) > six_hours:
            continue

        try:
            plat, plng = float(post_lat), float(post_lng)
        except (ValueError, TypeError):
            continue

        # Check if any recent conflict event is within 50km
        matching = [
            src for (elat, elng, src) in recent_events
            if _haversine_km(plat, plng, elat, elng) <= 50
        ]
        if not matching:
            continue

        channel = post.get("channel") or post.get("source") or "Telegram"
        sources = list(set(matching))[:2]
        alerts.append({
            "lat": plat,
            "lng": plng,
            "type": "signal_amplifier",
            "severity": "medium",
            "score": _severity_score("medium"),
            "drivers": [
                f"Telegram signal: {channel}",
                f"Confirmed by {', '.join(sources)}",
                "Multi-source geographic convergence",
            ],
            "cell_size": _CELL_SIZE,
        })

    return alerts[:10]  # Cap to avoid noise


# ---------------------------------------------------------------------------
# Watchlist Alert: watchlisted vessel in active piracy zone
# ---------------------------------------------------------------------------


def _detect_watchlist_alerts(data: dict) -> list[dict]:
    piracy = data.get("piracy_incidents") or []
    ships = data.get("ships") or []
    watchlist = data.get("watchlist_vessels") or []  # Set of MMSI / vessel names

    if not piracy or not ships or not watchlist:
        return []

    # Normalize watchlist to lowercase strings
    watch_set = {str(w).lower() for w in watchlist}

    # Build piracy zone cells
    piracy_cells: set[str] = set()
    for p in piracy:
        lat = p.get("lat") or p.get("latitude")
        lng = p.get("lng") or p.get("lon") or p.get("longitude")
        if lat is None or lng is None:
            continue
        try:
            piracy_cells.add(_cell_key(float(lat), float(lng)))
        except (ValueError, TypeError):
            pass

    if not piracy_cells:
        return []

    alerts: list[dict] = []
    for s in ships:
        name = str(s.get("name") or "").lower()
        mmsi = str(s.get("mmsi") or "").lower()
        if name not in watch_set and mmsi not in watch_set:
            continue

        lat = s.get("lat") or s.get("latitude")
        lng = s.get("lng") or s.get("lon") or s.get("longitude")
        if lat is None or lng is None:
            continue
        try:
            key = _cell_key(float(lat), float(lng))
        except (ValueError, TypeError):
            continue

        if key not in piracy_cells:
            continue

        display_name = s.get("name") or mmsi or "Vessel"
        alerts.append({
            "lat": float(lat),
            "lng": float(lng),
            "type": "watchlist_alert",
            "severity": "high",
            "score": _severity_score("high"),
            "drivers": [
                f"WATCHLISTED: {display_name}",
                "Vessel in active piracy zone",
                f"MMSI: {s.get('mmsi') or 'unknown'}",
            ],
            "cell_size": _CELL_SIZE,
        })

    return alerts


# ---------------------------------------------------------------------------
# Breaking Signal: multiple news sources reporting same incident within 1hr
# ---------------------------------------------------------------------------


def _detect_breaking_signals(data: dict) -> list[dict]:
    news = data.get("news") or []
    if len(news) < 2:
        return []

    now_ts = datetime.now(timezone.utc).timestamp()
    one_hour = 3600

    # Filter to articles published in the last hour with geo
    recent_geo: list[dict] = []
    for article in news:
        pub = article.get("pub_date") or article.get("published")
        ts = _parse_iso(pub)
        if ts and (now_ts - ts) <= one_hour:
            lat = article.get("lat") or article.get("latitude")
            lng = article.get("lng") or article.get("lon") or article.get("longitude")
            if lat is not None and lng is not None:
                try:
                    recent_geo.append({
                        "lat": float(lat),
                        "lng": float(lng),
                        "source": article.get("source") or article.get("feed_name") or "Unknown",
                        "title": article.get("title") or "",
                    })
                except (ValueError, TypeError):
                    pass

    if len(recent_geo) < 2:
        return []

    # Group by cell — multiple distinct sources in same cell = breaking signal
    cell_sources: dict[str, dict] = defaultdict(lambda: {"sources": set(), "lat": 0.0, "lng": 0.0})
    for item in recent_geo:
        key = _cell_key(item["lat"], item["lng"])
        cell_sources[key]["sources"].add(item["source"])
        cell_sources[key]["lat"] = item["lat"]
        cell_sources[key]["lng"] = item["lng"]

    alerts: list[dict] = []
    for key, info in cell_sources.items():
        if len(info["sources"]) < 2:
            continue  # Need at least 2 distinct sources
        sources_list = list(info["sources"])[:3]
        lat, lng = _cell_center(key)
        sev = "high" if len(info["sources"]) >= 3 else "medium"
        alerts.append({
            "lat": lat,
            "lng": lng,
            "type": "breaking_signal",
            "severity": sev,
            "score": _severity_score(sev),
            "drivers": [
                f"{len(info['sources'])} sources in 1hr",
                f"Sources: {', '.join(sources_list)}",
                "Multi-outlet convergence",
            ],
            "cell_size": _CELL_SIZE,
        })

    return alerts[:5]


# ---------------------------------------------------------------------------
# Domestic Cyber Threat: CISA KEV + ransomware IOCs in same region
# ---------------------------------------------------------------------------


def _detect_cyber_threats(data: dict) -> list[dict]:
    cisa_kev = data.get("cisa_kev") or []
    ransomware_iocs = data.get("ransomware_iocs") or []

    # These datasets are global (no geo), so we emit a single global alert
    # only when both active sources have high-recency entries.
    if not cisa_kev or not ransomware_iocs:
        return []

    kev_count = len(cisa_kev)
    ioc_count = len(ransomware_iocs)

    # Only alert when both sources have meaningful data volumes
    if kev_count < 5 or ioc_count < 5:
        return []

    drivers = [
        f"{kev_count} CISA KEV vulnerabilities active",
        f"{ioc_count} ransomware IOCs tracked",
    ]
    sev = "high" if kev_count >= 20 and ioc_count >= 20 else "medium"
    return [{
        "lat": 0.0,
        "lng": 0.0,
        "type": "cyber_threat",
        "severity": sev,
        "score": _severity_score(sev),
        "drivers": drivers,
        "cell_size": None,  # Global — no geographic scope
    }]


def _detect_domestic_cyber_spike(data: dict) -> list[dict]:
    """CISA KEV spike: 3+ new entries in the last 24 hours."""
    cisa_kev = data.get("cisa_kev") or []
    if not cisa_kev:
        return []

    now_ts = datetime.now(timezone.utc).timestamp()
    one_day = 24 * 3600

    new_today = []
    for entry in cisa_kev:
        added = entry.get("dateAdded") or entry.get("date_added") or entry.get("published")
        ts = _parse_iso(added)
        if ts and (now_ts - ts) <= one_day:
            new_today.append(entry)

    if len(new_today) < 3:
        return []

    # Build affected vendor/product summary
    vendors = list({e.get("vendorProject") or e.get("vendor") or "Unknown" for e in new_today})[:3]
    return [{
        "lat": 0.0,
        "lng": 0.0,
        "type": "domestic_cyber_threat",
        "severity": "high" if len(new_today) >= 6 else "medium",
        "score": _severity_score("high" if len(new_today) >= 6 else "medium"),
        "drivers": [
            f"{len(new_today)} new CISA KEV entries in 24h",
            f"Vendors: {', '.join(vendors)}",
            "Active exploitation in the wild",
        ],
        "cell_size": None,
    }]


# ---------------------------------------------------------------------------
# Predictions: rule-based forward intelligence assessments
# ---------------------------------------------------------------------------


def compute_predictions(data: dict, correlations: list[dict]) -> list[dict]:
    """Generate rule-based predictions from current data and correlations."""
    predictions: list[dict] = []

    # 1. Troop movement escalation — military buildup correlation → escalation risk
    mil_buildups = [c for c in correlations if c.get("type") == "military_buildup" and c.get("severity") in ("medium", "high")]
    for b in mil_buildups[:5]:
        conf = 0.72 if b.get("severity") == "high" else 0.55
        predictions.append({
            "type": "escalation_risk",
            "label": "Escalation Risk — Military Buildup",
            "probability": conf,
            "lat": b["lat"],
            "lng": b["lng"],
            "horizon": "48h",
            "drivers": b.get("drivers", []),
            "severity": b["severity"],
        })

    # 2. Multi-source confirmation — same area flagged by 3+ correlation types
    from collections import Counter
    cell_hits: Counter = Counter()
    cell_types: dict[str, set] = defaultdict(set)
    for c in correlations:
        if c.get("lat") is not None and c.get("lng") is not None:
            key = _cell_key(c["lat"], c["lng"])
            cell_hits[key] += 1
            cell_types[key].add(c["type"])
    for key, count in cell_hits.items():
        if count < 2 or len(cell_types[key]) < 2:
            continue
        lat, lng = _cell_center(key)
        predictions.append({
            "type": "multi_source_confirmation",
            "label": "Multi-Source Confirmation",
            "probability": min(0.50 + count * 0.12, 0.95),
            "lat": lat,
            "lng": lng,
            "horizon": "24h",
            "drivers": [f"{count} independent correlation signals", f"Types: {', '.join(sorted(cell_types[key]))}"],
            "severity": "high" if count >= 3 else "medium",
        })

    # 3. GDELT conflict threshold — high event density signals instability
    gdelt = data.get("gdelt") or []
    gdelt_cells: Counter = Counter()
    for g in gdelt:
        lat, lng = _coords(g)
        if lat is None or lng is None:
            continue
        try:
            # Use event count from GeoJSON properties if available
            count = 1
            props = g.get("properties")
            if isinstance(props, dict):
                count = int(props.get("count", 1) or 1)
            gdelt_cells[_cell_key(lat, lng)] += count
        except (ValueError, TypeError):
            pass
    for key, count in gdelt_cells.most_common(5):
        if count < 8:
            break
        lat, lng = _cell_center(key)
        conf = min(0.40 + count * 0.015, 0.88)
        predictions.append({
            "type": "gdelt_instability",
            "label": "Conflict Risk — GDELT Spike",
            "probability": conf,
            "lat": lat,
            "lng": lng,
            "horizon": "72h",
            "drivers": [f"{count} GDELT conflict events in zone"],
            "severity": "medium" if count < 40 else "high",
        })

    # 4. Piracy ripple — active piracy zone → shipping route risk
    maritime_threats = [c for c in correlations if c.get("type") == "maritime_threat"]
    for m in maritime_threats[:5]:
        predictions.append({
            "type": "shipping_lane_risk",
            "label": "Shipping Lane Risk",
            "probability": 0.65 if m.get("severity") == "high" else 0.45,
            "lat": m["lat"],
            "lng": m["lng"],
            "horizon": "24h",
            "drivers": m.get("drivers", []) + ["Active piracy zone — adjacent routes at risk"],
            "severity": m.get("severity", "medium"),
        })

    # Deduplicate by proximity (keep highest probability per cell)
    seen_keys: dict[str, float] = {}
    deduped: list[dict] = []
    for p in sorted(predictions, key=lambda x: -x["probability"]):
        if p.get("lat") is not None and p.get("lng") is not None:
            key = _cell_key(p["lat"], p["lng"]) + f"_{p['type']}"
        else:
            key = f"global_{p['type']}"
        if key not in seen_keys:
            seen_keys[key] = p["probability"]
            deduped.append(p)

    return deduped[:20]


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def compute_correlations(data: dict) -> list[dict]:
    """Run all correlation detectors and return merged alert list."""
    alerts: list[dict] = []

    try:
        alerts.extend(_detect_rf_anomalies(data))
    except Exception as e:
        logger.error("Correlation engine RF anomaly error: %s", e)

    try:
        alerts.extend(_detect_military_buildups(data))
    except Exception as e:
        logger.error("Correlation engine military buildup error: %s", e)

    try:
        alerts.extend(_detect_infra_cascades(data))
    except Exception as e:
        logger.error("Correlation engine infra cascade error: %s", e)

    try:
        alerts.extend(_detect_maritime_threats(data))
    except Exception as e:
        logger.error("Correlation engine maritime threat error: %s", e)

    try:
        alerts.extend(_detect_cyber_threats(data))
    except Exception as e:
        logger.error("Correlation engine cyber threat error: %s", e)

    try:
        alerts.extend(_detect_escalation_alerts(data))
    except Exception as e:
        logger.error("Correlation engine escalation alert error: %s", e)

    try:
        alerts.extend(_detect_signal_amplifiers(data))
    except Exception as e:
        logger.error("Correlation engine signal amplifier error: %s", e)

    try:
        alerts.extend(_detect_watchlist_alerts(data))
    except Exception as e:
        logger.error("Correlation engine watchlist alert error: %s", e)

    try:
        alerts.extend(_detect_breaking_signals(data))
    except Exception as e:
        logger.error("Correlation engine breaking signal error: %s", e)

    try:
        alerts.extend(_detect_domestic_cyber_spike(data))
    except Exception as e:
        logger.error("Correlation engine domestic cyber spike error: %s", e)

    type_counts: dict[str, int] = defaultdict(int)
    for a in alerts:
        type_counts[a["type"]] += 1
    if alerts:
        summary = ", ".join(f"{v} {k}" for k, v in type_counts.items())
        logger.info("Correlations: %d alerts (%s)", len(alerts), summary)

    return alerts
