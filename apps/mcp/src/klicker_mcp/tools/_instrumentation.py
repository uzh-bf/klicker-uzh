"""Structured per-call logging for every MCP tool invocation.

The `@instrument` decorator sits *between* `@mcp.tool(...)` and the async tool
body. It times the call, emits a JSON-structured log line with tool name,
participant sub, latency, outcome, and (on error) the translated error class,
and translates any stray backend / auth exception into a `ToolError` with the
stable `[klicker.<class>] …` prefix. Tool payloads are never logged.
"""

from __future__ import annotations

import functools
import time
from collections.abc import Awaitable, Callable
from typing import Any

import jwt
from fastmcp.exceptions import ToolError

from klicker_mcp.auth import get_bearer_token
from klicker_mcp.gql.errors import (
    extract_error_class,
    format_message,
    translate_and_raise,
)
from klicker_mcp.logging import get_logger

_logger = get_logger("klicker_mcp.tools")


def _participant_sub() -> str | None:
    """Best-effort JWT `sub` claim extraction for audit logging.

    We intentionally do not verify the signature — the backend is the
    authoritative verifier, and we only need the identifier for a log line.
    A malformed token yields `None`, never an error.
    """
    token = get_bearer_token()
    if not token:
        return None
    try:
        claims = jwt.decode(token, options={"verify_signature": False})
    except jwt.PyJWTError:
        return None
    sub = claims.get("sub")
    if isinstance(sub, (str, int)):
        return str(sub)
    return None


def instrument[F: Callable[..., Awaitable[Any]]](fn: F) -> F:
    """Wrap an async tool body with timing, structured logging, and error
    translation. Apply `@instrument` below `@mcp.tool(...)` so the decorator
    order is `@mcp.tool → @instrument → async def`."""

    @functools.wraps(fn)
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        tool_name = fn.__name__
        participant_sub = _participant_sub()
        started = time.perf_counter()
        try:
            result = await fn(*args, **kwargs)
        except ToolError as err:
            latency_ms = int((time.perf_counter() - started) * 1000)
            error_class = extract_error_class(str(err))
            _logger.warning(
                "tool_call",
                tool=tool_name,
                participant_sub=participant_sub,
                latency_ms=latency_ms,
                outcome="error",
                error_class=error_class,
            )
            raise
        except Exception as err:
            latency_ms = int((time.perf_counter() - started) * 1000)
            _logger.warning(
                "tool_call",
                tool=tool_name,
                participant_sub=participant_sub,
                latency_ms=latency_ms,
                outcome="error",
                error_class="backend_unavailable",
                exception_type=err.__class__.__name__,
            )
            translate_and_raise(err)
        latency_ms = int((time.perf_counter() - started) * 1000)
        _logger.info(
            "tool_call",
            tool=tool_name,
            participant_sub=participant_sub,
            latency_ms=latency_ms,
            outcome="ok",
        )
        return result

    return wrapper  # type: ignore[return-value]


__all__ = ["format_message", "instrument"]
