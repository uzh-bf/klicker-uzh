from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import text


def test_aggregated_query_ranks_attempts_per_participant_and_instance():
    from src.modules.live_quiz_analytics.compute_live_quiz_analytics import (
        _AGGREGATED_SQL,
    )

    assert 'PARTITION BY lqr."participantId", lqr."instanceId"' in _AGGREGATED_SQL
    assert "attempt_asc = 1" in _AGGREGATED_SQL
    assert "attempt_asc = attempt_count" in _AGGREGATED_SQL
    assert "JOIN LATERAL" not in _AGGREGATED_SQL


@pytest.mark.integration
def test_live_quiz_queries_exclude_free_text_and_compute_attempts(session):
    from src.modules.live_quiz_analytics.compute_live_quiz_analytics import (
        compute_aggregated_live_quiz_analytics,
        compute_participant_live_quiz_analytics,
    )

    session.execute(
        text(
            """
            CREATE TEMP TABLE "LiveQuiz" (
              id text PRIMARY KEY,
              "courseId" uuid,
              "finishedAt" timestamptz,
              "isAssessmentEnabled" boolean NOT NULL
            );
            CREATE TEMP TABLE "Course" (
              id uuid PRIMARY KEY,
              "isLearningAnalyticsEnabled" boolean NOT NULL
            );
            CREATE TEMP TABLE "Participation" (
              id integer PRIMARY KEY,
              "participantId" text NOT NULL,
              "courseId" uuid NOT NULL,
              "learningAnalyticsStatus" text NOT NULL,
              "learningAnalyticsIncludedFrom" timestamptz,
              "learningAnalyticsDisclosureVersion" text
            );
            CREATE TEMP TABLE "ElementBlock" (
              id integer PRIMARY KEY,
              "liveQuizId" text NOT NULL
            );
            CREATE TEMP TABLE "ElementInstance" (
              id integer PRIMARY KEY,
              "elementBlockId" integer NOT NULL,
              "elementType" text NOT NULL
            );
            CREATE TEMP TABLE "LiveQuizResponse" (
              id integer PRIMARY KEY,
              "participantId" text NOT NULL,
              "instanceId" integer NOT NULL,
              "submittedAt" timestamptz NOT NULL,
              correctness text NOT NULL,
              "correctionOnly" boolean NOT NULL,
              "timeSpent" real NOT NULL,
              "basePoints" integer NOT NULL,
              "correctnessPoints" integer NOT NULL,
              "bonusPoints" integer NOT NULL
            );
            CREATE TEMP TABLE "ParticipantLiveQuizAnalytics" (
              "participantId" text NOT NULL,
              "liveQuizId" text NOT NULL,
              "courseId" text NOT NULL,
              "totalResponses" integer NOT NULL,
              "firstCorrectCount" integer NOT NULL,
              "lastCorrectCount" integer NOT NULL,
              "averageTimeSpent" real,
              "totalBasePoints" integer NOT NULL,
              "totalCorrectnessPoints" integer NOT NULL,
              "totalBonusPoints" integer NOT NULL,
              "createdAt" timestamptz NOT NULL,
              "updatedAt" timestamptz NOT NULL,
              PRIMARY KEY ("participantId", "liveQuizId")
            );
            CREATE TEMP TABLE "AggregatedLiveQuizAnalytics" (
              "liveQuizId" text PRIMARY KEY,
              "courseId" text NOT NULL,
              "participantCount" integer NOT NULL,
              "responseCount" integer NOT NULL,
              "meanFirstCorrectness" real,
              "meanLastCorrectness" real,
              "lateSubmitterRate" real,
              "createdAt" timestamptz NOT NULL,
              "updatedAt" timestamptz NOT NULL
            );
            """
        )
    )
    session.execute(
        text(
            """
            INSERT INTO "LiveQuiz"
              (id, "courseId", "finishedAt", "isAssessmentEnabled")
            VALUES
              ('quiz-1', 'aaaa0000-0000-0000-0000-000000000001', :finished_at, true)
            """
        ),
        {"finished_at": datetime(2026, 7, 23, 10, 5, tzinfo=UTC)},
    )
    session.execute(
        text(
            """
            INSERT INTO "Course" (id, "isLearningAnalyticsEnabled")
            VALUES ('aaaa0000-0000-0000-0000-000000000001', true);
            INSERT INTO "Participation" (
              id, "participantId", "courseId", "learningAnalyticsStatus",
              "learningAnalyticsIncludedFrom", "learningAnalyticsDisclosureVersion"
            ) VALUES
              (
                1, 'participant-1', 'aaaa0000-0000-0000-0000-000000000001', 'INCLUDED',
                TIMESTAMPTZ '2026-07-23 10:00:00+00', '2026-07-30-v1'
              ),
              (
                2, 'participant-2', 'aaaa0000-0000-0000-0000-000000000001', 'INCLUDED',
                TIMESTAMPTZ '2026-07-23 10:00:00+00', '2026-07-30-v1'
              );
            """
        )
    )
    session.execute(
        text(
            """
            INSERT INTO "ElementBlock" (id, "liveQuizId")
            VALUES (1, 'quiz-1')
            """
        )
    )
    session.execute(
        text(
            """
            INSERT INTO "ElementInstance" (id, "elementBlockId", "elementType")
            VALUES (10, 1, 'SC'), (11, 1, 'FREE_TEXT')
            """
        )
    )
    session.execute(
        text(
            """
            INSERT INTO "LiveQuizResponse"
              (
                id, "participantId", "instanceId", "submittedAt", correctness,
                "correctionOnly", "timeSpent", "basePoints",
                "correctnessPoints", "bonusPoints"
              )
            VALUES
              (1, 'participant-1', 10, :p1_first, 'WRONG', false, 10, 1, 0, 0),
              (2, 'participant-1', 10, :p1_last, 'CORRECT', false, 20, 1, 1, 0),
              (3, 'participant-2', 10, :p2_only, 'CORRECT', false, 30, 1, 1, 0),
              (4, 'participant-2', 10, :ignored_correction, 'WRONG', true, 40, 1, 0, 0),
              (5, 'participant-1', 11, :free_text, 'CORRECT', false, 50, 1, 1, 0)
            """
        ),
        {
            "p1_first": datetime(2026, 7, 23, 10, 1, tzinfo=UTC),
            "p1_last": datetime(2026, 7, 23, 10, 3, tzinfo=UTC),
            "p2_only": datetime(2026, 7, 23, 10, 6, tzinfo=UTC),
            "ignored_correction": datetime(2026, 7, 23, 10, 0, tzinfo=UTC),
            "free_text": datetime(2026, 7, 23, 10, 4, tzinfo=UTC),
        },
    )

    assert compute_participant_live_quiz_analytics(session) == 2
    participant_responses = session.execute(
        text(
            """
            SELECT "participantId", "totalResponses"
            FROM "ParticipantLiveQuizAnalytics"
            ORDER BY "participantId"
            """
        )
    ).all()
    assert participant_responses == [("participant-1", 2), ("participant-2", 1)]

    assert compute_aggregated_live_quiz_analytics(session) == 1

    result = (
        session.execute(
            text(
                """
                SELECT
                  "participantCount",
                  "responseCount",
                  "meanFirstCorrectness",
                  "meanLastCorrectness",
                  "lateSubmitterRate"
                FROM "AggregatedLiveQuizAnalytics"
                WHERE "liveQuizId" = 'quiz-1'
                """
            )
        )
        .mappings()
        .one()
    )
    assert result["participantCount"] == 2
    assert result["responseCount"] == 3
    assert result["meanFirstCorrectness"] == pytest.approx(0.5)
    assert result["meanLastCorrectness"] == pytest.approx(1.0)
    assert result["lateSubmitterRate"] == pytest.approx(0.5)
