"""Tests for the bearer-token extraction helper."""

from __future__ import annotations

from unittest.mock import patch

from starlette.requests import Request

from klicker_mcp.auth.context import get_bearer_token


def _fake_request(headers: dict[str, str]) -> Request:
    # Minimal ASGI scope good enough for Starlette's Headers parser.
    raw_headers = [(k.lower().encode(), v.encode()) for k, v in headers.items()]
    scope = {"type": "http", "method": "GET", "path": "/", "headers": raw_headers}
    return Request(scope)  # pyright: ignore[reportArgumentType]


def test_returns_none_when_no_http_request() -> None:
    with patch(
        "klicker_mcp.auth.context.get_http_request",
        side_effect=RuntimeError("not in request scope"),
    ):
        assert get_bearer_token() is None


def test_returns_none_when_no_authorization_header() -> None:
    with patch(
        "klicker_mcp.auth.context.get_http_request",
        return_value=_fake_request({}),
    ):
        assert get_bearer_token() is None


def test_extracts_bearer_token() -> None:
    with patch(
        "klicker_mcp.auth.context.get_http_request",
        return_value=_fake_request({"Authorization": "Bearer abc.def.ghi"}),
    ):
        assert get_bearer_token() == "abc.def.ghi"


def test_rejects_non_bearer_scheme() -> None:
    with patch(
        "klicker_mcp.auth.context.get_http_request",
        return_value=_fake_request({"Authorization": "Basic dXNlcjpwYXNz"}),
    ):
        assert get_bearer_token() is None


def test_lowercase_authorization_header() -> None:
    with patch(
        "klicker_mcp.auth.context.get_http_request",
        return_value=_fake_request({"authorization": "Bearer xyz"}),
    ):
        assert get_bearer_token() == "xyz"
