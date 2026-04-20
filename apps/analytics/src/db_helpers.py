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

from typing import Iterable, Mapping, Sequence

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import insert as postgres_insert
from sqlalchemy.orm import DeclarativeBase, Session
from sqlalchemy.sql import Select
from sqlalchemy.sql.elements import ColumnElement


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

    stmt = postgres_insert(Model).values(list(rows))
    effective_update_cols = list(update_cols) if update_cols is not None else [
        c for c in rows[0].keys() if c not in conflict_cols
    ]
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
    by callers that want nested data).
    """
    mapper = getattr(row.__class__, "__mapper__", None)
    if mapper is None:
        # ``RowMapping`` from ``session.execute(select(...)).mappings()`` already
        # behaves like a dict — return a plain copy.
        return dict(row)  # type: ignore[arg-type]
    return {col.key: getattr(row, col.key) for col in mapper.column_attrs}
