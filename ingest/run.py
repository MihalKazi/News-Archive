"""Daily ingest: RSS -> article text -> Postgres -> auto-tags.

Run: python ingest/run.py  (env: see .env.example)
Idempotent: known urls skipped. One failing outlet never stops the run.
"""

import asyncio
import logging
import sys
from collections import Counter

import embed
import extract
import fetch
import store
import tagging
from config import Config, load_config
from takedown.config import Settings

log = logging.getLogger("ingest")


def tag_article(
    conn, tagger: tagging.Tagger | None, article_id: int, title: str, body: str | None,
    tag_ids: dict[str, int], counts: Counter,
) -> None:
    """Tag a stored article. Any failure leaves it stored and untagged."""
    if tagger is None:
        return
    try:
        tags = tagger.tag(title, body)
        rows = []
        for t in tags:
            tag_id = tag_ids.get(t["slug"])
            if tag_id is None:
                log.warning("tag slug %r missing from tags table; run db:seed", t["slug"])
                continue
            rows.append((tag_id, t["confidence"]))
        store.insert_auto_tags(conn, article_id=article_id, tags=rows, model=tagger.model)
        conn.commit()
        counts["tagged"] += 1
    except Exception as exc:  # tagging must never drop the article
        conn.rollback()
        counts["tag_failed"] += 1
        log.warning("tagging failed for article %d: %s", article_id, exc)


async def embed_article(conn, article_id: int, title: str, body: str | None, counts: Counter) -> None:
    """Store passage embedding for search. Failure leaves the article searchable by keyword."""
    try:
        vec = embed.embed([embed.passage_text(title, body)], kind="passage")[0]
        store.insert_embedding(conn, article_id=article_id, model=embed.MODEL_NAME, vector=vec)
        conn.commit()
        counts["embedded"] += 1
    except Exception as exc:
        conn.rollback()
        counts["embed_failed"] += 1
        log.warning("embedding failed for article %d: %s", article_id, exc)


async def fetch_body(crawler: fetch.Crawler, url: str, counts: Counter) -> str | None:
    """Article text, or None with counts updated. Never raises."""
    try:
        res = await fetch.fetch_article(crawler, url)
    except Exception as exc:
        counts["fetch_error"] += 1
        log.warning("article fetch failed %s: %s", url, exc)
        return None
    if res is None:
        counts["robots_blocked"] += 1
        return None
    if not res.ok:
        counts["fetch_error"] += 1
        log.warning("article %s %s status=%s", res.outcome, url, res.status)
        return None
    return extract.extract_text(res.content, url)


async def ingest_outlet(
    conn, crawler: fetch.Crawler, outlet: store.Outlet, tagger: tagging.Tagger | None,
    tag_ids: dict[str, int], budget: int,
) -> Counter:
    counts: Counter = Counter()
    entries = await fetch.fetch_feed(crawler, outlet.feed_url)
    counts["feed_entries"] = len(entries)

    known = store.known_urls(conn, [e.url for e in entries])
    for entry in entries:
        if counts["stored"] >= budget:
            counts["budget_hit"] = 1
            break
        if entry.url in known:
            continue

        body = await fetch_body(crawler, entry.url, counts)
        if body is None:
            counts["no_body"] += 1

        language = extract.detect_language(f"{entry.title} {body or ''}")
        article_id = store.insert_article(
            conn,
            outlet_id=outlet.id,
            url=entry.url,
            title=entry.title,
            published_at=entry.published_at,
            body=body,
            language=language,
        )
        conn.commit()
        if article_id is None:  # raced with another run
            counts["duplicate"] += 1
            continue

        counts["stored"] += 1
        tag_article(conn, tagger, article_id, entry.title, body, tag_ids, counts)
        embed_article(conn, article_id, entry.title, body, counts)
    return counts


async def run(cfg: Config) -> int:
    tagger = None
    if cfg.groq_api_key:
        tagger = tagging.Tagger(api_key=cfg.groq_api_key, model=cfg.tagging_model)
    else:
        log.warning("GROQ_API_KEY not set: articles stored untagged")

    settings = Settings(user_agent=cfg.user_agent)
    budget = cfg.max_articles_per_run
    failed_outlets = 0
    total = Counter()

    async with fetch.Crawler(settings) as crawler:
        with store.connect(cfg.database_url) as conn:
            outlets = store.active_outlets(conn)
            if not outlets:
                log.warning("no active outlets in DB; run db:seed and enable outlets")
            tag_ids = store.tag_ids(conn)

            # Per-outlet share of the run cap, so one big feed cannot starve the rest.
            per_outlet = max(1, budget // max(1, len(outlets)))
            for outlet in outlets:
                if budget <= 0:
                    log.info("MAX_ARTICLES_PER_RUN reached; stopping")
                    break
                try:
                    counts = await ingest_outlet(
                        conn, crawler, outlet, tagger, tag_ids, min(per_outlet, budget)
                    )
                except Exception as exc:
                    conn.rollback()
                    failed_outlets += 1
                    log.error("outlet %s failed: %s", outlet.domain, exc)
                    continue

                budget -= counts["stored"]
                total.update(counts)
                log.info(
                    "outlet %s: feed=%d stored=%d tagged=%d tag_failed=%d no_body=%d "
                    "fetch_error=%d robots_blocked=%d duplicate=%d embedded=%d embed_failed=%d",
                    outlet.domain, counts["feed_entries"], counts["stored"],
                    counts["tagged"], counts["tag_failed"], counts["no_body"],
                    counts["fetch_error"], counts["robots_blocked"], counts["duplicate"],
                    counts["embedded"], counts["embed_failed"],
                )

    log.info(
        "run done: stored=%d tagged=%d tag_failed=%d failed_outlets=%d",
        total["stored"], total["tagged"], total["tag_failed"], failed_outlets,
    )
    return 0


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    return asyncio.run(run(load_config()))


if __name__ == "__main__":
    sys.exit(main())
