import os

from src.modules.utils import load_sql

_DIR = os.path.dirname(__file__)
_PARTICIPANT_SQL = load_sql(os.path.join(_DIR, "participant_live_quiz_analytics.sql"))
_AGGREGATED_SQL = load_sql(os.path.join(_DIR, "aggregated_live_quiz_analytics.sql"))


def compute_participant_live_quiz_analytics(db, verbose: bool = False):
    if verbose:
        print("[live_quiz_analytics] running participant_live_quiz_analytics.sql")
    rows = db.execute_raw(_PARTICIPANT_SQL)
    if verbose:
        print(f"[live_quiz_analytics] participant rows affected: {rows}")
    return rows


def compute_aggregated_live_quiz_analytics(db, verbose: bool = False):
    if verbose:
        print("[live_quiz_analytics] running aggregated_live_quiz_analytics.sql")
    rows = db.execute_raw(_AGGREGATED_SQL)
    if verbose:
        print(f"[live_quiz_analytics] aggregated rows affected: {rows}")
    return rows
