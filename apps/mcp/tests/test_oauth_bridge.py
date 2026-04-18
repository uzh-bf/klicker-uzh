"""Tests for the OAuth bridge wiring.

The OAuth proxy itself is an upstream FastMCP primitive — we don't re-test
its DCR / PKCE handling. These tests just pin:

- `build_oauth_proxy` returns None in pass-through (default) config
- `build_oauth_proxy` constructs a proxy when all upstream envs are set
- `get_bearer_token` picks the OAuth-issued token over a raw header
- `get_bearer_token` still falls back to the raw header when no OAuth ctx

Full end-to-end (Claude Desktop ↔ apps/auth) validation is manual and lives
in the iteration-5 entry in `apps/mcp/PLAN.md`.
"""

from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import MagicMock, patch

import pytest
from fastmcp.server.auth.oauth_proxy import OAuthProxy

from klicker_mcp.auth.context import get_bearer_token
from klicker_mcp.auth.oauth import build_oauth_proxy
from klicker_mcp.settings import Settings


@pytest.fixture
def oauth_env(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.setenv("MCP_ORIGIN", "https://mcp.klicker.com")
    monkeypatch.setenv("MCP_UPSTREAM_CLIENT_ID", "mcp-proxy")
    monkeypatch.setenv("MCP_UPSTREAM_CLIENT_SECRET", "shhh")
    monkeypatch.setenv("MCP_UPSTREAM_AUTHORIZE_URL", "https://auth.klicker.com/api/mcp/authorize")
    monkeypatch.setenv("MCP_UPSTREAM_TOKEN_URL", "https://auth.klicker.com/api/mcp/token")
    monkeypatch.setenv("APP_SECRET", "abcd")
    yield


def test_build_oauth_proxy_returns_none_when_unconfigured() -> None:
    settings = Settings(
        MCP_ORIGIN=None,
        MCP_UPSTREAM_CLIENT_ID=None,
        MCP_UPSTREAM_CLIENT_SECRET=None,
        MCP_UPSTREAM_AUTHORIZE_URL=None,
        MCP_UPSTREAM_TOKEN_URL=None,
    )
    assert build_oauth_proxy(settings) is None


def test_build_oauth_proxy_partial_config_returns_none() -> None:
    # Client secret missing => OAuth stays disabled.
    settings = Settings(
        MCP_ORIGIN="https://mcp.klicker.com",
        MCP_UPSTREAM_CLIENT_ID="id",
        MCP_UPSTREAM_CLIENT_SECRET=None,
        MCP_UPSTREAM_AUTHORIZE_URL="https://auth.klicker.com/api/mcp/authorize",
        MCP_UPSTREAM_TOKEN_URL="https://auth.klicker.com/api/mcp/token",
    )
    assert build_oauth_proxy(settings) is None


def test_build_oauth_proxy_constructs_proxy_when_configured(oauth_env: None) -> None:
    proxy = build_oauth_proxy(Settings())
    assert proxy is not None
    assert isinstance(proxy, OAuthProxy)


def test_get_bearer_token_prefers_oauth_access_token() -> None:
    fake_access = MagicMock()
    fake_access.token = "oauth-issued-jwt"

    # get_access_token returns the fake; get_http_request would find a header
    # but we want to assert OAuth wins.
    with (
        patch("klicker_mcp.auth.context.get_http_request") as mock_req,
        patch("fastmcp.server.dependencies.get_access_token", return_value=fake_access),
    ):
        mock_req.return_value.headers = {"authorization": "Bearer raw-header-jwt"}
        assert get_bearer_token() == "oauth-issued-jwt"


def test_get_bearer_token_falls_back_to_header() -> None:
    with (
        patch("klicker_mcp.auth.context.get_http_request") as mock_req,
        patch("fastmcp.server.dependencies.get_access_token", return_value=None),
    ):
        mock_req.return_value.headers = {"authorization": "Bearer raw-header-jwt"}
        assert get_bearer_token() == "raw-header-jwt"


def test_get_bearer_token_none_when_neither_present() -> None:
    with (
        patch("klicker_mcp.auth.context.get_http_request") as mock_req,
        patch("fastmcp.server.dependencies.get_access_token", return_value=None),
    ):
        mock_req.return_value.headers = {}
        assert get_bearer_token() is None


def test_get_bearer_token_survives_access_token_exception() -> None:
    def raise_err() -> None:
        raise RuntimeError("no auth context")

    with (
        patch("klicker_mcp.auth.context.get_http_request") as mock_req,
        patch("fastmcp.server.dependencies.get_access_token", side_effect=raise_err),
    ):
        mock_req.return_value.headers = {"authorization": "Bearer fallback"}
        assert get_bearer_token() == "fallback"
