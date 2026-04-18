"""FastMCP server module.

Re-exports the shared `mcp` instance from `klicker_mcp.app` and imports the
`tools` package so every `@mcp.tool` decorator runs at module load and the
server is fully populated by the time anyone reaches `main.py`.
"""

from __future__ import annotations

from klicker_mcp.app import mcp
from klicker_mcp.tools import common, lecturer  # noqa: F401  # pyright: ignore[reportUnusedImport]

__all__ = ["mcp"]
