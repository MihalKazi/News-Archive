"""Shim for tw.log. Upstream calls structlog-style: log.info("event", key=value).

Renders as "event key=value" through stdlib logging.
"""

import logging


class _Log:
    def __init__(self, name: str) -> None:
        self._log = logging.getLogger(name)

    def _emit(self, level: int, event: str, **kw: object) -> None:
        if self._log.isEnabledFor(level):
            tail = " ".join(f"{k}={v}" for k, v in kw.items())
            self._log.log(level, "%s %s", event, tail)

    def debug(self, event: str, **kw: object) -> None:
        self._emit(logging.DEBUG, event, **kw)

    def info(self, event: str, **kw: object) -> None:
        self._emit(logging.INFO, event, **kw)

    def warning(self, event: str, **kw: object) -> None:
        self._emit(logging.WARNING, event, **kw)

    def error(self, event: str, **kw: object) -> None:
        self._emit(logging.ERROR, event, **kw)


def get_logger(name: str) -> _Log:
    return _Log(name)
