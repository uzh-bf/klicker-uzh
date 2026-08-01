import os
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from src.models import Course, Participation


# Keep this value aligned with
# packages/util/src/learningAnalytics.ts:LEARNING_ANALYTICS_DISCLOSURE_VERSION.
LEARNING_ANALYTICS_DISCLOSURE_VERSION = "2026-07-30-v1"


def is_learning_analytics_rollout_enabled() -> bool:
    return os.environ.get("NEXT_PUBLIC_LEARNING_ANALYTICS_ROLLOUT_ENABLED") == "true"


def is_activity_eligible_for_learning_analytics(
    *,
    is_course_enabled: bool,
    participation_status: str,
    acknowledged_disclosure_version: str | None,
    included_from: datetime | None,
    activity_at: datetime,
    current_disclosure_version: str = LEARNING_ANALYTICS_DISCLOSURE_VERSION,
) -> bool:
    status_value = getattr(participation_status, "value", participation_status)
    return (
        is_course_enabled
        and status_value == "INCLUDED"
        and bool(current_disclosure_version)
        and acknowledged_disclosure_version == current_disclosure_version
        and included_from is not None
        and activity_at >= included_from
    )


def is_participation_currently_included(
    participation: Mapping[str, Any],
    *,
    is_course_enabled: bool,
    current_disclosure_version: str = LEARNING_ANALYTICS_DISCLOSURE_VERSION,
) -> bool:
    included_from = participation.get("learningAnalyticsIncludedFrom")
    status = participation.get("learningAnalyticsStatus")
    status_value = getattr(status, "value", status)
    return (
        is_course_enabled
        and status_value == "INCLUDED"
        and participation.get("learningAnalyticsDisclosureVersion") == current_disclosure_version
        and isinstance(included_from, datetime)
    )


def filter_eligible_activity(
    records: list[Mapping[str, Any]],
    *,
    participation: Mapping[str, Any],
    is_course_enabled: bool,
    activity_time_field: str = "createdAt",
) -> list[Mapping[str, Any]]:
    return [
        record
        for record in records
        if isinstance(record.get(activity_time_field), datetime)
        and is_activity_eligible_for_learning_analytics(
            is_course_enabled=is_course_enabled,
            participation_status=participation.get("learningAnalyticsStatus"),
            acknowledged_disclosure_version=participation.get("learningAnalyticsDisclosureVersion"),
            included_from=participation.get("learningAnalyticsIncludedFrom"),
            activity_at=record[activity_time_field],
        )
    ]


def current_participation_predicates():
    return (
        Participation.learningAnalyticsStatus == "INCLUDED",
        Participation.learningAnalyticsDisclosureVersion == LEARNING_ANALYTICS_DISCLOSURE_VERSION,
        Participation.learningAnalyticsIncludedFrom.is_not(None),
    )


def eligible_course_ids(
    session: Session,
    requested_course_ids: Sequence[str] | None,
    *,
    include_finalized: bool = True,
) -> list[str]:
    """Resolve a fail-closed course scope for every analytics task."""
    if not is_learning_analytics_rollout_enabled():
        return []

    statement = select(Course.id).where(Course.isLearningAnalyticsEnabled.is_(True))
    if requested_course_ids is not None:
        if not requested_course_ids:
            return []
        statement = statement.where(Course.id.in_(requested_course_ids))
    if not include_finalized:
        statement = statement.where(Course.analyticsFinalizedAt.is_(None))
    return [str(course_id) for course_id in session.execute(statement).scalars().all()]


def lock_learning_analytics_courses(session: Session, course_ids: Sequence[str]) -> set[str]:
    """Lock and re-check course switches in the transaction that performs writes.

    The course-setting mutation takes the same advisory lock. If it disables LA
    after this function, it waits for the write and then deletes the results. If
    it disabled LA first, this function observes that state and drops the rows.
    """
    unique_ids = sorted({str(course_id) for course_id in course_ids})
    if not unique_ids or not is_learning_analytics_rollout_enabled():
        return set()

    for course_id in unique_ids:
        session.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:course_id))::text"),
            {"course_id": course_id},
        )
    return set(eligible_course_ids(session, unique_ids))


def filter_learning_analytics_rows_for_write(
    session: Session,
    rows: list[dict[str, Any]],
    *,
    participant_id_key: str | None = None,
) -> list[dict[str, Any]]:
    """Re-check eligibility under the write lock immediately before an upsert."""
    if not rows:
        return []

    enabled_course_ids = lock_learning_analytics_courses(
        session,
        [str(row["courseId"]) for row in rows],
    )
    filtered = [row for row in rows if str(row["courseId"]) in enabled_course_ids]
    if participant_id_key is None or not filtered:
        return filtered

    target_pairs = {(str(row["courseId"]), str(row[participant_id_key])) for row in filtered}
    statement = select(Participation.courseId, Participation.participantId).where(
        *current_participation_predicates(),
        Participation.courseId.in_({pair[0] for pair in target_pairs}),
        Participation.participantId.in_({pair[1] for pair in target_pairs}),
    )
    eligible_pairs = {(str(row.courseId), str(row.participantId)) for row in session.execute(statement)}
    return [row for row in filtered if (str(row["courseId"]), str(row[participant_id_key])) in eligible_pairs]
