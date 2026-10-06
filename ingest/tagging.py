"""Auto-tagging via Groq. Only complete() touches the provider: swap it for Claude/OpenRouter there."""

import json
import logging
import threading
import time
from dataclasses import dataclass

from groq import Groq, RateLimitError

log = logging.getLogger(__name__)

# Mirror of web/lib/tags.ts. ingest/tests/test_tags_mirror.py fails on drift.
TAGS: tuple[str, ...] = (
    "arrest",
    "detention",
    "custodial-death",
    "state-violence",
    "police-violence",
    "harassment",
    "sexual-violence",
    "violence-against-women",
    "injury",
    "internet-shutdown",
    "other",
)
TAG_SLUGS = frozenset(TAGS)

BODY_MAX_CHARS = 2000  # ~500 tokens of Bangla/English body text
MAX_RETRIES = 5
MIN_CALL_INTERVAL = 2.0  # seconds; 30 RPM free-tier ceiling
MAX_BACKOFF_SECONDS = 60

SYSTEM_PROMPT = (
    "You tag news articles from Bangladesh. Choose zero or more tags ONLY from the "
    "allowed list. Base tags only on what the article text says. Do not guess. "
    'Reply with JSON only: {"tags": [{"slug": "<slug>", "confidence": <number 0-1>}]}'
)


class TaggingError(Exception):
    pass


_client: Groq | None = None
_last_call = 0.0
_lock = threading.Lock()


def _groq(api_key: str) -> Groq:
    global _client
    if _client is None:
        _client = Groq(api_key=api_key)
    return _client


def _pace() -> None:
    global _last_call
    with _lock:
        wait = _last_call + MIN_CALL_INTERVAL - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        _last_call = time.monotonic()


def complete(system: str, user: str, *, model: str, api_key: str) -> str:
    """The single LLM call. Throttled, retries on 429 with exponential backoff."""
    client = _groq(api_key)
    for attempt in range(MAX_RETRIES):
        _pace()
        try:
            resp = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                temperature=0,
                max_tokens=1000,
                response_format={"type": "json_object"},
            )
            return resp.choices[0].message.content or ""
        except RateLimitError:
            wait = min(MAX_BACKOFF_SECONDS, 5 * 2**attempt)
            log.warning("groq 429, retry %d in %ds", attempt + 1, wait)
            time.sleep(wait)
    raise TaggingError("rate limited after retries")


def parse_tags(raw: str) -> list[dict]:
    """Validate model JSON. Drops unknown slugs, clamps confidence, dedupes."""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise TaggingError(f"invalid JSON: {exc}") from exc

    items = data.get("tags") if isinstance(data, dict) else None
    if not isinstance(items, list):
        raise TaggingError("missing tags list")

    out: dict[str, float | None] = {}
    for item in items:
        if not isinstance(item, dict):
            continue
        slug = item.get("slug")
        if slug not in TAG_SLUGS:
            log.info("dropped unknown tag slug %r", slug)
            continue
        raw_conf = item.get("confidence")
        try:
            conf = max(0.0, min(1.0, float(raw_conf))) if raw_conf is not None else None
        except (TypeError, ValueError):
            conf = None
        out[slug] = conf
    return [{"slug": s, "confidence": c} for s, c in out.items()]


@dataclass(frozen=True)
class Tagger:
    api_key: str
    model: str

    def tag(self, title: str, body: str | None) -> list[dict]:
        excerpt = (body or "")[:BODY_MAX_CHARS]
        user = (
            f"Allowed tags: {', '.join(TAGS)}\n\n"
            f"Title: {title}\n\nText: {excerpt}"
        )
        raw = complete(SYSTEM_PROMPT, user, model=self.model, api_key=self.api_key)
        return parse_tags(raw)
