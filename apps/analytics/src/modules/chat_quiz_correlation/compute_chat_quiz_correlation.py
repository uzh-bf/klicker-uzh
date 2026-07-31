import os
from datetime import timedelta

_DIR = os.path.dirname(__file__)
_OUTCOME_SQL = os.path.join(_DIR, "participant_chat_outcome.sql")
_UPDATE_SQL = os.path.join(_DIR, "update_has_chat_activity.sql")
_DELETE_OUTCOMES_SQL = 'DELETE FROM "ParticipantChatOutcome"'


def _load(path: str) -> str:
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def report_source_counts(db, verbose: bool = False) -> None:
    """Report source row counts without treating a valid empty result as failure.

    The pipeline dependency graph establishes that scripts 4 and 8 completed.
    Their tables can legitimately be empty, for example after the final participant
    revokes chat consent, and script 11 still needs to clear downstream state.
    """
    chat_rows = db.query_raw('SELECT COUNT(*) AS n FROM "ParticipantChatAnalytics" WHERE "type" = \'COURSE\'')[0]["n"]
    perf_rows = db.query_raw('SELECT COUNT(*) AS n FROM "ParticipantPerformance"')[0]["n"]
    if verbose:
        print(f"[chat_quiz_correlation] preconditions: chat_course_rows={chat_rows} perf_rows={perf_rows}")


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


def reconcile_chat_quiz_correlation(db, verbose: bool = False) -> tuple[int, int]:
    """Atomically replace outcomes and reset activity flags from current sources."""
    outcome_sql = _load(_OUTCOME_SQL)
    activity_sql = _load(_UPDATE_SQL)

    with db.tx(timeout=timedelta(minutes=30)) as transaction:
        transaction.execute_raw(_DELETE_OUTCOMES_SQL)
        outcome_rows = transaction.execute_raw(outcome_sql)
        activity_rows = transaction.execute_raw(activity_sql)

    if verbose:
        print(f"[chat_quiz_correlation] reconciled outcome_rows={outcome_rows} activity_rows={activity_rows}")
    return outcome_rows, activity_rows
