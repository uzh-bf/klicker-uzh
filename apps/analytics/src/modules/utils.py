"""Shared helpers for the analytics compute modules.

Kept small on purpose — any piece of logic used by more than one module belongs
here instead of being copy-pasted into individual ``compute_*.py`` files.
"""

import os
import uuid
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


def _parse_window_since(windows_since: str | None) -> pd.Timestamp | None:
    if not windows_since:
        return None
    try:
        return pd.Timestamp(windows_since)
    except (ValueError, TypeError):
        print(f"[utils] ignoring invalid windows_since={windows_since!r}")
        return None


def should_skip_window(win_end: str, windows_since: str | None) -> bool:
    """Return True when ``win_end`` falls before the ``windows_since`` cutoff.

    Shared by ``iter_analytics_windows`` and the bespoke window loops in
    scripts 0 / 1 so the cutoff semantics stay in one place.
    """
    cutoff = _parse_window_since(windows_since)
    if cutoff is None:
        return False
    return pd.Timestamp(win_end) < cutoff


def render_uuid_in_clause(column: str, course_ids: list[str]) -> str:
    """Render ``AND <column> IN (...)`` with UUID-validated literals.

    Returns ``AND false`` for an empty list so the caller's surrounding
    predicate still matches zero rows. UUIDs are re-parsed to fail loud on
    malformed input — placeholders get substituted into raw SQL, so we never
    inline an unchecked identifier even from a nominally internal env var.
    """
    if not course_ids:
        return "AND false"
    validated = [str(uuid.UUID(cid)) for cid in course_ids]
    in_list = ", ".join(f"'{cid}'" for cid in validated)
    return f"AND {column} IN ({in_list})"


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
    windows_since: str | None = None,
    label: str = "analytics",
    verbose: bool = False,
) -> None:
    """Iterate DAILY / WEEKLY / MONTHLY / COURSE windows and call ``compute_fn``
    for each one with the signature ``(db, win_start, win_end, timestamp,
    analytics_type, verbose)``.

    If ``windows_since`` is provided (ISO date), DAILY/WEEKLY/MONTHLY windows
    whose ``win_end < windows_since`` are skipped. COURSE is always emitted
    when ``compute_course=True`` — callers restrict COURSE-scope writes by
    filtering courses upstream, not by window cutoff.
    """
    end_date = end_date or datetime.now().strftime("%Y-%m-%d")

    def _skip(win_end: str) -> bool:
        return should_skip_window(win_end, windows_since)

    if compute_daily:
        for curr in pd.date_range(start=start_date, end=end_date, freq="D"):
            day = curr.strftime("%Y-%m-%d")
            if _skip(day):
                continue
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
            if _skip(week_end):
                continue
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
            if _skip(month_end):
                continue
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


def analytics_mode() -> str:
    """Normalised value of ``ANALYTICS_MODE`` env var.

    Returns one of ``full`` / ``incremental`` / ``finalize``. Unknown / unset
    values default to ``full`` so existing behaviour is preserved when the env
    var is absent.
    """
    raw = (os.environ.get("ANALYTICS_MODE") or "").strip().lower()
    if raw in {"incremental", "finalize", "full"}:
        return raw
    return "full"


def analytics_window_since() -> str | None:
    """ISO date floor for DAILY/WEEKLY/MONTHLY windows, or None for no floor."""
    value = (os.environ.get("ANALYTICS_WINDOW_SINCE") or "").strip()
    return value or None


def _parse_course_ids_env() -> list[str] | None:
    raw = os.environ.get("ANALYTICS_COURSE_IDS")
    if not raw:
        return None
    ids = [cid.strip() for cid in raw.split(",") if cid.strip()]
    return ids or None


def scoped_course_ids(db) -> list[str] | None:
    """Return course ids in scope per env, or ``None`` to mean 'all courses'.

    Precedence:
    - ``ANALYTICS_COURSE_IDS=<csv>`` wins — explicit override for finalize /
      manual runs.
    - ``ANALYTICS_MODE=incremental`` restricts to courses where
      ``analyticsFinalizedAt IS NULL`` (ACTIVE + FINALIZING, but the scanner
      peels off FINALIZING separately).
    - ``ANALYTICS_MODE=full`` or unset returns ``None`` (no filter).
    """
    explicit = _parse_course_ids_env()
    if explicit is not None:
        return explicit

    if analytics_mode() == "incremental":
        courses = db.course.find_many(where={"analyticsFinalizedAt": None})
        return [str(c.id) for c in courses]

    return None
