"""Memory management — distance-based eviction helpers and RSS logging.

All cap thresholds are relative to Singapore (1.35 N, 103.82 E).
"""

import math
import logging

logger = logging.getLogger(__name__)

_SG_LAT = 1.35
_SG_LNG = 103.82


# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------

def dist_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance in km."""
    R = 6371.0
    dLat = math.radians(lat2 - lat1)
    dLng = math.radians(lng2 - lng1)
    a = (
        math.sin(dLat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dLng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------------------------------------------------------------------------
# Generic list capper (flat dicts with lat/lng keys)
# ---------------------------------------------------------------------------

def cap_list_by_distance(
    items: list,
    lat_key: str,
    lng_key: str,
    near_km: float,
    far_cap: int,
    sort_key: str | None = None,
    sort_reverse: bool = True,
) -> list:
    """Keep all items within *near_km* of Singapore; cap items beyond to *far_cap*.

    Args:
        items:        List of dicts to filter.
        lat_key:      Dict key for latitude.
        lng_key:      Dict key for longitude.
        near_km:      Distance threshold (km); items within are always kept.
        far_cap:      Max number of far items to retain.
        sort_key:     Optional key to sort far items before capping.
        sort_reverse: If True (default), sort descending (newest/highest first).
    """
    near: list = []
    far: list = []
    for item in items:
        try:
            lat = float(item[lat_key])
            lng = float(item[lng_key])
        except (KeyError, TypeError, ValueError):
            far.append(item)
            continue
        if dist_km(lat, lng, _SG_LAT, _SG_LNG) <= near_km:
            near.append(item)
        else:
            far.append(item)
    if len(far) > far_cap:
        if sort_key is not None:
            far.sort(key=lambda x: x.get(sort_key) or "", reverse=sort_reverse)
        far = far[:far_cap]
    return near + far


# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# Memory / RSS logging
# ---------------------------------------------------------------------------

def log_memory_usage() -> None:
    """Log process RSS and counts of key in-memory data structures."""
    rss_mb = _read_rss_mb()

    from services.fetchers._store import latest_data, _data_lock  # lazy import

    with _data_lock:
        counts = {k: len(latest_data.get(k) or []) for k in (
            "ships", "commercial_flights", "private_flights",
            "private_jets", "military_flights", "tracked_flights",
            "gdelt", "telegram_posts", "news",
        )}

    # AIS backing dict size
    ais_count = _read_ais_count()

    logger.info(
        "MEMORY | RSS=%.1f MB | AIS=%d | ships=%d | "
        "flights(com=%d priv=%d jets=%d mil=%d trk=%d) | "
        "gdelt=%d | tg=%d | news=%d",
        rss_mb,
        ais_count,
        counts["ships"],
        counts["commercial_flights"],
        counts["private_flights"],
        counts["private_jets"],
        counts["military_flights"],
        counts["tracked_flights"],
        counts["gdelt"],
        counts["telegram_posts"],
        counts["news"],
    )


def _read_rss_mb() -> float:
    """Read process RSS from /proc/self/status (Linux/Docker only)."""
    try:
        with open("/proc/self/status") as fh:
            for line in fh:
                if line.startswith("VmRSS:"):
                    return int(line.split()[1]) / 1024.0
    except Exception:
        pass
    return 0.0


def _read_ais_count() -> int:
    try:
        from services.ais_stream import _vessels, _vessels_lock
        with _vessels_lock:
            return len(_vessels)
    except Exception:
        return -1
