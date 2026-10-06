"""Plain SQL against tables owned by web/db/schema.ts (Drizzle migrations).

Ingest never runs DDL. Column names here must match web/db/schema.ts.
"""

from dataclasses import dataclass
from datetime import datetime

import psycopg
from psycopg.rows import dict_row


@dataclass(frozen=True)
class Outlet:
    id: int
    name: str
    domain: str
    feed_url: str


def connect(database_url: str) -> psycopg.Connection:
    # prepare_threshold=None: transaction pooler (port 6543) rejects named prepared statements.
    return psycopg.connect(database_url, autocommit=False, prepare_threshold=None)


def active_outlets(conn: psycopg.Connection) -> list[Outlet]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "select id, name, domain, feed_url from outlets where active order by id"
        )
        return [Outlet(**row) for row in cur.fetchall()]


def known_urls(conn: psycopg.Connection, urls: list[str]) -> set[str]:
    if not urls:
        return set()
    with conn.cursor() as cur:
        cur.execute("select url from articles where url = any(%s)", (urls,))
        return {row[0] for row in cur.fetchall()}


def tag_ids(conn: psycopg.Connection) -> dict[str, int]:
    with conn.cursor() as cur:
        cur.execute("select slug, id from tags")
        return {slug: tag_id for slug, tag_id in cur.fetchall()}


def insert_article(
    conn: psycopg.Connection,
    *,
    outlet_id: int,
    url: str,
    title: str,
    published_at: datetime | None,
    body: str | None,
    language: str | None,
) -> int | None:
    """Insert article. Returns id, or None if url already stored."""
    with conn.cursor() as cur:
        cur.execute(
            """
            insert into articles (outlet_id, url, title, published_at, body, language)
            values (%s, %s, %s, %s, %s, %s)
            on conflict (url) do nothing
            returning id
            """,
            (outlet_id, url, title, published_at, body, language),
        )
        row = cur.fetchone()
        return row[0] if row else None


def insert_auto_tags(
    conn: psycopg.Connection,
    *,
    article_id: int,
    tags: list[tuple[int, float | None]],
    model: str,
) -> None:
    if not tags:
        return
    with conn.cursor() as cur:
        cur.executemany(
            """
            insert into article_tags (article_id, tag_id, source, confidence, model)
            values (%s, %s, 'auto', %s, %s)
            on conflict (article_id, tag_id) do nothing
            """,
            [(article_id, tag_id, conf, model) for tag_id, conf in tags],
        )


def insert_embedding(conn: psycopg.Connection, *, article_id: int, model: str, vector: list[float]) -> None:
    import embed

    with conn.cursor() as cur:
        cur.execute(
            """
            insert into article_embeddings (article_id, model, embedding)
            values (%s, %s, %s::vector)
            on conflict (article_id) do nothing
            """,
            (article_id, model, embed.to_pg_vector(vector)),
        )
