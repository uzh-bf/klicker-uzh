"""In-memory fetch of user-role chat message text per chatbot.

Text is read straight from Postgres into a Python list and never persisted to disk
(§3.9 privacy gate). The caller is responsible for releasing the list once the
clustering pipeline has finished with it.
"""


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
WHERE m.role = 'user'
  AND ct."chatbotId" = $1::uuid
  AND m."createdAt" >= $2::timestamptz
  AND m."createdAt" <  $3::timestamptz
"""


def load_user_text(db, chatbot_id: str, win_start: str, win_end: str):
    """Return list of dicts with keys: message_id, participant_id, text.

    Rows with an empty text field (e.g. tool-only messages) are filtered out.
    """
    rows = db.query_raw(LOAD_SQL, chatbot_id, win_start, win_end)
    return [r for r in rows if r.get("text") and r["text"].strip()]
