import os

from src.modules.utils import load_sql

_DIR = os.path.dirname(__file__)
_PLATFORM_SQL = load_sql(os.path.join(_DIR, "platform_semester_analytics.sql"))
_FOOTPRINT_SQL = load_sql(os.path.join(_DIR, "course_modality_footprint.sql"))


def compute_platform_semester_analytics(db, verbose: bool = False):
    """Populate PlatformSemesterAnalytics — one row per UZH semester that has any activity."""
    if verbose:
        print("[platform_analytics] running platform_semester_analytics.sql")
    rows = db.execute_raw(_PLATFORM_SQL)
    if verbose:
        print(f"[platform_analytics] rows affected: {rows}")
    return rows


def compute_course_modality_footprint(db, verbose: bool = False):
    """Update AggregatedCourseAnalytics modality-footprint columns for all courses."""
    if verbose:
        print("[platform_analytics] running course_modality_footprint.sql")
    rows = db.execute_raw(_FOOTPRINT_SQL)
    if verbose:
        print(f"[platform_analytics] rows affected: {rows}")
    return rows
