"""Tool modules.

Importing any submodule runs its `@mcp.tool` decorators and thereby registers
the tools on the shared `mcp` instance. `server.py` imports this package to
trigger those side effects before the server is exposed.
"""

from klicker_mcp.tools import common, lecturer  # noqa: F401  # pyright: ignore[reportUnusedImport]
