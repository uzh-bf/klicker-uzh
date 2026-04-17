"""End-to-end-ish tests for the whoami tool: auth context + GraphQL client wired
together, with the backend call mocked."""

from __future__ import annotations

import pytest
from pytest_httpx import HTTPXMock

from klicker_mcp.server import whoami


@pytest.mark.asyncio
async def test_whoami_returns_unauthenticated_without_token() -> None:
    result = await whoami()
    assert result["authenticated"] is False


@pytest.mark.asyncio
async def test_whoami_forwards_bearer_and_returns_self(httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        url="http://localhost:3000/api/graphql",
        method="POST",
        json={
            "data": {
                "self": {
                    "id": "participant-1",
                    "role": "PARTICIPANT",
                    "isCourseParticipant": True,
                }
            }
        },
    )

    from unittest.mock import patch

    with patch("klicker_mcp.server.get_bearer_token", return_value="tkn"):
        result = await whoami()

    request = httpx_mock.get_request()
    assert request is not None
    assert request.headers["Authorization"] == "Bearer tkn"
    assert result["authenticated"] is True
    assert isinstance(result["self"], dict)
    assert result["self"]["id"] == "participant-1"


@pytest.mark.asyncio
async def test_whoami_handles_graphql_errors(httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        url="http://localhost:3000/api/graphql",
        method="POST",
        json={"errors": [{"message": "expired token"}]},
    )

    from unittest.mock import patch

    with patch("klicker_mcp.server.get_bearer_token", return_value="tkn"):
        result = await whoami()

    assert result["authenticated"] is False
    assert result["errors"][0]["message"] == "expired token"
