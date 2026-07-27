"""Shared fixtures for the manage-assistant eval suite.

Skip semantics (per the mission brief): the whole suite must skip cleanly —
not fail red — when the live dev stack or DB is unreachable, or when the E6
seed step hasn't been run yet. `_require_live_environment` is
session-scoped and autouse, so every test in every module depends on it
implicitly; a `pytest.skip` there skips the entire run with one clear
reason instead of every individual test failing on a connection error.
"""

from __future__ import annotations

from pathlib import Path

import httpx
import pytest
from scoring import collector

from manage_assistant_eval.config import EVAL_SEED_PREFIX, Settings, load_settings
from manage_assistant_eval.seed import _connect, verify_connectivity

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "ground_truth"


def _check_environment(settings: Settings) -> str | None:
    """Returns a skip reason if the environment isn't ready to run the
    suite against, else None."""
    try:
        verify_connectivity(settings)
    except Exception as exc:  # noqa: BLE001 - any DB error means "not ready"
        return f"database unreachable ({exc!r}); is the dev DB/devrouter tunnel up?"

    try:
        verify = settings.ca_bundle if settings.ca_bundle else True
        with httpx.Client(verify=verify, timeout=5.0) as client:
            client.get(settings.chat_endpoint)
    except httpx.HTTPError as exc:
        return f"chat route unreachable at {settings.chat_endpoint} ({exc!r}); is the stack up?"

    try:
        with _connect(settings) as conn, conn.cursor() as cur:
            cur.execute(
                'SELECT count(*) FROM "User" WHERE shortname = %s',
                (f"{EVAL_SEED_PREFIX}-collaborator",),
            )
            (count,) = cur.fetchone()
    except Exception as exc:  # noqa: BLE001
        return f"could not query seed data ({exc!r})"

    if count == 0:
        return (
            "E6 seed data not found — run "
            "`uv run python -m manage_assistant_eval.seed --seed` first"
        )

    return None


@pytest.fixture(scope="session")
def settings() -> Settings:
    return load_settings()


@pytest.fixture(scope="session")
def _live_environment_reason(settings: Settings) -> str | None:
    """Session-scoped so the DB/HTTP readiness probe runs at most once."""
    return _check_environment(settings)


@pytest.fixture(autouse=True)
def _require_live_environment(request: pytest.FixtureRequest) -> None:
    """Function-scoped gate so `@pytest.mark.offline` tests can opt out.

    The marker is checked BEFORE `_live_environment_reason` is requested, so
    an offline test never constructs `Settings` and never touches the DB or
    the network — that is what lets the scoring-contract tests (which assert
    the gates can actually fail) run in CI with no dev stack at all. Live
    tests still share the single cached probe.
    """
    if request.node.get_closest_marker("offline"):
        return
    reason = request.getfixturevalue("_live_environment_reason")
    if reason:
        pytest.skip(f"manage-assistant eval environment not ready: {reason}")


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    # Only print the score summary if at least one dimension actually ran
    # (i.e. we weren't skipped for environment reasons before any case ran).
    if any(dim.cases for dim in collector.dimensions.values()):
        collector.print_summary()
