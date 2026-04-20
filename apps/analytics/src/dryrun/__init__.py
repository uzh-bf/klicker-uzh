"""Read-only dry-run harness for the analytics pipeline.

See ``runner.run_dryrun`` for the entry point. Imports are kept small so the
module is cheap to load from the CLI wrapper.
"""

from src.dryrun.interceptor import (
    CaptureBuffer,
    classify_text,
    intercept_writes,
    rewrite_insert_to_select,
)
from src.dryrun.runner import run_dryrun

__all__ = [
    "CaptureBuffer",
    "classify_text",
    "intercept_writes",
    "rewrite_insert_to_select",
    "run_dryrun",
]
