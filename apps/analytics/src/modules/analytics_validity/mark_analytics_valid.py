import os

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.modules.utils import (
    analytics_run_config_from_env,
    load_sql,
    render_uuid_in_clause,
    scoped_course_ids,
)

_SQL = load_sql(os.path.join(os.path.dirname(__file__), "mark_analytics_valid.sql"))

_SET_PLACEHOLDER = "/*COURSE_FINALIZE_SET*/"
_FILTER_PLACEHOLDER = "/*COURSE_FINALIZE_FILTER*/"
_SCOPE_BYPASS_PLACEHOLDER = "/*COURSE_SCOPE_BYPASS*/"
_PENDING_SCOPE_PLACEHOLDER = "/*PENDING_CHAT_COURSE_FILTER*/"


def _render_sql(finalize: bool, course_ids: list[str] | None) -> str:
    set_clause = ""
    filter_clause = ""
    pending_scope = ""
    # A scoped run covers every selected course even if current consent yields
    # zero chat rows. Marking that empty result prevents a privacy rebuild on
    # every later incremental run.
    bypass_clause = "true" if course_ids is not None else "false"
    if course_ids is not None:
        filter_clause = render_uuid_in_clause("c.id", course_ids)
        pending_scope = render_uuid_in_clause('pending."courseId"', course_ids)
    if finalize:
        set_clause = """
  "analyticsFinalizedAt" = CASE
    WHEN EXISTS (
      SELECT 1
      FROM pending_chat_changes pending
      WHERE pending."courseId" = c.id
    ) THEN c."analyticsFinalizedAt"
    ELSE CURRENT_TIMESTAMP AT TIME ZONE 'UTC'
  END,"""
    return (
        _SQL.replace(_SET_PLACEHOLDER, set_clause)
        .replace(_SCOPE_BYPASS_PLACEHOLDER, bypass_clause)
        .replace(_PENDING_SCOPE_PLACEHOLDER, pending_scope)
        .replace(_FILTER_PLACEHOLDER, filter_clause)
    )


def mark_analytics_valid(session: Session, verbose: bool = False):
    """Flip Course.areAnalyticsValid for every course that received analytics rows.

    Also sets Course.chatAnalyticsValidAt for scoped courses, including a valid
    empty chat result. Unscoped runs set it only for courses with participant
    chat rows. Only courses actually covered by the run are touched (per §3.8
    safeguard).

    When ``ANALYTICS_MODE=finalize`` and ``ANALYTICS_COURSE_IDS`` is set, the
    per-course terminal marker ``analyticsFinalizedAt`` is stamped or refreshed
    for scoped courses only when no LA-eligibility change arrived after the
    immutable run cutoff. Already-finalized courses remain eligible so the
    scanner can reconcile late privacy changes.
    """
    config = analytics_run_config_from_env()
    if config.chat_analytics_cutoff is None:
        raise RuntimeError("chat analytics validity requires the immutable workflow cutoff")
    mode = config.mode
    course_ids = scoped_course_ids(session, config)
    finalize = mode == "finalize" and bool(course_ids)

    if verbose:
        print(f"[analytics_validity] mode={mode} finalize={finalize} course_ids={len(course_ids) if course_ids else 0}")
    result = session.execute(
        text(_render_sql(finalize, course_ids)),
        {
            "chat_analytics_cutoff": config.chat_analytics_cutoff,
        },
    )
    session.commit()
    rows = result.rowcount or 0
    if verbose:
        print(f"[analytics_validity] rows affected: {rows}")
    return rows
