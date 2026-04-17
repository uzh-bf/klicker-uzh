import os

_DIR = os.path.dirname(__file__)
_PLATFORM_SQL = os.path.join(_DIR, "platform_semester_analytics.sql")
_FOOTPRINT_SQL = os.path.join(_DIR, "course_modality_footprint.sql")


def _load(path: str) -> str:
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def compute_platform_semester_analytics(db, verbose: bool = False):
    """Populate PlatformSemesterAnalytics — one row per UZH semester that has any activity."""
    sql = _load(_PLATFORM_SQL)
    if verbose:
        print("[platform_analytics] running platform_semester_analytics.sql")
    rows = db.execute_raw(sql)
    if verbose:
        print(f"[platform_analytics] rows affected: {rows}")
    return rows


def compute_course_modality_footprint(db, verbose: bool = False):
    """Update AggregatedCourseAnalytics modality-footprint columns for all courses."""
    sql = _load(_FOOTPRINT_SQL)
    if verbose:
        print("[platform_analytics] running course_modality_footprint.sql")
    rows = db.execute_raw(sql)
    if verbose:
        print(f"[platform_analytics] rows affected: {rows}")
    return rows
