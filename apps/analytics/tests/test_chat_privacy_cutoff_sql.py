from datetime import datetime, timezone

import pytest
from sqlalchemy import text

from src.modules.utils import (
    AnalyticsMode,
    AnalyticsRunConfig,
    analytics_run_context,
)
from tests.chat_privacy_sql_helpers import (
    ACCEPTED,
    CHATBOT_A,
    COURSE_A,
    DISCLAIMER,
    _create_temp_tables,
    _seed_chat_sources,
)


@pytest.mark.integration
@pytest.mark.parametrize("mode", ["incremental", "finalize"])
def test_acceptance_during_workflow_remains_visible_after_start_cutoff(
    session,
    mode: AnalyticsMode,
):
    from src.modules.analytics_validity.mark_analytics_valid import (
        mark_analytics_valid,
    )
    from src.modules.chat_analytics.compute_participant_chat_analytics import (
        compute_participant_chat_analytics,
    )
    from src.modules.chat_analytics.consent_reconciliation import (
        plan_chat_analytics_runs,
    )

    _create_temp_tables(session)
    _seed_chat_sources(session)
    session.execute(
        text(
            """
            UPDATE "ChatUsageCredits"
            SET "acceptedDisclaimerId" = NULL,
                "disclaimerAcceptedAt" = NULL,
                "disclaimerDeclined" = true,
                "updatedAt" = TIMESTAMP '2026-01-01 00:00:00'
            WHERE "participantId" = :participant
              AND "chatbotId" = :chatbot
            """
        ),
        {"participant": ACCEPTED, "chatbot": CHATBOT_A},
    )

    initial_runs = plan_chat_analytics_runs(
        session,
        [str(COURSE_A)],
        "2026-07-09",
    )
    assert [(run.course_ids, run.window_since) for run in initial_runs] == [([str(COURSE_A)], "2026-07-09")]

    session.execute(
        text(
            """
            UPDATE "ChatUsageCredits"
            SET "acceptedDisclaimerId" = :disclaimer,
                "disclaimerAcceptedAt" = TIMESTAMP '2026-07-10 00:00:00',
                "disclaimerDeclined" = false,
                "updatedAt" = TIMESTAMP '2026-07-10 00:00:00'
            WHERE "participantId" = :participant
              AND "chatbotId" = :chatbot
            """
        ),
        {
            "disclaimer": DISCLAIMER,
            "participant": ACCEPTED,
            "chatbot": CHATBOT_A,
        },
    )

    first_cutoff = AnalyticsRunConfig(
        mode=mode,
        course_ids=(str(COURSE_A),),
        window_since="2026-07-09",
        chat_analytics_cutoff="2026-07-09T12:00:00+00:00",
    )
    with analytics_run_context(first_cutoff):
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

    history_runs = plan_chat_analytics_runs(
        session,
        [str(COURSE_A)],
        "2026-07-09",
    )
    assert [(run.course_ids, run.window_since) for run in history_runs] == [([str(COURSE_A)], "2026-07-01")]

    compute_participant_chat_analytics(
        session,
        "2026-07-01T00:00:00Z",
        "2026-07-02T00:00:00Z",
        "2026-07-01",
        "DAILY",
        course_ids=[str(COURSE_A)],
    )
    assert (
        session.execute(
            text(
                """
                SELECT COUNT(*)
                FROM "ParticipantChatAnalytics"
                WHERE "courseId" = :course
                  AND "participantId" = :participant
                """
            ),
            {"course": COURSE_A, "participant": ACCEPTED},
        ).scalar_one()
        == 1
    )

    second_cutoff = AnalyticsRunConfig(
        mode=mode,
        course_ids=(str(COURSE_A),),
        window_since="2026-07-09",
        chat_analytics_cutoff="2026-07-11T00:00:00+00:00",
    )
    with analytics_run_context(second_cutoff):
        mark_analytics_valid(session)

    converged_runs = plan_chat_analytics_runs(
        session,
        [str(COURSE_A)],
        "2026-07-09",
    )
    assert [(run.course_ids, run.window_since) for run in converged_runs] == [([str(COURSE_A)], "2026-07-09")]
    finalized_at = session.execute(
        text(
            """
            SELECT "analyticsFinalizedAt"
            FROM "Course"
            WHERE id = :course
            """
        ),
        {"course": COURSE_A},
    ).scalar_one()
    assert (finalized_at is not None) is (mode == "finalize")


@pytest.mark.integration
def test_revocation_during_finalize_remains_eligible_for_follow_up(session):
    from src.modules.analytics_validity.mark_analytics_valid import (
        mark_analytics_valid,
    )
    from src.modules.chat_analytics.compute_participant_chat_analytics import (
        compute_participant_chat_analytics,
    )
    from src.modules.chat_analytics.consent_reconciliation import (
        plan_chat_analytics_runs,
        purge_ineligible_participant_chat_analytics,
    )

    _create_temp_tables(session)
    _seed_chat_sources(session)
    compute_participant_chat_analytics(
        session,
        "2026-07-01T00:00:00Z",
        "2026-07-02T00:00:00Z",
        "2026-07-01",
        "DAILY",
        course_ids=[str(COURSE_A)],
    )
    initial_runs = plan_chat_analytics_runs(
        session,
        [str(COURSE_A)],
        "2026-07-09",
    )
    assert [(run.course_ids, run.window_since) for run in initial_runs] == [([str(COURSE_A)], "2026-07-09")]

    session.execute(
        text(
            """
            UPDATE "ChatUsageCredits"
            SET "acceptedDisclaimerId" = NULL,
                "disclaimerAcceptedAt" = NULL,
                "disclaimerDeclined" = true,
                "updatedAt" = TIMESTAMP '2026-07-10 00:00:00'
            WHERE "participantId" = :participant
              AND "chatbotId" = :chatbot
            """
        ),
        {"participant": ACCEPTED, "chatbot": CHATBOT_A},
    )
    first_cutoff = AnalyticsRunConfig(
        mode="finalize",
        course_ids=(str(COURSE_A),),
        chat_analytics_cutoff="2026-07-09T12:00:00+00:00",
    )
    with analytics_run_context(first_cutoff):
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

    history_runs = plan_chat_analytics_runs(
        session,
        [str(COURSE_A)],
        "2026-07-09",
    )
    assert [(run.course_ids, run.window_since) for run in history_runs] == [([str(COURSE_A)], "2026-07-01")]
    purge_ineligible_participant_chat_analytics(session, [str(COURSE_A)])

    second_cutoff = AnalyticsRunConfig(
        mode="finalize",
        course_ids=(str(COURSE_A),),
        chat_analytics_cutoff="2026-07-11T00:00:00+00:00",
    )
    with analytics_run_context(second_cutoff):
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
    converged_runs = plan_chat_analytics_runs(
        session,
        [str(COURSE_A)],
        "2026-07-09",
    )
    assert [(run.course_ids, run.window_since) for run in converged_runs] == [([str(COURSE_A)], "2026-07-09")]


@pytest.mark.integration
def test_chat_cutoff_is_stored_as_utc_naive_in_non_utc_session(session):
    from src.modules.analytics_validity.mark_analytics_valid import (
        mark_analytics_valid,
    )

    _create_temp_tables(session)
    _seed_chat_sources(session)
    session.execute(text("SET LOCAL TIME ZONE 'Europe/Zurich'"))
    config = AnalyticsRunConfig(
        mode="incremental",
        course_ids=(str(COURSE_A),),
        chat_analytics_cutoff="2026-07-09T09:30:00+00:00",
    )
    with analytics_run_context(config):
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


@pytest.mark.integration
def test_same_millisecond_consent_change_remains_visible(session):
    from src.analytics_cutoff import database_safe_cutoff
    from src.modules.analytics_validity.mark_analytics_valid import (
        mark_analytics_valid,
    )
    from src.modules.chat_analytics.consent_reconciliation import (
        plan_chat_analytics_runs,
    )

    _create_temp_tables(session)
    _seed_chat_sources(session)
    session.execute(
        text(
            """
            UPDATE "Course"
            SET "analyticsFinalizedAt" = TIMESTAMP '2026-07-01 00:00:00',
                "chatAnalyticsValidAt" = TIMESTAMP '2026-07-01 00:00:00'
            WHERE id = :course
            """
        ),
        {"course": COURSE_A},
    )
    session.execute(
        text(
            """
            UPDATE "ChatUsageCredits"
            SET "disclaimerAcceptedAt" = TIMESTAMP '2026-07-09 09:30:00.123',
                "updatedAt" = TIMESTAMP '2026-07-09 09:30:00.123'
            WHERE "participantId" = :participant
              AND "chatbotId" = :chatbot
            """
        ),
        {
            "participant": ACCEPTED,
            "chatbot": CHATBOT_A,
        },
    )
    cutoff = database_safe_cutoff(datetime(2026, 7, 9, 9, 30, 0, 123456, tzinfo=timezone.utc))

    with analytics_run_context(
        AnalyticsRunConfig(
            mode="finalize",
            course_ids=(str(COURSE_A),),
            chat_analytics_cutoff=cutoff,
        )
    ):
        mark_analytics_valid(session)

    marker, finalized_at = session.execute(
        text(
            """
            SELECT "chatAnalyticsValidAt", "analyticsFinalizedAt"
            FROM "Course"
            WHERE id = :course
            """
        ),
        {"course": COURSE_A},
    ).one()
    assert marker == datetime(2026, 7, 9, 9, 30, 0, 122000)
    assert finalized_at == datetime(2026, 7, 1)
    history_runs = plan_chat_analytics_runs(
        session,
        [str(COURSE_A)],
        "2026-07-09",
    )
    assert [(run.course_ids, run.window_since) for run in history_runs] == [([str(COURSE_A)], "2026-07-01")]

    with analytics_run_context(
        AnalyticsRunConfig(
            mode="finalize",
            course_ids=(str(COURSE_A),),
            chat_analytics_cutoff=database_safe_cutoff(datetime(2026, 7, 9, 9, 30, 0, 125000, tzinfo=timezone.utc)),
        )
    ):
        mark_analytics_valid(session)

    marker, finalized_at = session.execute(
        text(
            """
            SELECT "chatAnalyticsValidAt", "analyticsFinalizedAt"
            FROM "Course"
            WHERE id = :course
            """
        ),
        {"course": COURSE_A},
    ).one()
    assert marker == datetime(2026, 7, 9, 9, 30, 0, 124000)
    assert finalized_at > datetime(2026, 7, 1)
    converged_runs = plan_chat_analytics_runs(
        session,
        [str(COURSE_A)],
        "2026-07-09",
    )
    assert [(run.course_ids, run.window_since) for run in converged_runs] == [([str(COURSE_A)], "2026-07-09")]
