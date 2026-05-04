"""Tools usable by both lecturer and participant roles."""

from __future__ import annotations

from typing import Any

from fastmcp.exceptions import ToolError

from klicker_mcp.app import mcp
from klicker_mcp.auth import get_bearer_token
from klicker_mcp.gql import AsyncGraphQLClient
from klicker_mcp.gql.errors import extract_error_class
from klicker_mcp.tools._annotations import READ_ONLY
from klicker_mcp.tools._instrumentation import instrument
from klicker_mcp.tools._meta import tool_meta


@mcp.tool(
    title="Who am I",
    annotations=READ_ONLY,
    meta=tool_meta(audience="any", category="meta"),
)
@instrument
async def whoami() -> dict[str, Any]:
    """Return the authenticated KlickerUZH identity for the current request.

    Calls the `Self` GraphQL query with whatever bearer token the MCP client
    sent; the KlickerUZH backend is the authoritative verifier. Unauthenticated
    and auth-error callers receive a structured `{authenticated: False}` payload
    instead of a raised error — this tool is the one deliberate exception to
    the project-wide error-translation rule.
    """
    token = get_bearer_token()
    if not token:
        return {
            "authenticated": False,
            "reason": "no Authorization: Bearer header on request",
        }

    try:
        async with AsyncGraphQLClient() as client:
            data = await client.execute("Self", variables={"liveQuizId": None}, bearer_token=token)
    except ToolError as err:
        return {
            "authenticated": False,
            "error_class": extract_error_class(str(err)),
            "message": str(err),
        }

    self_ = data.get("self")
    if not isinstance(self_, dict):
        return {"authenticated": False, "reason": "backend returned no `self`"}

    return {"authenticated": True, "self": self_}
