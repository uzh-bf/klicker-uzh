"""Unit tests for env-driven filters in ``src.modules.utils``.

Replaces the previous ``unittest.FakeDb`` scaffolding with small pytest tests
that either stand alone (no DB required) or use the shared ``session`` fixture
from ``conftest.py``.
"""

from __future__ import annotations

import os
import sys
from unittest import mock

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.modules.utils import (  # noqa: E402
    analytics_mode,
    analytics_window_since,
    apply_course_scope,
    render_uuid_in_clause,
    should_skip_window,
)


# --- analytics_mode --------------------------------------------------------


def test_analytics_mode_defaults_to_full_when_unset():
    with mock.patch.dict(os.environ, {}, clear=False):
        os.environ.pop("ANALYTICS_MODE", None)
        assert analytics_mode() == "full"


def test_analytics_mode_normalises_casing():
    with mock.patch.dict(os.environ, {"ANALYTICS_MODE": "Incremental"}):
        assert analytics_mode() == "incremental"


def test_analytics_mode_unknown_value_falls_back_to_full():
    with mock.patch.dict(os.environ, {"ANALYTICS_MODE": "weird"}):
        assert analytics_mode() == "full"


# --- analytics_window_since ------------------------------------------------


def test_window_since_returns_none_when_unset():
    with mock.patch.dict(os.environ, {}, clear=False):
        os.environ.pop("ANALYTICS_WINDOW_SINCE", None)
        assert analytics_window_since() is None


def test_window_since_returns_trimmed_value():
    with mock.patch.dict(os.environ, {"ANALYTICS_WINDOW_SINCE": "  2026-04-01  "}):
        assert analytics_window_since() == "2026-04-01"


# --- should_skip_window ----------------------------------------------------


def test_skip_window_no_cutoff_keeps_every_window():
    assert should_skip_window("2022-10-23", None) is False


def test_skip_window_skips_before_cutoff():
    assert should_skip_window("2026-03-30", "2026-04-01") is True


def test_skip_window_keeps_cutoff_day():
    assert should_skip_window("2026-04-01", "2026-04-01") is False


def test_skip_window_invalid_cutoff_keeps_window():
    assert should_skip_window("2026-04-01", "not-a-date") is False


# --- render_uuid_in_clause --------------------------------------------------


VALID_A = "aaaa0000-0000-0000-0000-000000000001"
VALID_B = "aaaa0000-0000-0000-0000-000000000002"


def test_render_uuid_empty_list_returns_false_guard():
    assert render_uuid_in_clause("c.id", []) == "AND false"


def test_render_uuid_renders_quoted_list():
    clause = render_uuid_in_clause('lq."courseId"', [VALID_A, VALID_B])
    assert clause == f"AND lq.\"courseId\" IN ('{VALID_A}', '{VALID_B}')"


def test_render_uuid_rejects_malformed_uuid():
    with pytest.raises(ValueError):
        render_uuid_in_clause("c.id", ["not-a-uuid"])


# --- apply_course_scope (now SQLAlchemy-aware) -----------------------------


class _FakeColumn:
    """Standin for an ``InstrumentedAttribute`` so we can assert on ``in_``."""

    def __init__(self, name: str):
        self.name = name

    def in_(self, values):
        return ("in", self.name, list(values))


class _FakeStmt:
    def __init__(self, filters=None):
        self.filters = list(filters or [])

    def where(self, predicate):
        return _FakeStmt([*self.filters, predicate])


def test_apply_scope_none_returns_stmt_unchanged():
    stmt = _FakeStmt()
    col = _FakeColumn("Course.id")
    result = apply_course_scope(None, stmt, col)
    assert result is stmt


def test_apply_scope_empty_list_returns_none():
    result = apply_course_scope([], _FakeStmt(), _FakeColumn("Course.id"))
    assert result is None


def test_apply_scope_non_empty_list_appends_in_filter():
    stmt = _FakeStmt()
    col = _FakeColumn("Course.id")
    result = apply_course_scope(["a", "b"], stmt, col)
    assert result.filters == [("in", "Course.id", ["a", "b"])]
