from types import SimpleNamespace
from typing import Any, cast

import pandas as pd
import pytest
from sqlalchemy.orm import Session

from src.dryrun.interceptor import CaptureBuffer, intercept_writes
from src.modules.participant_activity_performance.prepare_participant_activity_data import (
    prepare_participant_activity_data,
)
from src.modules.participant_course_analytics.compute_participant_activity import (
    compute_participant_activity,
)
from src.modules.participant_course_analytics.get_active_weeks import get_active_weeks
from src.modules.utils import (
    AnalyticsRunCancelled,
    AnalyticsRunConfig,
    analytics_run_context,
)


def cancellation_after(checks_before_cancel: int):
    checks = 0

    def cancelled() -> bool:
        nonlocal checks
        checks += 1
        return checks > checks_before_cancel

    return cancelled


def test_active_week_queries_stop_between_participants() -> None:
    course = {
        "id": "course-1",
        "participations": [
            {"participantId": "participant-1"},
            {"participantId": "participant-2"},
        ],
    }

    with (
        intercept_writes(CaptureBuffer()),
        analytics_run_context(
            AnalyticsRunConfig(mode="incremental"),
            cancellation_after(1),
        ),
        pytest.raises(AnalyticsRunCancelled),
    ):
        get_active_weeks(cast(Session, object()), course)


def test_participant_activity_stops_between_participants() -> None:
    activity = pd.DataFrame(
        [
            {"participantId": "participant-1"},
            {"participantId": "participant-2"},
        ]
    )

    with (
        intercept_writes(CaptureBuffer()),
        analytics_run_context(
            AnalyticsRunConfig(mode="incremental"),
            cancellation_after(1),
        ),
        pytest.raises(AnalyticsRunCancelled),
    ):
        compute_participant_activity(
            cast(Session, object()),
            activity,
            "course-1",
            pd.Timestamp("2026-07-01"),
            pd.Timestamp("2026-07-07"),
        )

    assert activity.loc[0, "activeDaysPerWeek"] == 0
    assert pd.isna(activity.loc[1, "activeDaysPerWeek"])


def test_participant_activity_stops_between_weekly_expansions() -> None:
    activity = pd.DataFrame([{"participantId": "participant-1"}])

    with (
        intercept_writes(CaptureBuffer()),
        analytics_run_context(
            AnalyticsRunConfig(mode="incremental"),
            cancellation_after(2),
        ),
        pytest.raises(AnalyticsRunCancelled),
    ):
        compute_participant_activity(
            cast(Session, object()),
            activity,
            "course-1",
            pd.Timestamp("2026-07-01"),
            pd.Timestamp("2026-07-20"),
        )


class FakeScalarResult:
    def __init__(self, values: list[Any]) -> None:
        self.values = values

    def scalars(self) -> "FakeScalarResult":
        return self

    def all(self) -> list[Any]:
        return self.values


class FakeSession:
    def __init__(self, results: list[list[Any]]) -> None:
        self.results = iter(results)

    def execute(self, _statement: object) -> FakeScalarResult:
        return FakeScalarResult(next(self.results))


def test_activity_response_expansion_stops_between_activities() -> None:
    activities = [
        SimpleNamespace(id="activity-1", status="PUBLISHED", stacks=[]),
        SimpleNamespace(id="activity-2", status="PUBLISHED", stacks=[]),
    ]
    session = FakeSession([activities, [], ["participant-1"]])

    with (
        analytics_run_context(
            AnalyticsRunConfig(mode="incremental"),
            cancellation_after(1),
        ),
        pytest.raises(AnalyticsRunCancelled),
    ):
        prepare_participant_activity_data(cast(Session, session), "course-1")
