import urllib.robotparser

import extract
import fetch


def _robots(text: str | None = None, *, disallow_all: bool = False):
    rp = urllib.robotparser.RobotFileParser()
    if disallow_all:
        rp.disallow_all = True
    else:
        rp.parse((text or "").splitlines())
    return rp


def test_empty_robots_allows_everything():
    rp = _robots("")
    assert rp.can_fetch("NewsFinderBot/0.1", "https://example.com/any/page")


def test_robots_disallow_respected():
    rp = _robots("User-agent: *\nDisallow: /private/\n")
    assert not rp.can_fetch("NewsFinderBot/0.1", "https://example.com/private/x")
    assert rp.can_fetch("NewsFinderBot/0.1", "https://example.com/news/x")


def test_disallow_all_blocks_everything():
    rp = _robots(disallow_all=True)
    assert not rp.can_fetch("NewsFinderBot/0.1", "https://example.com/news/x")


def test_canonical_url_drops_fragment_and_lowercases_host():
    assert (
        fetch.canonical_url("HTTPS://News.Example.com/a/b?x=1#frag")
        == "https://news.example.com/a/b?x=1"
    )


def test_detect_language_bangla_and_english():
    assert extract.detect_language("ঢাকায় হামলার ঘটনায় গ্রেপ্তার") == "bn"
    assert extract.detect_language("Police arrest man in Dhaka") == "en"
    assert extract.detect_language("1234 !!!") is None
