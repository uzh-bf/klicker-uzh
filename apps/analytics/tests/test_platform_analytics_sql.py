from __future__ import annotations

import pytest
from sqlalchemy import text

COURSE_ID = "aaaa0000-0000-0000-0000-000000000001"
PARTICIPANT_ID = "bbbb0000-0000-0000-0000-000000000001"


@pytest.mark.integration
def test_platform_rollup_excludes_free_text_and_scopes_locked_courses(session):
    from src.modules.platform_analytics.compute_platform_analytics import (
        compute_platform_semester_analytics,
    )

    session.execute(
        text(
            """
            CREATE TEMP TABLE "Course" (
              id uuid PRIMARY KEY,
              "startDate" timestamptz NOT NULL,
              "endDate" timestamptz NOT NULL,
              "isLearningAnalyticsEnabled" boolean NOT NULL
            );
            CREATE TEMP TABLE "Participation" (
              id integer PRIMARY KEY,
              "participantId" uuid NOT NULL,
              "courseId" uuid NOT NULL,
              "learningAnalyticsStatus" text NOT NULL,
              "learningAnalyticsIncludedFrom" timestamptz,
              "learningAnalyticsDisclosureVersion" text
            );
            CREATE TEMP TABLE "ElementInstance" (
              id integer PRIMARY KEY,
              "elementType" text NOT NULL,
              "elementBlockId" integer
            );
            CREATE TEMP TABLE "QuestionResponseDetail" (
              id integer PRIMARY KEY,
              "participantId" uuid NOT NULL,
              "participationId" integer NOT NULL,
              "elementInstanceId" integer NOT NULL,
              "practiceQuizId" uuid,
              "microLearningId" uuid,
              "createdAt" timestamptz NOT NULL
            );
            CREATE TEMP TABLE "LiveQuiz" (
              id uuid PRIMARY KEY,
              "courseId" uuid NOT NULL
            );
            CREATE TEMP TABLE "ElementBlock" (
              id integer PRIMARY KEY,
              "liveQuizId" uuid
            );
            CREATE TEMP TABLE "LiveQuizResponse" (
              id integer PRIMARY KEY,
              "participantId" uuid NOT NULL,
              "instanceId" integer NOT NULL,
              "submittedAt" timestamptz NOT NULL,
              "createdAt" timestamptz NOT NULL
            );
            CREATE TEMP TABLE "Chatbot" (
              id uuid PRIMARY KEY,
              "courseId" uuid NOT NULL
            );
            CREATE TEMP TABLE "ChatThread" (
              id uuid PRIMARY KEY,
              "participantId" uuid NOT NULL,
              "chatbotId" uuid NOT NULL
            );
            CREATE TEMP TABLE "ChatMessage" (
              id uuid PRIMARY KEY,
              "threadId" uuid NOT NULL,
              role text NOT NULL,
              "createdAt" timestamptz NOT NULL
            );
            CREATE TEMP TABLE "PlatformSemesterAnalytics" (
              id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
              "semesterLabel" text UNIQUE NOT NULL,
              "semesterStart" timestamptz NOT NULL,
              "semesterEnd" timestamptz NOT NULL,
              "quizResponseRows" integer NOT NULL,
              "quizTrials" integer NOT NULL,
              "quizDistinctParticipants" integer NOT NULL,
              "liveQuizResponses" integer NOT NULL,
              "liveQuizDistinctParticipants" integer NOT NULL,
              "chatMessages" integer NOT NULL,
              "chatDistinctParticipants" integer NOT NULL,
              "activeCourses" integer NOT NULL,
              "coursesWithChatbot" integer NOT NULL,
              "coursesWithLiveQuiz" integer NOT NULL,
              "coursesWithQuizActivity" integer NOT NULL,
              "createdAt" timestamptz NOT NULL,
              "updatedAt" timestamptz NOT NULL
            );
            """
        )
    )
    session.execute(
        text(
            """
            INSERT INTO "Course" (
              id, "startDate", "endDate", "isLearningAnalyticsEnabled"
            ) VALUES (
              :course_id,
              TIMESTAMPTZ '2026-02-15 00:00:00+00',
              TIMESTAMPTZ '2026-08-31 23:59:59+00',
              true
            );
            """
        ),
        {"course_id": COURSE_ID},
    )
    session.execute(
        text(
            """
            INSERT INTO "Participation" (
              id, "participantId", "courseId", "learningAnalyticsStatus",
              "learningAnalyticsIncludedFrom",
              "learningAnalyticsDisclosureVersion"
            ) VALUES (
              1, :participant_id, :course_id, 'INCLUDED',
              TIMESTAMPTZ '2026-02-15 00:00:00+00', '2026-07-30-v1'
            );
            """
        ),
        {"participant_id": PARTICIPANT_ID, "course_id": COURSE_ID},
    )
    session.execute(
        text(
            """
            INSERT INTO "ElementInstance" (id, "elementType")
            VALUES (1, 'SC'), (2, 'FREE_TEXT');
            """
        )
    )
    session.execute(
        text(
            """
            INSERT INTO "QuestionResponseDetail" (
              id, "participantId", "participationId", "elementInstanceId",
              "practiceQuizId", "createdAt"
            ) VALUES
              (
                1, :participant_id, 1, 1,
                'cccc0000-0000-0000-0000-000000000001',
                TIMESTAMPTZ '2026-07-01 10:00:00+00'
              ),
              (
                2, :participant_id, 1, 2,
                'cccc0000-0000-0000-0000-000000000001',
                TIMESTAMPTZ '2026-07-01 10:01:00+00'
              );
            """
        ),
        {"participant_id": PARTICIPANT_ID},
    )

    assert compute_platform_semester_analytics(session) == 1
    row = (
        session.execute(
            text(
                """
                SELECT
                  "quizResponseRows",
                  "quizTrials",
                  "quizDistinctParticipants",
                  "coursesWithQuizActivity"
                FROM "PlatformSemesterAnalytics"
                WHERE "semesterLabel" = 'FS26'
                """
            )
        )
        .mappings()
        .one()
    )
    assert dict(row) == {
        "quizResponseRows": 1,
        "quizTrials": 1,
        "quizDistinctParticipants": 1,
        "coursesWithQuizActivity": 1,
    }
