"""Eligibility and publication fencing shared by the learning analytics writers."""

from __future__ import annotations

from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any


# Keep this value aligned with the server-owned participant data-use disclosure.
# Server source: packages/util/src/participantAccountDataUse.ts
CURRENT_ANALYTICS_DISCLOSURE_VERSION = "2026-09-08"
ANALYTICS_ELIGIBILITY_GENERATION_ID = 0
ANALYTICS_ADVISORY_LOCK = (1279340545, 0)


class AnalyticsEligibilityChanged(RuntimeError):
    """Raised when eligibility changed while an analytics result was computed."""


class AnalyticsEligibilityRequired(RuntimeError):
    """Raised when a writer is called without an explicit eligibility context."""


@dataclass(frozen=True)
class EligibleParticipant:
    participant_id: str
    learning_analytics_choice_at: datetime


@dataclass(frozen=True)
class AnalyticsEligibilityContext:
    generation: int
    disclosure_version: str
    participants: tuple[EligibleParticipant, ...]

    @property
    def participant_ids(self) -> tuple[str, ...]:
        return tuple(participant.participant_id for participant in self.participants)

    @property
    def choice_at_by_participant(self) -> dict[str, datetime]:
        return {
            participant.participant_id: participant.learning_analytics_choice_at for participant in self.participants
        }


_ELIGIBLE_PARTICIPANTS_QUERY = """
SELECT
  p."id" AS "participantId",
  p."learningAnalyticsChoiceAt" AS "choiceAt"
FROM "Participant" AS p
WHERE p."learningAnalyticsConsent" IS TRUE
  AND p."learningAnalyticsChoiceAt" IS NOT NULL
  AND p."learningAnalyticsDisclosureVersion" = $1
  AND NOT EXISTS (
    SELECT 1
    FROM "ParticipantAnalyticsWithdrawal" AS withdrawal
    WHERE withdrawal."participantId" = p."id"
      AND withdrawal."completedAt" IS NULL
  )
"""

_VALIDATE_PARTICIPANT_QUERY = """
SELECT
  p."id" AS "participantId",
  p."learningAnalyticsChoiceAt" AS "choiceAt"
FROM "Participant" AS p
WHERE p."id" = CAST($1 AS uuid)
  AND p."learningAnalyticsConsent" IS TRUE
  AND p."learningAnalyticsChoiceAt" IS NOT NULL
  AND p."learningAnalyticsDisclosureVersion" = $2
  AND NOT EXISTS (
    SELECT 1
    FROM "ParticipantAnalyticsWithdrawal" AS withdrawal
    WHERE withdrawal."participantId" = p."id"
      AND withdrawal."completedAt" IS NULL
  )
"""

_ADVISORY_LOCK_QUERY = "SELECT pg_advisory_xact_lock(CAST($1 AS integer), CAST($2 AS integer))"


def _as_utc_datetime(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        parsed = value
    elif isinstance(value, date):
        parsed = datetime.combine(value, datetime.min.time())
    elif isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    else:
        return None

    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _participant_row(row: Any) -> tuple[str, datetime] | None:
    participant_id = _value(row, "participantId")
    choice_at = _value(row, "choiceAt")
    parsed_choice_at = _as_utc_datetime(choice_at)
    if participant_id is None or parsed_choice_at is None:
        return None
    return str(participant_id), parsed_choice_at


def _value(value: Any, key: str) -> Any:
    if isinstance(value, Mapping):
        return value.get(key)
    return getattr(value, key, None)


def _read_generation(db: Any) -> int:
    row = db.analyticseligibilitygeneration.find_unique(where={"id": ANALYTICS_ELIGIBILITY_GENERATION_ID})
    if row is None:
        return 0
    generation = _value(row, "generation")
    return 0 if generation is None else int(generation)


def capture_analytics_eligibility(
    db: Any,
    disclosure_version: str = CURRENT_ANALYTICS_DISCLOSURE_VERSION,
) -> AnalyticsEligibilityContext:
    """Capture generation and the current eligible participant cohort before reads."""

    generation = _read_generation(db)
    rows = db.query_raw(_ELIGIBLE_PARTICIPANTS_QUERY, disclosure_version)
    participants = []
    for row in rows:
        participant = _participant_row(row)
        if participant is not None:
            participants.append(EligibleParticipant(*participant))

    return AnalyticsEligibilityContext(
        generation=generation,
        disclosure_version=disclosure_version,
        participants=tuple(participants),
    )


def ensure_analytics_eligibility(
    db: Any,
    eligibility: AnalyticsEligibilityContext | None,
) -> AnalyticsEligibilityContext:
    """Capture a context for direct computation entry points, before their reads."""

    return eligibility if eligibility is not None else capture_analytics_eligibility(db)


def filter_records_by_eligibility(
    records: Iterable[Mapping[str, Any]],
    eligibility: AnalyticsEligibilityContext,
) -> list[Mapping[str, Any]]:
    """Keep only opted-in, disclosed, non-pending, prospective response records."""

    choice_at_by_participant = eligibility.choice_at_by_participant
    filtered: list[Mapping[str, Any]] = []
    for record in records:
        participant_id = record.get("participantId")
        choice_at = choice_at_by_participant.get(str(participant_id))
        created_at = _as_utc_datetime(record.get("createdAt"))
        if choice_at is not None and created_at is not None and created_at >= choice_at:
            filtered.append(record)
    return filtered


def filter_activity_by_eligibility(
    activity: Mapping[str, Any],
    eligibility: AnalyticsEligibilityContext,
) -> dict[str, Any]:
    """Copy an activity while removing ineligible response rows before totals."""

    filtered_activity = dict(activity)
    filtered_stacks = []
    for stack in activity.get("stacks", []):
        filtered_stack = dict(stack)
        filtered_elements = []
        for element in stack.get("elements", []):
            filtered_element = dict(element)
            filtered_element["responses"] = list(
                filter_records_by_eligibility(
                    element.get("responses", []),
                    eligibility,
                )
            )
            filtered_elements.append(filtered_element)
        filtered_stack["elements"] = filtered_elements
        filtered_stacks.append(filtered_stack)
    filtered_activity["stacks"] = filtered_stacks
    filtered_activity["responses"] = list(
        filter_records_by_eligibility(
            activity.get("responses", []),
            eligibility,
        )
    )
    return filtered_activity


def filter_dataframe_by_eligibility(
    dataframe: Any,
    eligibility: AnalyticsEligibilityContext,
) -> Any:
    """Apply the same prospective filter to a dataframe before aggregation."""

    if dataframe.empty:
        return dataframe
    if "participantId" not in dataframe or "createdAt" not in dataframe:
        return dataframe.iloc[0:0]

    return dataframe.loc[
        dataframe.apply(
            lambda row: bool(
                filter_records_by_eligibility(
                    [row.to_dict()],
                    eligibility,
                )
            ),
            axis=1,
        )
    ].copy()


def filter_dataframe_by_participants(
    dataframe: Any,
    eligibility: AnalyticsEligibilityContext,
) -> Any:
    """Keep derived rows for the captured participant cohort."""

    if dataframe.empty or "participantId" not in dataframe:
        return dataframe.iloc[0:0]

    participant_ids = set(eligibility.participant_ids)
    return dataframe.loc[dataframe["participantId"].astype(str).isin(participant_ids)].copy()


def is_course_learning_analytics_enabled(db: Any, course_id: str) -> bool:
    course = db.course.find_unique(where={"id": course_id})
    return bool(course is not None and _value(course, "isLearningAnalyticsEnabled"))


def filter_dataframe_by_enabled_courses(
    db: Any,
    dataframe: Any,
) -> Any:
    """Keep derived rows whose course still permits learning analytics."""

    if dataframe.empty or "courseId" not in dataframe:
        return dataframe.iloc[0:0]

    course_ids = tuple(dict.fromkeys(str(course_id) for course_id in dataframe["courseId"].dropna()))
    if not course_ids:
        return dataframe.iloc[0:0]

    courses = db.course.find_many(
        where={
            "id": {"in": list(course_ids)},
            "isLearningAnalyticsEnabled": True,
        }
    )
    enabled_course_ids = {str(_value(course, "id")) for course in courses}
    return dataframe.loc[dataframe["courseId"].astype(str).isin(enabled_course_ids)].copy()


def load_course_question_responses(
    db: Any,
    course_id: str,
    eligibility: AnalyticsEligibilityContext,
) -> list[dict[str, Any]]:
    """Load only prospective QuestionResponse rows for an enabled course."""

    if not eligibility.participant_ids or not is_course_learning_analytics_enabled(db, course_id):
        return []

    responses = db.questionresponse.find_many(
        where={
            "courseId": course_id,
            "participantId": {"in": list(eligibility.participant_ids)},
        }
    )
    return list(
        filter_records_by_eligibility(
            [response.dict() for response in responses],
            eligibility,
        )
    )


def _validate_participants(
    db: Any,
    eligibility: AnalyticsEligibilityContext,
) -> None:
    for participant in eligibility.participants:
        rows = db.query_raw(
            _VALIDATE_PARTICIPANT_QUERY,
            participant.participant_id,
            eligibility.disclosure_version,
        )
        if len(rows) != 1:
            raise AnalyticsEligibilityChanged("Participant eligibility changed during computation")

        current = _participant_row(rows[0])
        if current is None or current[0] != participant.participant_id:
            raise AnalyticsEligibilityChanged("Participant eligibility changed during computation")
        if current[1] != participant.learning_analytics_choice_at:
            raise AnalyticsEligibilityChanged("Participant choice changed during computation")


def validate_analytics_eligibility(
    db: Any,
    eligibility: AnalyticsEligibilityContext,
    course_ids: Iterable[str],
) -> None:
    """Validate the captured scope while the caller holds the shared lock."""

    if _read_generation(db) != eligibility.generation:
        raise AnalyticsEligibilityChanged("Analytics eligibility generation changed during computation")

    for course_id in dict.fromkeys(str(course_id) for course_id in course_ids):
        if not is_course_learning_analytics_enabled(db, course_id):
            raise AnalyticsEligibilityChanged("Course learning analytics gate changed during computation")

    _validate_participants(db, eligibility)


def publish_analytics(
    db: Any,
    eligibility: AnalyticsEligibilityContext | None,
    course_ids: Iterable[str],
    write: Callable[[Any], None],
) -> None:
    """Publish one family atomically after revalidating the captured scope.

    Course validity is intentionally not set here. The parent coordinator owns
    the final all-families completion boundary and must set it only after every
    required computation has succeeded.
    """

    if eligibility is None:
        raise AnalyticsEligibilityRequired("Analytics publication requires an eligibility context")
    if not eligibility.participant_ids:
        return

    course_ids = tuple(dict.fromkeys(str(course_id) for course_id in course_ids))

    with db.tx(
        max_wait=timedelta(seconds=10),
        timeout=timedelta(seconds=60),
    ) as transaction:
        transaction.execute_raw(
            _ADVISORY_LOCK_QUERY,
            ANALYTICS_ADVISORY_LOCK[0],
            ANALYTICS_ADVISORY_LOCK[1],
        )
        validate_analytics_eligibility(transaction, eligibility, course_ids)
        write(transaction)
