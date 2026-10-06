"""One-off import: Takedown Watch SQLite archive -> our articles table.

Read-only on the source. Latest HTTP-200 snapshot per article. Skips merged duplicates and
articles with no headline or no body (title is NOT NULL here; nothing is invented).
Imported rows are untagged. Tag later with backfill.py if wanted.

Run: python import_takedown.py "D:/Takedown Watch/var/tw.db"   (env: DATABASE_URL)
"""

import json
import logging
import sqlite3
import sys
from collections import Counter
from urllib.parse import urlsplit

import extract
import fetch
import store
from config import load_config

log = logging.getLogger("import_takedown")

SOURCE_SQL = """
select a.id, a.canonical_url, o.slug, o.name, o.base_url, o.rss_urls, o.sitemap_urls,
       s.headline, s.published_at, s.body_text
from article a
join outlet o on o.id = a.outlet_id
join snapshot s on s.id = (
    select s2.id from snapshot s2
    where s2.article_id = a.id and s2.http_status = 200
    order by s2.fetched_at desc, s2.id desc limit 1
)
where a.merged_into_id is null
order by a.id
"""


def _list(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        val = json.loads(raw)
    except (TypeError, ValueError):
        return []
    return [str(v) for v in val] if isinstance(val, list) else []


def _domain(base_url: str) -> str:
    return urlsplit(base_url).netloc.lower()


def ensure_outlets(conn, src: sqlite3.Connection) -> dict[str, int]:
    """Map Takedown Watch outlet slug -> our outlets.id. Inserts missing outlets inactive."""
    mapping: dict[str, int] = {}
    with conn.cursor() as cur:
        for slug, name, base_url, rss, sitemaps in src.execute(
            "select slug, name, base_url, rss_urls, sitemap_urls from outlet"
        ):
            domain = _domain(base_url)
            feed = (_list(rss) + _list(sitemaps) + [base_url])[0]
            cur.execute(
                """
                insert into outlets (name, domain, feed_url, active)
                values (%s, %s, %s, false)
                on conflict (domain) do update set name = outlets.name
                returning id
                """,
                (name, domain, feed),
            )
            mapping[slug] = cur.fetchone()[0]
    conn.commit()
    return mapping


def main(src_path: str) -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    cfg = load_config()
    src = sqlite3.connect(f"file:{src_path}?mode=ro", uri=True)
    counts: Counter = Counter()

    with store.connect(cfg.database_url) as conn:
        outlet_ids = ensure_outlets(conn, src)
        log.info("outlets mapped: %d", len(outlet_ids))

        rows = []
        for art_id, url, slug, _name, _base, _rss, _sm, headline, published_raw, body in src.execute(SOURCE_SQL):
            counts["source"] += 1
            if not headline or not headline.strip():
                counts["no_headline"] += 1
                continue
            if not body or not body.strip():
                counts["no_body"] += 1
                continue
            rows.append((
                outlet_ids[slug],
                fetch.canonical_url(url),
                headline.strip(),
                fetch._parse_date(published_raw),
                body,
                extract.detect_language(f"{headline} {body}"),
            ))

        log.info("importable rows: %d", len(rows))
        with conn.cursor() as cur:
            cur.execute("select count(*) from articles")
            before = cur.fetchone()[0]
            cur.executemany(
                """
                insert into articles (outlet_id, url, title, published_at, body, language)
                values (%s, %s, %s, %s, %s, %s)
                on conflict (url) do nothing
                """,
                rows,
            )
            cur.execute("select count(*) from articles")
            after = cur.fetchone()[0]
        conn.commit()

    log.info(
        "source=%d skipped(no_headline=%d no_body=%d) inserted=%d already_present=%d",
        counts["source"], counts["no_headline"], counts["no_body"],
        after - before, len(rows) - (after - before),
    )
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: import_takedown.py <path to tw.db>", file=sys.stderr)
        sys.exit(2)
    sys.exit(main(sys.argv[1]))
