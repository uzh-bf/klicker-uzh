from __future__ import annotations

from uuid import UUID

import pytest
from sqlalchemy import text


@pytest.mark.integration
def test_load_user_text_enforces_la_eligibility_not_disclaimer_state(session):
    from src.modules.chat_topic_clustering.load_user_text import load_user_text

    chatbot_id = UUID("00000000-0000-0000-0000-000000000001")
    course_id = UUID("10000000-0000-0000-0000-000000000001")
    disclaimer_id = UUID("00000000-0000-0000-0000-000000000002")
    stale_disclaimer_id = UUID("00000000-0000-0000-0000-000000000003")
    current_participant_id = UUID("00000000-0000-0000-0000-000000000004")
    stale_participant_id = UUID("00000000-0000-0000-0000-000000000005")
    declined_participant_id = UUID("00000000-0000-0000-0000-000000000006")
    current_thread_id = UUID("00000000-0000-0000-0000-000000000007")
    stale_thread_id = UUID("00000000-0000-0000-0000-000000000008")
    declined_thread_id = UUID("00000000-0000-0000-0000-000000000009")
    included_message_id = UUID("00000000-0000-0000-0000-000000000010")

    session.execute(text("SET LOCAL TIME ZONE 'Europe/Zurich'"))
    session.execute(
        text(
            """
            CREATE TEMP TABLE "Chatbot" (
              id uuid PRIMARY KEY,
              "courseId" uuid NOT NULL,
              "disclaimerId" uuid
            );
            CREATE TEMP TABLE "Course" (
              id uuid PRIMARY KEY,
              "isLearningAnalyticsEnabled" boolean NOT NULL
            );
            CREATE TEMP TABLE "Participation" (
              "participantId" uuid NOT NULL,
              "courseId" uuid NOT NULL,
              "learningAnalyticsStatus" text NOT NULL,
              "learningAnalyticsIncludedFrom" timestamp,
              "learningAnalyticsDisclosureVersion" text
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
              "disclaimerDeclined" boolean NOT NULL
            );
            CREATE TEMP TABLE "ChatMessage" (
              id uuid PRIMARY KEY,
              "threadId" uuid NOT NULL,
              content jsonb NOT NULL,
              role text NOT NULL,
              "createdAt" timestamp(3) NOT NULL
            );
            """
        )
    )
    session.execute(
        text(
            """
            INSERT INTO "Course" (id, "isLearningAnalyticsEnabled")
            VALUES (:course_id, true)
            """
        ),
        {"course_id": course_id},
    )
    session.execute(
        text(
            """
            INSERT INTO "Chatbot" (id, "courseId", "disclaimerId")
            VALUES (:chatbot_id, :course_id, :disclaimer_id)
            """
        ),
        {
            "chatbot_id": chatbot_id,
            "course_id": course_id,
            "disclaimer_id": disclaimer_id,
        },
    )
    session.execute(
        text(
            """
            INSERT INTO "ChatThread" (id, "chatbotId", "participantId")
            VALUES
              (:current_thread_id, :chatbot_id, :current_participant_id),
              (:stale_thread_id, :chatbot_id, :stale_participant_id),
              (:declined_thread_id, :chatbot_id, :declined_participant_id)
            """
        ),
        {
            "chatbot_id": chatbot_id,
            "current_participant_id": current_participant_id,
            "stale_participant_id": stale_participant_id,
            "declined_participant_id": declined_participant_id,
            "current_thread_id": current_thread_id,
            "stale_thread_id": stale_thread_id,
            "declined_thread_id": declined_thread_id,
        },
    )
    session.execute(
        text(
            """
            INSERT INTO "Participation" (
              "participantId", "courseId", "learningAnalyticsStatus",
              "learningAnalyticsIncludedFrom", "learningAnalyticsDisclosureVersion"
            ) VALUES
              (
                :current_participant_id, :course_id, 'INCLUDED',
                TIMESTAMP '2026-07-23 10:15:00', '2026-07-30-v1'
              ),
              (
                :stale_participant_id, :course_id, 'EXCLUDED',
                NULL, '2026-07-30-v1'
              ),
              (
                :declined_participant_id, :course_id, 'INCLUDED',
                TIMESTAMP '2026-07-23 10:15:00', '2026-07-30-v1'
              )
            """
        ),
        {
            "course_id": course_id,
            "current_participant_id": current_participant_id,
            "stale_participant_id": stale_participant_id,
            "declined_participant_id": declined_participant_id,
        },
    )
    session.execute(
        text(
            """
            INSERT INTO "ChatUsageCredits"
              ("participantId", "chatbotId", "acceptedDisclaimerId", "disclaimerDeclined")
            VALUES
              (:current_participant_id, :chatbot_id, :disclaimer_id, false),
              (:stale_participant_id, :chatbot_id, :stale_disclaimer_id, false),
              (:declined_participant_id, :chatbot_id, :disclaimer_id, true)
            """
        ),
        {
            "chatbot_id": chatbot_id,
            "disclaimer_id": disclaimer_id,
            "stale_disclaimer_id": stale_disclaimer_id,
            "current_participant_id": current_participant_id,
            "stale_participant_id": stale_participant_id,
            "declined_participant_id": declined_participant_id,
        },
    )
    session.execute(
        text(
            """
            INSERT INTO "ChatMessage" (id, "threadId", content, role, "createdAt")
            VALUES
              (
                :included_message_id,
                :current_thread_id,
                '[{"type":"text","text":"included"}]',
                'user',
                TIMESTAMP '2026-07-23 10:30:00'
              ),
              (
                '00000000-0000-0000-0000-000000000011',
                :current_thread_id,
                '[{"type":"text","text":"exclusive end"}]',
                'user',
                TIMESTAMP '2026-07-23 11:00:00'
              ),
              (
                '00000000-0000-0000-0000-000000000012',
                :stale_thread_id,
                '[{"type":"text","text":"stale consent"}]',
                'user',
                TIMESTAMP '2026-07-23 10:30:00'
              ),
              (
                '00000000-0000-0000-0000-000000000013',
                :declined_thread_id,
                '[{"type":"text","text":"declined"}]',
                'user',
                TIMESTAMP '2026-07-23 10:30:00'
              )
            """
        ),
        {
            "current_thread_id": current_thread_id,
            "stale_thread_id": stale_thread_id,
            "declined_thread_id": declined_thread_id,
            "included_message_id": included_message_id,
        },
    )

    rows = load_user_text(
        session,
        str(chatbot_id),
        "2026-07-23T10:00:00Z",
        "2026-07-23T11:00:00Z",
    )

    assert rows == [
        {
            "message_id": str(included_message_id),
            "participant_id": current_participant_id,
            "text": "included",
        },
        {
            "message_id": "00000000-0000-0000-0000-000000000013",
            "participant_id": declined_participant_id,
            "text": "declined",
        },
    ]
