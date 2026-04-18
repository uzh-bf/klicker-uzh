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
    scoped_course_ids,
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


if __name__ == "__main__":
    unittest.main()
