from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from datetime import datetime, timedelta
import os
from typing import Any


# Keep this value aligned with
# packages/graphql/src/lib/learningAnalytics.ts:LEARNING_ANALYTICS_DISCLOSURE_VERSION.
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


@contextmanager
def learning_analytics_write_transaction(
    db: Any,
    *,
    course_id: str,
    participant_id: str | None = None,
) -> Iterator[Any | None]:
    if not is_learning_analytics_rollout_enabled():
        yield None
        return

    with db.tx(max_wait=timedelta(seconds=10), timeout=timedelta(seconds=60)) as transaction:
        transaction.query_raw(
            "SELECT pg_advisory_xact_lock(hashtext($1))::text",
            course_id,
        )
        course = transaction.course.find_unique(where={"id": course_id})
        if course is None or not course.isLearningAnalyticsEnabled:
            yield None
            return

        if participant_id is not None:
            participation = transaction.participation.find_unique(
                where={
                    "courseId_participantId": {
                        "courseId": course_id,
                        "participantId": participant_id,
                    }
                }
            )
            if participation is None or not is_participation_currently_included(
                participation.dict(),
                is_course_enabled=True,
            ):
                yield None
                return

        yield transaction
