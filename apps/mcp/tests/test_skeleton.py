"""Iteration-1 sanity tests: the package imports, the server object exists, the
placeholder tool is registered."""

from __future__ import annotations

import pytest


def test_package_version() -> None:
    from klicker_mcp import __version__

    assert __version__ == "0.1.0"


def test_server_instance() -> None:
    from klicker_mcp.server import mcp

    assert mcp.name == "klicker-uzh-mcp"


@pytest.mark.asyncio
async def test_whoami_tool_registered() -> None:
    from klicker_mcp.server import mcp

    tools = await mcp.list_tools()
    tool_names = {t.name for t in tools}
    assert "whoami" in tool_names


def test_settings_defaults() -> None:
    from klicker_mcp.settings import Settings

    settings = Settings()
    assert settings.port == 7079
    assert settings.mcp_path == "/mcp"
