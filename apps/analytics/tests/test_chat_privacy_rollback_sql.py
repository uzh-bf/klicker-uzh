import pytest
from sqlalchemy import text

from tests.chat_privacy_sql_helpers import (
    CHATBOT_A,
    COURSE_A,
    _create_temp_tables,
    _seed_chat_sources,
)


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
