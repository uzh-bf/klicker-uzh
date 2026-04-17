"""CLI entry point for the klicker-mcp server."""

from __future__ import annotations

from klicker_mcp.logging import configure_logging, get_logger
from klicker_mcp.server import mcp
from klicker_mcp.settings import get_settings


def main() -> None:
    settings = get_settings()
    configure_logging(level=settings.log_level)
    log = get_logger(__name__)
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
