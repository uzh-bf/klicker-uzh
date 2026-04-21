import os
from datetime import datetime, timezone
from typing import Literal

from sqlalchemy import text
from sqlalchemy.orm import Session

from src.db_helpers import bulk_upsert
from src.dryrun import buffer_registry
from src.modules.utils import render_uuid_in_clause

ChatDoseBucketLiteral = Literal["NONE", "LOW", "MED", "HIGH"]

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
    buffer_active = buffer_registry.is_active()

    if buffer_active:
        chat_rows = len(_buffered_chat_course_rows(course_ids) or [])
        perf_rows = len(_buffered_performance_rows(course_ids) or [])
    else:
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
        source = "buffer" if buffer_active else "db"
        print(
            f"[chat_quiz_correlation] preconditions ({source}): "
            f"chat_course_rows={chat_rows} perf_rows={perf_rows}"
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
    if buffer_registry.is_active():
        return _compute_outcomes_from_buffer(session, course_ids, verbose)

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


# ---------------------------------------------------------------------------
# Dry-run buffer fallback
# ---------------------------------------------------------------------------
#
# Script 11's production path is a single raw-SQL statement that joins
# ParticipantChatAnalytics × ParticipantPerformance via percentile_cont. In a
# dryrun against an unmigrated prod DB, both source tables only exist in the
# in-memory CaptureBuffer (written by scripts 8 and 4 during this run), so the
# SQL statement can't see them.
#
# The buffer fallback below re-implements the same outcome shape in pandas and
# writes rows through ``bulk_upsert``. The interceptor captures
# ``bulk_upsert`` into the buffer, so the resulting ParticipantChatOutcome
# rows land in the dryrun workbook exactly like any other captured write.


def _buffered_chat_course_rows(course_ids: list[str] | None) -> list[dict] | None:
    return buffer_registry.filter_rows(
        "ParticipantChatAnalytics",
        course_ids=course_ids,
        type_value="COURSE",
    )


def _buffered_performance_rows(course_ids: list[str] | None) -> list[dict] | None:
    return buffer_registry.filter_rows(
        "ParticipantPerformance",
        course_ids=course_ids,
    )


def _percentile(values: list[float], q: float) -> float:
    if not values:
        return 0.0
    sorted_values = sorted(values)
    if len(sorted_values) == 1:
        return float(sorted_values[0])
    # Linear interpolation (matches postgres ``percentile_cont``).
    pos = q * (len(sorted_values) - 1)
    lower = int(pos)
    upper = min(lower + 1, len(sorted_values) - 1)
    frac = pos - lower
    return float(sorted_values[lower] + (sorted_values[upper] - sorted_values[lower]) * frac)


def _compute_outcomes_from_buffer(
    session: Session,
    course_ids: list[str] | None,
    verbose: bool,
) -> int:
    from src.models import ParticipantChatOutcome

    chat_rows = _buffered_chat_course_rows(course_ids) or []
    perf_rows = _buffered_performance_rows(course_ids) or []

    # Build chat-dose lookup: userMessages > 0 per (courseId, participantId).
    nonzero_chat: dict[tuple[str, str], int] = {}
    per_course_nonzero: dict[str, list[int]] = {}
    for row in chat_rows:
        messages = int(row.get("userMessages") or 0)
        if messages <= 0:
            continue
        course_id = str(row.get("courseId"))
        participant_id = str(row.get("participantId"))
        nonzero_chat[(course_id, participant_id)] = messages
        per_course_nonzero.setdefault(course_id, []).append(messages)

    cuts: dict[str, tuple[float, float]] = {}
    for course_id, values in per_course_nonzero.items():
        cuts[course_id] = (
            _percentile(values, 0.33),
            _percentile(values, 0.66),
        )

    perf_lookup: dict[tuple[str, str], dict] = {}
    for row in perf_rows:
        course_id = str(row.get("courseId"))
        participant_id = str(row.get("participantId"))
        perf_lookup[(course_id, participant_id)] = row

    # Participation is not captured by the interceptor — the buffer path can't
    # union enrolled-but-inactive participants. The resulting outcome set is
    # the union of (participant, course) pairs seen in chat or performance,
    # which matches the SQL's other two union branches. This is the best
    # we can do with buffered-only inputs; the production SQL remains the
    # authoritative path when writable analytics tables exist.
    pairs: set[tuple[str, str]] = set()
    for row in chat_rows:
        pairs.add((str(row.get("courseId")), str(row.get("participantId"))))
    for row in perf_rows:
        pairs.add((str(row.get("courseId")), str(row.get("participantId"))))

    if verbose:
        print(
            f"[chat_quiz_correlation] buffer path: chat_rows={len(chat_rows)} "
            f"perf_rows={len(perf_rows)} outcome_pairs={len(pairs)}"
        )

    now = datetime.now(timezone.utc)
    outcome_rows: list[dict] = []
    for course_id, participant_id in sorted(pairs):
        messages = nonzero_chat.get((course_id, participant_id), 0)
        bucket = _bucket_for(messages, cuts.get(course_id))
        perf = perf_lookup.get((course_id, participant_id))
        first_error = perf.get("firstErrorRate") if perf else None
        last_error = perf.get("lastErrorRate") if perf else None
        delta = (
            float(last_error) - float(first_error)
            if first_error is not None and last_error is not None
            else None
        )
        outcome_rows.append(
            {
                "participantId": participant_id,
                "courseId": course_id,
                "chatMessagesInCourse": messages,
                "chatDoseBucket": bucket,
                "firstErrorRate": first_error,
                "lastErrorRate": last_error,
                "errorRateDelta": delta,
                "hasBothModalities": messages > 0 and perf is not None,
                "createdAt": now,
                "updatedAt": now,
            }
        )

    if not outcome_rows:
        return 0

    # ``bulk_upsert`` is patched by the interceptor to record rows in the
    # CaptureBuffer, so this call never hits the DB during dryrun.
    return bulk_upsert(
        session,
        ParticipantChatOutcome,
        outcome_rows,
        conflict_cols=["participantId", "courseId"],
        update_cols=[
            "chatMessagesInCourse",
            "chatDoseBucket",
            "firstErrorRate",
            "lastErrorRate",
            "errorRateDelta",
            "hasBothModalities",
            "updatedAt",
        ],
    )


def _bucket_for(
    messages: int, cuts: tuple[float, float] | None
) -> ChatDoseBucketLiteral:
    if messages <= 0 or cuts is None:
        return "NONE"
    cut_low, cut_med = cuts
    if messages <= cut_low:
        return "LOW"
    if messages <= cut_med:
        return "MED"
    return "HIGH"
