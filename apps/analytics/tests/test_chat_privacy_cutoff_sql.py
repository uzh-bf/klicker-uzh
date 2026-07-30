from datetime import datetime

import pytest
from sqlalchemy import text

from src.modules.utils import AnalyticsRunConfig, analytics_run_context
from tests.chat_privacy_sql_helpers import (
    ACCEPTED,
    COURSE_A,
    _create_temp_tables,
    _seed_chat_sources,
)


@pytest.mark.integration
def test_choice_after_workflow_cutoff_defers_then_allows_finalization(session):
    from src.modules.analytics_validity.mark_analytics_valid import (
        mark_analytics_valid,
    )
    from src.modules.chat_analytics.consent_reconciliation import (
        plan_chat_analytics_runs,
    )

    _create_temp_tables(session)
    _seed_chat_sources(session)
    participation_id = session.execute(
        text(
            """
            SELECT id
            FROM "Participation"
            WHERE "courseId" = :course
              AND "participantId" = :participant
            """
        ),
        {"course": COURSE_A, "participant": ACCEPTED},
    ).scalar_one()
    session.execute(
        text(
            """
            INSERT INTO "LearningAnalyticsChoiceEvent" (
              "participationId", "createdAt"
            ) VALUES (
              :participation_id, TIMESTAMP '2026-07-10 00:00:00'
            )
            """
        ),
        {"participation_id": participation_id},
    )
    session.execute(
        text(
            """
            UPDATE "Course"
            SET "areAnalyticsValid" = false,
                "chatAnalyticsValidAt" = NULL
            WHERE id = :course
            """
        ),
        {"course": COURSE_A},
    )
    assert [
        (run.course_ids, run.window_since)
        for run in plan_chat_analytics_runs(
            session,
            [str(COURSE_A)],
            "2026-07-09",
        )
    ] == [([str(COURSE_A)], "2022-10-23")]

    with analytics_run_context(
        AnalyticsRunConfig(
            mode="finalize",
            course_ids=(str(COURSE_A),),
            chat_analytics_cutoff="2026-07-09T12:00:00+00:00",
        )
    ):
        mark_analytics_valid(session)

    assert (
        session.execute(
            text(
                """
                SELECT "analyticsFinalizedAt"
                FROM "Course"
                WHERE id = :course
                """
            ),
            {"course": COURSE_A},
        ).scalar_one()
        is None
    )
    with analytics_run_context(
        AnalyticsRunConfig(
            mode="finalize",
            course_ids=(str(COURSE_A),),
            chat_analytics_cutoff="2026-07-11T00:00:00+00:00",
        )
    ):
        mark_analytics_valid(session)

    assert (
        session.execute(
            text(
                """
                SELECT "analyticsFinalizedAt" IS NOT NULL
                FROM "Course"
                WHERE id = :course
                """
            ),
            {"course": COURSE_A},
        ).scalar_one()
        is True
    )


@pytest.mark.integration
def test_chat_cutoff_is_stored_as_utc_naive_in_non_utc_session(session):
    from src.modules.analytics_validity.mark_analytics_valid import (
        mark_analytics_valid,
    )

    _create_temp_tables(session)
    _seed_chat_sources(session)
    session.execute(text("SET LOCAL TIME ZONE 'Europe/Zurich'"))
    with analytics_run_context(
        AnalyticsRunConfig(
            mode="incremental",
            course_ids=(str(COURSE_A),),
            chat_analytics_cutoff="2026-07-09T09:30:00+00:00",
        )
    ):
        mark_analytics_valid(session)

    stored_cutoff = session.execute(
        text(
            """
            SELECT "chatAnalyticsValidAt"
            FROM "Course"
            WHERE id = :course
            """
        ),
        {"course": COURSE_A},
    ).scalar_one()
    assert stored_cutoff == datetime(2026, 7, 9, 9, 30)
