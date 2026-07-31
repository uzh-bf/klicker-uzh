"""Shared pytest fixtures for the analytics app.

- ``session`` gives each test a rolled-back, per-test transaction against the
  dev DB. Requires ``DATABASE_URL`` to be set (CI wires this via Infisical /
  the pytest-postgresql plugin in local dev).
- ``seeded_db`` is a marker-only dependency: tests that rely on fixture data
  from ``pnpm run seed:interactions`` should opt in via the ``integration``
  marker so unit tests can run without a DB.
"""

from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


@pytest.fixture()
def session():
    """Open a session in a nested transaction that rolls back after the test.

    Skipped when ``DATABASE_URL`` is unset so unit-test runs without a DB don't
    fail on import of ``src.db``.
    """
    if not os.environ.get("DATABASE_URL"):
        pytest.skip("DATABASE_URL not set — skipping DB-backed test")

    from src.db import SessionLocal, engine

    connection = engine.connect()
    outer = connection.begin()
    sess = SessionLocal(bind=connection)
    try:
        yield sess
    finally:
        sess.close()
        outer.rollback()
        connection.close()
