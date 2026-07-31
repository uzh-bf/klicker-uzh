import os

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.modules.utils import (
    analytics_mode,
    load_sql,
    render_uuid_in_clause,
    scoped_course_ids,
)

_SQL = load_sql(os.path.join(os.path.dirname(__file__), "mark_analytics_valid.sql"))

_SET_PLACEHOLDER = "/*COURSE_FINALIZE_SET*/"
_FILTER_PLACEHOLDER = "/*COURSE_FINALIZE_FILTER*/"
_BYPASS_PLACEHOLDER = "/*COURSE_FINALIZE_BYPASS*/"


def _render_sql(finalize: bool, course_ids: list[str] | None) -> str:
    set_clause = ""
    filter_clause = ""
    # ``false`` keeps ``quiz OR chat OR false`` == ``quiz OR chat`` for normal
    # runs; ``true`` in finalize mode lets the UPDATE touch courses with zero
    # analytics rows (otherwise the scanner would re-emit courseEnded daily
    # forever).
    bypass_clause = "false"
    if finalize:
        set_clause = '"analyticsFinalizedAt" = NOW(),'
        scoped = render_uuid_in_clause("c.id", course_ids or [])
        filter_clause = f'{scoped} AND c."analyticsFinalizedAt" IS NULL'
        bypass_clause = "true"
    return (
        _SQL.replace(_SET_PLACEHOLDER, set_clause)
        .replace(_BYPASS_PLACEHOLDER, bypass_clause)
        .replace(_FILTER_PLACEHOLDER, filter_clause)
    )


def mark_analytics_valid(session: Session, verbose: bool = False):
    """Flip Course.areAnalyticsValid for every course that received analytics rows.

    Also sets Course.chatAnalyticsValidAt on courses with ParticipantChatAnalytics
    rows. Only courses actually covered by the run are touched (per §3.8
    safeguard).

    When ``ANALYTICS_MODE=finalize`` and ``ANALYTICS_COURSE_IDS`` is set, the
    per-course terminal marker ``analyticsFinalizedAt`` is stamped NOW() for the
    scoped courses — the scanner's one-shot finalisation path.
    """
    mode = analytics_mode()
    course_ids = scoped_course_ids(session) if mode == "finalize" else None
    finalize = mode == "finalize" and bool(course_ids)

    if verbose:
        print(f"[analytics_validity] mode={mode} finalize={finalize} course_ids={len(course_ids) if course_ids else 0}")
    result = session.execute(text(_render_sql(finalize, course_ids)))
    session.commit()
    rows = result.rowcount or 0
    if verbose:
        print(f"[analytics_validity] rows affected: {rows}")
    return rows
