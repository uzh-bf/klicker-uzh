import os

_DIR = os.path.dirname(__file__)
_OUTCOME_SQL = os.path.join(_DIR, "participant_chat_outcome.sql")
_UPDATE_SQL = os.path.join(_DIR, "update_has_chat_activity.sql")


def _load(path: str) -> str:
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


class AnalyticsNotReadyError(RuntimeError):
    """Raised when required upstream analytics tables are empty.

    Script 11 joins ParticipantChatAnalytics (script 8) with ParticipantPerformance
    (script 4). If either table is empty we abort loudly rather than writing degenerate
    rows — per §3.5 the outcome build has a hard precondition on upstream runs.
    """


def assert_preconditions(db, verbose: bool = False) -> None:
    chat_rows = db.query_raw(
        'SELECT COUNT(*) AS n FROM "ParticipantChatAnalytics" WHERE "type" = \'COURSE\''
    )[0]["n"]
    perf_rows = db.query_raw('SELECT COUNT(*) AS n FROM "ParticipantPerformance"')[0]["n"]
    if verbose:
        print(
            f"[chat_quiz_correlation] preconditions: chat_course_rows={chat_rows} "
            f"perf_rows={perf_rows}"
        )
    if chat_rows == 0:
        raise AnalyticsNotReadyError(
            "ParticipantChatAnalytics (type=COURSE) is empty — run script 8 first."
        )
    if perf_rows == 0:
        raise AnalyticsNotReadyError(
            "ParticipantPerformance is empty — run script 4 first."
        )


def compute_participant_chat_outcomes(db, verbose: bool = False):
    sql = _load(_OUTCOME_SQL)
    if verbose:
        print("[chat_quiz_correlation] running participant_chat_outcome.sql")
    rows = db.execute_raw(sql)
    if verbose:
        print(f"[chat_quiz_correlation] outcome rows affected: {rows}")
    return rows


def update_has_chat_activity(db, verbose: bool = False):
    sql = _load(_UPDATE_SQL)
    if verbose:
        print("[chat_quiz_correlation] running update_has_chat_activity.sql")
    rows = db.execute_raw(sql)
    if verbose:
        print(f"[chat_quiz_correlation] hasChatActivity rows updated: {rows}")
    return rows
