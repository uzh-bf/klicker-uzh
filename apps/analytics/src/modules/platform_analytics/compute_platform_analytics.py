import os

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.modules.learning_analytics_eligibility import (
    eligible_course_ids,
    lock_learning_analytics_courses,
)
from src.modules.utils import load_sql, render_uuid_in_clause

_DIR = os.path.dirname(__file__)
_PLATFORM_SQL = load_sql(os.path.join(_DIR, "platform_semester_analytics.sql"))
_FOOTPRINT_SQL = load_sql(os.path.join(_DIR, "course_modality_footprint.sql"))


def _scope_sql(sql: str, course_ids: set[str]) -> str:
    return sql.replace(
        "/*COURSE_FILTER*/",
        render_uuid_in_clause("c.id", sorted(course_ids)),
    )


def compute_platform_semester_analytics(session: Session, verbose: bool = False):
    """Populate PlatformSemesterAnalytics — one row per UZH semester that has any activity."""
    if verbose:
        print("[platform_analytics] running platform_semester_analytics.sql")
    locked_ids = lock_learning_analytics_courses(
        session,
        eligible_course_ids(session, None),
    )
    if not locked_ids:
        session.rollback()
        return 0
    result = session.execute(text(_scope_sql(_PLATFORM_SQL, locked_ids)))
    session.commit()
    rows = result.rowcount or 0
    if verbose:
        print(f"[platform_analytics] rows affected: {rows}")
    return rows


def compute_course_modality_footprint(session: Session, verbose: bool = False):
    """Update AggregatedCourseAnalytics modality-footprint columns for all courses."""
    if verbose:
        print("[platform_analytics] running course_modality_footprint.sql")
    locked_ids = lock_learning_analytics_courses(
        session,
        eligible_course_ids(session, None),
    )
    if not locked_ids:
        session.rollback()
        return 0
    result = session.execute(text(_scope_sql(_FOOTPRINT_SQL, locked_ids)))
    session.commit()
    rows = result.rowcount or 0
    if verbose:
        print(f"[platform_analytics] rows affected: {rows}")
    return rows
