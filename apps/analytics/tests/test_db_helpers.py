"""Unit tests for ``src.db_helpers`` that don't hit the database.

The ``bulk_upsert`` SQL generation is exercised through a monkeypatched
``session.execute`` so we can assert on the compiled statement shape without
needing a live DB connection.
"""

from __future__ import annotations

import os
import sys
from types import SimpleNamespace

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.db_helpers import bulk_upsert, row_to_dict, scope_by_course_ids  # noqa: E402
from src.models import AggregatedAnalytics, ParticipantAnalytics  # noqa: E402


class _FakeColumn:
    def __init__(self, name: str):
        self.name = name

    def in_(self, values):
        return ("in", self.name, list(values))


class _FakeStmt:
    def __init__(self, filters=None):
        self.filters = list(filters or [])

    def where(self, predicate):
        return _FakeStmt([*self.filters, predicate])


class _RecordingSession:
    def __init__(self):
        self.executed = []

    def execute(self, stmt):
        self.executed.append(stmt)
        return SimpleNamespace(rowcount=len(getattr(stmt, "_values", [])) or 0)


def test_bulk_upsert_short_circuits_on_empty_rows():
    sess = _RecordingSession()
    assert bulk_upsert(sess, ParticipantAnalytics, [], conflict_cols=["id"]) == 0
    assert sess.executed == []


def test_bulk_upsert_emits_on_conflict_do_update():
    sess = _RecordingSession()
    rows = [
        {
            "type": "DAILY",
            "timestamp": "2026-04-01",
            "computedAt": "2026-04-20",
            "courseId": "aaaa0000-0000-0000-0000-000000000001",
            "participantId": "bbbb0000-0000-0000-0000-000000000001",
            "trialsCount": 1,
            "responseCount": 1,
            "totalScore": 0,
            "totalPoints": 0,
            "totalXp": 0,
            "meanCorrectCount": 0.0,
            "meanPartialCorrectCount": 0.0,
            "meanWrongCount": 0.0,
            "createdAt": "2026-04-20",
            "updatedAt": "2026-04-20",
        }
    ]
    bulk_upsert(
        sess,
        ParticipantAnalytics,
        rows,
        conflict_cols=["type", "courseId", "participantId", "timestamp"],
        update_cols=["trialsCount", "responseCount"],
    )
    assert len(sess.executed) == 1
    compiled = str(sess.executed[0].compile(compile_kwargs={"literal_binds": False}))
    assert 'INSERT INTO "ParticipantAnalytics"' in compiled
    assert "ON CONFLICT" in compiled
    assert "DO UPDATE" in compiled


def test_bulk_upsert_do_nothing_when_no_update_cols():
    sess = _RecordingSession()
    rows = [{"id": 1, "courseId": "x", "timestamp": "t", "type": "DAILY"}]
    bulk_upsert(
        sess,
        AggregatedAnalytics,
        rows,
        conflict_cols=["id", "courseId", "timestamp", "type"],
        update_cols=[],
    )
    compiled = str(sess.executed[0].compile(compile_kwargs={"literal_binds": False}))
    assert "ON CONFLICT" in compiled
    assert "DO NOTHING" in compiled


def test_scope_by_course_ids_none_returns_stmt_unchanged():
    stmt = _FakeStmt()
    col = _FakeColumn("Course.id")
    assert scope_by_course_ids(stmt, col, None) is stmt


def test_scope_by_course_ids_empty_returns_none():
    assert scope_by_course_ids(_FakeStmt(), _FakeColumn("Course.id"), []) is None


def test_scope_by_course_ids_appends_in_filter():
    stmt = _FakeStmt()
    col = _FakeColumn("Course.id")
    result = scope_by_course_ids(stmt, col, ["a", "b"])
    assert result.filters == [("in", "Course.id", ["a", "b"])]


def test_row_to_dict_on_rowmapping_like_dict():
    assert row_to_dict({"id": 1, "name": "x"}) == {"id": 1, "name": "x"}
