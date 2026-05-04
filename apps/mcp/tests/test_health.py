"""Smoke test for the /health custom route.

The deploy chart wires liveness + readiness probes to this path; the test
pins that the route is registered and returns `{status: "ok", version}`.
"""

from __future__ import annotations

import json
from typing import cast

from starlette.requests import Request
from starlette.responses import JSONResponse

from klicker_mcp import __version__
from klicker_mcp.health import health
from klicker_mcp.server import mcp


async def test_health_route_registered() -> None:
    routes = mcp._additional_http_routes  # pyright: ignore[reportPrivateUsage]
    paths = {getattr(r, "path", None) for r in routes}
    assert "/health" in paths


async def test_health_returns_ok_payload() -> None:
    # Starlette Request needs a minimal ASGI scope; GET /health has no body.
    scope: dict[str, object] = {"type": "http", "method": "GET", "path": "/health", "headers": []}
    request = Request(scope)
    response = cast(JSONResponse, await health(request))
    assert response.status_code == 200
    payload = json.loads(bytes(response.body).decode())
    assert payload == {"status": "ok", "version": __version__}
