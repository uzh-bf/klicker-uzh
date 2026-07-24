from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

import pytest
from sqlalchemy import text

from src.modules.utils import (
    AnalyticsMode,
    AnalyticsRunConfig,
    analytics_run_context,
)

COURSE_A = UUID("aaaa0000-0000-0000-0000-000000000001")
COURSE_B = UUID("aaaa0000-0000-0000-0000-000000000002")
CHATBOT_A = UUID("bbbb0000-0000-0000-0000-000000000001")
CHATBOT_B = UUID("bbbb0000-0000-0000-0000-000000000002")
DISCLAIMER = UUID("cccc0000-0000-0000-0000-000000000001")
STALE_DISCLAIMER = UUID("cccc0000-0000-0000-0000-000000000002")
ACCEPTED = UUID("dddd0000-0000-0000-0000-000000000001")
STALE = UUID("dddd0000-0000-0000-0000-000000000002")
DECLINED = UUID("dddd0000-0000-0000-0000-000000000003")
COURSE_B_PARTICIPANT = UUID("dddd0000-0000-0000-0000-000000000004")


def _create_temp_tables(session) -> None:
    session.execute(
        text(
            """
            CREATE TEMP TABLE "Course" (
              id uuid PRIMARY KEY,
              "areAnalyticsValid" boolean NOT NULL DEFAULT false,
              "analyticsLastComputedAt" timestamp,
              "analyticsFinalizedAt" timestamp,
              "chatAnalyticsValidAt" timestamp
            );
            CREATE TEMP TABLE "ParticipantAnalytics" ("courseId" uuid NOT NULL);
            CREATE TEMP TABLE "Chatbot" (
              id uuid PRIMARY KEY,
              "courseId" uuid NOT NULL,
              "disclaimerId" uuid,
              "updatedAt" timestamp NOT NULL
            );
            CREATE TEMP TABLE "ChatThread" (
              id uuid PRIMARY KEY,
              "chatbotId" uuid NOT NULL,
              "participantId" uuid NOT NULL
            );
            CREATE TEMP TABLE "ChatUsageCredits" (
              "participantId" uuid NOT NULL,
              "chatbotId" uuid NOT NULL,
              "acceptedDisclaimerId" uuid,
              "disclaimerAcceptedAt" timestamp,
              "disclaimerDeclined" boolean NOT NULL,
              "current" numeric NOT NULL,
              "updatedAt" timestamp NOT NULL
            );
            CREATE TEMP TABLE "ChatMessage" (
              id uuid PRIMARY KEY,
              "threadId" uuid NOT NULL,
              role text NOT NULL,
              content jsonb NOT NULL,
              "chatMode" text,
              "modelId" text,
              "reasoningEffort" text,
              "creditsUsed" numeric NOT NULL,
              "createdAt" timestamp(3) NOT NULL
            );
            CREATE TEMP TABLE "ChatAttachment" (
              id uuid PRIMARY KEY,
              "messageId" uuid NOT NULL
            );
            CREATE TEMP TABLE "ParticipantChatAnalytics" (
              "type" "AnalyticsType" NOT NULL,
              "timestamp" date NOT NULL,
              "participantId" uuid NOT NULL,
              "chatbotId" uuid NOT NULL,
              "courseId" uuid NOT NULL,
              "userMessages" integer NOT NULL,
              "assistantMessages" integer NOT NULL,
              threads integer NOT NULL,
              "distinctDays" integer NOT NULL,
              "firstMessageAt" timestamp,
              "lastMessageAt" timestamp,
              "msgLenMedian" real,
              "msgLenP90" real,
              "msgLenP99" real,
              "messagesPerThreadP50" real,
              "messagesPerThreadP90" real,
              "chatModeCounts" jsonb NOT NULL,
              "reasoningEffortCounts" jsonb NOT NULL,
              "attachmentCount" integer NOT NULL,
              "toolCallCount" integer NOT NULL,
              "totalCreditsUsed" numeric NOT NULL,
              "creditsExhausted" boolean NOT NULL,
              "createdAt" timestamp NOT NULL,
              "updatedAt" timestamp NOT NULL,
              UNIQUE ("type", "participantId", "chatbotId", "timestamp")
            );
            CREATE TEMP TABLE "AggregatedChatbotAnalytics" (
              "type" "AnalyticsType" NOT NULL,
              "timestamp" date NOT NULL,
              "chatbotId" uuid NOT NULL,
              "courseId" uuid NOT NULL,
              "activeParticipants" integer NOT NULL,
              "newParticipants" integer NOT NULL,
              "returningParticipants" integer NOT NULL,
              threads integer NOT NULL,
              "userMessages" integer NOT NULL,
              "assistantMessages" integer NOT NULL,
              "totalCreditsUsed" numeric NOT NULL,
              "creditExhaustionRate" real,
              "disclaimerAcceptedCount" integer NOT NULL,
              "disclaimerDeclinedCount" integer NOT NULL,
              "hourOfDayDistribution" jsonb NOT NULL,
              "modelDistribution" jsonb NOT NULL,
              "modeDistribution" jsonb NOT NULL,
              "reasoningEffortDistribution" jsonb NOT NULL,
              "createdAt" timestamp NOT NULL,
              "updatedAt" timestamp NOT NULL,
              UNIQUE ("type", "chatbotId", "timestamp")
            );
            CREATE TEMP TABLE "Participation" (
              "participantId" uuid NOT NULL,
              "courseId" uuid NOT NULL
            );
            CREATE TEMP TABLE "ParticipantPerformance" (
              "participantId" uuid NOT NULL,
              "courseId" uuid NOT NULL,
              "firstErrorRate" real,
              "lastErrorRate" real
            );
            CREATE TEMP TABLE "ParticipantChatOutcome" (
              "participantId" uuid NOT NULL,
              "courseId" uuid NOT NULL,
              "chatMessagesInCourse" integer NOT NULL,
              "chatDoseBucket" "ChatDoseBucket" NOT NULL,
              "firstErrorRate" real,
              "lastErrorRate" real,
              "errorRateDelta" real,
              "hasBothModalities" boolean NOT NULL,
              "createdAt" timestamp NOT NULL,
              "updatedAt" timestamp NOT NULL,
              UNIQUE ("participantId", "courseId")
            );
            CREATE TEMP TABLE "ParticipantCourseAnalytics" (
              "participantId" uuid NOT NULL,
              "courseId" uuid NOT NULL,
              "hasChatActivity" boolean NOT NULL
            );
            """
        )
    )


def _seed_chat_sources(session) -> None:
    params = {
        "chatbot_a": CHATBOT_A,
        "chatbot_b": CHATBOT_B,
        "course_a": COURSE_A,
        "course_b": COURSE_B,
        "disclaimer": DISCLAIMER,
        "stale_disclaimer": STALE_DISCLAIMER,
        "accepted": ACCEPTED,
        "stale": STALE,
        "declined": DECLINED,
    }
    session.execute(
        text(
            """
            INSERT INTO "Course" (id, "chatAnalyticsValidAt") VALUES
              (:course_a, TIMESTAMP '2026-07-05 00:00:00'),
              (:course_b, TIMESTAMP '2026-07-05 00:00:00')
            """
        ),
        params,
    )
    session.execute(
        text(
            """
            INSERT INTO "Chatbot" (id, "courseId", "disclaimerId", "updatedAt") VALUES
              (:chatbot_a, :course_a, :disclaimer, TIMESTAMP '2026-01-01 00:00:00'),
              (:chatbot_b, :course_b, :disclaimer, TIMESTAMP '2026-01-01 00:00:00')
            """
        ),
        params,
    )
    session.execute(
        text(
            """
            INSERT INTO "ChatThread" (id, "chatbotId", "participantId") VALUES
              ('eeee0000-0000-0000-0000-000000000001', :chatbot_a, :accepted),
              ('eeee0000-0000-0000-0000-000000000002', :chatbot_a, :stale),
              ('eeee0000-0000-0000-0000-000000000003', :chatbot_a, :declined)
            """
        ),
        params,
    )
    session.execute(
        text(
            """
            INSERT INTO "ChatUsageCredits"
              (
                "participantId", "chatbotId", "acceptedDisclaimerId",
                "disclaimerAcceptedAt", "disclaimerDeclined", "current", "updatedAt"
              )
            VALUES
              (
                :accepted, :chatbot_a, :disclaimer,
                TIMESTAMP '2026-01-01 00:00:00', false, 10, TIMESTAMP '2026-01-01 00:00:00'
              ),
              (
                :stale, :chatbot_a, :stale_disclaimer,
                TIMESTAMP '2026-01-01 00:00:00', false, 10, TIMESTAMP '2026-01-01 00:00:00'
              ),
              (
                :declined, :chatbot_a, :disclaimer,
                NULL, true, 10, TIMESTAMP '2026-01-01 00:00:00'
              )
            """
        ),
        params,
    )
    session.execute(
        text(
            """
            INSERT INTO "ChatMessage"
              (id, "threadId", role, content, "chatMode", "modelId",
               "reasoningEffort", "creditsUsed", "createdAt")
            VALUES
              (
                'ffff0000-0000-0000-0000-000000000001',
                'eeee0000-0000-0000-0000-000000000001',
                'user', '[{"type":"text","text":"accepted"}]', 'tutor', NULL, NULL, 0,
                TIMESTAMP '2026-07-01 10:00:00'
              ),
              (
                'ffff0000-0000-0000-0000-000000000002',
                'eeee0000-0000-0000-0000-000000000002',
                'user', '[{"type":"text","text":"stale"}]', 'tutor', NULL, NULL, 0,
                TIMESTAMP '2026-07-01 10:00:00'
              ),
              (
                'ffff0000-0000-0000-0000-000000000003',
                'eeee0000-0000-0000-0000-000000000003',
                'user', '[{"type":"text","text":"declined"}]', 'tutor', NULL, NULL, 0,
                TIMESTAMP '2026-07-01 10:00:00'
              )
            """
        ),
        params,
    )


def _create_participant_scope_tables(session) -> None:
    session.execute(
        text(
            """
            CREATE TEMP TABLE "Course" (
              id uuid PRIMARY KEY,
              "startDate" timestamp NOT NULL,
              "endDate" timestamp NOT NULL
            );
            CREATE TEMP TABLE "PracticeQuiz" (
              id uuid PRIMARY KEY,
              name text NOT NULL,
              "displayName" text NOT NULL,
              description text,
              "pointsMultiplier" integer NOT NULL,
              "resetTimeDays" integer NOT NULL,
              status "PublicationStatus" NOT NULL,
              "isGamificationEnabled" boolean NOT NULL,
              "isAssessmentEnabled" boolean NOT NULL,
              "isDeleted" boolean NOT NULL,
              "ownerId" uuid NOT NULL,
              "courseId" uuid NOT NULL,
              "createdAt" timestamp NOT NULL,
              "updatedAt" timestamp NOT NULL
            );
            CREATE TEMP TABLE "MicroLearning" (
              id uuid PRIMARY KEY,
              name text NOT NULL,
              "displayName" text NOT NULL,
              "pointsMultiplier" integer NOT NULL,
              description text,
              status "PublicationStatus" NOT NULL,
              "scheduledStartAt" timestamp NOT NULL,
              "scheduledEndAt" timestamp NOT NULL,
              "isGamificationEnabled" boolean NOT NULL,
              "isAssessmentEnabled" boolean NOT NULL,
              "isDeleted" boolean NOT NULL,
              "ownerId" uuid NOT NULL,
              "courseId" uuid NOT NULL,
              "createdAt" timestamp NOT NULL,
              "updatedAt" timestamp NOT NULL
            );
            CREATE TEMP TABLE "QuestionResponseDetail" (
              id integer PRIMARY KEY,
              score double precision NOT NULL,
              "pointsAwarded" double precision,
              "xpAwarded" double precision NOT NULL,
              "timeSpent" double precision NOT NULL,
              response jsonb NOT NULL,
              "participantId" uuid NOT NULL,
              "participationId" integer NOT NULL,
              "elementInstanceId" integer NOT NULL,
              "practiceQuizId" uuid,
              "microLearningId" uuid,
              "createdAt" timestamp NOT NULL,
              "updatedAt" timestamp NOT NULL
            );
            """
        )
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


@pytest.mark.integration
def test_chat_window_delete_rolls_back_when_recompute_fails(session, monkeypatch):
    from src.modules.aggregated_chat_analytics import (
        compute_aggregated_chatbot_analytics as module,
    )

    _create_temp_tables(session)
    _seed_chat_sources(session)
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
              1, 0, 0, 1, 1, 0, 0, 1, 0,
              '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, NOW(), NOW()
            )
            """
        ),
        {"chatbot": CHATBOT_A, "course": COURSE_A},
    )
    session.flush()

    savepoint = session.begin_nested()
    monkeypatch.setattr(module, "_SQL_DEFAULT", "SELECT 1 / 0")
    with pytest.raises(Exception, match="division by zero"):
        module.compute_aggregated_chatbot_analytics(
            session,
            "2026-07-01T00:00:00Z",
            "2026-07-02T00:00:00Z",
            "2026-07-01",
            "DAILY",
            course_ids=[str(COURSE_A)],
        )
    savepoint.rollback()

    remaining = session.execute(
        text(
            """
            SELECT "userMessages"
            FROM "AggregatedChatbotAnalytics"
            WHERE "courseId" = :course_id
            """
        ),
        {"course_id": COURSE_A},
    ).scalar_one()
    assert remaining == 1
