import pytest
from sqlalchemy import text

from tests.chat_privacy_sql_helpers import (
    ACCEPTED,
    CHATBOT_A,
    CHATBOT_B,
    COURSE_A,
    COURSE_B,
    COURSE_B_PARTICIPANT,
    STALE,
    _create_temp_tables,
    _seed_chat_sources,
)


@pytest.mark.integration
def test_consent_revocation_reconciles_scoped_chat_and_downstream_state(session):
    from src.modules.aggregated_chat_analytics.compute_aggregated_chatbot_analytics import (
        compute_aggregated_chatbot_analytics,
    )
    from src.modules.chat_analytics.compute_participant_chat_analytics import (
        compute_participant_chat_analytics,
    )
    from src.modules.chat_quiz_correlation.compute_chat_quiz_correlation import (
        reconcile_chat_quiz_correlation,
        report_source_counts,
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
    compute_aggregated_chatbot_analytics(
        session,
        "2026-07-01T00:00:00Z",
        "2026-07-02T00:00:00Z",
        "2026-07-01",
        "DAILY",
        course_ids=[str(COURSE_A)],
    )

    participant_rows = session.execute(
        text(
            """
            SELECT "participantId", "userMessages"
            FROM "ParticipantChatAnalytics"
            WHERE "courseId" = :course_id
            """
        ),
        {"course_id": COURSE_A},
    ).mappings()
    assert [dict(row) for row in participant_rows] == [{"participantId": ACCEPTED, "userMessages": 1}]

    aggregate = (
        session.execute(
            text(
                """
            SELECT "activeParticipants", "userMessages"
            FROM "AggregatedChatbotAnalytics"
            WHERE "courseId" = :course_id
            """
            ),
            {"course_id": COURSE_A},
        )
        .mappings()
        .one()
    )
    assert dict(aggregate) == {"activeParticipants": 1, "userMessages": 1}

    session.execute(
        text(
            """
            INSERT INTO "ParticipantChatAnalytics" (
              "type", "timestamp", "participantId", "chatbotId", "courseId",
              "userMessages", "assistantMessages", threads, "distinctDays",
              "chatModeCounts", "reasoningEffortCounts", "attachmentCount",
              "toolCallCount", "totalCreditsUsed", "creditsExhausted",
              "createdAt", "updatedAt"
            ) VALUES (
              'DAILY', DATE '2026-07-01', :participant, :chatbot, :course,
              9, 0, 1, 1, '{}'::jsonb, '{}'::jsonb, 0, 0, 0, false, NOW(), NOW()
            )
            """
        ),
        {
            "participant": COURSE_B_PARTICIPANT,
            "chatbot": CHATBOT_B,
            "course": COURSE_B,
        },
    )
    session.execute(
        text(
            """
            INSERT INTO "AggregatedChatbotAnalytics" (
              "type", "timestamp", "chatbotId", "courseId",
              "activeParticipants", "newParticipants", "returningParticipants",
              threads, "userMessages", "assistantMessages", "totalCreditsUsed",
              "disclaimerAcceptedCount", "disclaimerDeclinedCount",
              "hourOfDayDistribution", "modelDistribution", "modeDistribution",
              "reasoningEffortDistribution", "createdAt", "updatedAt"
            ) VALUES (
              'DAILY', DATE '2026-07-01', :chatbot, :course,
              9, 0, 0, 1, 9, 0, 0, 0, 0,
              '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, NOW(), NOW()
            )
            """
        ),
        {
            "participant": COURSE_B_PARTICIPANT,
            "chatbot": CHATBOT_B,
            "course": COURSE_B,
        },
    )

    session.execute(
        text(
            """
            UPDATE "ChatUsageCredits"
            SET "disclaimerDeclined" = true
            WHERE "participantId" = :participant
            """
        ),
        {"participant": ACCEPTED},
    )
    compute_participant_chat_analytics(
        session,
        "2026-07-01T00:00:00Z",
        "2026-07-02T00:00:00Z",
        "2026-07-01",
        "DAILY",
        course_ids=[str(COURSE_A)],
    )
    compute_aggregated_chatbot_analytics(
        session,
        "2026-07-01T00:00:00Z",
        "2026-07-02T00:00:00Z",
        "2026-07-01",
        "DAILY",
        course_ids=[str(COURSE_A)],
    )

    counts = (
        session.execute(
            text(
                """
            SELECT
              (SELECT COUNT(*) FROM "ParticipantChatAnalytics"
               WHERE "courseId" = :course_a) AS participant_a,
              (SELECT COUNT(*) FROM "ParticipantChatAnalytics"
               WHERE "courseId" = :course_b) AS participant_b,
              (SELECT COUNT(*) FROM "AggregatedChatbotAnalytics"
               WHERE "courseId" = :course_a) AS aggregate_a,
              (SELECT COUNT(*) FROM "AggregatedChatbotAnalytics"
               WHERE "courseId" = :course_b) AS aggregate_b
            """
            ),
            {"course_a": COURSE_A, "course_b": COURSE_B},
        )
        .mappings()
        .one()
    )
    assert dict(counts) == {
        "participant_a": 0,
        "participant_b": 1,
        "aggregate_a": 0,
        "aggregate_b": 1,
    }

    session.execute(
        text(
            """
            INSERT INTO "Participation" ("participantId", "courseId")
            VALUES (:accepted, :course_a)
            """
        ),
        {
            "accepted": ACCEPTED,
            "course_a": COURSE_A,
        },
    )
    session.execute(
        text(
            """
            INSERT INTO "ParticipantChatOutcome" (
              "participantId", "courseId", "chatMessagesInCourse",
              "chatDoseBucket", "hasBothModalities", "createdAt", "updatedAt"
            ) VALUES
              (:stale, :course_a, 3, 'HIGH', false, NOW(), NOW()),
              (:course_b_participant, :course_b, 3, 'HIGH', false, NOW(), NOW())
            """
        ),
        {
            "stale": STALE,
            "course_b_participant": COURSE_B_PARTICIPANT,
            "course_a": COURSE_A,
            "course_b": COURSE_B,
        },
    )
    session.execute(
        text(
            """
            INSERT INTO "ParticipantCourseAnalytics" (
              "participantId", "courseId", "hasChatActivity"
            ) VALUES
              (:accepted, :course_a, true),
              (:stale, :course_a, true),
              (:course_b_participant, :course_b, true)
            """
        ),
        {
            "accepted": ACCEPTED,
            "stale": STALE,
            "course_b_participant": COURSE_B_PARTICIPANT,
            "course_a": COURSE_A,
            "course_b": COURSE_B,
        },
    )

    report_source_counts(session, course_ids=[str(COURSE_A)], verbose=True)
    reconcile_chat_quiz_correlation(session, course_ids=[str(COURSE_A)])

    outcomes = session.execute(
        text(
            """
            SELECT "participantId", "courseId", "chatMessagesInCourse"
            FROM "ParticipantChatOutcome"
            ORDER BY "courseId", "participantId"
            """
        )
    ).mappings()
    assert [dict(row) for row in outcomes] == [
        {
            "participantId": ACCEPTED,
            "courseId": COURSE_A,
            "chatMessagesInCourse": 0,
        },
        {
            "participantId": COURSE_B_PARTICIPANT,
            "courseId": COURSE_B,
            "chatMessagesInCourse": 3,
        },
    ]

    activity = session.execute(
        text(
            """
            SELECT "participantId", "courseId", "hasChatActivity"
            FROM "ParticipantCourseAnalytics"
            ORDER BY "courseId", "participantId"
            """
        )
    ).mappings()
    assert [dict(row) for row in activity] == [
        {
            "participantId": ACCEPTED,
            "courseId": COURSE_A,
            "hasChatActivity": False,
        },
        {
            "participantId": STALE,
            "courseId": COURSE_A,
            "hasChatActivity": False,
        },
        {
            "participantId": COURSE_B_PARTICIPANT,
            "courseId": COURSE_B,
            "hasChatActivity": True,
        },
    ]


@pytest.mark.integration
def test_incremental_revocation_rebuilds_old_and_recent_chat_windows(session):
    from src.modules.aggregated_chat_analytics.compute_aggregated_chatbot_analytics import (
        compute_aggregated_chatbot_analytics,
    )
    from src.modules.chat_analytics.compute_participant_chat_analytics import (
        compute_participant_chat_analytics,
    )
    from src.modules.chat_analytics.consent_reconciliation import (
        plan_chat_analytics_runs,
        purge_ineligible_participant_chat_analytics,
    )
    from src.modules.utils import iter_analytics_windows

    _create_temp_tables(session)
    _seed_chat_sources(session)
    session.execute(
        text(
            """
            INSERT INTO "ChatMessage" (
              id, "threadId", role, content, "chatMode", "modelId",
              "reasoningEffort", "creditsUsed", "createdAt"
            ) VALUES (
              'ffff0000-0000-0000-0000-000000000004',
              'eeee0000-0000-0000-0000-000000000001',
              'user', '[{"type":"text","text":"recent"}]', 'tutor', NULL, NULL, 0,
              TIMESTAMP '2026-07-15 10:00:00'
            )
            """
        )
    )

    for day in ("2026-07-01", "2026-07-15"):
        compute_participant_chat_analytics(
            session,
            f"{day}T00:00:00Z",
            f"{day}T23:59:59.999Z",
            day,
            "DAILY",
            course_ids=[str(COURSE_A)],
        )
        compute_aggregated_chatbot_analytics(
            session,
            f"{day}T00:00:00Z",
            f"{day}T23:59:59.999Z",
            day,
            "DAILY",
            course_ids=[str(COURSE_A)],
        )

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

    runs = plan_chat_analytics_runs(
        session,
        [str(COURSE_A)],
        "2026-07-09",
    )
    assert [(run.course_ids, run.window_since) for run in runs] == [([str(COURSE_A)], "2026-07-01")]

    purge_ineligible_participant_chat_analytics(session, [str(COURSE_A)])
    assert (
        session.execute(
            text(
                """
                SELECT COUNT(*)
                FROM "ParticipantChatAnalytics"
                WHERE "courseId" = :course
                """
            ),
            {"course": COURSE_A},
        ).scalar_one()
        == 0
    )
    assert (
        session.execute(
            text(
                """
                SELECT "chatAnalyticsValidAt"
                FROM "Course"
                WHERE id = :course
                """
            ),
            {"course": COURSE_A},
        ).scalar_one()
        is None
    )

    # Script 9 discovers the rebuild after its script-8 parent purges stale rows:
    # the cleared course watermark is the durable hand-off between DAG stages.
    aggregate_runs = plan_chat_analytics_runs(
        session,
        [str(COURSE_A)],
        "2026-07-09",
    )
    assert [(run.course_ids, run.window_since) for run in aggregate_runs] == [([str(COURSE_A)], "2026-07-01")]
    iter_analytics_windows(
        session,
        compute_aggregated_chatbot_analytics,
        start_date="2026-07-01",
        end_date="2026-07-15",
        compute_weekly=False,
        compute_monthly=False,
        compute_course=False,
        windows_since=aggregate_runs[0].window_since,
        course_ids=aggregate_runs[0].course_ids,
    )

    assert (
        session.execute(
            text(
                """
                SELECT COUNT(*)
                FROM "AggregatedChatbotAnalytics"
                WHERE "courseId" = :course
                  AND "timestamp" IN (DATE '2026-07-01', DATE '2026-07-15')
                """
            ),
            {"course": COURSE_A},
        ).scalar_one()
        == 0
    )
