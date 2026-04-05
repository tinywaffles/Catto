"""IMB Piracy Reporting Centre incident fetcher.

Polls the ICC-CCS WP Google Maps REST API to retrieve maritime piracy
and armed robbery incidents. Data source: https://icc-ccs.org/map/

The ICC-CCS Live Piracy Map is powered by WP Google Maps. Each annual map
has a numeric ID; we probe recent IDs and deduplicate by incident ID.

Category mapping (from ICC-CCS):
  1 = Attempted   2 = Boarded   3 = Fired Upon
  4 = Hijacked    5 = Suspicious
"""

import logging
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from services.network_utils import fetch_with_curl
from services.fetchers._store import latest_data, _data_lock, _mark_fresh
from services.fetchers.retry import with_retry

logger = logging.getLogger(__name__)

# Poll at most once every 30 minutes
_PIRACY_INTERVAL_S = 1800
_last_fetch: Optional[float] = None

# WP Google Maps: probe these map IDs from newest to oldest
# Pattern observed: 2024=3, 2023=4, 2022=5 (extrapolated: 2025=2, 2026=1)
_MAP_IDS = [1, 2, 3, 4]

_CATEGORY_LABELS = {
    "1": "Attempted",
    "2": "Boarded",
    "3": "Fired Upon",
    "4": "Hijacked",
    "5": "Suspicious",
}


def _parse_category(categories_str: str) -> str:
    """Map raw category ID(s) string to a human-readable label."""
    if not categories_str:
        return "Unknown"
    first = str(categories_str).split(",")[0].strip()
    return _CATEGORY_LABELS.get(first, "Incident")


def _parse_location(marker: dict) -> tuple[Optional[float], Optional[float]]:
    """Extract (lat, lng) from a WP Google Maps marker object.

    The API may return either a "location" string "lat, lng"
    or separate "lat" / "lng" fields.
    """
    # Try separate fields first (newer API versions)
    if "lat" in marker and "lng" in marker:
        try:
            return float(marker["lat"]), float(marker["lng"])
        except (ValueError, TypeError):
            pass

    # Fall back to "location" string
    loc_str = str(marker.get("location", ""))
    parts = [p.strip() for p in loc_str.split(",")]
    if len(parts) == 2:
        try:
            return float(parts[0]), float(parts[1])
        except ValueError:
            pass

    return None, None


@with_retry(max_retries=2, base_delay=3)
def fetch_piracy():
    """Fetch IMB piracy incidents from the ICC-CCS WP Google Maps API."""
    global _last_fetch

    from services.fetchers._store import is_any_active
    if not is_any_active("piracy_incidents"):
        return

    now = time.monotonic()
    if _last_fetch is not None and (now - _last_fetch) < _PIRACY_INTERVAL_S:
        return  # Throttle to 30-min interval

    incidents = []
    seen_ids: set = set()

    for map_id in _MAP_IDS:
        url = f"https://icc-ccs.org/wp-json/wpgmza/v1/markers?map_id={map_id}"
        try:
            resp = fetch_with_curl(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
            if not resp or resp.status_code != 200:
                continue
            data = resp.json()
            if not isinstance(data, list):
                continue

            cutoff = datetime.now(timezone.utc) - timedelta(days=14)

            for marker in data:
                mid = marker.get("id")
                if mid is None or mid in seen_ids:
                    continue
                seen_ids.add(mid)

                lat, lng = _parse_location(marker)
                if lat is None or lng is None:
                    continue

                # Extract incident date from custom_field_data "Sitrep:" field (DD.MM.YYYY)
                incident_date = None
                for cf in marker.get("custom_field_data", []):
                    if "Sitrep" in str(cf.get("name", "")):
                        sitrep = str(cf.get("value", ""))
                        m = re.match(r'(\d{2})\.(\d{2})\.(\d{4})', sitrep)
                        if m:
                            d, mo, y = m.groups()
                            try:
                                incident_date = datetime(int(y), int(mo), int(d), tzinfo=timezone.utc)
                            except ValueError:
                                pass
                        break

                if incident_date is None or incident_date < cutoff:
                    continue  # skip incidents older than 14 days

                incidents.append({
                    "id": mid,
                    "lat": lat,
                    "lng": lng,
                    "date": incident_date.strftime("%Y-%m-%d") if incident_date else marker.get("date", ""),
                    "description": marker.get("description", ""),
                    "incident_number": marker.get("incident_number", ""),
                    "title": marker.get("title", ""),
                    "incident_type": _parse_category(str(marker.get("categories", ""))),
                    "map_id": map_id,
                })

        except Exception as e:
            logger.warning(f"Piracy fetch map_id={map_id} failed: {e}")

    with _data_lock:
        latest_data["piracy_incidents"] = incidents

    if incidents:
        _mark_fresh("piracy_incidents")
        logger.info(f"Piracy: {len(incidents)} incidents from {len(_MAP_IDS)} map(s)")
    else:
        logger.warning("Piracy: no incidents fetched — icc-ccs.org may be unreachable")

    _last_fetch = now
