from datetime import datetime, timezone
from typing import Any, cast

import pytest
from pydantic import ValidationError

from src import hatchet_worker


class FakeHatchet:
    def __init__(self) -> None:
        self.tasks: list[tuple[dict[str, Any], Any]] = []
        self.worker_options: dict[str, Any] | None = None

    def task(self, **options: Any) -> Any:
        def decorator(fn: Any) -> Any:
            self.tasks.append((options, fn))
            return fn

        return decorator

    def worker(self, name: str, **options: Any) -> dict[str, Any]:
        self.worker_options = {"name": name, **options}
        return self.worker_options


def test_run_input_is_immutable_and_rejects_unknown_fields() -> None:
    input = hatchet_worker.AnalyticsRunInput(courseId="course-1")

    with pytest.raises(ValidationError):
        input.courseId = "course-2"
    with pytest.raises(ValidationError):
        hatchet_worker.AnalyticsRunInput.model_validate(
            {"courseId": "course-1", "unknown": True}
        )


def test_resolve_run_config_preserves_producer_contract() -> None:
    now = datetime(2026, 7, 23, 12, tzinfo=timezone.utc)

    incremental = hatchet_worker.resolve_run_config(
        hatchet_worker.AnalyticsRunInput(courseIds=("course-1",)),
        allow_full=False,
        now=now,
    )
    assert incremental.mode == "incremental"
    assert incremental.course_ids == ("course-1",)
    assert incremental.window_since == "2026-07-09"

    finalize = hatchet_worker.resolve_run_config(
        hatchet_worker.AnalyticsRunInput(courseId="course-2"),
        allow_full=False,
        now=now,
    )
    assert finalize.mode == "finalize"
    assert finalize.course_ids == ("course-2",)
    assert finalize.window_since is None


def test_resolve_run_config_enforces_full_and_finalize_guards() -> None:
    with pytest.raises(ValueError, match="ANALYTICS_ALLOW_FULL"):
        hatchet_worker.resolve_run_config(
            hatchet_worker.AnalyticsRunInput(mode="full"),
            allow_full=False,
        )
    with pytest.raises(ValueError, match="requires courseIds"):
        hatchet_worker.resolve_run_config(
            hatchet_worker.AnalyticsRunInput(mode="finalize"),
            allow_full=False,
        )


def test_worker_registers_one_non_mutating_proof_task(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("ANALYTICS_ALLOW_FULL", raising=False)
    fake = FakeHatchet()

    worker = hatchet_worker.create_worker(cast(Any, fake))

    assert worker["name"] == hatchet_worker.WORKER_NAME
    assert worker["slots"] == 1
    assert worker["workflows"] == [fake.tasks[0][1]]
    options, proof = fake.tasks[0]
    assert options == {
        "name": hatchet_worker.PROOF_TASK_NAME,
        "input_validator": hatchet_worker.AnalyticsRunInput,
        "execution_timeout": "1m",
    }
    assert proof(hatchet_worker.AnalyticsRunInput(courseId="course-1"), None) == {
        "native": True,
        "mode": "finalize",
        "courseIds": ["course-1"],
        "windowSince": None,
    }
