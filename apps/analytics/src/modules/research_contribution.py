"""Research contribution retention bound to analytics result publications."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, Mapping

from .analytics_eligibility import AnalyticsEligibilityContext

# Bump when a family computation algorithm changes so retained contributions
# stay attributable to the exact algorithm version that published them.
ANALYTICS_ALGORITHM_VERSION = "1"


def contribution_scope_key(*parts: Any) -> str:
    """Build the deterministic scope identity used for contribution rows."""

    return "|".join(_scope_part(part) for part in parts)


def _scope_part(part: Any) -> str:
    if isinstance(part, datetime):
        return part.isoformat()
    if isinstance(part, date):
        return part.isoformat()
    return str(part)


def _json_value(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if value is None or isinstance(value, (bool, str, int, float)):
        return value
    if hasattr(value, "item"):  # numpy / pandas scalars
        return _json_value(value.item())
    return str(value)


def contribution_record(record: Mapping[str, Any]) -> dict[str, Any]:
    """Convert a contribution mapping to JSON-safe values."""

    return {str(key): _json_value(value) for key, value in record.items()}


def retain_research_contribution(
    transaction,
    *,
    family: str,
    participant_id,
    course_id,
    scope_key: str,
    scope: Mapping[str, Any],
    contributions: Mapping[str, Any],
    eligibility: AnalyticsEligibilityContext,
    computed_at,
    binding: str | None = None,
    result_row_id: Any = None,
    source_window_start=None,
    source_window_end=None,
) -> None:
    """Replace the retained contribution for one participant and scope.

    Runs inside the locked publication transaction of a family writer. The
    caller decides whether the publication wrote new result values; no-op
    upserts must not call this so their original provenance is retained.
    """

    participant_id = str(participant_id)
    course_id = str(course_id)
    choice_at = eligibility.choice_at_by_participant.get(participant_id)
    if choice_at is None:
        return

    transaction.participantanalyticsresearchcontribution.delete_many(
        where={
            "family": family,
            "participantId": participant_id,
            "scopeKey": scope_key,
        }
    )

    data = {
        "family": family,
        "scopeKey": scope_key,
        "scope": contribution_record(scope),
        "contributions": contribution_record(contributions),
        "generation": eligibility.generation,
        "disclosureVersion": eligibility.disclosure_version,
        "choiceAt": choice_at,
        "algorithmVersion": ANALYTICS_ALGORITHM_VERSION,
        "computedAt": computed_at,
        "sourceWindowStart": source_window_start,
        "sourceWindowEnd": source_window_end,
        "participant": {"connect": {"id": participant_id}},
        "course": {"connect": {"id": course_id}},
    }
    if binding is not None and result_row_id is not None:
        data[binding] = result_row_id

    transaction.participantanalyticsresearchcontribution.create(data)
