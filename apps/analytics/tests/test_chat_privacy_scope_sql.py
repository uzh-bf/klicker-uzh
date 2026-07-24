from uuid import UUID

import pytest
from sqlalchemy import text

from tests.chat_privacy_sql_helpers import (
    COURSE_A,
    COURSE_B,
    _create_participant_scope_tables,
)


@pytest.mark.integration
def test_participant_response_scope_excludes_other_course_in_database(session):
    from src.modules.participant_analytics.get_participant_responses import (
        get_participant_responses,
    )

    quiz_a = UUID("11110000-0000-0000-0000-000000000001")
    quiz_b = UUID("11110000-0000-0000-0000-000000000002")
    owner = UUID("11110000-0000-0000-0000-000000000003")
    participant = UUID("11110000-0000-0000-0000-000000000004")
    _create_participant_scope_tables(session)
    session.execute(
        text(
            """
            INSERT INTO "Course" (id, "startDate", "endDate") VALUES
              (:course_a, TIMESTAMP '2026-01-01', TIMESTAMP '2026-12-31'),
              (:course_b, TIMESTAMP '2026-01-01', TIMESTAMP '2026-12-31');
            """
        ),
        {"course_a": COURSE_A, "course_b": COURSE_B},
    )
    session.execute(
        text(
            """
            INSERT INTO "PracticeQuiz" (
              id, name, "displayName", "pointsMultiplier", "resetTimeDays",
              status, "isGamificationEnabled", "isAssessmentEnabled",
              "isDeleted", "ownerId", "courseId", "createdAt", "updatedAt"
            ) VALUES
              (
                :quiz_a, 'a', 'a', 1, 1, 'PUBLISHED', false, false, false,
                :owner, :course_a, NOW(), NOW()
              ),
              (
                :quiz_b, 'b', 'b', 1, 1, 'PUBLISHED', false, false, false,
                :owner, :course_b, NOW(), NOW()
              )
            """
        ),
        {
            "quiz_a": quiz_a,
            "quiz_b": quiz_b,
            "owner": owner,
            "course_a": COURSE_A,
            "course_b": COURSE_B,
        },
    )
    session.execute(
        text(
            """
            INSERT INTO "QuestionResponseDetail" (
              id, score, "pointsAwarded", "xpAwarded", "timeSpent", response,
              "participantId", "participationId", "elementInstanceId",
              "practiceQuizId", "createdAt", "updatedAt"
            ) VALUES
              (
                1, 1, 1, 1, 1, '{}'::jsonb, :participant, 1, 1, :quiz_a,
                TIMESTAMP '2026-07-01 10:00:00', NOW()
              ),
              (
                2, 1, 1, 1, 1, '{}'::jsonb, :participant, 2, 2, :quiz_b,
                TIMESTAMP '2026-07-01 10:00:00', NOW()
              )
            """
        ),
        {
            "participant": participant,
            "quiz_a": quiz_a,
            "quiz_b": quiz_b,
        },
    )

    details = get_participant_responses(
        session,
        "2026-07-01T00:00:00Z",
        "2026-07-02T00:00:00Z",
        course_ids=[str(COURSE_A)],
    )

    assert details["courseId"].tolist() == [str(COURSE_A)]
    assert details["id"].tolist() == [1]


@pytest.mark.integration
def test_incremental_validity_marks_only_current_course_scope(session, monkeypatch):
    from src.modules.analytics_validity.mark_analytics_valid import (
        mark_analytics_valid,
    )

    session.execute(
        text(
            """
            CREATE TEMP TABLE "Course" (
              id uuid PRIMARY KEY,
              "areAnalyticsValid" boolean NOT NULL,
              "analyticsLastComputedAt" timestamp,
              "analyticsFinalizedAt" timestamp,
              "chatAnalyticsValidAt" timestamp
            );
            CREATE TEMP TABLE "ParticipantAnalytics" ("courseId" uuid NOT NULL);
            CREATE TEMP TABLE "ParticipantChatAnalytics" ("courseId" uuid NOT NULL);
            """
        )
    )
    session.execute(
        text(
            """
            INSERT INTO "Course" (id, "areAnalyticsValid") VALUES
              (:course_a, false),
              (:course_b, false)
            """
        ),
        {"course_a": COURSE_A, "course_b": COURSE_B},
    )
    session.execute(
        text(
            """
            INSERT INTO "ParticipantAnalytics" ("courseId") VALUES
              (:course_a),
              (:course_b)
            """
        ),
        {"course_a": COURSE_A, "course_b": COURSE_B},
    )
    monkeypatch.setenv("ANALYTICS_MODE", "incremental")
    monkeypatch.setenv("ANALYTICS_COURSE_IDS", str(COURSE_A))
    monkeypatch.setenv("ANALYTICS_CHAT_CUTOFF", "2026-07-09T09:30:00Z")

    mark_analytics_valid(session)

    rows = session.execute(
        text(
            """
            SELECT
              id,
              "areAnalyticsValid",
              "analyticsLastComputedAt" IS NOT NULL AS marked,
              "chatAnalyticsValidAt" IS NOT NULL AS chat_marked
            FROM "Course"
            ORDER BY id
            """
        )
    ).mappings()
    assert [dict(row) for row in rows] == [
        {
            "id": COURSE_A,
            "areAnalyticsValid": True,
            "marked": True,
            "chat_marked": True,
        },
        {
            "id": COURSE_B,
            "areAnalyticsValid": False,
            "marked": False,
            "chat_marked": False,
        },
    ]
