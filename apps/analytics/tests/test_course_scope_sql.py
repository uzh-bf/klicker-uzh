from __future__ import annotations

import os
import sys
import uuid

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class _Result:
    def __init__(self, rowcount: int = 0, scalar: int = 1):
        self.rowcount = rowcount
        self._scalar = scalar

    def scalar_one(self):
        return self._scalar


class _CaptureSession:
    def __init__(self, scalars: list[int] | None = None):
        self.statements: list[str] = []
        self.params: list[dict[str, object] | None] = []
        self._scalars = list(scalars or [])

    def execute(self, stmt, params=None):
        self.statements.append(str(stmt))
        self.params.append(params)
        scalar = self._scalars.pop(0) if self._scalars else 1
        return _Result(rowcount=1, scalar=scalar)

    def commit(self):
        return None


def test_participant_chat_analytics_renders_course_filter():
    from src.modules.chat_analytics.compute_participant_chat_analytics import (
        compute_participant_chat_analytics,
    )

    session = _CaptureSession()
    course_id = str(uuid.uuid4())

    compute_participant_chat_analytics(
        session,
        "2026-01-01T00:00:00.000Z",
        "2026-01-31T23:59:59.999Z",
        "2026-01-31",
        "COURSE",
        course_ids=[course_id],
    )

    assert f"""AND cb."courseId" IN ('{course_id}')""" in session.statements[-1]


def test_participant_chat_analytics_leaves_query_unscoped_when_course_ids_none():
    from src.modules.chat_analytics.compute_participant_chat_analytics import (
        compute_participant_chat_analytics,
    )

    session = _CaptureSession()

    compute_participant_chat_analytics(
        session,
        "2026-01-01T00:00:00.000Z",
        "2026-01-31T23:59:59.999Z",
        "2026-01-31",
        "COURSE",
        course_ids=None,
    )

    assert """cb."courseId" IN (""" not in session.statements[-1]
    assert "/*COURSE_FILTER*/" not in session.statements[-1]


def test_participant_chat_analytics_uses_zero_attachment_fallback_when_table_missing():
    from src.modules.chat_analytics.compute_participant_chat_analytics import (
        compute_participant_chat_analytics,
    )

    session = _CaptureSession(scalars=[0])

    compute_participant_chat_analytics(
        session,
        "2026-01-01T00:00:00.000Z",
        "2026-01-31T23:59:59.999Z",
        "2026-01-31",
        "COURSE",
        course_ids=None,
    )

    assert len(session.statements) == 2
    assert "information_schema.tables" in session.statements[0]
    assert '"ChatAttachment"' not in session.statements[1]
    assert "attachment_rollup" in session.statements[1]


def test_aggregated_chatbot_analytics_renders_course_filter_for_weekly():
    from src.modules.aggregated_chat_analytics.compute_aggregated_chatbot_analytics import (
        compute_aggregated_chatbot_analytics,
    )

    session = _CaptureSession()
    course_id = str(uuid.uuid4())

    compute_aggregated_chatbot_analytics(
        session,
        "2026-01-01T00:00:00.000Z",
        "2026-01-07T23:59:59.999Z",
        "2026-01-07",
        "WEEKLY",
        course_ids=[course_id],
    )

    assert f"""AND cb."courseId" IN ('{course_id}')""" in session.statements[0]


@pytest.mark.parametrize("analytics_type", ["DAILY", "WEEKLY", "MONTHLY", "COURSE"])
def test_participant_chat_analytics_refreshes_existing_rollups(analytics_type):
    from src.modules.chat_analytics.compute_participant_chat_analytics import (
        compute_participant_chat_analytics,
    )

    session = _CaptureSession(scalars=[0])

    compute_participant_chat_analytics(
        session,
        "2026-01-01T00:00:00.000Z",
        "2026-01-31T23:59:59.999Z",
        "2026-01-31",
        analytics_type,
    )

    statement = session.statements[-1]
    assert "ON CONFLICT" in statement
    assert "DO UPDATE SET" in statement
    assert """WHERE "ParticipantChatAnalytics"."type" = 'COURSE'""" not in statement


@pytest.mark.parametrize("analytics_type", ["DAILY", "WEEKLY", "MONTHLY", "COURSE"])
def test_aggregated_chatbot_analytics_refreshes_existing_rollups(analytics_type):
    from src.modules.aggregated_chat_analytics.compute_aggregated_chatbot_analytics import (
        compute_aggregated_chatbot_analytics,
    )

    session = _CaptureSession()

    compute_aggregated_chatbot_analytics(
        session,
        "2026-01-01T00:00:00.000Z",
        "2026-01-31T23:59:59.999Z",
        "2026-01-31",
        analytics_type,
    )

    statement = session.statements[-1]
    assert "ON CONFLICT" in statement
    assert "DO UPDATE SET" in statement
    assert """WHERE "AggregatedChatbotAnalytics"."type" = 'COURSE'""" not in statement


def test_chat_quiz_correlation_renders_course_filters():
    from src.modules.chat_quiz_correlation.compute_chat_quiz_correlation import (
        compute_participant_chat_outcomes,
        update_has_chat_activity,
    )

    course_id = str(uuid.uuid4())

    outcome_session = _CaptureSession()
    compute_participant_chat_outcomes(outcome_session, course_ids=[course_id])
    assert f"""AND "courseId" IN ('{course_id}')""" in outcome_session.statements[0]
    assert "/*COURSE_FILTER" not in outcome_session.statements[0]

    update_session = _CaptureSession()
    update_has_chat_activity(update_session, course_ids=[course_id])
    assert f"""AND pca."courseId" IN ('{course_id}')""" in update_session.statements[0]


def test_chat_quiz_correlation_preconditions_scope_to_selected_course():
    from src.modules.chat_quiz_correlation.compute_chat_quiz_correlation import (
        assert_preconditions,
    )

    course_id = str(uuid.uuid4())
    session = _CaptureSession(scalars=[1, 1])

    assert_preconditions(session, course_ids=[course_id])

    assert len(session.statements) == 2
    assert f""""courseId" IN ('{course_id}')""" in session.statements[0]
    assert f""""courseId" IN ('{course_id}')""" in session.statements[1]
