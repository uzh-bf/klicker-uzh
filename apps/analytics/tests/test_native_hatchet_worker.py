from datetime import datetime, timezone
from typing import Any, cast

import pytest
from pydantic import ValidationError

from src import hatchet_worker


class FakeTask:
    def __init__(self, options: dict[str, Any], fn: Any) -> None:
        self.options = options
        self.fn = fn
        self.name = options["name"]


class FakeWorkflow:
    def __init__(self, options: dict[str, Any]) -> None:
        self.options = options
        self.tasks: list[FakeTask] = []

    def task(self, **options: Any) -> Any:
        def decorator(fn: Any) -> FakeTask:
            task = FakeTask(options, fn)
            self.tasks.append(task)
            return task

        return decorator


class FakeHatchet:
    def __init__(self) -> None:
        self.tasks: list[tuple[dict[str, Any], Any]] = []
        self.workflows: list[FakeWorkflow] = []
        self.worker_options: dict[str, Any] | None = None

    def task(self, **options: Any) -> Any:
        def decorator(fn: Any) -> Any:
            self.tasks.append((options, fn))
            return fn

        return decorator

    def workflow(self, **options: Any) -> FakeWorkflow:
        workflow = FakeWorkflow(options)
        self.workflows.append(workflow)
        return workflow

    def worker(self, name: str, **options: Any) -> dict[str, Any]:
        self.worker_options = {"name": name, **options}
        return self.worker_options


def test_run_input_is_immutable_and_rejects_unknown_fields() -> None:
    input = hatchet_worker.AnalyticsRunInput(courseId="course-1")

    with pytest.raises(ValidationError):
        input.courseId = "course-2"
    with pytest.raises(ValidationError):
        hatchet_worker.AnalyticsRunInput.model_validate({"courseId": "course-1", "unknown": True})


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


def test_worker_registers_proof_and_analytics_dag(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("ANALYTICS_ALLOW_FULL", raising=False)
    fake = FakeHatchet()

    worker = hatchet_worker.create_worker(cast(Any, fake))

    assert worker["name"] == hatchet_worker.WORKER_NAME
    assert worker["slots"] == 1
    assert worker["workflows"] == [fake.tasks[0][1], fake.workflows[0]]
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


def test_analytics_dag_matches_existing_task_contract() -> None:
    fake = FakeHatchet()
    calls: list[tuple[str, object]] = []
    hatchet_worker.register_native_workflows(
        cast(Any, fake),
        allow_full=False,
        script_runner=lambda module, config, _cancelled: calls.append((module, config)),
    )

    workflow = fake.workflows[0]
    assert workflow.options["name"] == "recompute-learning-analytics"
    assert workflow.options["on_crons"] == ["0 2 * * 1"]
    assert workflow.options["on_events"] == [
        "course-ended",
        "admin-recompute-analytics",
    ]
    assert workflow.options["input_validator"] is hatchet_worker.AnalyticsRunInput
    assert workflow.options["task_defaults"].schedule_timeout == (hatchet_worker.TASK_SCHEDULE_TIMEOUT)
    assert workflow.options["concurrency"].expression == ("has(input.courseId) ? input.courseId : 'global'")
    assert workflow.options["concurrency"].max_runs == 1

    tasks = {task.name: task for task in workflow.tasks}
    assert list(tasks) == [
        "s0-participant-analytics",
        "s2-course-heatmap",
        "s3-instance-activity-perf",
        "s4-participant-perf",
        "s5-participant-course-analytics",
        "s6-activity-progress",
        "s7-participant-activity-perf",
        "s8-chat-analytics",
        "s9-aggregated-chatbot-analytics",
        "s10-chat-topic-clustering",
        "s14-live-quiz-assessment-analytics",
        "s1-aggregated-analytics",
        "s13-platform-semester-analytics",
        "s11-chat-quiz-correlation",
        "s99-mark-analytics-valid",
    ]
    assert [parent.name for parent in tasks["s1-aggregated-analytics"].options["parents"]] == [
        "s0-participant-analytics"
    ]
    assert [parent.name for parent in tasks["s13-platform-semester-analytics"].options["parents"]] == [
        "s2-course-heatmap"
    ]
    assert [parent.name for parent in tasks["s11-chat-quiz-correlation"].options["parents"]] == [
        "s4-participant-perf",
        "s8-chat-analytics",
    ]
    assert len(tasks["s99-mark-analytics-valid"].options["parents"]) == 14
    assert tasks["s10-chat-topic-clustering"].options["retries"] == 0
    assert tasks["s0-participant-analytics"].options["execution_timeout"] == "60m"

    tasks["s14-live-quiz-assessment-analytics"].fn(
        hatchet_worker.AnalyticsRunInput(courseId="course-1"),
        type("Context", (), {"done": lambda self: False})(),
    )
    assert calls == [
        (
            hatchet_worker.ANALYTICS_SCRIPTS["s14"],
            hatchet_worker.AnalyticsRunConfig(
                mode="finalize",
                course_ids=("course-1",),
                window_since=None,
            ),
        )
    ]
