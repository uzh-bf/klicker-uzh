"""Shared helpers for tool implementations."""

from __future__ import annotations

from klicker_mcp.auth import get_bearer_token


class NotAuthenticatedError(RuntimeError):
    """Raised when a tool is invoked without an Authorization: Bearer header.

    FastMCP surfaces this as a tool error to the MCP client, which prompts
    the LLM to reauth rather than silently failing.
    """


def require_bearer_token() -> str:
    token = get_bearer_token()
    if not token:
        raise NotAuthenticatedError(
            "Missing Authorization: Bearer <jwt> header. The MCP client must "
            "authenticate with a KlickerUZH JWT before calling role-gated tools."
        )
    return token


def optional_bearer_token() -> str | None:
    """Return the bearer token if present, else None.

    Use for ops the backend marks as open fields (e.g. `GetPracticeQuiz`)
    where an unauthenticated caller is still a valid caller.
    """
    return get_bearer_token()
