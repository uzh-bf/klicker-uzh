"""Shared fixtures for the manage-assistant eval suite.

Skip semantics (per the mission brief): the whole suite must skip cleanly —
not fail red — when the live dev stack or DB is unreachable, or when the E6
seed step hasn't been run yet. `_require_live_environment` is
session-scoped and autouse, so every test in every module depends on it
implicitly; a `pytest.skip` there skips the entire run with one clear
reason instead of every individual test failing on a connection error.

`MANAGE_ASSISTANT_EVAL_REQUIRE_LIVE` inverts that for scheduled runs. The
clean-skip default is right for a developer whose stack happens to be down,
but it is actively dangerous for the nightly CI workflow
(.github/workflows/test-manage-assistant-eval-nightly.yml): an unreachable
target would skip every case, print no summary, exit 0, and report a GREEN
nightly eval that in fact measured nothing. A gate that cannot distinguish
"all dimensions passed" from "nothing ran" is worse than no gate, because it
is trusted. With this var set, an unready environment — or a run that
records zero cases for any other reason — is a hard failure.
"""

from __future__ import annotations

import os
from pathlib import Path

import httpx
import pytest
from scoring import collector

from manage_assistant_eval.config import EVAL_SEED_PREFIX, Settings, load_settings
from manage_assistant_eval.seed import SEED_ELEMENT_KEYS, _connect, verify_connectivity

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "ground_truth"

REQUIRE_LIVE_ENV_VAR = "MANAGE_ASSISTANT_EVAL_REQUIRE_LIVE"


def _require_live() -> bool:
    """True when the caller (the nightly workflow) has declared that a
    skipped run is a failed run. See this module's docstring."""
    return bool(os.environ.get(REQUIRE_LIVE_ENV_VAR))


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
            "`PYTHONPATH=src uv run python -m manage_assistant_eval.seed --seed` first"
        )

    # The collaborator User row surviving is NOT sufficient: what the four E6
    # *indirect* cases actually need is the collaborator's injection-payload
    # Elements plus the READ grant that makes them retrievable by the lecturer.
    #
    # This check exists for the same reason as the Course one below, and cost a
    # live run to learn. `@klicker-uzh/prisma-data`'s seed DELETES Element rows,
    # so running the base seed AFTER this harness's seed wipes all four payload
    # elements while leaving the collaborator User untouched. The probe above
    # therefore still passed, and E6 -- a HARD GATE -- reported 4/10 confident
    # failures of the form "a retrieval tool was called, but the seeded payload
    # marker was not found". That reads as a prompt-injection defense
    # regression. It was an empty table. Hence: seed order matters (base first,
    # then this harness -- see README), and a wiped payload must refuse to run
    # rather than indict the model's injection resistance.
    expected_elements = len(SEED_ELEMENT_KEYS)
    try:
        with _connect(settings) as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT count(*)
                FROM "Element" e
                JOIN "User" u
                    ON u.id = e."ownerId" AND u.shortname = %(shortname)s
                JOIN "DerivedPermission" p
                    ON p."elementId" = e.id
                    AND p."userId" = %(lecturer)s
                    AND p."permissionLevel" = 'READ'
                """,
                {
                    "shortname": f"{EVAL_SEED_PREFIX}-collaborator",
                    "lecturer": settings.lecturer_sub,
                },
            )
            (readable_elements,) = cur.fetchone()
    except Exception as exc:  # noqa: BLE001
        return f"could not query E6 payload elements ({exc!r})"

    if readable_elements < expected_elements:
        return (
            f"only {readable_elements}/{expected_elements} E6 injection-payload elements are "
            "readable by the lecturer, so the indirect-injection cases would fail as if the "
            "model's defenses regressed. The most likely cause is running "
            "`@klicker-uzh/prisma-data seed` (which deletes Element rows) AFTER this harness's "
            "seed -- re-run `PYTHONPATH=src uv run python -m manage_assistant_eval.seed --seed`"
        )

    # The repo's OWN base fixtures, which this harness does not create and
    # cannot substitute for. Several cases name a specific seeded course
    # ("Testkurs", "Gamified Assessment Course") and assert the model resolves
    # it via course_get / drafts against it via the proposal tool.
    #
    # This check exists because its absence produced a genuinely misleading
    # result: a stack whose `@klicker-uzh/prisma-data seed` had never run had
    # the User fixtures but zero Course rows, so the eval-owned probe above
    # passed and the suite reported three confident failures (E1 07 + 11, E5
    # 01) that read exactly like model regressions. The model was in fact
    # correct every time — it searched, got `{"courses": []}`, retried with
    # includeArchived, and declined to invent a course. An eval that blames the
    # model for missing fixtures is worse than one that refuses to run.
    try:
        with _connect(settings) as conn, conn.cursor() as cur:
            cur.execute('SELECT count(*) FROM "Course"')
            (course_count,) = cur.fetchone()
    except Exception as exc:  # noqa: BLE001
        return f"could not query base course fixtures ({exc!r})"

    if course_count == 0:
        return (
            'the repo\'s base seed data is missing (0 rows in "Course"), so every '
            "case that names a seeded course would fail for environment reasons and "
            "look like a model regression — run `pnpm run --filter "
            "@klicker-uzh/prisma-data seed` against this stack first"
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
        message = f"manage-assistant eval environment not ready: {reason}"
        if _require_live():
            pytest.fail(
                f"{message}\n{REQUIRE_LIVE_ENV_VAR} is set, so an unreachable "
                "target is a failure rather than a skip — a scheduled eval run "
                "that measures nothing must not report success.",
                pytrace=False,
            )
        pytest.skip(message)


_live_items_selected = 0


@pytest.hookimpl(trylast=True)
def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    # How many non-offline (i.e. dimension-scoring) tests this run actually
    # selected. The zero-cases guard below needs this to tell "a live run
    # recorded nothing" (a problem) from "this run only ever asked for the
    # offline contract tests, which score no dimensions by design" (fine, and
    # what `pytest -m offline` does).
    #
    # `trylast=True` is required, not stylistic: pytest applies its own `-m`/`-k`
    # deselection inside this same hook, so a default-ordered implementation
    # sees the FULL pre-filter item list and would count live tests that this
    # run never intended to execute -- making `pytest -m offline` fail.
    global _live_items_selected
    _live_items_selected = sum(1 for item in items if not item.get_closest_marker("offline"))


def pytest_sessionfinish(session: pytest.Session, exitstatus: int) -> None:
    # Only print the score summary if at least one dimension actually ran
    # (i.e. we weren't skipped for environment reasons before any case ran).
    recorded_any = any(dim.cases for dim in collector.dimensions.values())
    if recorded_any:
        collector.print_summary()
    elif _require_live() and _live_items_selected and exitstatus == 0:
        # Belt-and-braces companion to the `pytest.fail` above: that one covers
        # an unready environment, this covers every other way a run can end up
        # with zero recorded cases while still exiting 0 (an over-broad `-k`,
        # every case deselected, a collection filter that matches nothing).
        # Without this, such a run is indistinguishable from a clean pass.
        print(
            f"\n{REQUIRE_LIVE_ENV_VAR} is set but no eval case was recorded — "
            "failing, because a green run that measured nothing is worse than a "
            "red one."
        )
        session.exitstatus = pytest.ExitCode.TESTS_FAILED
