"""Error-class translation: each backend failure shape maps to one of the four
taxonomy classes (`auth`, `not_found`, `validation`, `backend_unavailable`) and
surfaces as a `ToolError` with the `[klicker.<class>] …` prefix.
"""

from __future__ import annotations

import httpx
import pytest
from fastmcp.exceptions import ToolError
from pytest_httpx import HTTPXMock

from klicker_mcp.gql.client import AsyncGraphQLClient
from klicker_mcp.gql.errors import classify, extract_error_class


@pytest.mark.parametrize(
    ("status_code", "expected_class"),
    [
        (401, "auth"),
        (403, "auth"),
        (404, "not_found"),
        (400, "validation"),
        (422, "validation"),
        (500, "backend_unavailable"),
        (502, "backend_unavailable"),
        (503, "backend_unavailable"),
    ],
)
@pytest.mark.asyncio
async def test_http_status_maps_to_error_class(
    httpx_mock: HTTPXMock,
    status_code: int,
    expected_class: str,
) -> None:
    httpx_mock.add_response(
        url="http://localhost:3000/api/graphql",
        method="POST",
        status_code=status_code,
        json={"errors": [{"message": "err"}]},
    )

    async with AsyncGraphQLClient() as client:
        with pytest.raises(ToolError) as exc:
            await client.execute("Self")

    assert str(exc.value).startswith(f"[klicker.{expected_class}] ")
    assert extract_error_class(str(exc.value)) == expected_class


@pytest.mark.parametrize(
    ("code", "expected_class"),
    [
        ("UNAUTHENTICATED", "auth"),
        ("FORBIDDEN", "auth"),
        ("NOT_FOUND", "not_found"),
        ("BAD_USER_INPUT", "validation"),
        ("GRAPHQL_VALIDATION_FAILED", "validation"),
        ("SOMETHING_ELSE", "validation"),
        (None, "validation"),
    ],
)
@pytest.mark.asyncio
async def test_graphql_extension_code_maps_to_error_class(
    httpx_mock: HTTPXMock,
    code: str | None,
    expected_class: str,
) -> None:
    error: dict[str, object] = {"message": "boom"}
    if code is not None:
        error["extensions"] = {"code": code}
    httpx_mock.add_response(
        url="http://localhost:3000/api/graphql",
        method="POST",
        json={"errors": [error]},
    )

    async with AsyncGraphQLClient() as client:
        with pytest.raises(ToolError) as exc:
            await client.execute("Self")

    assert str(exc.value).startswith(f"[klicker.{expected_class}] ")
    assert "boom" in str(exc.value)


@pytest.mark.asyncio
async def test_timeout_maps_to_backend_unavailable(httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_exception(httpx.ReadTimeout("slow"))

    async with AsyncGraphQLClient() as client:
        with pytest.raises(ToolError) as exc:
            await client.execute("Self")

    assert str(exc.value).startswith("[klicker.backend_unavailable] ")


@pytest.mark.asyncio
async def test_connect_error_maps_to_backend_unavailable(httpx_mock: HTTPXMock) -> None:
    httpx_mock.add_exception(httpx.ConnectError("refused"))

    async with AsyncGraphQLClient() as client:
        with pytest.raises(ToolError) as exc:
            await client.execute("Self")

    assert str(exc.value).startswith("[klicker.backend_unavailable] ")


def test_classify_unknown_exception_defaults_to_validation() -> None:
    cls, msg = classify(ValueError("something off"))
    assert cls == "validation"
    assert "something off" in msg


def test_extract_error_class_round_trip() -> None:
    assert extract_error_class("[klicker.auth] missing token") == "auth"
    assert extract_error_class("[klicker.backend_unavailable] boom") == "backend_unavailable"
    assert extract_error_class("no prefix") is None
    assert extract_error_class("[klicker.bogus] x") is None
