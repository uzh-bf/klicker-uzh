import os
from datetime import timedelta

from src.modules.utils import COURSE_TIMESTAMP, load_sql

_DIR = os.path.dirname(__file__)
_SQL_DEFAULT = load_sql(os.path.join(_DIR, "aggregated_chatbot_analytics.sql"))
_SQL_WEEKLY = load_sql(os.path.join(_DIR, "aggregated_chatbot_analytics_weekly.sql"))
_DELETE_SQL = """
DELETE FROM "AggregatedChatbotAnalytics"
WHERE "type" = $1::"AnalyticsType"
  AND "timestamp" = $2::date
"""

__all__ = ["compute_aggregated_chatbot_analytics", "COURSE_TIMESTAMP"]


def compute_aggregated_chatbot_analytics(
    db,
    win_start: str,
    win_end: str,
    timestamp: str,
    analytics_type: str,
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

    with db.tx(timeout=timedelta(minutes=30)) as transaction:
        transaction.execute_raw(_DELETE_SQL, analytics_type, timestamp)
        if analytics_type == "WEEKLY":
            rows_written = transaction.execute_raw(
                _SQL_WEEKLY,
                win_start,
                win_end,
                timestamp,
            )
        else:
            rows_written = transaction.execute_raw(
                _SQL_DEFAULT,
                win_start,
                win_end,
                analytics_type,
                timestamp,
            )
    if verbose:
        print(f"[aggregated_chat_analytics] rows affected: {rows_written}")
    return rows_written
