"""Reusable helpers for SQLAlchemy reads and writes in the analytics pipeline.

- ``bulk_upsert`` collapses per-row ``upsert`` loops to one ``INSERT ... ON
  CONFLICT DO UPDATE`` statement, replacing the 2N+1 round-trip pattern the
  archived prisma-client-py forced on us.
- ``scope_by_course_ids`` applies the ``scoped_course_ids()`` filter to any
  select / update / delete statement without each call site having to
  short-circuit on the empty-scope case.
- ``row_to_dict`` is a small adapter for call sites that still feed SQLAlchemy
  rows into pandas.
"""

from datetime import date, datetime, time, timezone
from typing import Iterable, Mapping, Sequence

from sqlalchemy import Column, inspect
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.orm import DeclarativeBase, Session
from sqlalchemy.sql import Select
from sqlalchemy.sql.elements import ColumnElement


def utcnow() -> datetime:
    """Return the current UTC time using the database's naive timestamp convention."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def bulk_upsert(
    session: Session,
    Model: type[DeclarativeBase],
    rows: Sequence[Mapping[str, object]],
    *,
    conflict_cols: Sequence[str],
    update_cols: Sequence[str] | None = None,
) -> int:
    """Upsert ``rows`` into ``Model`` in a single statement.

    ``conflict_cols`` names the columns that make up the conflict target (a
    unique constraint or primary key). ``update_cols`` are refreshed on
    conflict; if omitted, every non-conflict column in the first row is
    refreshed. Returns the number of affected rows.
    """
    if not rows:
        return 0

    expected_columns = set(rows[0])
    for index, row in enumerate(rows[1:], start=1):
        if set(row) != expected_columns:
            raise ValueError(
                f"bulk_upsert row {index} must have the same columns as row 0"
            )

    stmt = postgres_insert(Model).values(list(rows))
    effective_update_cols = (
        list(update_cols)
        if update_cols is not None
        else [c for c in rows[0].keys() if c not in conflict_cols]
    )
    if not effective_update_cols:
        # No columns to refresh on conflict — degrade to DO NOTHING so we still
        # honour the conflict target rather than erroring.
        stmt = stmt.on_conflict_do_nothing(index_elements=list(conflict_cols))
    else:
        stmt = stmt.on_conflict_do_update(
            index_elements=list(conflict_cols),
            set_={col: stmt.excluded[col] for col in effective_update_cols},
        )
    result = session.execute(stmt)
    return result.rowcount or 0


def coerce_date(value: object) -> date:
    """Normalize ISO strings / datetimes / dates to ``datetime.date``.

    The analytics models map timestamp-like fields such as ``timestamp`` and
    ``computedAt`` to SQL ``DATE`` columns. Passing strings through SQLAlchemy
    leaves them typed as VARCHAR bind params, which breaks on stricter Postgres
    comparisons like ``date = character varying``.
    """
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    return coerce_timestamp(value).date()


def coerce_timestamp(value: object) -> datetime:
    """Normalize date-like inputs to a UTC-naive ``datetime``.

    Accepted inputs include ISO date strings, full ISO timestamps with a
    trailing ``Z``, Python ``date`` / ``datetime`` objects, and Pandas
    ``Timestamp`` values. Timezone-aware inputs are converted to UTC and then
    made naive so analytics comparisons and Excel output use one stable
    convention.
    """
    try:
        import pandas as pd
    except Exception as exc:  # pragma: no cover - pandas is always available here
        raise RuntimeError("pandas is required for timestamp coercion") from exc

    if isinstance(value, pd.Timestamp):
        ts = value
    elif isinstance(value, datetime):
        ts = pd.Timestamp(value)
    elif isinstance(value, date):
        ts = pd.Timestamp(datetime.combine(value, time.min))
    elif isinstance(value, str):
        try:
            ts = pd.Timestamp(value)
        except Exception as exc:
            raise ValueError(f"invalid timestamp string: {value!r}") from exc
    else:
        raise TypeError(
            f"expected ISO date string, timestamp string, date, or datetime; got {type(value)!r}"
        )

    if ts.tzinfo is not None:
        ts = ts.tz_convert(timezone.utc).tz_localize(None)

    return ts.to_pydatetime()


def scope_by_course_ids(
    stmt: Select,
    course_column: Column | ColumnElement,
    scope: list[str] | None,
) -> Select | None:
    """Apply ``scope`` from ``scoped_course_ids`` to a SELECT statement.

    ``None`` means 'all courses' — statement is returned unchanged. An empty
    list means the caller should short-circuit (explicit empty scope matches
    nothing); we return ``None`` to signal that.
    """
    if scope is None:
        return stmt
    if not scope:
        return None
    return stmt.where(course_column.in_(scope))


def row_to_dict(row: object) -> dict:
    """Shallow SQLAlchemy model -> dict for pandas ingestion.

    Mirrors the old ``prisma_model.dict()`` call sites: pulls the mapped
    column values only, skipping relationships (those get expanded explicitly
    by callers that want nested data). Unloaded/deferred columns stay omitted
    so partial ORM loads do not trigger lazy SQL for schema-drifted fields.
    """
    mapper = getattr(row.__class__, "__mapper__", None)
    if mapper is None:
        # ``RowMapping`` from ``session.execute(select(...)).mappings()`` already
        # behaves like a dict — return a plain copy.
        return dict(row)  # type: ignore[arg-type]
    state = inspect(row)
    unloaded = set(state.unloaded)
    return {
        col.key: getattr(row, col.key)
        for col in mapper.column_attrs
        if col.key not in unloaded
    }
