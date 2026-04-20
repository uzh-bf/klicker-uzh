"""Shared helpers for tool implementations."""

from __future__ import annotations

from typing import Any

from fastmcp.exceptions import ToolError

from klicker_mcp.auth import get_bearer_token
from klicker_mcp.gql.errors import format_message

__all__ = ["NotAuthenticatedError", "drop_none", "get_bearer_token", "require_bearer_token"]


class NotAuthenticatedError(ToolError):
    """Raised when a tool is invoked without an Authorization: Bearer header.

    Subclasses `ToolError` so FastMCP surfaces the stable `[klicker.auth] …`
    prefix to the MCP client without an extra translation step.
    """


def require_bearer_token() -> str:
    token = get_bearer_token()
    if not token:
        raise NotAuthenticatedError(
            format_message(
                "auth",
                "missing Authorization: Bearer <jwt> header; the MCP client must "
                "authenticate with a KlickerUZH JWT before calling role-gated tools",
            )
        )
    return token


def drop_none(payload: dict[str, Any]) -> dict[str, Any]:
    """Strip top-level None values so the GraphQL call uses server defaults."""
    return {k: v for k, v in payload.items() if v is not None}
