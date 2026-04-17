"""Tests for the persisted-ops GraphQL client."""

from __future__ import annotations

import json

import httpx
import pytest
from pytest_httpx import HTTPXMock

from klicker_mcp.gql.client import (
    AsyncGraphQLClient,
    GraphQLError,
    UnknownOperationError,
)


def test_client_defaults_endpoint_from_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    from klicker_mcp.settings import get_settings

    get_settings.cache_clear()
    monkeypatch.setenv("APP_ORIGIN_API", "https://api.example.test")

    client = AsyncGraphQLClient()
    assert client.endpoint == "https://api.example.test/api/graphql"


@pytest.mark.asyncio
async def test_execute_sends_persisted_query_shape(httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        url="http://localhost:3000/api/graphql",
        method="POST",
        json={"data": {"self": {"id": "u1", "role": "USER"}}},
    )

    async with AsyncGraphQLClient() as client:
        data = await client.execute("Self", variables={"liveQuizId": None}, bearer_token="abc")

    request = httpx_mock.get_request()
    assert request is not None
    assert request.headers["Authorization"] == "Bearer abc"
    body = json.loads(request.content)
    assert body["operationName"] == "Self"
    assert body["extensions"]["persistedQuery"]["version"] == 1
    assert isinstance(body["extensions"]["persistedQuery"]["sha256Hash"], str)
    assert body["variables"] == {"liveQuizId": None}
    assert data == {"self": {"id": "u1", "role": "USER"}}


@pytest.mark.asyncio
async def test_execute_omits_authorization_header_when_no_token(
    httpx_mock: HTTPXMock,
) -> None:
    httpx_mock.add_response(
        url="http://localhost:3000/api/graphql",
        method="POST",
        json={"data": {"self": None}},
    )

    async with AsyncGraphQLClient() as client:
        await client.execute("Self")

    request = httpx_mock.get_request()
    assert request is not None
    assert "authorization" not in {k.lower() for k in request.headers.keys()}


@pytest.mark.asyncio
async def test_unknown_operation_raises() -> None:
    async with AsyncGraphQLClient() as client:
        with pytest.raises(UnknownOperationError):
            await client.execute("ThisOpDoesNotExistAnywhere")


@pytest.mark.asyncio
async def test_graphql_errors_are_raised(httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        url="http://localhost:3000/api/graphql",
        method="POST",
        json={"errors": [{"message": "nope"}]},
    )

    async with AsyncGraphQLClient() as client:
        with pytest.raises(GraphQLError) as exc:
            await client.execute("Self")

    assert exc.value.errors[0]["message"] == "nope"


@pytest.mark.asyncio
async def test_custom_httpx_client_is_not_closed(httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_response(
        url="http://localhost:3000/api/graphql",
        method="POST",
        json={"data": {"self": None}},
    )

    async with httpx.AsyncClient() as shared:
        client = AsyncGraphQLClient(client=shared)
        await client.execute("Self")
        await client.aclose()
        # Shared client must remain open: calling execute again would fail otherwise.
        assert not shared.is_closed
