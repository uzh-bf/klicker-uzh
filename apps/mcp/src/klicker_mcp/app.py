"""Single source of truth for the FastMCP instance.

Split out from `server.py` so that tool modules can register themselves on this
instance without creating an import cycle back through `server.py`.
"""

from __future__ import annotations

from fastmcp import FastMCP

mcp: FastMCP = FastMCP(name="klicker-uzh-mcp")
