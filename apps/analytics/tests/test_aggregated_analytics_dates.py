from __future__ import annotations

import os
import sys
import importlib
from datetime import date

import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _timestamp_filter_value(stmt):
    for criterion in stmt._where_criteria:
        left = getattr(criterion, "left", None)
        if getattr(left, "key", None) == "timestamp":
            return criterion.right.value
    raise AssertionError("timestamp filter not found")


def _course_filter_value(stmt):
    for criterion in stmt._where_criteria:
        left = getattr(criterion, "left", None)
        if getattr(left, "key", None) == "courseId":
            return criterion.right.value
    raise AssertionError("courseId filter not found")


def test_load_participant_analytics_coerces_string_timestamp_to_date():
    from src.modules.aggregated_analytics.load_participant_analytics import (
        load_participant_analytics,
    )

    captured = {}

    class _FakeScalars:
        def all(self):
            return []

    class _FakeResult:
        def scalars(self):
            return _FakeScalars()

    class _FakeSession:
        def execute(self, stmt):
            captured["stmt"] = stmt
            return _FakeResult()

    load_participant_analytics(_FakeSession(), "1970-01-01", "COURSE")

    assert _timestamp_filter_value(captured["stmt"]) == date(1970, 1, 1)


def test_load_participant_analytics_coerces_full_iso_timestamp_to_date():
    from src.modules.aggregated_analytics.load_participant_analytics import (
        load_participant_analytics,
    )

    captured = {}

    class _FakeScalars:
        def all(self):
            return []

    class _FakeResult:
        def scalars(self):
            return _FakeScalars()

    class _FakeSession:
        def execute(self, stmt):
            captured["stmt"] = stmt
            return _FakeResult()

    load_participant_analytics(_FakeSession(), "2026-02-15T00:00:00.000Z", "DAILY")

    assert _timestamp_filter_value(captured["stmt"]) == date(2026, 2, 15)


def test_load_participant_analytics_applies_course_scope_filter():
    from src.modules.aggregated_analytics.load_participant_analytics import (
        load_participant_analytics,
    )

    captured = {}

    class _FakeScalars:
        def all(self):
            return []

    class _FakeResult:
        def scalars(self):
            return _FakeScalars()

    class _FakeSession:
        def execute(self, stmt):
            captured["stmt"] = stmt
            return _FakeResult()

    load_participant_analytics(
        _FakeSession(),
        "1970-01-01",
        "COURSE",
        course_ids=["course-1"],
    )

    assert _course_filter_value(captured["stmt"]) == ["course-1"]


def test_load_participant_analytics_empty_scope_short_circuits_without_query():
    from src.modules.aggregated_analytics.load_participant_analytics import (
        load_participant_analytics,
    )

    class _FakeSession:
        def execute(self, stmt):
            raise AssertionError("empty scope should not hit the database")

    result = load_participant_analytics(
        _FakeSession(),
        "1970-01-01",
        "COURSE",
        course_ids=[],
    )

    assert result.empty


def test_save_aggregated_analytics_uses_date_objects_for_course_timestamp(monkeypatch):
    module = importlib.import_module("src.modules.aggregated_analytics.save_aggregated_analytics")

    captured = {}

    monkeypatch.setattr(
        module,
        "bulk_upsert",
        lambda session, Model, rows, **kwargs: captured.setdefault("rows", rows),
    )

    class _FakeSession:
        def execute(self, stmt):
            raise AssertionError("unexpected relationship query in this unit test")

        def commit(self):
            captured["committed"] = True

    df = pd.DataFrame(
        [
            {
                "courseId": "course-1",
                "participantCount": 10,
                "responseCount": 20,
                "totalScore": 30,
                "totalPoints": 40,
                "totalXp": 50,
            }
        ]
    )

    monkeypatch.setattr(module, "_count_elements_for_course", lambda session, course_id: 7)

    module.save_aggregated_analytics(_FakeSession(), df, "1970-01-01", "COURSE")

    row = captured["rows"][0]
    assert row["timestamp"] == date(1970, 1, 1)
    assert isinstance(row["computedAt"], date)


def test_save_aggregated_analytics_uses_date_objects_for_daily_iso_timestamp(
    monkeypatch,
):
    module = importlib.import_module("src.modules.aggregated_analytics.save_aggregated_analytics")

    captured = {}

    monkeypatch.setattr(
        module,
        "bulk_upsert",
        lambda session, Model, rows, **kwargs: captured.setdefault("rows", rows),
    )

    class _FakeSession:
        def commit(self):
            captured["committed"] = True

    df = pd.DataFrame(
        [
            {
                "courseId": "course-1",
                "participantCount": 10,
                "responseCount": 20,
                "totalScore": 30,
                "totalPoints": 40,
                "totalXp": 50,
            }
        ]
    )

    module.save_aggregated_analytics(
        _FakeSession(),
        df,
        "2026-02-15T00:00:00.000Z",
        "DAILY",
    )

    row = captured["rows"][0]
    assert row["timestamp"] == date(2026, 2, 15)
