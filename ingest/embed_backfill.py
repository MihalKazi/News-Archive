"""Embed stored articles that have no embedding yet. Safe to re-run.

Run: python ingest/embed_backfill.py   (env: DATABASE_URL)
"""

import logging
import sys

import embed
import store
from config import load_config

log = logging.getLogger("embed_backfill")
BATCH = 64


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    cfg = load_config()
    done = 0
    with store.connect(cfg.database_url) as conn:
        while True:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    select a.id, a.title, a.body from articles a
                    where not exists (select 1 from article_embeddings e where e.article_id = a.id)
                    order by a.id limit %s
                    """,
                    (BATCH,),
                )
                rows = cur.fetchall()
            if not rows:
                break
            vecs = embed.embed([embed.passage_text(t, b) for _, t, b in rows], kind="passage")
            with conn.cursor() as cur:
                cur.executemany(
                    """
                    insert into article_embeddings (article_id, model, embedding)
                    values (%s, %s, %s::vector)
                    on conflict (article_id) do nothing
                    """,
                    [(rid, embed.MODEL_NAME, embed.to_pg_vector(v)) for (rid, _, _), v in zip(rows, vecs)],
                )
            conn.commit()
            done += len(rows)
            log.info("embedded %d (total %d)", len(rows), done)
    log.info("backfill done: %d", done)
    return 0


if __name__ == "__main__":
    sys.exit(main())
