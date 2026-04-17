"""Shared pytest fixtures."""

from __future__ import annotations

from collections.abc import Iterator

import pytest


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> Iterator[None]:  # pyright: ignore[reportUnusedFunction]
    """Ensure Settings is re-read from env in every test — the `get_settings`
    `lru_cache` would otherwise leak one test's env into the next."""
    from klicker_mcp.settings import get_settings

    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
