"""Helpers for extracting KlickerUZH identity from the current FastMCP request.

Two modes, probed in order:

1. **OAuth mode (iteration 5).** When the server is configured with
   `build_oauth_proxy`, FastMCP exposes the access token issued by the proxy
   via `get_access_token()`. The OAuth proxy stores the upstream KlickerUZH
   JWT alongside it (one-way mapping) and presents the raw KlickerUZH JWT
   back to tools so they can forward it to the GraphQL backend.

2. **Pass-through mode (iterations 2-4).** No OAuth configured; the MCP
   client sends a raw `Authorization: Bearer <jwt>` header itself, which we
   forward verbatim. This remains the default for local dev and CI so tests
   don't need to spin up a mock IdP.

The KlickerUZH GraphQL backend's `jwtMiddleware` is always the authoritative
verifier.
"""

from __future__ import annotations

from fastmcp.server.dependencies import get_http_request


def _token_from_oauth_context() -> str | None:
    """Return the upstream KlickerUZH JWT captured by `OAuthProxy`, if any.

    Imported lazily so pass-through callers don't pay an import cost and
    tests that don't touch OAuth never need the dependency wired.
    """
    try:
        from fastmcp.server.dependencies import get_access_token
    except ImportError:
        return None

    try:
        access = get_access_token()
    except Exception:
        return None

    if access is None:
        return None

    # FastMCP's AccessToken carries the raw token string verbatim — that's
    # the upstream KlickerUZH JWT in our proxy setup (HS256 over APP_SECRET),
    # which the backend `jwtMiddleware` accepts directly.
    token = getattr(access, "token", None)
    if isinstance(token, str) and token.strip():
        return token.strip()
    return None


def _token_from_header() -> str | None:
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


def get_bearer_token() -> str | None:
    """Return the bearer token on the current request, or None.

    Prefers an OAuth-issued access token; falls back to the raw
    `Authorization` header.
    """
    return _token_from_oauth_context() or _token_from_header()
