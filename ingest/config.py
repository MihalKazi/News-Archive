import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    database_url: str
    groq_api_key: str | None
    tagging_model: str
    max_articles_per_run: int
    user_agent: str


def _env(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name, "").strip()
    return value or default


def load_config() -> Config:
    database_url = _env("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL not set")

    return Config(
        database_url=database_url,
        groq_api_key=_env("GROQ_API_KEY"),
        tagging_model=_env("TAGGING_MODEL", "llama-3.1-8b-instant"),
        max_articles_per_run=int(_env("MAX_ARTICLES_PER_RUN", "50")),
        user_agent=_env("INGEST_USER_AGENT", "NewsFinderBot/0.1"),
    )
