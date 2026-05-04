"""Central error taxonomy for tool failures.

Maps backend / network / auth exceptions to one of four stable classes the
chat consumer can switch on:

| class                 | trigger                                           |
| --------------------- | ------------------------------------------------- |
| `auth`                | 401/403, expired or missing JWT                   |
| `not_found`           | 404, explicit `NOT_FOUND` GraphQL code            |
| `validation`          | 400/422, bad-input GraphQL codes                  |
| `backend_unavailable` | 5xx, connect error, timeout                       |

Every public entry point raises `fastmcp.exceptions.ToolError` with a stable
`[klicker.<class>] <message>` prefix so the consumer can parse it reliably.
"""

from __future__ import annotations

from typing import Any, Literal, NoReturn, cast

import httpx
from fastmcp.exceptions import ToolError

from klicker_mcp.gql.client import GraphQLError, UnknownOperationError

ErrorClass = Literal["auth", "not_found", "validation", "backend_unavailable"]


def _http_class(status: int) -> ErrorClass:
    if status in (401, 403):
        return "auth"
    if status == 404:
        return "not_found"
    if status in (400, 422):
        return "validation"
    if status >= 500:
        return "backend_unavailable"
    return "validation"


def _graphql_class(errors: list[dict[str, Any]]) -> ErrorClass:
    if not errors:
        return "validation"
    extensions = errors[0].get("extensions")
    code: str | None = None
    if isinstance(extensions, dict):
        raw_code = cast(dict[str, Any], extensions).get("code")
        if isinstance(raw_code, str):
            code = raw_code.upper()
    if code in ("UNAUTHENTICATED", "FORBIDDEN"):
        return "auth"
    if code == "NOT_FOUND":
        return "not_found"
    if code in ("BAD_USER_INPUT", "GRAPHQL_VALIDATION_FAILED"):
        return "validation"
    return "validation"


def _graphql_message(errors: list[dict[str, Any]]) -> str:
    if errors:
        message = errors[0].get("message")
        if isinstance(message, str) and message:
            return message
    return "GraphQL error"


def classify(exc: BaseException) -> tuple[ErrorClass, str]:
    """Return `(error_class, human_message)` for a supported exception."""
    if isinstance(exc, UnknownOperationError):
        return "validation", _graphql_message(exc.errors)
    if isinstance(exc, GraphQLError):
        return _graphql_class(exc.errors), _graphql_message(exc.errors)
    if isinstance(exc, httpx.HTTPStatusError):
        status = exc.response.status_code
        return _http_class(status), f"backend returned HTTP {status}"
    if isinstance(exc, httpx.TimeoutException):
        return "backend_unavailable", "backend request timed out"
    if isinstance(exc, httpx.ConnectError):
        return "backend_unavailable", "cannot reach backend"
    if isinstance(exc, httpx.HTTPError):
        return "backend_unavailable", f"backend I/O error: {exc}"
    return "validation", str(exc) or exc.__class__.__name__


def format_message(error_class: ErrorClass, message: str) -> str:
    """Render the stable `[klicker.<class>] <message>` shape."""
    return f"[klicker.{error_class}] {message}"


def translate_and_raise(exc: BaseException) -> NoReturn:
    """Classify `exc` and raise `ToolError` with the stable prefix."""
    cls, msg = classify(exc)
    raise ToolError(format_message(cls, msg)) from exc


def extract_error_class(message: str) -> ErrorClass | None:
    """Parse the `[klicker.<class>] …` prefix back to its class."""
    if not message.startswith("[klicker."):
        return None
    end = message.find("]")
    if end <= len("[klicker."):
        return None
    candidate = message[len("[klicker.") : end]
    if candidate in ("auth", "not_found", "validation", "backend_unavailable"):
        return candidate  # type: ignore[return-value]
    return None


__all__ = [
    "ErrorClass",
    "classify",
    "extract_error_class",
    "format_message",
    "translate_and_raise",
]
