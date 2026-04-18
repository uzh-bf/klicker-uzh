import os
import uuid

from src.modules.utils import load_sql

_DIR = os.path.dirname(__file__)
_PARTICIPANT_SQL = load_sql(os.path.join(_DIR, "participant_live_quiz_analytics.sql"))
_AGGREGATED_SQL = load_sql(os.path.join(_DIR, "aggregated_live_quiz_analytics.sql"))

_PLACEHOLDER = "/*COURSE_FILTER*/"


def _render_filter(course_ids: list[str] | None) -> str:
    """Build the optional ``AND lq."courseId" IN (...)`` clause.

    UUIDs are re-parsed through ``uuid.UUID`` to fail loud on malformed input —
    the placeholder is substituted into raw SQL, so we never inline an unchecked
    identifier even though the env source is nominally internal.
    """
    if course_ids is None:
        return ""
    if not course_ids:
        return "AND false"
    validated = [str(uuid.UUID(cid)) for cid in course_ids]
    in_list = ", ".join(f"'{cid}'" for cid in validated)
    return f'AND lq."courseId" IN ({in_list})'


def _prepare_sql(template: str, course_ids: list[str] | None) -> str:
    return template.replace(_PLACEHOLDER, _render_filter(course_ids))


def compute_participant_live_quiz_analytics(
    db, course_ids: list[str] | None = None, verbose: bool = False
):
    if verbose:
        print("[live_quiz_analytics] running participant_live_quiz_analytics.sql")
    rows = db.execute_raw(_prepare_sql(_PARTICIPANT_SQL, course_ids))
    if verbose:
        print(f"[live_quiz_analytics] participant rows affected: {rows}")
    return rows


def compute_aggregated_live_quiz_analytics(
    db, course_ids: list[str] | None = None, verbose: bool = False
):
    if verbose:
        print("[live_quiz_analytics] running aggregated_live_quiz_analytics.sql")
    rows = db.execute_raw(_prepare_sql(_AGGREGATED_SQL, course_ids))
    if verbose:
        print(f"[live_quiz_analytics] aggregated rows affected: {rows}")
    return rows
