"""Health-check endpoint.

Wired up via FastMCP's `custom_route` decorator so the Helm deployment's
liveness + readiness probes can hit `GET /health` and the ingress can
verify the pod is up without opening an MCP transport.

Imported for its side effect (route registration) from `server.py`.
"""

from __future__ import annotations

from starlette.requests import Request
from starlette.responses import JSONResponse

from klicker_mcp import __version__ as _package_version
from klicker_mcp.app import mcp


@mcp.custom_route("/health", methods=["GET"])
async def health(_request: Request) -> JSONResponse:
    return JSONResponse({"status": "ok", "version": _package_version})
