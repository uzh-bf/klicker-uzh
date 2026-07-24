from __future__ import annotations

import importlib
import uuid
from typing import Any, cast
from unittest import mock

import pytest

from src.modules.analytics_validity.mark_analytics_valid import _render_sql

COURSE_A = "aaaa0000-0000-0000-0000-000000000001"
COURSE_B = "aaaa0000-0000-0000-0000-000000000002"


class _Result:
    def __init__(self, *, rowcount: int = 7, scalar: int = 0):
        self.rowcount = rowcount
        self._scalar = scalar

    def scalar_one(self):
        return self._scalar

    def scalars(self):
        return self

    def all(self):
        return []


class _CaptureSession:
    def __init__(self, scalars: list[int] | None = None):
        self.statements: list[object] = []
        self.params: list[dict[str, object] | None] = []
        self.scalars = list(scalars or [])
        self.commits = 0

    def execute(self, statement, params=None):
        self.statements.append(statement)
        self.params.append(params)
        scalar = self.scalars.pop(0) if self.scalars else 0
        return _Result(scalar=scalar)

    def commit(self):
        self.commits += 1


def test_participant_response_query_scopes_both_activity_types():
    module = importlib.import_module("src.modules.participant_analytics.get_participant_responses")
    session = _CaptureSession()

    result = module.get_participant_responses(
        session,
        "2026-07-01T00:00:00Z",
        "2026-07-02T00:00:00Z",
        course_ids=[COURSE_A, COURSE_B],
    )

    statement = str(session.statements[0])
    params = session.statements[0].compile().params
    assert 'FROM "PracticeQuiz"' in statement
    assert 'FROM "MicroLearning"' in statement
    assert '"PracticeQuiz"."courseId" IN ' in statement
    assert '"MicroLearning"."courseId" IN ' in statement
    assert [COURSE_A, COURSE_B] in params.values()
    assert result.empty


def test_participant_chat_window_replaces_only_scoped_rows():
    module = importlib.import_module("src.modules.chat_analytics.compute_participant_chat_analytics")
    session = _CaptureSession(scalars=[0])

    rows = module.compute_participant_chat_analytics(
        session,
        "2026-07-01T00:00:00Z",
        "2026-07-02T00:00:00Z",
        "2026-07-01",
        "DAILY",
        course_ids=[COURSE_A],
    )

    statements = [str(statement) for statement in session.statements]
    assert rows == 7
    assert 'DELETE FROM "ParticipantChatAnalytics"' in statements[1]
    assert f""""courseId" IN ('{COURSE_A}')""" in statements[1]
    assert f"""cb."courseId" IN ('{COURSE_A}')""" in statements[2]
    assert session.commits == 1


def test_aggregate_chat_window_replaces_only_scoped_rows():
    module = importlib.import_module("src.modules.aggregated_chat_analytics.compute_aggregated_chatbot_analytics")
    session = _CaptureSession()

    rows = module.compute_aggregated_chatbot_analytics(
        session,
        "2026-07-01T00:00:00Z",
        "2026-07-08T00:00:00Z",
        "2026-07-07",
        "WEEKLY",
        course_ids=[COURSE_A],
    )

    statements = [str(statement) for statement in session.statements]
    assert rows == 7
    assert 'DELETE FROM "AggregatedChatbotAnalytics"' in statements[0]
    assert f""""courseId" IN ('{COURSE_A}')""" in statements[0]
    assert f"""cb."courseId" IN ('{COURSE_A}')""" in statements[1]
    assert session.commits == 1


def test_below_threshold_clustering_clears_previous_rows():
    module = importlib.import_module("src.modules.chat_topic_clustering.cluster_chatbot")
    session = object()

    with (
        mock.patch.object(module, "load_user_text", return_value=[]),
        mock.patch.object(module, "save_clusters", return_value=0) as save,
    ):
        result = module.cluster_chatbot(
            session,
            str(uuid.uuid4()),
            "2026-07-01T00:00:00Z",
            "2026-07-02T00:00:00Z",
            "COURSE",
            "1970-01-01",
        )

    assert result == 0
    save.assert_called_once_with(
        session,
        mock.ANY,
        "COURSE",
        "1970-01-01",
        {},
        [],
        [],
        verbose=False,
    )


def test_empty_chat_source_reconciles_scoped_outcomes_and_activity(monkeypatch):
    module = importlib.import_module("src.modules.chat_quiz_correlation.compute_chat_quiz_correlation")
    monkeypatch.setattr(module.buffer_registry, "is_active", lambda: False)
    session = _CaptureSession(scalars=[0, 0])

    module.report_source_counts(session, course_ids=[COURSE_A], verbose=True)
    result = module.reconcile_chat_quiz_correlation(session, course_ids=[COURSE_A])

    statements = [str(statement) for statement in session.statements]
    assert result == (7, 7)
    assert 'DELETE FROM "ParticipantChatOutcome"' in statements[2]
    assert f""""courseId" IN ('{COURSE_A}')""" in statements[2]
    assert f"""pca."courseId" IN ('{COURSE_A}')""" in statements[4]
    assert session.commits == 1


def test_incremental_scope_filters_completion_watermarks():
    statement = _render_sql(False, [COURSE_A])

    assert f"AND c.id IN ('{COURSE_A}')" in statement
    assert '"analyticsFinalizedAt" = CASE' not in statement


def test_finalize_scope_defers_terminal_marker_for_pending_consent():
    statement = _render_sql(True, [COURSE_A])

    assert '"analyticsFinalizedAt" = CASE' in statement
    assert "pending_chat_changes pending" in statement
    assert f"""cb."courseId" IN ('{COURSE_A}')""" in statement
    assert 'AND c."analyticsFinalizedAt" IS NULL' in statement


def test_validity_marker_fails_closed_without_immutable_cutoff(monkeypatch):
    from src.modules.analytics_validity.mark_analytics_valid import (
        mark_analytics_valid,
    )

    monkeypatch.delenv("ANALYTICS_CHAT_CUTOFF", raising=False)

    with pytest.raises(RuntimeError, match="immutable workflow cutoff"):
        mark_analytics_valid(cast(Any, None))


def test_empty_incremental_scope_updates_no_course():
    assert "AND false" in _render_sql(False, [])
