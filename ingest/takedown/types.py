"""Shim for tw.db.types. UTC clock only."""

from datetime import UTC, datetime


def utcnow() -> datetime:
    return datetime.now(UTC)
