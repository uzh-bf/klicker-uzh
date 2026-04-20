import os

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.modules.utils import COURSE_TIMESTAMP, load_sql

_DIR = os.path.dirname(__file__)
_SQL_DEFAULT = load_sql(os.path.join(_DIR, "aggregated_chatbot_analytics.sql"))
_SQL_WEEKLY = load_sql(os.path.join(_DIR, "aggregated_chatbot_analytics_weekly.sql"))

__all__ = ["compute_aggregated_chatbot_analytics", "COURSE_TIMESTAMP"]


def compute_aggregated_chatbot_analytics(
    session: Session,
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
        print(
            f"[aggregated_chat_analytics] {analytics_type} "
            f"{win_start}..{win_end} -> {timestamp}"
        )

    if analytics_type == "WEEKLY":
        result = session.execute(
            text(_SQL_WEEKLY),
            {"win_start": win_start, "win_end": win_end, "ts": timestamp},
        )
    else:
        result = session.execute(
            text(_SQL_DEFAULT),
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
        print(f"[aggregated_chat_analytics] rows affected: {rows_written}")
    return rows_written
