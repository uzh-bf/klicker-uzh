import importlib
import os
import sys
from contextlib import nullcontext
from types import ModuleType
from typing import Any, cast

import pytest

from src.analytics_runtime import AnalyticsRunCancelled, run_analytics_module
from src.modules.utils import (
    AnalyticsRunConfig,
    analytics_mode,
    analytics_run_config_from_env,
    analytics_window_since,
)


def test_direct_runtime_uses_task_local_config_without_mutating_environment(monkeypatch) -> None:
    module_name = "tests.fake_analytics_script"
    module = ModuleType(module_name)
    captured: list[object] = []

    def main() -> None:
        captured.extend(
            [
                analytics_mode(),
                analytics_window_since(),
                analytics_run_config_from_env(),
            ]
        )

    setattr(module, "main", main)
    monkeypatch.setitem(sys.modules, module_name, module)
    monkeypatch.setenv("ANALYTICS_MODE", "full")
    monkeypatch.setenv("ANALYTICS_COURSE_IDS", "process-scope")
    before = dict(os.environ)
    config = AnalyticsRunConfig(
        mode="finalize",
        course_ids=("task-scope",),
        window_since=None,
    )

    run_analytics_module(module_name, config, lambda: False)

    assert captured == ["finalize", None, config]
    assert dict(os.environ) == before
    assert analytics_run_config_from_env() == AnalyticsRunConfig(
        mode="full",
        course_ids=("process-scope",),
        window_since=None,
    )


def test_direct_runtime_checks_cancellation_before_import(monkeypatch) -> None:
    module_name = "tests.cancelled_analytics_script"
    monkeypatch.delitem(sys.modules, module_name, raising=False)

    with pytest.raises(AnalyticsRunCancelled):
        run_analytics_module(
            module_name,
            AnalyticsRunConfig(mode="incremental"),
            lambda: True,
        )
    assert module_name not in sys.modules


def test_direct_runtime_normalizes_process_exit_to_task_failure(monkeypatch) -> None:
    module_name = "tests.exiting_analytics_script"
    module = ModuleType(module_name)

    def main() -> None:
        raise SystemExit(7)

    setattr(module, "main", main)
    monkeypatch.setitem(sys.modules, module_name, module)

    with pytest.raises(RuntimeError, match="exited with status 7") as exc_info:
        run_analytics_module(
            module_name,
            AnalyticsRunConfig(mode="incremental"),
            lambda: False,
        )

    assert isinstance(exc_info.value.__cause__, SystemExit)


def test_chat_quiz_precondition_raises_ordinary_task_error(monkeypatch) -> None:
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql://postgres@127.0.0.1/analytics-entrypoint-test",
    )
    entrypoint = cast(
        Any,
        importlib.import_module("src.scripts.11_chat_quiz_correlation"),
    )
    session = object()
    expected = entrypoint.AnalyticsNotReadyError("analytics inputs missing")

    def fail_precondition(*_args, **_kwargs) -> None:
        raise expected

    monkeypatch.setattr(entrypoint, "SessionLocal", lambda: nullcontext(session))
    monkeypatch.setattr(entrypoint, "scoped_course_ids", lambda _session: None)
    monkeypatch.setattr(entrypoint, "script_entry", lambda **_kwargs: 0.0)
    monkeypatch.setattr(entrypoint, "assert_preconditions", fail_precondition)

    with pytest.raises(entrypoint.AnalyticsNotReadyError) as exc_info:
        entrypoint.main()

    assert exc_info.value is expected
    assert not isinstance(exc_info.value, SystemExit)
