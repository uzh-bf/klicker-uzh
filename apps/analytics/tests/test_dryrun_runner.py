"""Integration tests for the dry-run runner.

These tests require a seeded dev database (``DATABASE_URL`` present) and the
``seed:interactions`` fixture data to produce non-zero row counts. They're
gated by ``DATABASE_URL`` so unit-only runs skip cleanly.
"""

from __future__ import annotations

import os
import sys
import types
import uuid
import zipfile
from pathlib import Path

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


pytestmark = pytest.mark.integration


def _pick_course_id() -> str | None:
    from sqlalchemy import text

    from src.db import engine

    with engine.connect() as conn:
        row = conn.execute(
            text('SELECT id FROM "Course" ORDER BY "startDate" LIMIT 1')
        ).first()
    return str(row[0]) if row else None


@pytest.fixture()
def seeded_course_id():
    if not os.environ.get("DATABASE_URL"):
        pytest.skip("DATABASE_URL not set — skipping integration test")
    cid = _pick_course_id()
    if cid is None:
        pytest.skip("no courses seeded in the dev DB — run pnpm run prisma:setup")
    return cid


def test_run_dryrun_end_to_end_writes_expected_sheets(seeded_course_id, tmp_path):
    from src.dryrun.runner import run_dryrun

    output = tmp_path / f"dryrun-{seeded_course_id}.xlsx"
    buffer = run_dryrun(
        seeded_course_id,
        output,
        allow_rw_role=True,  # local dev DB is R/W — rely on interceptors alone
    )

    assert output.exists() and output.stat().st_size > 0

    with zipfile.ZipFile(output) as zf:
        workbook = zf.read("xl/workbook.xml").decode("utf-8")

    for expected in (
        "00 Run Health",
        "01 Index",
        "10 Activity",
        "11 Performance",
        "12 Chat",
        "13 Live Quiz",
        "99 Diagnostics",
    ):
        assert f'name="{expected}"' in workbook, f"missing {expected} sheet"
    assert 'name="14 Platform"' not in workbook

    # ParticipantAnalytics / AggregatedAnalytics should always have rows once
    # the seed fixture has populated responses; if not, the seed is stale.
    assert "ParticipantAnalytics" in buffer.rows_by_table
    assert len(buffer.rows_by_table["ParticipantAnalytics"]) > 0
    assert "AggregatedAnalytics" in buffer.rows_by_table
    assert len(buffer.rows_by_table["AggregatedAnalytics"]) > 0

    # Every script in the pipeline should have explicit status + row deltas.
    assert len(buffer.scripts) >= 15
    assert all(s["elapsed_s"] is not None for s in buffer.scripts)
    assert all(
        s["status"] in {"produced", "empty", "skipped", "failed"}
        for s in buffer.scripts
    )
    assert all(s["rows_written"] is not None for s in buffer.scripts)


def test_run_dryrun_aborts_on_invalid_uuid(tmp_path):
    from src.dryrun.runner import DryRunAbort, run_dryrun

    with pytest.raises(DryRunAbort):
        run_dryrun("not-a-uuid", tmp_path / "noop.xlsx", allow_rw_role=True)


def test_run_dryrun_intentionally_skips_platform_and_validity_scripts(
    tmp_path, monkeypatch
):
    from src.dryrun import runner

    fake_db = types.ModuleType("src.db")

    class _FakeConnection:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    class _FakeEngine:
        def connect(self):
            return _FakeConnection()

    fake_db.engine = _FakeEngine()
    monkeypatch.setitem(sys.modules, "src.db", fake_db)
    monkeypatch.setenv("DATABASE_URL", "postgresql://dryrun:test@localhost/klicker")
    monkeypatch.setenv("ANALYTICS_MODE", "incremental")

    captured: dict[str, object] = {}

    monkeypatch.setattr(runner, "_install_read_only_hook", lambda engine: object())
    monkeypatch.setattr(runner.event, "remove", lambda *args, **kwargs: None)
    monkeypatch.setattr(
        runner,
        "_assert_read_only_role",
        lambda connection, *, allow_rw: "dryrun_user",
    )
    monkeypatch.setattr(
        runner, "_auto_scope_window", lambda connection, course_id: None
    )
    monkeypatch.setattr(
        runner, "_detect_missing_tables", lambda connection, names: set()
    )
    monkeypatch.setattr(
        runner, "_collect_reference_lookups", lambda connection, buffer, course_id: {}
    )
    monkeypatch.setattr(runner, "_git_sha", lambda: "deadbeef")

    def _fake_write_excel(buffer, output_path, metadata):
        captured["buffer"] = buffer
        captured["metadata"] = metadata

    monkeypatch.setattr(runner, "write_excel", _fake_write_excel)
    monkeypatch.setattr(
        runner,
        "_discover_scripts",
        lambda: [
            "src.scripts.13_platform_semester_analytics",
            "src.scripts.99_mark_analytics_valid",
        ],
    )

    buffer = runner.run_dryrun(
        str(uuid.uuid4()),
        tmp_path / "dryrun.xlsx",
        allow_rw_role=True,
    )

    script_status = {entry["script"]: entry for entry in buffer.scripts}
    assert (
        script_status["src.scripts.13_platform_semester_analytics"]["status"]
        == "skipped"
    )
    assert script_status["src.scripts.99_mark_analytics_valid"]["status"] == "skipped"
    assert "PlatformSemesterAnalytics" not in buffer.table_status
    assert "AggregatedCourseAnalytics" not in buffer.table_status
    assert "analyticsLastComputedAt" not in "".join(
        entry.get("error", "") or "" for entry in buffer.scripts
    )

    metadata = captured["metadata"]
    assert metadata["scope_mode"] == "course"
    assert metadata["omitted_domains"] == "Platform"


def test_run_dryrun_does_not_persist_writes(seeded_course_id, tmp_path):
    from sqlalchemy import text

    from src.db import engine
    from src.dryrun.runner import run_dryrun

    with engine.connect() as conn:
        before = conn.execute(
            text(
                'SELECT MAX("computedAt") FROM "ParticipantAnalytics" '
                'WHERE "courseId" = :cid'
            ),
            {"cid": seeded_course_id},
        ).scalar()

    run_dryrun(seeded_course_id, tmp_path / "noop.xlsx", allow_rw_role=True)

    with engine.connect() as conn:
        after = conn.execute(
            text(
                'SELECT MAX("computedAt") FROM "ParticipantAnalytics" '
                'WHERE "courseId" = :cid'
            ),
            {"cid": seeded_course_id},
        ).scalar()

    # The dry-run must not have bumped the watermark — Python interceptors
    # should have short-circuited every would-be INSERT before it reached the DB.
    assert before == after


def test_run_dryrun_course_scope_keeps_chat_rows_to_selected_course(
    seeded_course_id, tmp_path
):
    from src.dryrun.runner import run_dryrun

    output = tmp_path / f"course-scope-{seeded_course_id}.xlsx"
    buffer = run_dryrun(
        seeded_course_id,
        output,
        allow_rw_role=True,
    )

    with zipfile.ZipFile(output) as zf:
        workbook = zf.read("xl/workbook.xml").decode("utf-8")

    assert 'name="14 Platform"' not in workbook

    for table in (
        "ParticipantChatAnalytics",
        "AggregatedChatbotAnalytics",
        "ParticipantChatOutcome",
    ):
        rows = buffer.rows_by_table.get(table, [])
        if not rows:
            continue
        assert {str(row["courseId"]) for row in rows} == {seeded_course_id}


def test_initial_aggregated_analytics_course_uses_date_sentinel(monkeypatch):
    import importlib

    class _SessionContext:
        def __enter__(self):
            return object()

        def __exit__(self, exc_type, exc, tb):
            return False

    fake_db = types.ModuleType("src.db")
    fake_db.SessionLocal = lambda: _SessionContext()
    monkeypatch.setitem(sys.modules, "src.db", fake_db)
    sys.modules.pop("src.scripts.1_initial_aggregated_analytics", None)

    module = importlib.import_module("src.scripts.1_initial_aggregated_analytics")

    captured: list[tuple[str, str, str, str, list[str] | None]] = []

    monkeypatch.setattr(module, "script_entry", lambda **kwargs: 0.0)
    monkeypatch.setattr(module, "script_exit", lambda **kwargs: None)
    monkeypatch.setattr(module, "analytics_window_since", lambda: "2100-01-01")
    monkeypatch.setattr(module, "analytics_mode", lambda: "incremental")
    monkeypatch.setattr(module, "scoped_course_ids", lambda session: [])
    monkeypatch.setattr(
        module,
        "compute_aggregated_analytics",
        lambda session, start, end, timestamp, analytics_type, verbose, course_ids=None: (
            captured.append((start, end, timestamp, analytics_type, course_ids))
        ),
    )

    module.main()

    assert captured == [("1970-01-01", "1970-01-01", "1970-01-01", "COURSE", [])]
