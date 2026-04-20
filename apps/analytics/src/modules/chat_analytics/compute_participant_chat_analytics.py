import os

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.modules.utils import COURSE_TIMESTAMP, load_sql

_SQL = load_sql(os.path.join(os.path.dirname(__file__), "participant_chat_analytics.sql"))

__all__ = ["compute_participant_chat_analytics", "COURSE_TIMESTAMP"]


def compute_participant_chat_analytics(
    session: Session,
    win_start: str,
    win_end: str,
    timestamp: str,
    analytics_type: str,
    verbose: bool = False,
):
    """Run the participant-chat-analytics rollup for a single window."""
    if analytics_type not in ("DAILY", "WEEKLY", "MONTHLY", "COURSE"):
        raise ValueError(f"Unknown analytics type: {analytics_type}")

    if verbose:
        print(
            f"[chat_analytics] {analytics_type} {win_start}..{win_end} -> {timestamp}"
        )

    result = session.execute(
        text(_SQL),
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
