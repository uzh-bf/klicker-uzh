"""Unit tests for the analytics dry-run write interceptor."""

from __future__ import annotations

import os
import sys

import pytest
from sqlalchemy import text

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.dryrun.interceptor import (  # noqa: E402
    CaptureBuffer,
    classify_text,
    intercept_writes,
    remap_result_rows,
    rewrite_insert_to_select,
)


class _FakeModel:
    __tablename__ = "ParticipantAnalytics"


def test_classify_text_detects_plain_insert():
    verb, table = classify_text('INSERT INTO "ParticipantAnalytics" (id) VALUES (1)')
    assert verb == "INSERT"
    assert table == "ParticipantAnalytics"


def test_classify_text_detects_insert_with_leading_cte():
    sql = """
    WITH chat_course AS (SELECT 1)
    INSERT INTO "ParticipantChatOutcome" ("participantId") SELECT 1
    ON CONFLICT DO NOTHING
    """
    verb, table = classify_text(sql)
    assert verb == "INSERT"
    assert table == "ParticipantChatOutcome"


def test_classify_text_detects_update_with_leading_cte():
    sql = """
    WITH quiz_courses AS (SELECT 1)
    UPDATE "Course" c SET "areAnalyticsValid" = true
    WHERE EXISTS (SELECT 1 FROM quiz_courses);
    """
    verb, table = classify_text(sql)
    assert verb == "UPDATE"
    assert table == "Course"


def test_classify_text_detects_delete():
    verb, table = classify_text('DELETE FROM "ChatTopicCluster" WHERE id = 1')
    assert verb == "DELETE"
    assert table == "ChatTopicCluster"


def test_classify_text_passes_select_through():
    verb, table = classify_text('SELECT COUNT(*) FROM "Course"')
    assert verb == "SELECT"
    assert table is None


def test_classify_text_ignores_dml_keyword_in_comment():
    # A ``-- INSERT INTO "X"`` banner must not flip the classification.
    sql = '-- INSERT INTO "Course" (id) VALUES (1)\nSELECT 1'
    verb, _ = classify_text(sql)
    assert verb == "SELECT"


def test_rewrite_insert_to_select_strips_cols_and_on_conflict():
    sql = (
        'INSERT INTO "ParticipantAnalytics" ("courseId", "timestamp")\n'
        "SELECT id, NOW() FROM other\n"
        'ON CONFLICT ("courseId", "timestamp") DO UPDATE SET "timestamp" = NOW()'
    )
    result = rewrite_insert_to_select(sql)
    assert result is not None
    table, columns, rewritten = result
    assert table == "ParticipantAnalytics"
    assert columns == ["courseId", "timestamp"]
    assert rewritten.upper().startswith("SELECT")
    assert "ON CONFLICT" not in rewritten.upper()


def test_rewrite_insert_to_select_preserves_leading_cte():
    sql = (
        "WITH cuts AS (SELECT 1 AS c)\n"
        'INSERT INTO "ParticipantChatOutcome" ("participantId") SELECT c FROM cuts\n'
        "ON CONFLICT DO NOTHING"
    )
    result = rewrite_insert_to_select(sql)
    assert result is not None
    _, columns, rewritten = result
    assert columns == ["participantId"]
    assert rewritten.upper().startswith("WITH CUTS")
    assert "SELECT C FROM CUTS" in rewritten.upper()


def test_rewrite_insert_to_select_values_payload_stays_valid():
    sql = 'INSERT INTO "ChatTopicCluster" ("type") VALUES (:analytics_type)'
    result = rewrite_insert_to_select(sql)
    assert result is not None
    _, columns, rewritten = result
    assert columns == ["type"]
    # Bare ``VALUES (:param)`` is a row source that Postgres will happily execute
    # as a read. The rewrite keeps the placeholder intact for param binding.
    assert rewritten.upper().startswith("VALUES")
    assert ":analytics_type" in rewritten


def test_rewrite_insert_to_select_returns_none_for_non_insert():
    assert rewrite_insert_to_select('SELECT 1 FROM "Course"') is None


def test_remap_result_rows_uses_target_columns_for_unaliased_selects():
    rows = remap_result_rows(
        ["type", "timestamp", "chatbotId", "newParticipants"],
        [("COURSE", "1970-01-01", "cb-1", 0)],
    )
    assert rows == [
        {
            "type": "COURSE",
            "timestamp": "1970-01-01",
            "chatbotId": "cb-1",
            "newParticipants": 0,
        }
    ]


def test_remap_result_rows_rejects_column_count_mismatches():
    with pytest.raises(ValueError, match="expected 3 columns, got 2"):
        remap_result_rows(["a", "b", "c"], [(1, 2)])


def test_bulk_upsert_patch_captures_rows_without_db():
    import src.db_helpers as db_helpers

    buffer = CaptureBuffer()
    rows = [
        {"courseId": "a", "timestamp": "t1", "score": 1},
        {"courseId": "b", "timestamp": "t2", "score": 2},
    ]

    original = db_helpers.bulk_upsert
    with intercept_writes(buffer):
        # ``bulk_upsert`` is now the capturing variant; calling it must never
        # hit a DB and must report the number of rows recorded.
        written = db_helpers.bulk_upsert(
            session=None,
            Model=_FakeModel,
            rows=rows,
            conflict_cols=["courseId", "timestamp"],
        )

    assert written == 2
    assert buffer.rows_by_table["ParticipantAnalytics"] == rows
    # Patches are restored cleanly on exit.
    assert db_helpers.bulk_upsert is original


def test_bulk_upsert_patch_handles_empty_rows():
    import src.db_helpers as db_helpers

    buffer = CaptureBuffer()
    with intercept_writes(buffer):
        written = db_helpers.bulk_upsert(
            session=None,
            Model=_FakeModel,
            rows=[],
            conflict_cols=["courseId"],
        )

    assert written == 0
    assert "ParticipantAnalytics" not in buffer.rows_by_table


def test_intercept_writes_rebinds_already_imported_consumers():
    # Modules that did ``from src.db_helpers import bulk_upsert`` before the
    # interceptor was installed must still route through the capturing
    # variant — the interceptor walks sys.modules to patch them up.
    import importlib

    import src.db_helpers as db_helpers

    save_mod = importlib.import_module("src.modules.participant_analytics.save_participant_analytics")
    buffer = CaptureBuffer()
    original = db_helpers.bulk_upsert

    assert save_mod.bulk_upsert is original

    with intercept_writes(buffer):
        assert save_mod.bulk_upsert is not original
        written = save_mod.bulk_upsert(
            session=None,
            Model=_FakeModel,
            rows=[{"a": 1}],
            conflict_cols=["a"],
        )
        assert written == 1

    assert save_mod.bulk_upsert is original


def test_intercept_writes_noops_commit_and_flush():
    from sqlalchemy.orm import Session

    buffer = CaptureBuffer()
    commit_before = Session.commit
    flush_before = Session.flush

    with intercept_writes(buffer):
        assert Session.commit is not commit_before
        assert Session.flush is not flush_before

        # Build a stub that looks enough like a Session to call the patched
        # methods — noop_commit / noop_flush only take self.
        class _Stub:
            pass

        stub = _Stub()
        # Bind the patched bound methods dynamically.
        Session.commit(stub)  # type: ignore[arg-type]
        Session.flush(stub)  # type: ignore[arg-type]

    assert Session.commit is commit_before
    assert Session.flush is flush_before


@pytest.mark.parametrize("verb", ["UPDATE", "DELETE"])
def test_skipped_writes_capture_verb_and_sql(verb):
    buffer = CaptureBuffer()
    sql = f'{verb} FROM "Course" WHERE id = 1' if verb == "DELETE" else f'{verb} "Course" SET x = 1'
    buffer.skip(f"{verb}-TEXT", sql, {"x": 1})
    entry = buffer.skipped_writes[-1]
    assert entry["verb"] == f"{verb}-TEXT"
    assert entry["sql"] == sql
    assert "x" in entry["params"]


def test_capture_buffer_coerces_non_primitive_values():
    buffer = CaptureBuffer()

    class _Custom:
        def __repr__(self) -> str:
            return "<custom>"

    buffer.record("X", [{"a": _Custom(), "b": 3}])
    assert buffer.rows_by_table["X"][0]["a"] == "<custom>"
    assert buffer.rows_by_table["X"][0]["b"] == 3


def test_capture_buffer_strips_tzinfo_from_datetimes():
    # xlsxwriter rejects timezone-aware datetimes. Captured rows should be
    # written with tzinfo removed (values normalised to UTC first), so the
    # workbook round-trips cleanly through pandas' Excel writer.
    from datetime import datetime, timezone, timedelta

    buffer = CaptureBuffer()
    aware_utc = datetime(2026, 4, 20, 12, 0, tzinfo=timezone.utc)
    aware_plus2 = datetime(2026, 4, 20, 14, 0, tzinfo=timezone(timedelta(hours=2)))
    naive = datetime(2026, 4, 20, 9, 0)

    buffer.record(
        "X",
        [{"utc": aware_utc, "plus2": aware_plus2, "naive": naive}],
    )
    row = buffer.rows_by_table["X"][0]
    assert row["utc"].tzinfo is None
    assert row["plus2"].tzinfo is None
    # +02:00 at 14:00 local == 12:00 UTC
    assert row["plus2"] == datetime(2026, 4, 20, 12, 0)
    assert row["naive"] == naive


def test_intercept_writes_rolls_back_failed_rewrite_before_next_query(monkeypatch):
    from sqlalchemy.orm import Session

    class _Stub:
        def __init__(self) -> None:
            self.rollback_calls = 0
            self.tx_aborted = False

        def rollback(self) -> None:
            self.rollback_calls += 1
            self.tx_aborted = False

    def fake_execute(self, statement, params=None, **kwargs):
        sql = str(statement)
        if "missing_source" in sql:
            self.tx_aborted = True
            raise RuntimeError("boom")
        if self.tx_aborted:
            raise RuntimeError("transaction still aborted")
        return [("ok",)]

    monkeypatch.setattr(Session, "execute", fake_execute)

    buffer = CaptureBuffer()
    stub = _Stub()
    with intercept_writes(buffer):
        Session.execute(
            stub,
            text('INSERT INTO "X" ("value") SELECT value FROM missing_source'),
        )
        result = Session.execute(
            stub,
            text('INSERT INTO "X" ("value") VALUES (\'ok\')'),
        )

    assert stub.rollback_calls == 1
    assert result.rowcount == 1
    assert buffer.rows_by_table["X"] == [{"value": "ok"}]
