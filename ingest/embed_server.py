"""Local query-embedding service for the web search route.

Run: python -m uvicorn embed_server:app --host 127.0.0.1 --port 8001   (from ingest/)
POST /embed {"texts": [...], "kind": "query"|"passage"} -> {"vectors": [[...], ...]}
"""

from fastapi import FastAPI
from pydantic import BaseModel, Field

import embed

app = FastAPI(title="news-finder embeddings")


class EmbedRequest(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=64)
    kind: str = "query"


@app.get("/health")
def health() -> dict:
    return {"ok": True, "model": embed.MODEL_NAME, "dims": embed.DIMS}


@app.post("/embed")
def embed_texts(req: EmbedRequest) -> dict:
    return {"vectors": embed.embed(req.texts, kind=req.kind)}
