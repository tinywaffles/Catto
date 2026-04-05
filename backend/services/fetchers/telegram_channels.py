"""Telegram conflict channel monitor using Telethon MTProto client.

Fetches the latest 10 posts per channel from the following public channels
every 15 minutes and stores them in latest_data['telegram_posts'].

Channels monitored:
  intelslava, rybar, militarylandnet, warmonitor, ajenglish, trtworld

Session setup (required on first run):
  docker exec -it catto-backend python3 -c "
  import asyncio, os
  from telethon.sync import TelegramClient
  c = TelegramClient('/app/data/telegram', int(os.environ['TELEGRAM_API_ID']), os.environ['TELEGRAM_API_HASH'])
  c.start()
  c.disconnect()
  print('Session saved to /app/data/telegram.session')
  "

After that, the fetcher will re-use the session automatically.
"""

import asyncio
import logging
import os
import threading
import time
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

CHANNELS = [
    "intelslava",
    "rybar",
    "militarylandnet",
    "warmonitor",
    "ajenglish",
    "trtworld",
]
POSTS_PER_CHANNEL = 10
SESSION_PATH = "/app/data/telegram"
_REFETCH_INTERVAL = 900  # 15 minutes

_api_id_str = os.environ.get("TELEGRAM_API_ID", "")
_api_hash = os.environ.get("TELEGRAM_API_HASH", "")

# Prevent concurrent fetches
_lock = threading.Lock()
_last_fetch: float = 0.0


async def _do_fetch() -> list:
    """Run the async Telegram fetch; returns list of post dicts."""
    if not _api_id_str or not _api_hash:
        logger.warning("TELEGRAM_API_ID / TELEGRAM_API_HASH not set — skipping Telegram fetch")
        return []

    try:
        from telethon import TelegramClient
    except ImportError:
        logger.warning("telethon not installed — skipping Telegram channel fetch")
        return []

    api_id = int(_api_id_str)
    client = TelegramClient(SESSION_PATH, api_id, _api_hash)

    try:
        await client.connect()

        if not await client.is_user_authorized():
            logger.warning(
                "Telegram session not authorised. "
                "Run the auth one-liner from the module docstring to enable channel monitoring."
            )
            return []

        posts: list = []
        for channel in CHANNELS:
            try:
                entity = await client.get_entity(channel)
                messages = await client.get_messages(entity, limit=POSTS_PER_CHANNEL)
                for msg in messages:
                    text = getattr(msg, "text", None) or ""
                    if not text.strip():
                        continue
                    posts.append(
                        {
                            "channel": channel,
                            "message_id": msg.id,
                            "text": text,
                            "timestamp": msg.date.isoformat() if msg.date else "",
                            "url": f"https://t.me/{channel}/{msg.id}",
                        }
                    )
            except Exception as exc:
                logger.error("Error fetching Telegram channel %s: %s", channel, exc)

        return sorted(posts, key=lambda p: p.get("timestamp", ""), reverse=True)

    except Exception as exc:
        logger.error("Telegram client error: %s", exc)
        return []
    finally:
        try:
            await client.disconnect()
        except Exception:
            pass


def fetch_telegram_channels() -> None:
    """Fetch recent posts from monitored Telegram conflict channels (slow-tier)."""
    global _last_fetch
    from services.fetchers._store import latest_data, _data_lock, _mark_fresh

    now = time.monotonic()
    if now - _last_fetch < _REFETCH_INTERVAL:
        return

    if not _lock.acquire(blocking=False):
        logger.debug("Telegram fetch already in progress — skip")
        return

    try:
        loop = asyncio.new_event_loop()
        try:
            posts = loop.run_until_complete(_do_fetch())
        finally:
            loop.close()

        # Discard messages older than 24 hours
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        posts = [
            p for p in posts
            if p.get("timestamp") and datetime.fromisoformat(p["timestamp"].replace("Z", "+00:00")) >= cutoff
        ]

        with _data_lock:
            latest_data["telegram_posts"] = posts

        if posts:
            _mark_fresh("telegram_posts")
            _last_fetch = time.monotonic()

        logger.info(
            "Fetched %d Telegram posts from %d channels",
            len(posts),
            len(CHANNELS),
        )
    except Exception as exc:
        logger.error("fetch_telegram_channels failed: %s", exc)
    finally:
        _lock.release()
