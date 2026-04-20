import os

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.modules.utils import render_uuid_in_clause

_DIR = os.path.dirname(__file__)
_OUTCOME_SQL = os.path.join(_DIR, "participant_chat_outcome.sql")
_UPDATE_SQL = os.path.join(_DIR, "update_has_chat_activity.sql")

_OUTCOME_PLACEHOLDERS = {
    "/*CHAT_COURSE_FILTER*/": '"courseId"',
    "/*COURSE_PARTICIPATION_FILTER*/": '"courseId"',
    "/*COURSE_PERFORMANCE_FILTER*/": '"courseId"',
}
_UPDATE_PLACEHOLDERS = {"/*COURSE_FILTER*/": 'pca."courseId"'}


def _load(path: str) -> str:
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def _render_sql(
    template: str,
    *,
    course_ids: list[str] | None,
    placeholders: dict[str, str],
) -> str:
    rendered = template
    for placeholder, column in placeholders.items():
        clause = "" if course_ids is None else render_uuid_in_clause(column, course_ids)
        rendered = rendered.replace(placeholder, clause)
    return rendered


class AnalyticsNotReadyError(RuntimeError):
    """Raised when required upstream analytics tables are empty.

    Script 11 joins ParticipantChatAnalytics (script 8) with ParticipantPerformance
    (script 4). If either table is empty we abort loudly rather than writing
    degenerate rows — per §3.5 the outcome build has a hard precondition on
    upstream runs.
    """


def assert_preconditions(
    session: Session,
    course_ids: list[str] | None = None,
    verbose: bool = False,
) -> None:
    scope_clause = (
        "" if course_ids is None else render_uuid_in_clause('"courseId"', course_ids)
    )
    chat_rows = session.execute(
        text(
            'SELECT COUNT(*) AS n FROM "ParticipantChatAnalytics" '
            f'WHERE "type" = \'COURSE\' {scope_clause}'
        )
    ).scalar_one()
    perf_rows = session.execute(
        text(f'SELECT COUNT(*) AS n FROM "ParticipantPerformance" WHERE true {scope_clause}')
    ).scalar_one()
    if verbose:
        print(
            f"[chat_quiz_correlation] preconditions: chat_course_rows={chat_rows} "
            f"perf_rows={perf_rows}"
        )
    if chat_rows == 0:
        raise AnalyticsNotReadyError(
            "ParticipantChatAnalytics (type=COURSE) is empty — run script 8 first."
        )
    if perf_rows == 0:
        raise AnalyticsNotReadyError(
            "ParticipantPerformance is empty — run script 4 first."
        )


def compute_participant_chat_outcomes(
    session: Session,
    course_ids: list[str] | None = None,
    verbose: bool = False,
):
    sql = _render_sql(
        _load(_OUTCOME_SQL),
        course_ids=course_ids,
        placeholders=_OUTCOME_PLACEHOLDERS,
    )
    if verbose:
        print("[chat_quiz_correlation] running participant_chat_outcome.sql")
    result = session.execute(text(sql))
    session.commit()
    rows = result.rowcount or 0
    if verbose:
        print(f"[chat_quiz_correlation] outcome rows affected: {rows}")
    return rows


def update_has_chat_activity(
    session: Session,
    course_ids: list[str] | None = None,
    verbose: bool = False,
):
    sql = _render_sql(
        _load(_UPDATE_SQL),
        course_ids=course_ids,
        placeholders=_UPDATE_PLACEHOLDERS,
    )
    if verbose:
        print("[chat_quiz_correlation] running update_has_chat_activity.sql")
    result = session.execute(text(sql))
    session.commit()
    rows = result.rowcount or 0
    if verbose:
        print(f"[chat_quiz_correlation] hasChatActivity rows updated: {rows}")
    return rows
