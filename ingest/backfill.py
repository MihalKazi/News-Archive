"""Tag stored articles that have no tags yet. Safe to re-run.

Run: python ingest/backfill.py  (same env as run.py)
"""

import logging
import sys

import store
import tagging
from config import load_config

log = logging.getLogger("backfill")


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    cfg = load_config()
    if not cfg.groq_api_key:
        log.error("GROQ_API_KEY not set")
        return 1

    tagger = tagging.Tagger(api_key=cfg.groq_api_key, model=cfg.tagging_model)
    tagged = failed = 0

    with store.connect(cfg.database_url) as conn:
        tag_ids = store.tag_ids(conn)
        with conn.cursor() as cur:
            cur.execute(
                """
                select a.id, a.title, a.body from articles a
                where not exists (select 1 from article_tags t where t.article_id = a.id)
                order by a.id
                """
            )
            rows = cur.fetchall()
        log.info("untagged articles: %d", len(rows))

        for article_id, title, body in rows:
            try:
                tags = tagger.tag(title, body)
                pairs = [(tag_ids[t["slug"]], t["confidence"]) for t in tags if t["slug"] in tag_ids]
                store.insert_auto_tags(conn, article_id=article_id, tags=pairs, model=cfg.tagging_model)
                conn.commit()
                tagged += 1
            except Exception as exc:
                conn.rollback()
                failed += 1
                log.warning("tagging failed for article %d: %s", article_id, exc)

    log.info("backfill done: tagged=%d failed=%d", tagged, failed)
    return 0


if __name__ == "__main__":
    sys.exit(main())
