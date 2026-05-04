"""Shared pytest fixtures and test helpers."""

from __future__ import annotations

import json
from collections.abc import Iterator
from typing import Any

import pytest
from pytest_httpx import HTTPXMock


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> Iterator[None]:  # pyright: ignore[reportUnusedFunction]
    """Ensure Settings is re-read from env in every test — the `get_settings`
    `lru_cache` would otherwise leak one test's env into the next."""
    from klicker_mcp.settings import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def mock_graphql(httpx_mock: HTTPXMock, response_data: dict[str, Any]) -> None:
    """Stub a POST to the local GraphQL endpoint with the given `data` payload."""
    httpx_mock.add_response(
        url="http://localhost:3000/api/graphql",
        method="POST",
        json={"data": response_data},
    )


def sent_body(httpx_mock: HTTPXMock) -> dict[str, Any]:
    """Return the JSON body of the most recent intercepted request."""
    request = httpx_mock.get_request()
    assert request is not None
    body: dict[str, Any] = json.loads(request.content)
    return body
