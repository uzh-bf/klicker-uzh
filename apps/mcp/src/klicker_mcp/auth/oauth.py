"""OAuth bridge between MCP clients and KlickerUZH `apps/auth`.

Wraps FastMCP's `OAuthProxy` to present a DCR-compliant OAuth 2.1 + PKCE face
to MCP clients (Claude Desktop, Cursor) while proxying the browser dance to
the new `/api/mcp/authorize` + `/api/mcp/token` routes on `apps/auth`.

The upstream is not a general OAuth server — it is a minimal
authorization-code shim that:
- checks the user's NextAuth session (lecturer or participant) and, if absent,
  funnels them through the existing NextAuth sign-in flow,
- mints a one-time code bound to the MCP client's PKCE challenge,
- exchanges that code for the KlickerUZH JWT the backend already accepts.

`apps/mcp` never sees a raw NextAuth session cookie; it only sees the
KlickerUZH JWT that the backend's `jwtMiddleware` validates. Tools forward
that JWT unchanged via `get_bearer_token()`.

OAuth is entirely opt-in: if `MCP_UPSTREAM_CLIENT_ID` isn't set, the server
starts in pass-through mode (clients send a raw `Authorization: Bearer <jwt>`
header themselves). That's the default for local dev and tests.
"""

from __future__ import annotations

from fastmcp.server.auth.oauth_proxy import OAuthProxy
from fastmcp.server.auth.providers.jwt import JWTVerifier

from klicker_mcp.settings import Settings


def build_oauth_proxy(settings: Settings) -> OAuthProxy | None:
    """Build an OAuth proxy provider, or None if OAuth is not configured.

    OAuth is enabled iff all of these are set:
    - `MCP_ORIGIN`                  — public URL of this server
    - `MCP_UPSTREAM_CLIENT_ID`      — pre-registered with apps/auth
    - `MCP_UPSTREAM_CLIENT_SECRET`  — shared secret with apps/auth
    - `MCP_UPSTREAM_AUTHORIZE_URL`  — typically `${APP_ORIGIN_AUTH}/api/mcp/authorize`
    - `MCP_UPSTREAM_TOKEN_URL`      — typically `${APP_ORIGIN_AUTH}/api/mcp/token`
    """
    if not (
        settings.mcp_origin
        and settings.mcp_upstream_client_id
        and settings.mcp_upstream_client_secret
        and settings.mcp_upstream_authorize_url
        and settings.mcp_upstream_token_url
    ):
        return None

    # KlickerUZH signs JWTs with HS256 + APP_SECRET (see
    # apps/backend-docker/src/app.ts jwtMiddleware). The proxy validates the
    # upstream-issued KlickerUZH JWT with the same algorithm + secret.
    token_verifier = JWTVerifier(
        public_key=settings.app_secret,
        algorithm="HS256",
        issuer=settings.mcp_upstream_issuer or None,
    )

    return OAuthProxy(
        upstream_authorization_endpoint=settings.mcp_upstream_authorize_url,
        upstream_token_endpoint=settings.mcp_upstream_token_url,
        upstream_client_id=settings.mcp_upstream_client_id,
        upstream_client_secret=settings.mcp_upstream_client_secret,
        token_verifier=token_verifier,
        base_url=settings.mcp_origin,
        # Consent page shown once per client. The user signs in at apps/auth;
        # this screen is the "allow this MCP client to act on your behalf" step.
        require_authorization_consent=True,
    )
