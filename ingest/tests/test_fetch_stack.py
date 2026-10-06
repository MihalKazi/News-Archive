import httpx
import pytest

import fetch
from takedown.fetch.classify import Outcome, classify, is_retryable
from takedown.fetch.ratelimit import HostRateLimiter, host_key
from takedown.listings import parse_listing


def test_host_key_merges_www():
    assert host_key("https://www.example.com/a") == host_key("https://example.com/b") == "example.com"


def test_classify_cloudflare_challenge_not_content():
    headers = httpx.Headers({"cf-mitigated": "challenge"})
    assert classify(403, headers, b"") is Outcome.CF_CHALLENGE


def test_classify_429_and_ok():
    assert classify(429, httpx.Headers(), b"") is Outcome.RATE_LIMITED
    assert classify(200, httpx.Headers(), b"x") is Outcome.OK


@pytest.mark.parametrize(
    "outcome,status,expected",
    [
        (Outcome.TIMEOUT, None, True),
        (Outcome.HTTP_ERROR, 503, True),
        (Outcome.HTTP_ERROR, 404, False),
        (Outcome.CF_CHALLENGE, 403, False),
    ],
)
def test_retry_policy(outcome, status, expected):
    assert is_retryable(outcome, status) is expected


def test_parse_date_rfc2822_and_iso():
    assert fetch._parse_date("Tue, 06 Oct 2026 15:16:22 +0000").isoformat() == "2026-10-06T15:16:22+00:00"
    assert fetch._parse_date("2026-10-06T10:00:00+06:00").isoformat() == "2026-10-06T04:00:00+00:00"
    assert fetch._parse_date("garbage") is None
    assert fetch._parse_date(None) is None


def test_parse_listing_rss_items():
    rss = (
        b'<?xml version="1.0"?><rss version="2.0"><channel><title>t</title>'
        b"<item><title>Hello</title><link>https://ex.com/a?utm_source=x</link>"
        b"<pubDate>Tue, 06 Oct 2026 15:16:22 +0000</pubDate></item></channel></rss>"
    )
    parsed = parse_listing(rss)
    assert parsed.kind == "rss"
    assert parsed.items[0].title == "Hello"
    assert fetch.canonical_url(parsed.items[0].url) == "https://ex.com/a"


def test_ratelimiter_spaces_same_host():
    import asyncio
    waited = []

    async def fake_sleep(s):
        waited.append(s)

    clock = iter([0.0, 0.0, 0.5]).__next__
    rl = HostRateLimiter(2.0, clock=clock, sleep=fake_sleep)
    async def run():
        await rl.acquire("https://ex.com/a")
        await rl.acquire("https://ex.com/b")

    asyncio.run(run())
    assert waited and waited[0] == pytest.approx(2.0)
