"""CLI entry point for the klicker-mcp server."""

from __future__ import annotations

from klicker_mcp.auth.oauth import build_oauth_proxy
from klicker_mcp.logging import configure_logging, get_logger
from klicker_mcp.server import mcp
from klicker_mcp.settings import get_settings


def main() -> None:
    settings = get_settings()
    configure_logging(level=settings.log_level)
    log = get_logger(__name__)

    # Attach the OAuth proxy if configured. Tools are already registered on
    # `mcp` at module-import time; auth is orthogonal to that registration.
    auth = build_oauth_proxy(settings)
    if auth is not None:
        mcp.auth = auth
        log.info("oauth enabled", upstream=settings.mcp_upstream_authorize_url)
    else:
        log.info("oauth disabled (pass-through mode)")

    log.info(
        "starting klicker-mcp",
        host=settings.host,
        port=settings.port,
        path=settings.mcp_path,
    )
    mcp.run(
        transport="http",
        host=settings.host,
        port=settings.port,
        path=settings.mcp_path,
    )


if __name__ == "__main__":
    main()
