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


class FakeContext:
    def __init__(self, done: bool = False) -> None:
        self._done = done

    def done(self) -> bool:
        return self._done


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
    assert worker["workflows"] == [
        fake.tasks[0][1],
        fake.workflows[0],
        fake.workflows[1],
    ]
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


def test_analytics_dags_split_concurrency_and_preserve_task_contract() -> None:
    fake = FakeHatchet()
    calls: list[tuple[str, object]] = []
    hatchet_worker.register_native_workflows(
        cast(Any, fake),
        allow_full=True,
        script_runner=lambda module, config, _cancelled: calls.append((module, config)),
    )

    freshness, full = fake.workflows
    assert freshness.options["name"] == "recompute-learning-analytics"
    assert freshness.options["on_crons"] == ["0 2 * * 1"]
    assert freshness.options["on_events"] == [
        "course-ended",
        "admin-recompute-analytics",
    ]
    assert freshness.options["input_validator"] is hatchet_worker.AnalyticsRunInput
    assert freshness.options["task_defaults"].schedule_timeout == (hatchet_worker.TASK_SCHEDULE_TIMEOUT)
    assert freshness.options["concurrency"].expression == ("has(input.courseId) ? input.courseId : 'global'")
    assert freshness.options["concurrency"].max_runs == 1
    assert freshness.options["concurrency"].limit_strategy == hatchet_worker.ConcurrencyLimitStrategy.CANCEL_IN_PROGRESS

    assert full.options["name"] == "recompute-learning-analytics-full"
    assert full.options["on_events"] == ["admin-recompute-analytics-full"]
    assert "on_crons" not in full.options
    assert full.options["input_validator"] is hatchet_worker.AnalyticsRunInput
    assert full.options["task_defaults"].schedule_timeout == (hatchet_worker.TASK_SCHEDULE_TIMEOUT)
    assert full.options["concurrency"].expression == "'global'"
    assert full.options["concurrency"].max_runs == 1
    assert full.options["concurrency"].limit_strategy == hatchet_worker.ConcurrencyLimitStrategy.CANCEL_NEWEST

    expected_task_names = [
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

    for workflow in (freshness, full):
        tasks = {task.name: task for task in workflow.tasks}
        assert list(tasks) == expected_task_names
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

    freshness_tasks = {task.name: task for task in freshness.tasks}
    freshness_tasks["s14-live-quiz-assessment-analytics"].fn(
        hatchet_worker.AnalyticsRunInput(courseId="course-1"),
        FakeContext(),
    )
    full_tasks = {task.name: task for task in full.tasks}
    full_tasks["s14-live-quiz-assessment-analytics"].fn(
        hatchet_worker.AnalyticsRunInput(mode="full", courseId="course-2"),
        FakeContext(),
    )
    assert calls[0][1] == hatchet_worker.AnalyticsRunConfig(
        mode="finalize",
        course_ids=("course-1",),
        window_since=None,
    )
    assert calls[1][1] == hatchet_worker.AnalyticsRunConfig(
        mode="full",
        course_ids=("course-2",),
        window_since=None,
    )

    with pytest.raises(ValueError, match="ANALYTICS_ALLOW_FULL"):
        freshness_tasks["s14-live-quiz-assessment-analytics"].fn(
            hatchet_worker.AnalyticsRunInput(mode="full"),
            FakeContext(),
        )
    with pytest.raises(ValueError, match="requires mode=full"):
        full_tasks["s14-live-quiz-assessment-analytics"].fn(
            hatchet_worker.AnalyticsRunInput(mode="incremental"),
            FakeContext(),
        )


def test_cancelled_script_is_non_retryable_at_hatchet_boundary() -> None:
    fake = FakeHatchet()

    def cancelled_runner(*_args: object) -> None:
        raise hatchet_worker.AnalyticsRunCancelled("superseded")

    hatchet_worker.register_native_workflows(
        cast(Any, fake),
        allow_full=False,
        script_runner=cancelled_runner,
    )
    task = next(task for task in fake.workflows[0].tasks if task.name == "s14-live-quiz-assessment-analytics")

    with pytest.raises(hatchet_worker.NonRetryableException, match="superseded") as exc_info:
        task.fn(
            hatchet_worker.AnalyticsRunInput(courseId="course-1"),
            FakeContext(done=True),
        )

    assert isinstance(exc_info.value.__cause__, hatchet_worker.AnalyticsRunCancelled)
