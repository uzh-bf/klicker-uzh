import os
import uuid

from src.modules.utils import analytics_mode, load_sql, scoped_course_ids

_SQL = load_sql(os.path.join(os.path.dirname(__file__), "mark_analytics_valid.sql"))


def _render_sql(
    finalize: bool,
    course_ids: list[str] | None,
) -> str:
    set_clause = ""
    filter_clause = ""
    if finalize and course_ids:
        validated = [str(uuid.UUID(cid)) for cid in course_ids]
        in_list = ", ".join(f"'{cid}'" for cid in validated)
        set_clause = '"analyticsFinalizedAt" = NOW(),'
        filter_clause = f"AND c.id IN ({in_list}) AND c.\"analyticsFinalizedAt\" IS NULL"
    return (
        _SQL.replace("/*COURSE_FINALIZE_SET*/", set_clause)
        .replace("/*COURSE_FINALIZE_FILTER*/", filter_clause)
    )


def mark_analytics_valid(db, verbose: bool = False):
    """Flip Course.areAnalyticsValid for every course that received analytics rows.

    Also sets Course.chatAnalyticsValidAt on courses with ParticipantChatAnalytics rows.
    Only courses actually covered by the run are touched (per §3.8 safeguard).

    When ``ANALYTICS_MODE=finalize`` and ``ANALYTICS_COURSE_IDS`` is set, the
    per-course terminal marker ``analyticsFinalizedAt`` is stamped NOW() for the
    scoped courses — the scanner's one-shot finalisation path.
    """
    mode = analytics_mode()
    course_ids = scoped_course_ids(db) if mode == "finalize" else None
    finalize = mode == "finalize" and bool(course_ids)

    if verbose:
        print(
            f"[analytics_validity] mode={mode} finalize={finalize} "
            f"course_ids={len(course_ids) if course_ids else 0}"
        )
    sql = _render_sql(finalize, course_ids)
    rows = db.execute_raw(sql)
    if verbose:
        print(f"[analytics_validity] rows affected: {rows}")
    return rows
