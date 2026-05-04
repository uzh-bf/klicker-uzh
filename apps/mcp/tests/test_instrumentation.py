"""`@instrument` shape checks: structured log line per call, error-class
extraction, and translation of untranslated exceptions into `ToolError`.
"""

from __future__ import annotations

from collections.abc import Iterator
from unittest.mock import MagicMock

import pytest
from fastmcp.exceptions import ToolError

from klicker_mcp.tools import _instrumentation
from klicker_mcp.tools._instrumentation import instrument


@pytest.fixture
def logger_spy(monkeypatch: pytest.MonkeyPatch) -> Iterator[MagicMock]:
    spy = MagicMock()
    monkeypatch.setattr(_instrumentation, "_logger", spy)
    yield spy


@instrument
async def _ok_tool(x: int) -> int:
    return x * 2


@instrument
async def _auth_fail_tool() -> None:
    raise ToolError("[klicker.auth] missing token")


@instrument
async def _leaking_tool() -> None:
    raise RuntimeError("wild exception")


@pytest.mark.asyncio
async def test_instrument_logs_ok_outcome(logger_spy: MagicMock) -> None:
    result = await _ok_tool(3)
    assert result == 6

    logger_spy.info.assert_called_once()
    _args, kwargs = logger_spy.info.call_args
    assert _args == ("tool_call",)
    assert kwargs["tool"] == "_ok_tool"
    assert kwargs["outcome"] == "ok"
    assert kwargs["participant_sub"] is None
    assert isinstance(kwargs["latency_ms"], int)


@pytest.mark.asyncio
async def test_instrument_logs_error_class_and_reraises(logger_spy: MagicMock) -> None:
    with pytest.raises(ToolError) as exc:
        await _auth_fail_tool()

    assert str(exc.value).startswith("[klicker.auth]")
    logger_spy.warning.assert_called_once()
    _args, kwargs = logger_spy.warning.call_args
    assert _args == ("tool_call",)
    assert kwargs["outcome"] == "error"
    assert kwargs["error_class"] == "auth"
    assert kwargs["tool"] == "_auth_fail_tool"


@pytest.mark.asyncio
async def test_instrument_translates_stray_exception(logger_spy: MagicMock) -> None:
    with pytest.raises(ToolError) as exc:
        await _leaking_tool()

    assert str(exc.value).startswith("[klicker.")
    logger_spy.warning.assert_called_once()
    _args, kwargs = logger_spy.warning.call_args
    assert kwargs["exception_type"] == "RuntimeError"
    assert kwargs["error_class"] == "backend_unavailable"


@pytest.mark.asyncio
async def test_instrument_reports_participant_sub_from_jwt(
    logger_spy: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    import jwt

    token = jwt.encode(
        {"sub": "participant-42"},
        "0" * 32,
        algorithm="HS256",
    )
    monkeypatch.setattr(
        _instrumentation,
        "get_bearer_token",
        lambda: token,
    )

    @instrument
    async def tool() -> str:
        return "ok"

    await tool()

    _args, kwargs = logger_spy.info.call_args
    assert kwargs["participant_sub"] == "participant-42"


@pytest.mark.asyncio
async def test_instrument_participant_sub_none_on_malformed_token(
    logger_spy: MagicMock,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        _instrumentation,
        "get_bearer_token",
        lambda: "not-a-jwt",
    )

    @instrument
    async def tool() -> str:
        return "ok"

    await tool()

    _args, kwargs = logger_spy.info.call_args
    assert kwargs["participant_sub"] is None
