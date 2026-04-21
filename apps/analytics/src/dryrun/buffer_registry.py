"""Thin in-process registry that exposes a dryrun ``CaptureBuffer`` to read sites.

The dry-run interceptor captures every write a script would have performed in
``CaptureBuffer.rows_by_table``. But downstream analytics scripts also *read*
from those tables (e.g. script 1 reads ``ParticipantAnalytics`` written by
script 0). Against an unmigrated prod the real tables are absent or stale, so
those reads return nothing and the downstream summaries come out empty.

This module is the narrow bridge: while a dryrun is active, ``set_active`` is
called with the buffer, and a handful of read sites short-circuit through
``get_table`` to consume buffered rows instead of hitting the DB. When inactive
(normal pipeline runs, tests without dryrun), ``get_table`` returns ``None`` and
callers fall back to the existing DB path unchanged.

This is deliberately NOT a generic SQL interception layer. The cross-script
read dependencies are a small, enumerable set of call sites; each of those
sites consults the registry explicitly.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.dryrun.interceptor import CaptureBuffer


_active_buffer: "CaptureBuffer | None" = None


def set_active(buffer: "CaptureBuffer") -> None:
    global _active_buffer
    _active_buffer = buffer


def clear_active() -> None:
    global _active_buffer
    _active_buffer = None


def is_active() -> bool:
    return _active_buffer is not None


def get_table(table_name: str) -> tuple[list[str], list[dict]] | None:
    """Return ``(columns, rows)`` from the active buffer, or ``None``.

    ``None`` means no dryrun is active — callers should fall back to the DB.
    A hit returns the captured column list (in insertion order) plus the
    captured rows as shallow references; callers must not mutate in place.
    """
    buffer = _active_buffer
    if buffer is None:
        return None
    columns = buffer.columns_by_table.get(table_name, [])
    rows = buffer.rows_by_table.get(table_name, [])
    return columns, rows


def filter_rows(
    table_name: str,
    *,
    course_ids: list[str] | None = None,
    type_value: str | None = None,
) -> list[dict] | None:
    """Return buffered rows for ``table_name`` filtered by course / type.

    ``None`` means no dryrun is active — callers should fall back to the DB.
    An empty list means the table is known but has no matching rows. When
    ``course_ids`` is ``None`` no course filter is applied; ``type_value`` is
    compared against ``row["type"]`` when provided.
    """
    buffered = get_table(table_name)
    if buffered is None:
        return None
    _, rows = buffered
    scope = set(course_ids) if course_ids is not None else None
    return [
        row
        for row in rows
        if (type_value is None or row.get("type") == type_value)
        and (scope is None or str(row.get("courseId")) in scope)
    ]
