import os
from datetime import datetime, timedelta, timezone
from typing import Any

from hatchet_sdk import Context, Hatchet
from pydantic import BaseModel, ConfigDict

from src.modules.utils import AnalyticsMode, AnalyticsRunConfig

WORKER_NAME = "hatchet-worker-analytics-python"
PROOF_TASK_NAME = "learning-analytics-native-proof"
INCREMENTAL_LOOKBACK_DAYS = 14


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


def register_native_tasks(
    hatchet: Hatchet,
    *,
    allow_full: bool,
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

    return [native_proof]


def create_worker(hatchet: Hatchet) -> Any:
    tasks = register_native_tasks(
        hatchet,
        allow_full=os.environ.get("ANALYTICS_ALLOW_FULL") == "1",
    )
    return hatchet.worker(WORKER_NAME, slots=1, workflows=tasks)


def main() -> None:
    create_worker(Hatchet()).start()


if __name__ == "__main__":
    main()
