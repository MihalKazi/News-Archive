"""Shim for tw.config. Same field names and defaults as upstream Settings, no pydantic."""

import os
from dataclasses import dataclass


@dataclass
class Settings:
    contact_url: str = "https://activaterights.org"
    user_agent: str | None = None
    default_rate_limit_seconds: float = 2.0
    http_timeout_seconds: float = 30.0
    http_max_attempts: int = 3
    http_backoff_base_seconds: float = 2.0
    http_max_redirects: int = 10
    http_max_bytes: int = 25_000_000
    http_max_retry_after_seconds: float = 300.0
    robots_token: str = "NewsFinderBot"

    @classmethod
    def from_env(cls) -> "Settings":
        ua = os.environ.get("INGEST_USER_AGENT", "").strip() or None
        return cls(user_agent=ua)

    @property
    def effective_user_agent(self) -> str:
        return self.user_agent or f"NewsFinderBot (+{self.contact_url})"

    @property
    def robots_agent_token(self) -> str:
        return self.robots_token
