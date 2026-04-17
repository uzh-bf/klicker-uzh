"""Helpers for extracting KlickerUZH identity from the current FastMCP request.

Iteration 2 is intentionally pass-through: the MCP does not verify JWTs locally,
it just forwards whatever `Authorization: Bearer <jwt>` header the client sends
to the KlickerUZH GraphQL backend, which is the authoritative verifier
(`apps/backend-docker/src/app.ts` jwtMiddleware).

Local JWT verification + the OAuth bridge that issues MCP-specific tokens land
in iteration 5.
"""

from __future__ import annotations

from fastmcp.server.dependencies import get_http_request


def get_bearer_token() -> str | None:
    """Return the bearer token on the current HTTP request, or None."""
    try:
        request = get_http_request()
    except Exception:
        return None

    header = request.headers.get("authorization") or request.headers.get("Authorization")
    if not header:
        return None

    parts = header.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None

    token = parts[1].strip()
    return token or None
