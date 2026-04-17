import os

from src.modules.utils import COURSE_TIMESTAMP, load_sql

_SQL = load_sql(os.path.join(os.path.dirname(__file__), "participant_chat_analytics.sql"))

__all__ = ["compute_participant_chat_analytics", "COURSE_TIMESTAMP"]


def compute_participant_chat_analytics(
    db,
    win_start: str,
    win_end: str,
    timestamp: str,
    analytics_type: str,
    verbose: bool = False,
):
    """Run the participant-chat-analytics rollup for a single window.

    Args:
        db: connected Prisma client
        win_start: ISO timestamp string (inclusive) — window start
        win_end: ISO timestamp string (exclusive) — window end
        timestamp: DATE string written into the "timestamp" column; for COURSE use COURSE_TIMESTAMP
        analytics_type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'COURSE'
        verbose: log the SQL (truncated) before running
    """
    if analytics_type not in ("DAILY", "WEEKLY", "MONTHLY", "COURSE"):
        raise ValueError(f"Unknown analytics type: {analytics_type}")

    if verbose:
        print(f"[chat_analytics] {analytics_type} {win_start}..{win_end} -> {timestamp}")

    rows_written = db.execute_raw(_SQL, win_start, win_end, analytics_type, timestamp)
    if verbose:
        print(f"[chat_analytics] rows affected: {rows_written}")
    return rows_written
