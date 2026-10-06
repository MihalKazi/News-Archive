"""Multilingual embeddings via Cloudflare Workers AI (@cf/baai/bge-m3, 1024-dim, Bangla-capable).

Needs CF_ACCOUNT_ID and CF_API_TOKEN (Workers AI permission). Same model must embed passages and queries.
bge-m3 takes no e5-style prefixes, so kind is accepted for call-site clarity but not applied.
"""

import logging
import os
import time

import httpx

log = logging.getLogger(__name__)

MODEL_NAME = "@cf/baai/bge-m3"
DIMS = 1024
PASSAGE_CHARS = 1500  # title + body head
BATCH_MAX = 100  # Workers AI embedding batch cap
RETRIES = 4

_URL = "https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/" + MODEL_NAME


def _client() -> tuple[str, dict]:
    account = os.environ["CF_ACCOUNT_ID"]
    token = os.environ["CF_API_TOKEN"]
    return _URL.format(account=account), {"Authorization": f"Bearer {token}"}


def embed(texts: list[str], kind: str) -> list[list[float]]:
    """kind: 'passage' for stored articles, 'query' for search input."""
    if kind not in ("passage", "query"):
        raise ValueError(f"bad kind {kind!r}")
    url, headers = _client()
    out: list[list[float]] = []
    for i in range(0, len(texts), BATCH_MAX):
        out.extend(_post(url, headers, texts[i : i + BATCH_MAX]))
    return out


def _post(url: str, headers: dict, batch: list[str]) -> list[list[float]]:
    for attempt in range(RETRIES):
        resp = httpx.post(url, headers=headers, json={"text": batch}, timeout=60)
        if resp.status_code == 429 or resp.status_code >= 500:
            wait = 2**attempt
            log.warning("workers ai %s, retry in %ss", resp.status_code, wait)
            time.sleep(wait)
            continue
        resp.raise_for_status()
        body = resp.json()
        if not body.get("success"):
            raise RuntimeError(f"workers ai error: {body.get('errors')}")
        vecs = body["result"]["data"]
        if len(vecs) != len(batch) or any(len(v) != DIMS for v in vecs):
            raise RuntimeError("workers ai returned unexpected shape")
        return vecs
    raise RuntimeError("workers ai retries exhausted")


def passage_text(title: str, body: str | None) -> str:
    return f"{title}\n{(body or '')[:PASSAGE_CHARS]}"


def to_pg_vector(v: list[float]) -> str:
    return "[" + ",".join(f"{x:.7f}" for x in v) + "]"
