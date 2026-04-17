"""Shared helpers for the analytics compute modules.

Kept small on purpose — any piece of logic used by more than one module belongs
here instead of being copy-pasted into individual ``compute_*.py`` files.
"""

from datetime import datetime
from typing import Callable

import pandas as pd


def load_sql(path: str) -> str:
    """Read a ``.sql`` file from disk. Cache the result at the call site by
    assigning it to a module-level constant; this helper is deliberately
    stateless so callers don't accidentally share a cache across modules.
    """
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


# Sentinel timestamp for COURSE-type analytics rows — matches the convention
# used by the existing participant-analytics saver.
COURSE_TIMESTAMP = "1970-01-01"

ComputeFn = Callable[..., object]


def iter_analytics_windows(
    db,
    compute_fn: ComputeFn,
    *,
    start_date: str = "2022-10-23",
    end_date: str | None = None,
    compute_daily: bool = True,
    compute_weekly: bool = True,
    compute_monthly: bool = True,
    compute_course: bool = True,
    label: str = "analytics",
    verbose: bool = False,
) -> None:
    """Iterate DAILY / WEEKLY / MONTHLY / COURSE windows and call ``compute_fn``
    for each one with the signature ``(db, win_start, win_end, timestamp,
    analytics_type, verbose)``.

    Used by scripts 8 and 9 (and future scripts with the same window shape) to
    avoid re-stating the same date-range boilerplate.
    """
    end_date = end_date or datetime.now().strftime("%Y-%m-%d")

    if compute_daily:
        for curr in pd.date_range(start=start_date, end=end_date, freq="D"):
            day = curr.strftime("%Y-%m-%d")
            print(f"Computing daily {label} for {day}")
            compute_fn(
                db,
                day + "T00:00:00.000Z",
                day + "T23:59:59.999Z",
                day,
                "DAILY",
                verbose,
            )

    if compute_weekly:
        for curr in pd.date_range(start=start_date, end=end_date, freq="W"):
            week_end = curr.strftime("%Y-%m-%d")
            win_start = (curr - pd.DateOffset(days=6)).strftime("%Y-%m-%d")
            print(f"Computing weekly {label} for {win_start} to {week_end}")
            compute_fn(
                db,
                win_start + "T00:00:00.000Z",
                week_end + "T23:59:59.999Z",
                week_end,
                "WEEKLY",
                verbose,
            )

    if compute_monthly:
        for curr in pd.date_range(start=start_date, end=end_date, freq="ME"):
            month_end = curr.strftime("%Y-%m-%d")
            win_start = (curr - pd.offsets.MonthBegin(1)).strftime("%Y-%m-%d")
            print(f"Computing monthly {label} for {win_start} to {month_end}")
            compute_fn(
                db,
                win_start + "T00:00:00.000Z",
                month_end + "T23:59:59.999Z",
                month_end,
                "MONTHLY",
                verbose,
            )

    if compute_course:
        print(f"Computing course-wide {label} for {start_date} to {end_date}")
        compute_fn(
            db,
            start_date + "T00:00:00.000Z",
            end_date + "T23:59:59.999Z",
            COURSE_TIMESTAMP,
            "COURSE",
            verbose,
        )
