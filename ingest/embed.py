"""Local multilingual embeddings (intfloat/multilingual-e5-small, 384-dim, Bangla-capable).

Free, no API key. Passages and queries use the e5 prefixes. Same model must embed both sides.
"""

import logging
import os
import threading

log = logging.getLogger(__name__)

MODEL_NAME = os.environ.get("EMBED_MODEL", "intfloat/multilingual-e5-small")
DIMS = 384
PASSAGE_CHARS = 1500  # title + body head; model max 512 tokens

_model = None
_lock = threading.Lock()


def _load():
    global _model
    with _lock:
        if _model is None:
            import torch
            from sentence_transformers import SentenceTransformer

            device = "cuda" if torch.cuda.is_available() else "cpu"
            log.info("loading %s on %s", MODEL_NAME, device)
            _model = SentenceTransformer(MODEL_NAME, device=device)
    return _model


def embed(texts: list[str], kind: str) -> list[list[float]]:
    """kind: 'passage' for stored articles, 'query' for search input."""
    if kind not in ("passage", "query"):
        raise ValueError(f"bad kind {kind!r}")
    prefix = f"{kind}: "
    vecs = _load().encode(
        [prefix + t for t in texts],
        batch_size=32,
        normalize_embeddings=True,
        convert_to_numpy=True,
        show_progress_bar=False,
    )
    return [v.tolist() for v in vecs]


def passage_text(title: str, body: str | None) -> str:
    return f"{title}\n{(body or '')[:PASSAGE_CHARS]}"


def to_pg_vector(v: list[float]) -> str:
    return "[" + ",".join(f"{x:.7f}" for x in v) + "]"
