from contextlib import AbstractContextManager
from types import TracebackType
from typing import cast

import pytest
from sqlalchemy.orm import Session
from src.modules.live_quiz_analytics import run_live_quiz_analytics as entrypoint
from src.modules.utils import (
    AnalyticsRunCancelled,
    AnalyticsRunConfig,
    analytics_run_context,
)


class FakeSession(AbstractContextManager[Session]):
    def __enter__(self) -> Session:
        return cast(Session, self)

    def __exit__(
        self,
        _exc_type: type[BaseException] | None,
        _exc: BaseException | None,
        _traceback: TracebackType | None,
    ) -> None:
        return None


def test_live_quiz_entrypoint_uses_immutable_config_without_environment_mutation(
    monkeypatch,
) -> None:
    config = AnalyticsRunConfig(
        mode="finalize",
        course_ids=("course-1",),
        window_since=None,
    )
    session = FakeSession()
    calls: list[tuple[str, object, list[str] | None]] = []

    monkeypatch.setattr(entrypoint, "script_entry", lambda **_kwargs: 0.0)
    monkeypatch.setattr(entrypoint, "script_exit", lambda **_kwargs: None)
    monkeypatch.setattr(
        entrypoint,
        "scoped_course_ids",
        lambda received_session, received_config: (
            calls.append(("scope", received_session, list(received_config.course_ids or ()))) or ["course-1"]
        ),
    )
    monkeypatch.setattr(
        entrypoint,
        "compute_participant_live_quiz_analytics",
        lambda received_session, *, course_ids, verbose: calls.append(("participant", received_session, course_ids)),
    )
    monkeypatch.setattr(
        entrypoint,
        "compute_aggregated_live_quiz_analytics",
        lambda received_session, *, course_ids, verbose: calls.append(("aggregated", received_session, course_ids)),
    )

    entrypoint.run_live_quiz_analytics(config, session_factory=lambda: session)

    assert calls == [
        ("scope", session, ["course-1"]),
        ("participant", session, ["course-1"]),
        ("aggregated", session, ["course-1"]),
    ]


def test_live_quiz_entrypoint_stops_between_committed_phases(monkeypatch) -> None:
    config = AnalyticsRunConfig(
        mode="finalize",
        course_ids=("course-1",),
        window_since=None,
    )
    session = FakeSession()
    calls: list[str] = []

    monkeypatch.setattr(entrypoint, "script_entry", lambda **_kwargs: 0.0)
    monkeypatch.setattr(entrypoint, "script_exit", lambda **_kwargs: None)
    monkeypatch.setattr(
        entrypoint,
        "scoped_course_ids",
        lambda _session, _config: ["course-1"],
    )
    monkeypatch.setattr(
        entrypoint,
        "compute_participant_live_quiz_analytics",
        lambda *_args, **_kwargs: calls.append("participant"),
    )
    monkeypatch.setattr(
        entrypoint,
        "compute_aggregated_live_quiz_analytics",
        lambda *_args, **_kwargs: calls.append("aggregated"),
    )

    with (
        analytics_run_context(config, lambda: calls == ["participant"]),
        pytest.raises(AnalyticsRunCancelled),
    ):
        entrypoint.run_live_quiz_analytics(config, session_factory=lambda: session)

    assert calls == ["participant"]
