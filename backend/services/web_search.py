"""
Web search + page scraping for Ask Catto.
Uses DuckDuckGo HTML search (no API key required) + httpx + BeautifulSoup.
"""

from __future__ import annotations

import asyncio
import logging
import time
from urllib.parse import quote_plus, urljoin, urlparse

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# Sites to skip when fetching full content (paywalls / JS-heavy)
_SKIP_DOMAINS = {
    "wsj.com", "ft.com", "nytimes.com", "bloomberg.com",
    "economist.com", "thetimes.co.uk", "telegraph.co.uk",
    "twitter.com", "x.com", "facebook.com", "instagram.com",
    "reddit.com", "youtube.com", "tiktok.com",
}


async def ddg_search(query: str, max_results: int = 6, region: str = "us-en") -> list[dict]:
    """
    Search DuckDuckGo HTML interface and return a list of
    {"title", "url", "snippet"} dicts.
    Appends current year and 'news' to bias toward recent results.
    """
    import datetime as _dt
    year = _dt.datetime.utcnow().year
    # Bias search toward recent news unless query already has year/news keywords
    biased_query = query if any(w in query.lower() for w in ["news", "latest", str(year), str(year-1)]) \
        else f"{query} {year} news"
    url = f"https://html.duckduckgo.com/html/?q={quote_plus(biased_query)}&kl={region}&df=m"  # df=m = past month
    results: list[dict] = []

    try:
        async with httpx.AsyncClient(timeout=12, headers=_HEADERS, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except Exception as exc:
        logger.warning("DDG search failed: %s", exc)
        return []

    soup = BeautifulSoup(resp.text, "html.parser")
    for div in soup.select(".result"):
        title_el = div.select_one(".result__title a")
        snippet_el = div.select_one(".result__snippet")
        url_el = div.select_one(".result__url")
        if not title_el:
            continue
        href = title_el.get("href", "")
        # DDG wraps links — extract real URL from uddg param
        if "uddg=" in href:
            from urllib.parse import parse_qs, urlparse as _up
            try:
                qs = parse_qs(_up(href).query)
                href = qs.get("uddg", [href])[0]
            except Exception:
                pass
        results.append(
            {
                "title": title_el.get_text(strip=True),
                "url": href,
                "snippet": snippet_el.get_text(strip=True) if snippet_el else "",
                "display_url": url_el.get_text(strip=True) if url_el else href,
            }
        )
        if len(results) >= max_results:
            break

    logger.info("DDG search '%s': %d results", query, len(results))
    return results


async def fetch_page_text(url: str, max_chars: int = 1800) -> str:
    """
    Fetch a web page and extract its main text content.
    Returns empty string on error or skipped domains.
    """
    domain = urlparse(url).netloc.lower().lstrip("www.")
    if any(domain.endswith(skip) for skip in _SKIP_DOMAINS):
        return ""

    try:
        async with httpx.AsyncClient(
            timeout=8, headers=_HEADERS, follow_redirects=True
        ) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            ct = resp.headers.get("content-type", "")
            if "text/html" not in ct:
                return ""
    except Exception:
        return ""

    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "form", "noscript"]):
        tag.decompose()

    # Prefer <article> or <main>, fall back to <body>
    body = soup.find("article") or soup.find("main") or soup.body
    if not body:
        return ""

    text = " ".join(body.get_text(separator=" ", strip=True).split())
    return text[:max_chars]


async def web_search_with_content(
    query: str,
    max_results: int = 5,
    fetch_content: bool = True,
) -> tuple[list[dict], str]:
    """
    Search DuckDuckGo, optionally fetch top page content.
    Returns (results_list, formatted_context_string).
    """
    results = await ddg_search(query, max_results=max_results)
    if not results:
        return [], ""

    # Fetch page content concurrently (up to 3 pages)
    if fetch_content:
        pages_to_fetch = [r for r in results[:3] if r["url"].startswith("http")]
        content_tasks = [fetch_page_text(r["url"]) for r in pages_to_fetch]
        contents = await asyncio.gather(*content_tasks, return_exceptions=True)
        for i, r in enumerate(pages_to_fetch):
            r["content"] = contents[i] if isinstance(contents[i], str) else ""

    # Build a readable context block
    lines = [f"WEB SEARCH RESULTS for: {query!r}  (fetched {time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime())})\n"]
    for i, r in enumerate(results, 1):
        lines.append(f"[{i}] {r['title']}")
        lines.append(f"    URL: {r['display_url']}")
        if r.get("snippet"):
            lines.append(f"    {r['snippet']}")
        if r.get("content"):
            lines.append(f"    FULL TEXT: {r['content']}")
        lines.append("")

    return results, "\n".join(lines)


def results_to_news_items(query: str, results: list[dict]) -> list[dict]:
    """
    Convert web search results into news-feed-compatible dicts
    so they can be injected into the live intelligence feed.
    """
    import time as _time

    now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    items = []
    for r in results:
        if not r.get("title"):
            continue
        items.append(
            {
                "title": r["title"],
                "source": "CATTO WEB INTEL",
                "link": r.get("url", ""),
                "pubDate": now_iso,
                "risk_score": 5,
                "breaking": False,
                "summary": r.get("snippet", ""),
                "web_query": query,
                "coords": None,
            }
        )
    return items
