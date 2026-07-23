"""Unit tests for env-driven filters in ``src.modules.utils``.

Runs with stdlib ``unittest`` so it doesn't require adding pytest to the
project's dev dependencies. Invoke locally with ``uv run python -m
tests.test_utils`` from ``apps/analytics``.
"""

import os
import sys
import unittest
from types import SimpleNamespace
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.modules.utils import (  # noqa: E402
    analytics_mode,
    analytics_window_since,
    apply_course_scope,
    exclusive_day_end,
    iter_analytics_windows,
    render_uuid_in_clause,
    scoped_course_ids,
    should_skip_window,
)


class FakeCourseTable:
    def __init__(self, rows):
        self.rows = rows
        self.last_where = None

    def find_many(self, where=None, include=None):
        self.last_where = where
        matched = []
        for row in self.rows:
            if where and "analyticsFinalizedAt" in where:
                if where["analyticsFinalizedAt"] is None and row.analyticsFinalizedAt is not None:
                    continue
            matched.append(row)
        return matched


class FakeDb:
    def __init__(self, rows):
        self.course = FakeCourseTable(rows)


def _course(id_, finalized_at):
    return SimpleNamespace(id=id_, analyticsFinalizedAt=finalized_at)


class AnalyticsModeTests(unittest.TestCase):
    def test_defaults_to_full_when_unset(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("ANALYTICS_MODE", None)
            self.assertEqual(analytics_mode(), "full")

    def test_normalises_casing(self):
        with mock.patch.dict(os.environ, {"ANALYTICS_MODE": "Incremental"}):
            self.assertEqual(analytics_mode(), "incremental")

    def test_unknown_value_falls_back_to_full(self):
        with mock.patch.dict(os.environ, {"ANALYTICS_MODE": "weird"}):
            self.assertEqual(analytics_mode(), "full")


class AnalyticsWindowSinceTests(unittest.TestCase):
    def test_returns_none_when_unset(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("ANALYTICS_WINDOW_SINCE", None)
            self.assertIsNone(analytics_window_since())

    def test_returns_trimmed_value(self):
        with mock.patch.dict(os.environ, {"ANALYTICS_WINDOW_SINCE": "  2026-04-01  "}):
            self.assertEqual(analytics_window_since(), "2026-04-01")


class ScopedCourseIdsTests(unittest.TestCase):
    def setUp(self):
        self.active = _course("aaaa0000-0000-0000-0000-000000000001", None)
        self.finalized = _course(
            "aaaa0000-0000-0000-0000-000000000002", "2026-03-01T00:00:00Z"
        )
        self.db = FakeDb([self.active, self.finalized])

    def test_no_env_returns_none(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("ANALYTICS_MODE", None)
            os.environ.pop("ANALYTICS_COURSE_IDS", None)
            self.assertIsNone(scoped_course_ids(self.db))

    def test_explicit_csv_wins(self):
        with mock.patch.dict(
            os.environ,
            {
                "ANALYTICS_MODE": "incremental",
                "ANALYTICS_COURSE_IDS": "id-a, id-b , ,id-c",
            },
        ):
            self.assertEqual(scoped_course_ids(self.db), ["id-a", "id-b", "id-c"])

    def test_incremental_returns_only_active(self):
        with mock.patch.dict(os.environ, {"ANALYTICS_MODE": "incremental"}):
            os.environ.pop("ANALYTICS_COURSE_IDS", None)
            result = scoped_course_ids(self.db)
            self.assertEqual(result, [self.active.id])
            self.assertEqual(
                self.db.course.last_where, {"analyticsFinalizedAt": None}
            )

    def test_full_returns_none(self):
        with mock.patch.dict(os.environ, {"ANALYTICS_MODE": "full"}):
            os.environ.pop("ANALYTICS_COURSE_IDS", None)
            self.assertIsNone(scoped_course_ids(self.db))


class ShouldSkipWindowTests(unittest.TestCase):
    def test_no_cutoff_keeps_every_window(self):
        self.assertFalse(should_skip_window("2022-10-23", None))

    def test_skips_windows_before_cutoff(self):
        self.assertTrue(should_skip_window("2026-03-30", "2026-04-01"))

    def test_keeps_cutoff_day(self):
        self.assertFalse(should_skip_window("2026-04-01", "2026-04-01"))

    def test_invalid_cutoff_keeps_window(self):
        self.assertFalse(should_skip_window("2026-04-01", "not-a-date"))


class AnalyticsWindowBoundaryTests(unittest.TestCase):
    def test_exclusive_end_is_next_midnight(self):
        self.assertEqual(exclusive_day_end("2026-07-23"), "2026-07-24T00:00:00.000Z")

    def test_daily_and_course_windows_use_exclusive_next_midnight(self):
        calls: list[tuple[object, ...]] = []

        def capture(*args: object) -> object:
            calls.append(args)
            return None

        iter_analytics_windows(
            object(),
            capture,
            start_date="2026-07-23",
            end_date="2026-07-23",
            compute_weekly=False,
            compute_monthly=False,
        )

        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[0][2], "2026-07-24T00:00:00.000Z")
        self.assertEqual(calls[1][2], "2026-07-24T00:00:00.000Z")


class RenderUuidInClauseTests(unittest.TestCase):
    VALID_A = "aaaa0000-0000-0000-0000-000000000001"
    VALID_B = "aaaa0000-0000-0000-0000-000000000002"

    def test_empty_list_returns_false_guard(self):
        self.assertEqual(render_uuid_in_clause("c.id", []), "AND false")

    def test_renders_quoted_uuid_list(self):
        clause = render_uuid_in_clause('lq."courseId"', [self.VALID_A, self.VALID_B])
        self.assertEqual(
            clause,
            f"AND lq.\"courseId\" IN ('{self.VALID_A}', '{self.VALID_B}')",
        )

    def test_rejects_malformed_uuid(self):
        with self.assertRaises(ValueError):
            render_uuid_in_clause("c.id", ["not-a-uuid"])


class ApplyCourseScopeTests(unittest.TestCase):
    def test_none_scope_returns_where_unchanged(self):
        result = apply_course_scope({"startDate": {"gt": "x"}}, None)
        self.assertEqual(result, {"startDate": {"gt": "x"}})

    def test_none_scope_with_no_where_returns_empty_dict(self):
        self.assertEqual(apply_course_scope(None, None), {})

    def test_empty_scope_returns_none(self):
        self.assertIsNone(apply_course_scope({"startDate": {"gt": "x"}}, []))

    def test_non_empty_scope_merges_default_column(self):
        result = apply_course_scope({"startDate": {"gt": "x"}}, ["a", "b"])
        self.assertEqual(
            result,
            {"startDate": {"gt": "x"}, "id": {"in": ["a", "b"]}},
        )

    def test_custom_column(self):
        result = apply_course_scope(None, ["a"], column="courseId")
        self.assertEqual(result, {"courseId": {"in": ["a"]}})

    def test_does_not_mutate_input(self):
        original = {"startDate": {"gt": "x"}}
        apply_course_scope(original, ["a"])
        self.assertEqual(original, {"startDate": {"gt": "x"}})


if __name__ == "__main__":
    unittest.main()
