"""Write-path interception for analytics dry runs."""

from __future__ import annotations

import contextlib
import datetime as dt
import re
import sys
from dataclasses import dataclass, field
from typing import Any, Iterable, Iterator, Mapping, Sequence

from sqlalchemy import text
from sqlalchemy.dialects.postgresql.dml import Insert as PgInsert
from sqlalchemy.orm import Session
from sqlalchemy.sql import Delete, Insert, Update
from sqlalchemy.sql.elements import TextClause

_INSERT_STRIP = re.compile(
    r'INSERT\s+INTO\s+"?(?P<table>\w+)"?\s*(?P<columns>\([^)]*\))?',
    re.IGNORECASE | re.DOTALL,
)
_ON_CONFLICT = re.compile(r"\bON\s+CONFLICT\b", re.IGNORECASE)
_INSERT_ANY = re.compile(r'\bINSERT\s+INTO\s+"?(?P<table>\w+)"?', re.IGNORECASE)
_UPDATE_ANY = re.compile(
    r'(?<!\w)UPDATE\s+"?(?P<table>\w+)"?\s+(?:\w+\s+)?SET\b',
    re.IGNORECASE | re.DOTALL,
)
_DELETE_ANY = re.compile(r'(?<!\w)DELETE\s+FROM\s+"?(?P<table>\w+)"?', re.IGNORECASE)


_STATUS_PRIORITY = {
    "skipped": 0,
    "empty": 1,
    "failed": 2,
    "produced": 3,
}


def _strip_sql_comments(sql: str) -> str:
    return "\n".join(line.split("--", 1)[0] for line in sql.split("\n"))


def _split_identifier_csv(raw: str) -> list[str]:
    text = raw.strip()
    if not text:
        return []
    if text[0] == "(" and text[-1] == ")":
        text = text[1:-1]

    columns: list[str] = []
    current: list[str] = []
    in_quotes = False
    for ch in text:
        if ch == '"':
            in_quotes = not in_quotes
            current.append(ch)
        elif ch == "," and not in_quotes:
            columns.append("".join(current).strip())
            current = []
        else:
            current.append(ch)
    if current:
        columns.append("".join(current).strip())

    parsed: list[str] = []
    for column in columns:
        col = column.strip()
        if not col:
            continue
        if col.startswith('"') and col.endswith('"'):
            parsed.append(col[1:-1])
        else:
            parsed.append(col)
    return parsed


def classify_text(sql: str) -> tuple[str, str | None]:
    cleaned = _strip_sql_comments(sql)
    for pattern, verb in (
        (_INSERT_ANY, "INSERT"),
        (_UPDATE_ANY, "UPDATE"),
        (_DELETE_ANY, "DELETE"),
    ):
        m = pattern.search(cleaned)
        if m:
            return verb, m.group("table")
    return "SELECT", None


def rewrite_insert_to_select(sql: str) -> tuple[str, list[str], str] | None:
    """Return ``(table_name, target_columns, rewritten_sql)`` for INSERT SQL."""

    m = _INSERT_STRIP.search(sql)
    if not m:
        return None

    before = sql[: m.start()]
    after = sql[m.end() :]
    after = _ON_CONFLICT.split(after, maxsplit=1)[0]
    rewritten = (before + after).strip().rstrip(";").rstrip()
    columns = _split_identifier_csv(m.group("columns") or "")
    return m.group("table"), columns, rewritten


def remap_result_rows(target_columns: Sequence[str], rows: Iterable[Any]) -> list[dict[str, Any]]:
    """Map raw row tuples onto target INSERT columns by position."""

    mapped: list[dict[str, Any]] = []
    for row in rows:
        if isinstance(row, Mapping):
            values = list(row.values())
        elif hasattr(row, "_mapping"):
            values = list(row)
        else:
            values = list(row)
        if len(values) != len(target_columns):
            raise ValueError(f"cannot map INSERT result row: expected {len(target_columns)} columns, got {len(values)}")
        mapped.append(dict(zip(target_columns, values, strict=True)))
    return mapped


@dataclass
class CaptureBuffer:
    """Accumulates what the pipeline would have written, keyed by table."""

    rows_by_table: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    columns_by_table: dict[str, list[str]] = field(default_factory=dict)
    table_status: dict[str, str] = field(default_factory=dict)
    table_notes: dict[str, list[str]] = field(default_factory=dict)
    table_scripts: dict[str, list[str]] = field(default_factory=dict)
    skipped_writes: list[dict[str, Any]] = field(default_factory=list)
    scripts: list[dict[str, Any]] = field(default_factory=list)

    def row_count(self, table: str) -> int:
        return len(self.rows_by_table.get(table, []))

    def mark_table(
        self,
        table: str,
        *,
        columns: Sequence[str] | None = None,
        status: str = "empty",
        script: str | None = None,
        note: str | None = None,
    ) -> None:
        if columns:
            existing = self.columns_by_table.get(table, [])
            if not existing:
                self.columns_by_table[table] = list(columns)
            else:
                merged = list(existing)
                for column in columns:
                    if column not in merged:
                        merged.append(column)
                self.columns_by_table[table] = merged

        current = self.table_status.get(table)
        if current is None or _STATUS_PRIORITY[status] >= _STATUS_PRIORITY[current]:
            self.table_status[table] = status

        if script:
            scripts = self.table_scripts.setdefault(table, [])
            if script not in scripts:
                scripts.append(script)

        if note:
            notes = self.table_notes.setdefault(table, [])
            if note not in notes:
                notes.append(note)

    def record(
        self,
        table: str,
        rows: Iterable[Mapping[str, Any]],
        *,
        columns: Sequence[str] | None = None,
        script: str | None = None,
    ) -> int:
        bucket = self.rows_by_table.setdefault(table, [])
        added = 0
        inferred_columns = list(columns or [])
        for row in rows:
            coerced = {k: _coerce_value(v) for k, v in dict(row).items()}
            if not inferred_columns:
                inferred_columns = list(coerced.keys())
            bucket.append(coerced)
            added += 1

        if inferred_columns:
            self.mark_table(
                table,
                columns=inferred_columns,
                status="produced" if added else "empty",
                script=script,
            )
        elif table not in self.table_status:
            self.mark_table(table, status="empty", script=script)

        return added

    def skip(
        self,
        verb: str,
        sql: str,
        params: Any,
        *,
        table: str | None = None,
        note: str | None = None,
    ) -> None:
        self.skipped_writes.append(
            {
                "verb": _truncate(verb, 4000),
                "sql": _truncate(sql, 4000),
                "params": _truncate(repr(params) if params is not None else "", 1000),
                "table": table or "",
                "note": note or "",
            }
        )
        if table:
            self.mark_table(table, status="failed", note=note or verb)

    def record_script(
        self,
        script: str,
        elapsed_s: float,
        rows_written: int | None = None,
        error: str | None = None,
        status: str | None = None,
    ) -> None:
        if status is None:
            if error is None:
                status = "produced"
            elif str(error).startswith("skipped:"):
                status = "skipped"
            else:
                status = "failed"
        self.scripts.append(
            {
                "script": script,
                "elapsed_s": round(elapsed_s, 3),
                "rows_written": rows_written,
                "error": error,
                "status": status,
            }
        )


def _coerce_value(value: Any) -> Any:
    from decimal import Decimal

    if value is None or isinstance(value, (bool, int, float, str, Decimal)):
        return value
    if isinstance(value, dt.datetime):
        if value.tzinfo is not None:
            value = value.astimezone(dt.timezone.utc).replace(tzinfo=None)
        return value
    if isinstance(value, (dt.date, dt.time)):
        return value
    return str(value)


def _truncate(s: str, limit: int) -> str:
    return s if len(s) <= limit else s[: limit - 3] + "..."


class _EmptyResult:
    def __init__(self, rowcount: int = 0) -> None:
        self.rowcount = rowcount

    def __iter__(self) -> Iterator[Any]:
        return iter(())


def _stringify_stmt(stmt: Any) -> str:
    try:
        compiled = stmt.compile(compile_kwargs={"literal_binds": False})
        return str(compiled)
    except Exception:
        return repr(stmt)


@contextlib.contextmanager
def intercept_writes(buffer: CaptureBuffer) -> Iterator[CaptureBuffer]:
    from src import db_helpers
    from src.dryrun import buffer_registry

    original_bulk = db_helpers.bulk_upsert
    original_execute = Session.execute
    original_commit = Session.commit
    original_flush = Session.flush

    buffer_registry.set_active(buffer)

    def capturing_bulk_upsert(
        session: Session,
        Model: Any,
        rows: Any,
        *,
        conflict_cols: Any,
        update_cols: Any = None,
    ) -> int:
        rows_list = list(rows)
        model_table = getattr(Model, "__table__", None)
        model_columns = (
            [column.name for column in model_table.columns]
            if model_table is not None
            else list(rows_list[0].keys())
            if rows_list
            else []
        )
        buffer.mark_table(Model.__tablename__, columns=model_columns, script=Model.__tablename__)
        if not rows_list:
            buffer.mark_table(Model.__tablename__, status="empty")
            return 0
        return buffer.record(
            Model.__tablename__,
            rows_list,
            columns=model_columns,
            script=Model.__tablename__,
        )

    db_helpers.bulk_upsert = capturing_bulk_upsert

    rebound_modules: list[Any] = []
    for module in list(sys.modules.values()):
        if module is None:  # type: ignore[unreachable]
            continue
        if getattr(module, "bulk_upsert", None) is original_bulk:
            setattr(module, "bulk_upsert", capturing_bulk_upsert)
            rebound_modules.append(module)

    def intercepting_execute(
        self: Session,
        statement: Any,
        params: Any = None,
        **kwargs: Any,
    ) -> Any:
        if isinstance(statement, (PgInsert, Insert)):
            buffer.skip("INSERT-CORE", _stringify_stmt(statement), params)
            return _EmptyResult()
        if isinstance(statement, Update):
            buffer.skip("UPDATE-CORE", _stringify_stmt(statement), params)
            return _EmptyResult()
        if isinstance(statement, Delete):
            buffer.skip("DELETE-CORE", _stringify_stmt(statement), params)
            return _EmptyResult()

        if isinstance(statement, TextClause):
            verb, table_name = classify_text(statement.text)
            if verb == "INSERT":
                rewritten = rewrite_insert_to_select(statement.text)
                if rewritten is not None:
                    table_name, target_columns, select_sql = rewritten
                    buffer.mark_table(table_name, columns=target_columns, status="empty")
                    if select_sql:
                        try:
                            result = original_execute(self, text(select_sql), params, **kwargs)
                            if target_columns:
                                captured = remap_result_rows(target_columns, result)
                            else:
                                captured = [dict(row._mapping) for row in result]
                            if captured:
                                buffer.record(
                                    table_name,
                                    captured,
                                    columns=target_columns or captured[0].keys(),
                                )
                            else:
                                buffer.mark_table(
                                    table_name,
                                    columns=target_columns,
                                    status="empty",
                                )
                            return _EmptyResult(rowcount=len(captured))
                        except Exception as exc:
                            rollback = getattr(self, "rollback", None)
                            if callable(rollback):
                                rollback()
                            buffer.skip(
                                f"INSERT-TEXT (rewrite failed: {exc})",
                                statement.text,
                                params,
                                table=table_name,
                                note=str(exc),
                            )
                            return _EmptyResult()
                buffer.skip("INSERT-TEXT", statement.text, params, table=table_name)
                return _EmptyResult()
            if verb in ("UPDATE", "DELETE"):
                buffer.skip(f"{verb}-TEXT", statement.text, params, table=table_name)
                return _EmptyResult()

        return original_execute(self, statement, params, **kwargs)

    def noop_commit(self: Session) -> None:
        return None

    def noop_flush(self: Session, objects: Any = None) -> None:
        return None

    Session.execute = intercepting_execute  # type: ignore[assignment]
    Session.commit = noop_commit  # type: ignore[assignment]
    Session.flush = noop_flush  # type: ignore[assignment]

    try:
        yield buffer
    finally:
        db_helpers.bulk_upsert = original_bulk
        for module in rebound_modules:
            setattr(module, "bulk_upsert", original_bulk)
        Session.execute = original_execute  # type: ignore[assignment]
        Session.commit = original_commit  # type: ignore[assignment]
        Session.flush = original_flush  # type: ignore[assignment]
        buffer_registry.clear_active()
