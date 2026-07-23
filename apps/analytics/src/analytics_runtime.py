import importlib
from collections.abc import Callable

from src.modules.utils import (
    AnalyticsRunConfig,
    analytics_run_cancelled,
    analytics_run_context,
)


class AnalyticsRunCancelled(RuntimeError):
    pass


def check_cancellation() -> None:
    if analytics_run_cancelled():
        raise AnalyticsRunCancelled("analytics task was cancelled")


def run_analytics_module(
    script_module: str,
    config: AnalyticsRunConfig,
    cancellation_check: Callable[[], bool],
) -> None:
    """Invoke an existing analytics script directly inside the Python worker."""
    with analytics_run_context(config, cancellation_check):
        check_cancellation()
        module = importlib.import_module(script_module)
        main = getattr(module, "main", None)
        if not callable(main):
            raise TypeError(f"{script_module} does not expose a callable main()")
        try:
            main()
        except SystemExit as exc:
            raise RuntimeError(f"{script_module} exited with status {exc.code}") from exc
        check_cancellation()
