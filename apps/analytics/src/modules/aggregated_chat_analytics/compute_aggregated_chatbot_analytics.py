import os

_SQL_PATH = os.path.join(os.path.dirname(__file__), "aggregated_chatbot_analytics.sql")

COURSE_TIMESTAMP = "1970-01-01"


def _load_sql() -> str:
    with open(_SQL_PATH, "r", encoding="utf-8") as fh:
        return fh.read()


def compute_aggregated_chatbot_analytics(
    db,
    win_start: str,
    win_end: str,
    timestamp: str,
    analytics_type: str,
    verbose: bool = False,
):
    """Run the chatbot-level rollup for one window.

    Parameters mirror compute_participant_chat_analytics.
    """
    if analytics_type not in ("DAILY", "WEEKLY", "MONTHLY", "COURSE"):
        raise ValueError(f"Unknown analytics type: {analytics_type}")

    sql = _load_sql()
    if verbose:
        print(f"[aggregated_chat_analytics] {analytics_type} {win_start}..{win_end} -> {timestamp}")

    rows_written = db.execute_raw(sql, win_start, win_end, analytics_type, timestamp)
    if verbose:
        print(f"[aggregated_chat_analytics] rows affected: {rows_written}")
    return rows_written
