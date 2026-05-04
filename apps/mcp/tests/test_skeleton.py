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


def test_ops_manifest_has_known_operations() -> None:
    from klicker_mcp.gql.ops import OPERATIONS

    # Sanity check: codegen emitted a meaningful manifest.
    assert isinstance(OPERATIONS, dict)
    assert len(OPERATIONS) > 50
    assert "Self" in OPERATIONS, "Self query must be in the persisted-ops manifest"
