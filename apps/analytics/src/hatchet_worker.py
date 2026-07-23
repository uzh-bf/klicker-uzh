import os
from collections.abc import Callable
from datetime import datetime, timedelta, timezone
from typing import Any

from hatchet_sdk import Context, Hatchet, NonRetryableException
from hatchet_sdk.runnables.types import (
    ConcurrencyExpression,
    ConcurrencyLimitStrategy,
    TaskDefaults,
)
from pydantic import BaseModel, ConfigDict

from src.analytics_runtime import run_analytics_module
from src.modules.utils import (
    AnalyticsMode,
    AnalyticsRunCancelled,
    AnalyticsRunConfig,
)

WORKER_NAME = "hatchet-worker-analytics-python"
PROOF_TASK_NAME = "learning-analytics-native-proof"
ANALYTICS_WORKFLOW_NAME = "recompute-learning-analytics"
INCREMENTAL_LOOKBACK_DAYS = 14
TASK_SCHEDULE_TIMEOUT = "168h"
ANALYTICS_EVENTS = ["course-ended", "admin-recompute-analytics"]
ANALYTICS_SCRIPTS = {
    "s0": "src.scripts.0_initial_participant_analytics",
    "s1": "src.scripts.1_initial_aggregated_analytics",
    "s2": "src.scripts.2_initial_aggregated_course_analytics",
    "s3": "src.scripts.3_initial_instance_activity_performance",
    "s4": "src.scripts.4_initial_participant_performance",
    "s5": "src.scripts.5_initial_participant_course_analytics",
    "s6": "src.scripts.6_initial_activity_progress",
    "s7": "src.scripts.7_participant_activity_performance",
    "s8": "src.scripts.8_initial_chat_analytics",
    "s9": "src.scripts.9_initial_aggregated_chatbot_analytics",
    "s10": "src.scripts.10_chat_topic_clustering",
    "s11": "src.scripts.11_chat_quiz_correlation",
    "s13": "src.scripts.13_platform_semester_analytics",
    "s14": "src.scripts.14_live_quiz_assessment_analytics",
    "s99": "src.scripts.99_mark_analytics_valid",
}
ScriptRunner = Callable[
    [str, AnalyticsRunConfig, Callable[[], bool]],
    None,
]


class AnalyticsRunInput(BaseModel):
    """Existing TypeScript producer contract, validated as immutable input."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    mode: AnalyticsMode | None = None
    courseIds: tuple[str, ...] = ()
    courseId: str | None = None
    windowSince: str | None = None


def resolve_run_config(
    input: AnalyticsRunInput,
    *,
    allow_full: bool,
    now: datetime | None = None,
) -> AnalyticsRunConfig:
    mode: AnalyticsMode = input.mode or (
        "finalize" if input.courseId else "incremental"
    )
    course_ids = tuple(
        course_id for course_id in (input.courseId, *input.courseIds) if course_id
    )

    if mode == "full" and not allow_full:
        raise ValueError("mode=full requires ANALYTICS_ALLOW_FULL=1")
    if mode == "finalize" and not course_ids:
        raise ValueError("mode=finalize requires courseIds or courseId")

    window_since = input.windowSince
    if mode == "incremental" and window_since is None:
        current = now or datetime.now(timezone.utc)
        window_since = (
            (current - timedelta(days=INCREMENTAL_LOOKBACK_DAYS)).date().isoformat()
        )
    if mode != "incremental":
        window_since = None

    return AnalyticsRunConfig(
        mode=mode,
        course_ids=course_ids or None,
        window_since=window_since,
    )


def register_native_workflows(
    hatchet: Hatchet,
    *,
    allow_full: bool,
    script_runner: ScriptRunner = run_analytics_module,
) -> list[Any]:
    @hatchet.task(
        name=PROOF_TASK_NAME,
        input_validator=AnalyticsRunInput,
        execution_timeout="1m",
    )
    def native_proof(input: AnalyticsRunInput, _ctx: Context) -> dict[str, object]:
        config = resolve_run_config(input, allow_full=allow_full)
        return {
            "native": True,
            "mode": config.mode,
            "courseIds": list(config.course_ids or ()),
            "windowSince": config.window_since,
        }

    analytics = hatchet.workflow(
        name=ANALYTICS_WORKFLOW_NAME,
        input_validator=AnalyticsRunInput,
        on_crons=["0 2 * * 1"],
        on_events=ANALYTICS_EVENTS,
        concurrency=ConcurrencyExpression(
            expression="has(input.courseId) ? input.courseId : 'global'",
            max_runs=1,
            limit_strategy=ConcurrencyLimitStrategy.CANCEL_IN_PROGRESS,
        ),
        # One slot is the conservative rollout starting point. Override
        # Hatchet's five-minute default so queued DAG roots do not expire
        # behind long-running siblings, retries, or a burst of course runs.
        task_defaults=TaskDefaults(schedule_timeout=TASK_SCHEDULE_TIMEOUT),
    )
    tasks: dict[str, Any] = {}

    def add_task(
        key: str,
        name: str,
        *,
        parents: tuple[str, ...] = (),
        execution_timeout: str = "30m",
        retries: int = 2,
    ) -> None:
        @analytics.task(
            name=name,
            parents=[tasks[parent] for parent in parents],
            execution_timeout=execution_timeout,
            retries=retries,
        )
        def run_script(input: AnalyticsRunInput, ctx: Context) -> None:
            config = resolve_run_config(input, allow_full=allow_full)
            try:
                script_runner(ANALYTICS_SCRIPTS[key], config, ctx.done)
            except AnalyticsRunCancelled as exc:
                raise NonRetryableException(str(exc)) from exc

        tasks[key] = run_script

    add_task("s0", "s0-participant-analytics", execution_timeout="60m")
    add_task("s2", "s2-course-heatmap")
    add_task("s3", "s3-instance-activity-perf")
    add_task("s4", "s4-participant-perf")
    add_task("s5", "s5-participant-course-analytics")
    add_task("s6", "s6-activity-progress")
    add_task("s7", "s7-participant-activity-perf")
    add_task("s8", "s8-chat-analytics", execution_timeout="60m")
    add_task("s9", "s9-aggregated-chatbot-analytics", execution_timeout="60m")
    add_task(
        "s10",
        "s10-chat-topic-clustering",
        execution_timeout="60m",
        retries=0,
    )
    add_task("s14", "s14-live-quiz-assessment-analytics")
    add_task(
        "s1",
        "s1-aggregated-analytics",
        parents=("s0",),
        execution_timeout="60m",
    )
    add_task("s13", "s13-platform-semester-analytics", parents=("s2",))
    add_task("s11", "s11-chat-quiz-correlation", parents=("s4", "s8"))
    add_task(
        "s99",
        "s99-mark-analytics-valid",
        parents=tuple(tasks),
    )

    return [native_proof, analytics]


def create_worker(hatchet: Hatchet) -> Any:
    workflows = register_native_workflows(
        hatchet,
        allow_full=os.environ.get("ANALYTICS_ALLOW_FULL") == "1",
    )
    return hatchet.worker(WORKER_NAME, slots=1, workflows=workflows)


def main() -> None:
    create_worker(Hatchet()).start()


if __name__ == "__main__":
    main()
