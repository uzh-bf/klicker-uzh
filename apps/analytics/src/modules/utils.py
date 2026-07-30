"""Shared helpers for the analytics compute modules.

Kept small on purpose — any piece of logic used by more than one module belongs
here instead of being copy-pasted into individual ``compute_*.py`` files.
"""

import os
import uuid
from contextlib import contextmanager
from contextvars import ContextVar
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Callable, Iterator, Literal, cast

import pandas as pd
from sqlalchemy import select
from sqlalchemy.orm import Session

from src.models import Course


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
AnalyticsMode = Literal["full", "incremental", "finalize"]


@dataclass(frozen=True, slots=True)
class AnalyticsRunConfig:
    """Immutable configuration for one analytics task execution."""

    mode: AnalyticsMode
    course_ids: tuple[str, ...] | None = None
    window_since: str | None = None
    chat_analytics_cutoff: str | None = None


class AnalyticsRunCancelled(RuntimeError):
    pass


_ACTIVE_RUN_CONFIG: ContextVar[AnalyticsRunConfig | None] = ContextVar(
    "analytics_run_config",
    default=None,
)
_CANCELLATION_CHECK: ContextVar[Callable[[], bool] | None] = ContextVar(
    "analytics_cancellation_check",
    default=None,
)


@contextmanager
def analytics_run_context(
    config: AnalyticsRunConfig,
    cancellation_check: Callable[[], bool] | None = None,
) -> Iterator[None]:
    """Bind task-local config without mutating process-global environment."""
    config_token = _ACTIVE_RUN_CONFIG.set(config)
    cancellation_token = _CANCELLATION_CHECK.set(cancellation_check)
    try:
        yield
    finally:
        _CANCELLATION_CHECK.reset(cancellation_token)
        _ACTIVE_RUN_CONFIG.reset(config_token)


def analytics_run_cancelled() -> bool:
    check = _CANCELLATION_CHECK.get()
    return check() if check is not None else False


def check_analytics_cancellation() -> None:
    if analytics_run_cancelled():
        raise AnalyticsRunCancelled("analytics task was cancelled")


def analytics_run_config_from_env() -> AnalyticsRunConfig:
    """Adapt the existing CLI environment contract to immutable run input."""
    active = _ACTIVE_RUN_CONFIG.get()
    if active is not None:
        return active
    course_ids = _parse_course_ids_env()
    return AnalyticsRunConfig(
        mode=analytics_mode(),
        course_ids=tuple(course_ids) if course_ids is not None else None,
        window_since=analytics_window_since(),
        chat_analytics_cutoff=(os.environ.get("ANALYTICS_CHAT_CUTOFF") or "").strip() or None,
    )


def exclusive_day_end(day: str) -> str:
    """Return midnight after ``day`` for use with exclusive SQL window ends."""
    next_day = datetime.strptime(day, "%Y-%m-%d") + timedelta(days=1)
    return next_day.strftime("%Y-%m-%dT00:00:00.000Z")


def _parse_window_since(windows_since: str | None) -> pd.Timestamp | None:
    if not windows_since:
        return None
    try:
        parsed = pd.Timestamp(windows_since)
        return parsed if isinstance(parsed, pd.Timestamp) else None
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
    session: Session,
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
    **compute_kwargs,
) -> None:
    """Iterate DAILY / WEEKLY / MONTHLY / COURSE windows and call ``compute_fn``
    for each one with the signature ``(session, win_start, win_end, timestamp,
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
            check_analytics_cancellation()
            day = curr.strftime("%Y-%m-%d")
            if _skip(day):
                continue
            print(f"Computing daily {label} for {day}")
            compute_fn(
                session,
                day + "T00:00:00.000Z",
                exclusive_day_end(day),
                day,
                "DAILY",
                verbose=verbose,
                **compute_kwargs,
            )

    if compute_weekly:
        for curr in pd.date_range(start=start_date, end=end_date, freq="W"):
            check_analytics_cancellation()
            week_end = curr.strftime("%Y-%m-%d")
            if _skip(week_end):
                continue
            win_start = (curr - pd.DateOffset(days=6)).strftime("%Y-%m-%d")
            print(f"Computing weekly {label} for {win_start} to {week_end}")
            compute_fn(
                session,
                win_start + "T00:00:00.000Z",
                exclusive_day_end(week_end),
                week_end,
                "WEEKLY",
                verbose=verbose,
                **compute_kwargs,
            )

    if compute_monthly:
        for curr in pd.date_range(start=start_date, end=end_date, freq="ME"):
            check_analytics_cancellation()
            month_end = curr.strftime("%Y-%m-%d")
            if _skip(month_end):
                continue
            win_start = (curr - pd.offsets.MonthBegin(1)).strftime("%Y-%m-%d")
            print(f"Computing monthly {label} for {win_start} to {month_end}")
            compute_fn(
                session,
                win_start + "T00:00:00.000Z",
                exclusive_day_end(month_end),
                month_end,
                "MONTHLY",
                verbose=verbose,
                **compute_kwargs,
            )

    if compute_course:
        check_analytics_cancellation()
        print(f"Computing course-wide {label} for {start_date} to {end_date}")
        compute_fn(
            session,
            start_date + "T00:00:00.000Z",
            exclusive_day_end(end_date),
            COURSE_TIMESTAMP,
            "COURSE",
            verbose=verbose,
            **compute_kwargs,
        )


def analytics_mode() -> AnalyticsMode:
    """Normalised value of ``ANALYTICS_MODE`` env var.

    Returns one of ``full`` / ``incremental`` / ``finalize``. Unknown / unset
    values default to ``full`` so existing behaviour is preserved when the env
    var is absent.
    """
    active = _ACTIVE_RUN_CONFIG.get()
    if active is not None:
        return active.mode

    raw = (os.environ.get("ANALYTICS_MODE") or "").strip().lower()
    if raw in {"incremental", "finalize", "full"}:
        return cast(AnalyticsMode, raw)
    return "full"


def analytics_window_since() -> str | None:
    """ISO date floor for DAILY/WEEKLY/MONTHLY windows, or None for no floor."""
    active = _ACTIVE_RUN_CONFIG.get()
    if active is not None:
        return active.window_since

    value = (os.environ.get("ANALYTICS_WINDOW_SINCE") or "").strip()
    return value or None


def _parse_course_ids_env() -> list[str] | None:
    raw = os.environ.get("ANALYTICS_COURSE_IDS")
    if not raw:
        return None
    ids = [cid.strip() for cid in raw.split(",") if cid.strip()]
    return ids or None


def scoped_course_ids(
    session: Session,
    config: AnalyticsRunConfig | None = None,
) -> list[str] | None:
    """Return course ids in scope, or ``None`` to mean "all courses".

    Precedence:
    - An explicit immutable ``config`` wins and never consults task-time env.
    - Without ``config``, ``ANALYTICS_COURSE_IDS=<csv>`` supplies explicit
      scope for CLI compatibility.
    - Incremental mode restricts to courses where
      ``analyticsFinalizedAt IS NULL`` (ACTIVE + FINALIZING, but the scanner
      peels off FINALIZING separately).
    - Full or finalize mode without explicit ids returns ``None`` (no filter).
    """
    config = config or _ACTIVE_RUN_CONFIG.get()
    if config is not None:
        explicit = list(config.course_ids) if config.course_ids is not None else None
    else:
        explicit = _parse_course_ids_env()
    if explicit is not None:
        return explicit

    mode = config.mode if config is not None else analytics_mode()
    if mode == "incremental":
        rows = session.execute(select(Course.id).where(Course.analyticsFinalizedAt.is_(None))).scalars().all()
        return [str(cid) for cid in rows]

    return None


def apply_course_scope(
    scope: list[str] | None,
    stmt,
    course_column,
):
    """Apply ``scoped_course_ids`` to a SQLAlchemy SELECT.

    - scope is ``None``            → return ``stmt`` unchanged (no filter).
    - scope is an empty list       → return ``None`` — caller should short-circuit.
    - scope is a non-empty list    → return ``stmt.where(course_column IN scope)``.
    """
    if scope is None:
        return stmt
    if not scope:
        return None
    return stmt.where(course_column.in_(scope))
