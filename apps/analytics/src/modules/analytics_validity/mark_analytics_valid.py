import os

_SQL_PATH = os.path.join(os.path.dirname(__file__), "mark_analytics_valid.sql")


def mark_analytics_valid(db, verbose: bool = False):
    """Flip Course.areAnalyticsValid for every course that received analytics rows.

    Also sets Course.chatAnalyticsValidAt on courses with ParticipantChatAnalytics rows.
    Only courses actually covered by the run are touched (per §3.8 safeguard).
    """
    with open(_SQL_PATH, "r", encoding="utf-8") as fh:
        sql = fh.read()
    if verbose:
        print("[analytics_validity] flipping Course.areAnalyticsValid for covered courses")
    rows = db.execute_raw(sql)
    if verbose:
        print(f"[analytics_validity] rows affected: {rows}")
    return rows
