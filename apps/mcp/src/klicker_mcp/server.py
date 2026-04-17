"""FastMCP server factory for KlickerUZH.

Iteration 2 wires the `whoami` tool to the real `Self` GraphQL query via the
persisted-ops client. Lecturer and participant tool packages land in iterations
3 and 4.
"""

from __future__ import annotations

from typing import Any

from fastmcp import FastMCP

from klicker_mcp.auth import get_bearer_token
from klicker_mcp.gql import AsyncGraphQLClient, GraphQLError

mcp: FastMCP = FastMCP(name="klicker-uzh-mcp")


@mcp.tool
async def whoami() -> dict[str, Any]:
    """Return the authenticated KlickerUZH identity for the current request.

    Calls the `Self` GraphQL query with whatever bearer token the MCP client
    sent; the KlickerUZH backend is the authoritative verifier.
    """
    token = get_bearer_token()
    if not token:
        return {
            "authenticated": False,
            "reason": "no Authorization: Bearer header on request",
        }

    async with AsyncGraphQLClient() as client:
        try:
            data = await client.execute("Self", variables={"liveQuizId": None}, bearer_token=token)
        except GraphQLError as err:
            return {"authenticated": False, "errors": err.errors}

    self_ = data.get("self")
    if not isinstance(self_, dict):
        return {"authenticated": False, "reason": "backend returned no `self`"}

    return {"authenticated": True, "self": self_}
