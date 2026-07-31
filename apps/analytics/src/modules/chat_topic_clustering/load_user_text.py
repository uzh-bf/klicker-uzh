"""In-memory fetch of user-role chat message text per chatbot.

Text is read straight from Postgres into a Python list and never persisted to
disk. Chat access already requires the disclaimer; this analytics input is
governed by the course and participant LA choice.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session


# SELECT user-message text for a single chatbot in the given window.
# Uses jsonb->0->>'text' on the content column (which is Json storing an array of
# {type: 'text'|'reasoning'|'tool-call'} chunks). Only the first text chunk is read —
# all production chat messages emit text as the leading chunk today.
LOAD_SQL = """
SELECT
  m.id::text           AS message_id,
  ct."participantId"   AS participant_id,
  COALESCE(m.content::jsonb->0->>'text', '') AS text
FROM "ChatMessage" m
JOIN "ChatThread" ct ON ct.id = m."threadId"
JOIN "Chatbot" cb ON cb.id = ct."chatbotId"
JOIN "Course" c ON c.id = cb."courseId"
JOIN "Participation" p
  ON p."participantId" = ct."participantId"
 AND p."courseId" = cb."courseId"
WHERE m.role = 'user'
  AND ct."chatbotId" = CAST(:chatbot_id AS uuid)
  AND c."isLearningAnalyticsEnabled" = true
  AND p."learningAnalyticsStatus" = 'INCLUDED'
  AND p."learningAnalyticsDisclosureVersion" = '2026-07-30-v1'
  AND p."learningAnalyticsIncludedFrom" IS NOT NULL
  AND m."createdAt" >= p."learningAnalyticsIncludedFrom"
  AND m."createdAt" >= (CAST(:win_start AS timestamptz) AT TIME ZONE 'UTC')
  AND m."createdAt" <  (CAST(:win_end AS timestamptz) AT TIME ZONE 'UTC')
"""


def load_user_text(session: Session, chatbot_id: str, win_start: str, win_end: str):
    """Return list of dicts with keys: message_id, participant_id, text.

    Rows with an empty text field (e.g. tool-only messages) are filtered out.
    """
    rows = (
        session.execute(
            text(LOAD_SQL),
            {"chatbot_id": chatbot_id, "win_start": win_start, "win_end": win_end},
        )
        .mappings()
        .all()
    )
    return [dict(r) for r in rows if r.get("text") and r["text"].strip()]
