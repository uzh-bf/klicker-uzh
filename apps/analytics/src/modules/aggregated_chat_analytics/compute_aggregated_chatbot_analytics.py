import os

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.modules.learning_analytics_eligibility import (
    eligible_course_ids,
    lock_learning_analytics_courses,
)
from src.modules.utils import COURSE_TIMESTAMP, load_sql, render_uuid_in_clause

_DIR = os.path.dirname(__file__)
_SQL_DEFAULT = load_sql(os.path.join(_DIR, "aggregated_chatbot_analytics.sql"))
_SQL_WEEKLY = load_sql(os.path.join(_DIR, "aggregated_chatbot_analytics_weekly.sql"))
_PLACEHOLDER = "/*COURSE_FILTER*/"
_DELETE_SQL = """
DELETE FROM "AggregatedChatbotAnalytics"
WHERE "type" = CAST(:analytics_type AS "AnalyticsType")
  AND "timestamp" = CAST(:ts AS date)
  /*COURSE_FILTER*/
"""

__all__ = ["compute_aggregated_chatbot_analytics", "COURSE_TIMESTAMP"]


def _prepare_sql(template: str, course_ids: list[str] | None) -> str:
    clause = "" if course_ids is None else render_uuid_in_clause('cb."courseId"', course_ids)
    return template.replace(_PLACEHOLDER, clause)


def _prepare_delete_sql(course_ids: list[str] | None) -> str:
    clause = "" if course_ids is None else render_uuid_in_clause('"courseId"', course_ids)
    return _DELETE_SQL.replace(_PLACEHOLDER, clause)


def compute_aggregated_chatbot_analytics(
    session: Session,
    win_start: str,
    win_end: str,
    timestamp: str,
    analytics_type: str,
    course_ids: list[str] | None = None,
    verbose: bool = False,
):
    """Run the chatbot-level rollup for one window.

    WEEKLY windows use a separate SQL that also computes new/returning participant
    splits via a full-history first_seen CTE. Other window types use the cheaper
    default SQL (new/returning zeroed out).
    """
    if analytics_type not in ("DAILY", "WEEKLY", "MONTHLY", "COURSE"):
        raise ValueError(f"Unknown analytics type: {analytics_type}")

    if verbose:
        print(f"[aggregated_chat_analytics] {analytics_type} {win_start}..{win_end} -> {timestamp}")

    enabled_ids = eligible_course_ids(session, course_ids)
    locked_ids = sorted(lock_learning_analytics_courses(session, enabled_ids))
    if not locked_ids:
        session.rollback()
        return 0

    params = {"analytics_type": analytics_type, "ts": timestamp}
    session.execute(text(_prepare_delete_sql(locked_ids)), params)
    if analytics_type == "WEEKLY":
        result = session.execute(
            text(_prepare_sql(_SQL_WEEKLY, locked_ids)),
            {"win_start": win_start, "win_end": win_end, "ts": timestamp},
        )
    else:
        result = session.execute(
            text(_prepare_sql(_SQL_DEFAULT, locked_ids)),
            params
            | {
                "win_start": win_start,
                "win_end": win_end,
            },
        )
    session.commit()
    rows_written = result.rowcount or 0
    if verbose:
        print(f"[aggregated_chat_analytics] rows affected: {rows_written}")
    return rows_written
