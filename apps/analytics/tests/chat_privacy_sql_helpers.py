from uuid import UUID

from sqlalchemy import text

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
