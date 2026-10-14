"""Mints the `next-auth.session-token` cookie the Manage chat route verifies.

Mirrors `apps/chat/src/lib/server/manageAuth.ts::getAuthenticatedManageUser`:
HS256, secret = APP_SECRET, required claims `sub` (non-empty string) and
`role` in {USER, ADMIN}. `scope` (a `UserLoginScope` value) is read but not
gated by manageAuth itself — it only matters downstream, when
`mcpAuthMint.ts::resolveLecturerMcpScope` maps it to the lecturer-MCP JWT
scope. verifyJWT is called there with no `issuer` option, so no `iss` claim
is required or checked.
"""

from __future__ import annotations

import time

import jwt

DEFAULT_TTL_SECONDS = 60 * 60  # generous; this is a simulated login session


def mint_session_token(
    *,
    sub: str,
    secret: str,
    role: str = "ADMIN",
    scope: str | None = "ACCOUNT_OWNER",
    ttl_seconds: int = DEFAULT_TTL_SECONDS,
) -> str:
    """Signs a session-token JWT for `sub` with the given role/scope.

    `role` must be "USER" or "ADMIN" to pass manageAuth's MANAGE_ROLES check.
    `scope` should be a `UserLoginScope` value (ACCOUNT_OWNER, FULL_ACCESS,
    READ_ONLY, SESSION_EXEC, OTP, ...) or None to simulate a pre-scope
    session (manageAuth treats a missing scope as least-privilege).
    """
    now = int(time.time())
    payload: dict[str, object] = {
        "sub": sub,
        "role": role,
        "iat": now,
        "exp": now + ttl_seconds,
    }
    if scope is not None:
        payload["scope"] = scope
    return jwt.encode(payload, secret, algorithm="HS256")


def session_cookie_header(cookie_name: str, token: str) -> str:
    return f"{cookie_name}={token}"
