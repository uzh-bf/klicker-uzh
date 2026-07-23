import os
import sys
from types import ModuleType

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
