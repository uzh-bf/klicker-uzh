import os

_DIR = os.path.dirname(__file__)
_PARTICIPANT_SQL = os.path.join(_DIR, "participant_live_quiz_analytics.sql")
_AGGREGATED_SQL = os.path.join(_DIR, "aggregated_live_quiz_analytics.sql")


def _load(path: str) -> str:
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def compute_participant_live_quiz_analytics(db, verbose: bool = False):
    sql = _load(_PARTICIPANT_SQL)
    if verbose:
        print("[live_quiz_analytics] running participant_live_quiz_analytics.sql")
    rows = db.execute_raw(sql)
    if verbose:
        print(f"[live_quiz_analytics] participant rows affected: {rows}")
    return rows


def compute_aggregated_live_quiz_analytics(db, verbose: bool = False):
    sql = _load(_AGGREGATED_SQL)
    if verbose:
        print("[live_quiz_analytics] running aggregated_live_quiz_analytics.sql")
    rows = db.execute_raw(sql)
    if verbose:
        print(f"[live_quiz_analytics] aggregated rows affected: {rows}")
    return rows
