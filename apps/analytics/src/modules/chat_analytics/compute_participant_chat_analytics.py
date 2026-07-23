import os

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.modules.utils import COURSE_TIMESTAMP, load_sql, render_uuid_in_clause

_SQL = load_sql(os.path.join(os.path.dirname(__file__), "participant_chat_analytics.sql"))
_COURSE_FILTER_PLACEHOLDER = "/*COURSE_FILTER*/"
_ATTACHMENT_ROLLUP_PLACEHOLDER = "/*ATTACHMENT_ROLLUP_CTE*/"
_TABLE_EXISTS_SQL = text(
    """
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = :table_name
    )
    """
)
_ATTACHMENT_SUPPORT_CACHE: dict[tuple[str, str], bool] = {}
_ATTACHMENT_ROLLUP_SQL = """
attachment_rollup AS (
  SELECT ct."participantId", ct."chatbotId", COUNT(a.id) AS attachment_count
  FROM "ChatAttachment" a
  JOIN "ChatMessage" m ON m.id = a."messageId"
  JOIN "ChatThread" ct ON ct.id = m."threadId"
  JOIN eligible_pairs ep ON ep."participantId" = ct."participantId" AND ep."chatbotId" = ct."chatbotId"
  CROSS JOIN params
  WHERE m.role = 'user'
    AND m."createdAt" >= params.win_start AND m."createdAt" < params.win_end
  GROUP BY 1, 2
),
""".strip()
_ATTACHMENT_ROLLUP_FALLBACK_SQL = """
attachment_rollup AS (
  SELECT DISTINCT "participantId", "chatbotId", 0::bigint AS attachment_count
  FROM user_rollup
),
""".strip()

__all__ = ["compute_participant_chat_analytics", "COURSE_TIMESTAMP"]


def _session_cache_key(session: Session) -> str:
    bind = getattr(session, "get_bind", lambda: None)()
    if bind is not None:
        url = getattr(bind, "url", None)
        if url is not None:
            return str(url)
        return f"bind:{id(bind)}"
    return f"session:{id(session)}"


def _table_exists(session: Session, table_name: str) -> bool:
    key = (_session_cache_key(session), table_name)
    cached = _ATTACHMENT_SUPPORT_CACHE.get(key)
    if cached is not None:
        return cached
    exists = bool(session.execute(_TABLE_EXISTS_SQL, {"table_name": table_name}).scalar_one())
    _ATTACHMENT_SUPPORT_CACHE[key] = exists
    return exists


def _prepare_sql(
    template: str,
    course_ids: list[str] | None,
    *,
    include_attachments: bool,
) -> str:
    clause = "" if course_ids is None else render_uuid_in_clause('cb."courseId"', course_ids)
    attachment_rollup = _ATTACHMENT_ROLLUP_SQL if include_attachments else _ATTACHMENT_ROLLUP_FALLBACK_SQL
    return template.replace(_COURSE_FILTER_PLACEHOLDER, clause).replace(
        _ATTACHMENT_ROLLUP_PLACEHOLDER, attachment_rollup
    )


def compute_participant_chat_analytics(
    session: Session,
    win_start: str,
    win_end: str,
    timestamp: str,
    analytics_type: str,
    course_ids: list[str] | None = None,
    verbose: bool = False,
):
    """Run the participant-chat-analytics rollup for a single window."""
    if analytics_type not in ("DAILY", "WEEKLY", "MONTHLY", "COURSE"):
        raise ValueError(f"Unknown analytics type: {analytics_type}")

    if verbose:
        print(f"[chat_analytics] {analytics_type} {win_start}..{win_end} -> {timestamp}")

    include_attachments = _table_exists(session, "ChatAttachment")
    if verbose and not include_attachments:
        print("[chat_analytics] ChatAttachment missing; defaulting attachmentCount to 0")

    result = session.execute(
        text(
            _prepare_sql(
                _SQL,
                course_ids,
                include_attachments=include_attachments,
            )
        ),
        {
            "win_start": win_start,
            "win_end": win_end,
            "analytics_type": analytics_type,
            "ts": timestamp,
        },
    )
    session.commit()
    rows_written = result.rowcount or 0
    if verbose:
        print(f"[chat_analytics] rows affected: {rows_written}")
    return rows_written
