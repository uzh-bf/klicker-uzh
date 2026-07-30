import os

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.modules.learning_analytics_eligibility import (
    eligible_course_ids,
    lock_learning_analytics_courses,
)
from src.modules.utils import load_sql, render_uuid_in_clause

_DIR = os.path.dirname(__file__)
_PARTICIPANT_SQL = load_sql(os.path.join(_DIR, "participant_live_quiz_analytics.sql"))
_AGGREGATED_SQL = load_sql(os.path.join(_DIR, "aggregated_live_quiz_analytics.sql"))

_PLACEHOLDER = "/*COURSE_FILTER*/"


def _prepare_sql(template: str, course_ids: list[str] | None) -> str:
    clause = "" if course_ids is None else render_uuid_in_clause('lq."courseId"', course_ids)
    return template.replace(_PLACEHOLDER, clause)


def compute_participant_live_quiz_analytics(
    session: Session, course_ids: list[str] | None = None, verbose: bool = False
):
    if verbose:
        print("[live_quiz_analytics] running participant_live_quiz_analytics.sql")
    enabled_ids = eligible_course_ids(session, course_ids)
    locked_ids = sorted(lock_learning_analytics_courses(session, enabled_ids))
    if not locked_ids:
        session.rollback()
        return 0
    result = session.execute(text(_prepare_sql(_PARTICIPANT_SQL, locked_ids)))
    session.commit()
    rows = result.rowcount or 0
    if verbose:
        print(f"[live_quiz_analytics] participant rows affected: {rows}")
    return rows


def compute_aggregated_live_quiz_analytics(
    session: Session, course_ids: list[str] | None = None, verbose: bool = False
):
    if verbose:
        print("[live_quiz_analytics] running aggregated_live_quiz_analytics.sql")
    enabled_ids = eligible_course_ids(session, course_ids)
    locked_ids = sorted(lock_learning_analytics_courses(session, enabled_ids))
    if not locked_ids:
        session.rollback()
        return 0
    result = session.execute(text(_prepare_sql(_AGGREGATED_SQL, locked_ids)))
    session.commit()
    rows = result.rowcount or 0
    if verbose:
        print(f"[live_quiz_analytics] aggregated rows affected: {rows}")
    return rows
