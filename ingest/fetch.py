"""Fetch layer on Takedown Watch's async stack: retries, Retry-After, Cloudflare detection,
per-host pacing, RFC 9309 robots.txt. Feed parsing via takedown.listings, URLs via takedown.canon.
"""

import logging
from dataclasses import dataclass
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin, urlsplit

from takedown import canon, listings
from takedown.config import Settings
from takedown.fetch.client import FetchResult, Fetcher
from takedown.fetch.ratelimit import HostRateLimiter
from takedown.robots import Robots, fetch_robots

log = logging.getLogger(__name__)

MAX_CHILD_SITEMAPS = 3
DEFAULT_DOMAIN_INTERVAL = 2.0  # seconds; matches upstream TW_DEFAULT_RATE_LIMIT_SECONDS


class FetchError(Exception):
    pass


@dataclass(frozen=True)
class FeedEntry:
    url: str
    title: str
    published_at: datetime | None


def canonical_url(url: str) -> str:
    return canon.canonicalise(url)


def _origin(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.scheme}://{parts.netloc}"


class Crawler:
    """Async fetch with robots.txt gate and per-host pacing. Use as async context manager."""

    def __init__(self, settings: Settings, default_interval: float = DEFAULT_DOMAIN_INTERVAL):
        self.settings = settings
        self.limiter = HostRateLimiter(default_interval)
        self.fetcher = Fetcher(settings, self.limiter)
        self._robots: dict[str, Robots] = {}

    async def __aenter__(self) -> "Crawler":
        await self.fetcher.__aenter__()
        return self

    async def __aexit__(self, *exc: object) -> None:
        await self.fetcher.__aexit__(*exc)

    async def robots_for(self, url: str) -> Robots:
        origin = _origin(url)
        if origin not in self._robots:
            robots = await fetch_robots(
                self.fetcher, origin, self.settings.robots_agent_token,
                record=lambda *_: None,
            )
            self._robots[origin] = robots
            if robots.parser is not None:
                delay = robots.parser.crawl_delay(self.settings.robots_agent_token)
                if delay:
                    self.limiter.set_interval(origin, float(delay))
            if robots.limitation:
                log.warning("robots unavailable for %s: %s", origin, robots.limitation)
        return self._robots[origin]

    async def get(self, url: str) -> FetchResult | None:
        """None when robots.txt disallows the URL. Otherwise the FetchResult, any outcome."""
        robots = await self.robots_for(url)
        if not robots.allowed(url):
            log.info("robots disallows %s", url)
            return None
        return await self.fetcher.get(url)


def _parse_date(raw: str | None) -> datetime | None:
    """RSS pubDate (RFC 2822) or ISO 8601 (sitemaps, Atom). None if neither parses."""
    if not raw:
        return None
    try:
        dt = parsedate_to_datetime(raw)
    except (TypeError, ValueError):
        try:
            dt = datetime.fromisoformat(raw.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


async def fetch_feed(crawler: Crawler, feed_url: str) -> list[FeedEntry]:
    res = await crawler.get(feed_url)
    if res is None:
        raise FetchError("feed disallowed by robots.txt")
    if not res.ok:
        raise FetchError(f"feed {res.outcome} status={res.status}")

    parsed = listings.parse_listing(res.content)
    if parsed is None:
        raise FetchError("unparseable feed")

    if parsed.kind == "sitemap_index":
        # Newest child sitemaps first (lastmod), capped. Each child is a leaf.
        children = sorted(
            parsed.items,
            key=lambda i: _parse_date(i.date) or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )[:MAX_CHILD_SITEMAPS]
        leaves = []
        for child in children:
            cres = await crawler.get(urljoin(feed_url, child.url))
            if cres is None or not cres.ok:
                log.warning("child sitemap skipped %s", child.url)
                continue
            cparsed = listings.parse_listing(cres.content)
            if cparsed is not None and cparsed.kind != "sitemap_index":
                leaves.extend(cparsed.items)
        items = leaves
    else:
        items = parsed.items

    entries: list[FeedEntry] = []
    for item in items:
        title = (item.title or "").strip()
        link = (item.url or "").strip()
        if not link or not title:
            continue
        entries.append(
            FeedEntry(
                url=canonical_url(urljoin(feed_url, link)),
                title=title,
                published_at=_parse_date(item.date),
            )
        )
    return entries


async def fetch_article(crawler: Crawler, url: str) -> FetchResult | None:
    """None if robots-disallowed. Caller checks .ok and .outcome."""
    return await crawler.get(url)


__all__ = [
    "Crawler", "FeedEntry", "FetchError", "canonical_url",
    "fetch_article", "fetch_feed",
]
