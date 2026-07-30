"""Unit tests for env-driven filters in ``src.modules.utils``.

Replaces the previous ``unittest.FakeDb`` scaffolding with small pytest tests
that either stand alone (no DB required) or use the shared ``session`` fixture
from ``conftest.py``.
"""

from __future__ import annotations

import os
import sys
from typing import cast
from unittest import mock

import pytest
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.modules.utils import (  # noqa: E402
    AnalyticsRunCancelled,
    AnalyticsRunConfig,
    analytics_mode,
    analytics_run_context,
    analytics_run_config_from_env,
    analytics_window_since,
    apply_course_scope,
    exclusive_day_end,
    iter_analytics_windows,
    render_uuid_in_clause,
    scoped_course_ids,
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


def test_cli_run_config_reads_immutable_chat_cutoff():
    with mock.patch.dict(
        os.environ,
        {"ANALYTICS_CHAT_CUTOFF": " 2026-07-23T09:30:00Z "},
    ):
        assert analytics_run_config_from_env().chat_analytics_cutoff == "2026-07-23T09:30:00Z"


# --- should_skip_window ----------------------------------------------------


def test_exclusive_end_is_next_midnight():
    assert exclusive_day_end("2026-07-23") == "2026-07-24T00:00:00.000Z"


def test_daily_and_course_windows_use_exclusive_next_midnight():
    calls: list[tuple[object, ...]] = []

    def capture(*args: object, **_kwargs: object) -> object:
        calls.append(args)
        return None

    iter_analytics_windows(
        cast(Session, object()),
        capture,
        start_date="2026-07-23",
        end_date="2026-07-23",
        compute_weekly=False,
        compute_monthly=False,
    )

    assert len(calls) == 2
    assert calls[0][2] == "2026-07-24T00:00:00.000Z"
    assert calls[1][2] == "2026-07-24T00:00:00.000Z"


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
    assert result is not None
    assert result.filters == [("in", "Course.id", ["a", "b"])]


def test_immutable_run_config_does_not_fall_back_to_process_scope():
    with mock.patch.dict(os.environ, {"ANALYTICS_COURSE_IDS": VALID_A}):
        assert (
            scoped_course_ids(
                cast(Session, object()),
                AnalyticsRunConfig(mode="full"),
            )
            is None
        )


def test_window_iteration_stops_at_next_bounded_cancellation_check():
    computed: list[str] = []

    def compute(
        _session,
        _win_start,
        _win_end,
        timestamp,
        _analytics_type,
        **_kwargs,
    ):
        computed.append(timestamp)

    with (
        analytics_run_context(
            AnalyticsRunConfig(mode="incremental"),
            lambda: len(computed) == 1,
        ),
        pytest.raises(AnalyticsRunCancelled),
    ):
        iter_analytics_windows(
            cast(Session, object()),
            compute,
            start_date="2026-07-22",
            end_date="2026-07-23",
            compute_weekly=False,
            compute_monthly=False,
            compute_course=False,
        )

    assert computed == ["2026-07-22"]
