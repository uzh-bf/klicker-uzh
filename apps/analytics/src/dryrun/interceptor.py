"""Write-path interceptors and workbook writer for analytics dry runs."""

from __future__ import annotations

import contextlib
import datetime as dt
import json
import math
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
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

_DOMAIN_TABLES: dict[str, tuple[str, ...]] = {
    "Activity": (
        "ParticipantAnalytics",
        "AggregatedAnalytics",
        "ParticipantCourseAnalytics",
        "AggregatedCourseAnalytics",
    ),
    "Performance": (
        "ParticipantPerformance",
        "ActivityProgress",
        "ActivityPerformance",
        "InstancePerformance",
        "ParticipantActivityPerformance",
    ),
    "Chat": (
        "ParticipantChatAnalytics",
        "AggregatedChatbotAnalytics",
        "ChatTopicCluster",
        "ParticipantChatOutcome",
    ),
    "Live Quiz": (
        "ParticipantLiveQuizAnalytics",
        "AggregatedLiveQuizAnalytics",
    ),
    "Platform": ("PlatformSemesterAnalytics",),
}

_STATUS_PRIORITY = {
    "skipped": 0,
    "empty": 1,
    "failed": 2,
    "produced": 3,
}

_HIDDEN_METADATA_KEYS = {"lookups", "script_domains", "omitted_domain_notes"}


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


def remap_result_rows(
    target_columns: Sequence[str], rows: Iterable[Any]
) -> list[dict[str, Any]]:
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
            raise ValueError(
                f"cannot map INSERT result row: expected {len(target_columns)} "
                f"columns, got {len(values)}"
            )
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
        buffer.mark_table(
            Model.__tablename__, columns=model_columns, script=Model.__tablename__
        )
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
                    buffer.mark_table(
                        table_name, columns=target_columns, status="empty"
                    )
                    if select_sql:
                        try:
                            result = original_execute(
                                self, text(select_sql), params, **kwargs
                            )
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


def _safe_sheet(name: str, used_names: set[str]) -> str:
    truncated = name[:31] or "sheet"
    if truncated not in used_names:
        used_names.add(truncated)
        return truncated
    stem = truncated[:28]
    for i in range(1, 1000):
        candidate = f"{stem}_{i}"
        if candidate not in used_names:
            used_names.add(candidate)
            return candidate
    raise RuntimeError(f"cannot build unique sheet name for {name!r}")


def _load_analytics_reference() -> dict[str, dict[str, str]]:
    path = Path(__file__).resolve().parents[1] / "ANALYTICS.md"
    if not path.exists():
        return {}

    content = path.read_text(encoding="utf-8")
    sections = re.split(r"^### `([^`]+)`", content, flags=re.MULTILINE)
    if len(sections) <= 1:
        return {}

    refs: dict[str, dict[str, str]] = {}
    for idx in range(1, len(sections), 2):
        table = sections[idx]
        body = sections[idx + 1]
        grain_match = re.search(r"- \*\*Grain\*\*: (.+)", body)
        source_match = re.search(r"- \*\*(Source|Reads from)\*\*: (.+)", body)
        refs[table] = {
            "grain": grain_match.group(1).strip() if grain_match else "",
            "source": source_match.group(2).strip() if source_match else "",
        }
    return refs


def _table_df(buffer: CaptureBuffer, table: str):
    import pandas as pd

    rows = buffer.rows_by_table.get(table, [])
    columns = buffer.columns_by_table.get(table, [])
    if rows:
        df = pd.DataFrame(rows)
        if columns:
            ordered = list(columns) + [c for c in df.columns if c not in columns]
            df = df.reindex(columns=ordered)
        return df
    return pd.DataFrame(columns=columns)


def _value_preview(value: Any) -> str:
    value = _excel_safe_value(value)
    if value is None:
        return ""
    if isinstance(value, dt.datetime):
        return value.isoformat(sep=" ")
    if isinstance(value, dt.date):
        return value.isoformat()
    if isinstance(value, float):
        return f"{value:.2f}"
    return str(value)


def _excel_safe_value(value: Any) -> Any:
    if value is None:
        return None

    if hasattr(value, "item") and not isinstance(
        value, (str, bytes, dt.datetime, dt.date, dt.time)
    ):
        try:
            value = value.item()
        except Exception:
            pass

    try:
        import pandas as pd

        if pd.isna(value):
            return None
    except Exception:
        pass

    try:
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            if not math.isfinite(float(value)):
                return None
    except (TypeError, ValueError, OverflowError):
        pass

    return value


def _column_width(series, header: str) -> int:
    width = len(header)
    sample = series.head(50) if hasattr(series, "head") else []
    for value in sample:
        width = max(width, len(_value_preview(value)))
    return max(10, min(width + 2, 60))


def _is_control_note(note: str) -> bool:
    stripped = note.strip()
    if not stripped:
        return False
    if re.match(r"^(INSERT|UPDATE|DELETE)-(TEXT|CORE)\b", stripped):
        return True
    if stripped.startswith("(psycopg.errors."):
        return True
    return False


def _visible_table_notes(notes: Sequence[str]) -> list[str]:
    return [note for note in notes if not _is_control_note(note)]


def _normalized_diagnostic_verb(verb: str) -> str:
    if verb.startswith("INSERT-TEXT (rewrite failed:"):
        return "INSERT-TEXT (rewrite failed)"
    return verb


def _normalized_diagnostic_note(note: str) -> str:
    if not note:
        return ""
    first_line = note.split("[SQL:", 1)[0].splitlines()[0].strip()
    return _truncate(first_line, 200)


def _diagnostics_rows(
    skipped_writes: Sequence[Mapping[str, Any]],
) -> list[dict[str, str | int]]:
    grouped: dict[tuple[str, str, str, str], dict[str, str | int]] = {}
    for entry in skipped_writes:
        verb = _normalized_diagnostic_verb(str(entry.get("verb", "")))
        table = str(entry.get("table", ""))
        note = _normalized_diagnostic_note(str(entry.get("note", "")))
        sql_excerpt = _truncate(str(entry.get("sql", "")), 240)
        key = (verb, table, note, sql_excerpt)
        if key not in grouped:
            grouped[key] = {
                "count": 1,
                "verb": verb,
                "table": table,
                "note": note,
                "sql_excerpt": sql_excerpt,
            }
        else:
            grouped[key]["count"] = int(grouped[key]["count"]) + 1

    if not grouped:
        return [
            {
                "count": 0,
                "verb": "none",
                "table": "",
                "note": "No skipped writes were captured.",
                "sql_excerpt": "",
            }
        ]

    return sorted(
        grouped.values(),
        key=lambda row: (-int(row["count"]), str(row["table"]), str(row["verb"])),
    )


def _format_name_for_column(column: str) -> str:
    lowered = column.lower()
    if lowered in {"timestamp", "day", "weekending", "semesterstart", "computedat"}:
        return "date"
    if "date" in lowered and "update" not in lowered:
        return "date"
    if lowered.endswith("at") or lowered.endswith("_at"):
        return "datetime"
    if "rate" in lowered or lowered.endswith("pct") or lowered.endswith("percent"):
        return "percent"
    if (
        lowered.endswith("count")
        or lowered.startswith("total")
        or lowered.startswith("num")
    ):
        return "int"
    return "default"


def _domain_table_status(
    buffer: CaptureBuffer, tables: Sequence[str]
) -> tuple[str, str]:
    statuses = [
        buffer.table_status.get(table)
        for table in tables
        if table in buffer.table_status
    ]
    if not statuses:
        return "skipped", "No captured or empty output tables for this domain."
    if any(status == "produced" for status in statuses):
        return "produced", "At least one table in this domain contains captured rows."
    if any(status == "failed" for status in statuses):
        return "failed", "One or more write captures in this domain failed."
    if any(status == "empty" for status in statuses):
        return (
            "empty",
            "Scripts ran, but this domain produced zero rows for the selected scope.",
        )
    return "skipped", "This domain was skipped on the target DB."


def _omitted_domain_notes(metadata: Mapping[str, Any]) -> dict[str, str]:
    raw = metadata.get("omitted_domain_notes")
    if isinstance(raw, Mapping):
        return {str(key): str(value) for key, value in raw.items()}
    raw = metadata.get("omitted_domains")
    if isinstance(raw, Mapping):
        return {str(key): str(value) for key, value in raw.items()}
    return {}


def _table_domain(table: str) -> str | None:
    for domain, tables in _DOMAIN_TABLES.items():
        if table in tables:
            return domain
    return None


def _table_row_positions(
    *,
    start_row: int,
    title: str | None = None,
    subtitle: str | None = None,
) -> tuple[int, int]:
    header_row = start_row + int(bool(title)) + int(bool(subtitle))
    first_data_row = header_row + 1
    return header_row, first_data_row


def _write_data_cell(
    worksheet,
    row: int,
    col: int,
    value: Any,
    column: str,
    formats: Mapping[str, Any],
) -> None:
    safe_value = _excel_safe_value(value)
    worksheet.write(
        row,
        col,
        safe_value,
        formats[_format_name_for_column(column)],
    )


def _visible_metadata_rows(metadata: Mapping[str, Any]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for key, value in metadata.items():
        if key in _HIDDEN_METADATA_KEYS:
            continue
        if value is None:
            display = ""
        elif isinstance(value, Mapping):
            display = ", ".join(f"{k}={v}" for k, v in value.items())
        else:
            display = str(value)
        rows.append({"key": key, "value": display})
    return rows


def _participant_labels(values: Sequence[Any]) -> dict[Any, str]:
    labels: dict[Any, str] = {}
    for idx, participant_id in enumerate(
        sorted({value for value in values if value is not None}), start=1
    ):
        labels[participant_id] = f"Student {idx}"
    return labels


def _with_lookup(df, column: str, lookup: Mapping[Any, str], new_column: str):
    if column in df.columns:
        df[new_column] = df[column].map(lookup).fillna(df[column].astype(str))
    return df


def _script_status(buffer: CaptureBuffer, script: str) -> str | None:
    for entry in buffer.scripts:
        if entry.get("script") == script:
            return str(entry.get("status")) if entry.get("status") is not None else None
    return None


def _participant_activity_all_zero(participants) -> bool:
    if participants.empty:
        return False

    relevant = [
        column
        for column in (
            "activeWeeks",
            "activeDaysPerWeek",
            "meanElementsPerDay",
        )
        if column in participants.columns
    ]
    if not relevant:
        return False

    numeric = participants[relevant].fillna(0)
    return bool((numeric == 0).all().all())


def _activity_degradation_reasons(
    buffer: CaptureBuffer, aggregated, participants
) -> list[str]:
    reasons: list[str] = []
    script0 = _script_status(buffer, "src.scripts.0_initial_participant_analytics")
    script1 = _script_status(buffer, "src.scripts.1_initial_aggregated_analytics")

    if script0 == "failed":
        reasons.append("Participant analytics script failed in this run.")
    if script1 == "failed":
        reasons.append("Aggregated activity script failed in this run.")

    daily_windows = 0
    weekly_windows = 0
    if not aggregated.empty and "type" in aggregated.columns:
        daily_windows = int((aggregated["type"] == "DAILY").sum())
        weekly_windows = int((aggregated["type"] == "WEEKLY").sum())

    if daily_windows == 0:
        reasons.append("No DAILY aggregated activity windows were captured.")
    if weekly_windows == 0:
        reasons.append("No WEEKLY aggregated activity windows were captured.")
    if _participant_activity_all_zero(participants):
        reasons.append(
            "Participant activity metrics are all zero in the captured course table."
        )

    return reasons


def _section_is_placeholder(section: tuple[str, str, Any, dict[str, Any]]) -> bool:
    return bool(section[3].get("placeholder"))


def _has_visible_summary_content(
    sections: Sequence[tuple[str, str, Any, dict[str, Any]]],
) -> bool:
    return any(not _section_is_placeholder(section) for section in sections)


def _json_compact(value: Any) -> str:
    if value is None or value == "":
        return ""
    if isinstance(value, str):
        return _truncate(value, 120)
    try:
        return _truncate(json.dumps(value, sort_keys=True), 120)
    except Exception:
        return _truncate(str(value), 120)


def _activity_sections(buffer: CaptureBuffer, metadata: Mapping[str, Any]):
    sections: list[tuple[str, str, Any, dict[str, Any]]] = []
    lookups = metadata.get("lookups", {})
    course_name = lookups.get("course_name", metadata.get("course_id", "course"))
    aggregated = _table_df(buffer, "AggregatedAnalytics")
    course = _table_df(buffer, "AggregatedCourseAnalytics")
    participants = _table_df(buffer, "ParticipantCourseAnalytics")

    if aggregated.empty and course.empty and participants.empty:
        sections.append(
            (
                "Activity Overview",
                "Course activity summaries could not be generated for this run.",
                None,
                {"placeholder": True},
            )
        )
        return sections

    total_participants = 0
    if not course.empty and "courseParticipantCount" in course.columns:
        total_participants = int(course["courseParticipantCount"].fillna(0).iloc[-1])
    elif not participants.empty:
        total_participants = len(participants)

    kpis = [
        {"metric": "Course", "value": course_name},
        {
            "metric": "Captured participants",
            "value": total_participants or len(participants),
        },
        {
            "metric": "Daily windows",
            "value": int((aggregated.get("type") == "DAILY").sum())
            if "type" in aggregated.columns
            else 0,
        },
        {
            "metric": "Weekly windows",
            "value": int((aggregated.get("type") == "WEEKLY").sum())
            if "type" in aggregated.columns
            else 0,
        },
    ]
    sections.append(("Key Metrics", "", kpis, {}))

    degradation_reasons = _activity_degradation_reasons(
        buffer, aggregated, participants
    )
    if degradation_reasons:
        sections.append(
            (
                "Activity Data Warning",
                "This run did not capture a trustworthy activity dashboard view, so participant-level activity sections are suppressed.",
                [{"reason": reason} for reason in degradation_reasons],
                {"degraded": True},
            )
        )
        return sections

    if not aggregated.empty and "type" in aggregated.columns:
        weekly = aggregated.loc[aggregated["type"] == "WEEKLY"].copy()
        if not weekly.empty:
            weekly = weekly[["timestamp", "participantCount"]].rename(
                columns={
                    "timestamp": "weekEnding",
                    "participantCount": "activeParticipants",
                }
            )
            if total_participants:
                weekly["activeRate"] = weekly["activeParticipants"] / total_participants
            sections.append(
                (
                    "Weekly Activity",
                    "Mirrors the lecturer dashboard's weekly active-participant view.",
                    weekly,
                    {"chart": "line", "x": "weekEnding", "y": "activeParticipants"},
                )
            )

        daily = aggregated.loc[aggregated["type"] == "DAILY"].copy()
        if not daily.empty:
            daily = daily[["timestamp", "participantCount"]].rename(
                columns={
                    "timestamp": "day",
                    "participantCount": "activeParticipants",
                }
            )
            if total_participants:
                daily["activeRate"] = daily["activeParticipants"] / total_participants
            sections.append(
                (
                    "Daily Activity",
                    "Daily activity trend for the selected course scope.",
                    daily,
                    {"chart": "line", "x": "day", "y": "activeParticipants"},
                )
            )

    if not course.empty:
        row = course.iloc[-1]
        weekday = [
            ("Monday", row.get("activityMonday", 0)),
            ("Tuesday", row.get("activityTuesday", 0)),
            ("Wednesday", row.get("activityWednesday", 0)),
            ("Thursday", row.get("activityThursday", 0)),
            ("Friday", row.get("activityFriday", 0)),
            ("Saturday", row.get("activitySaturday", 0)),
            ("Sunday", row.get("activitySunday", 0)),
        ]
        weekday_rows = []
        for name, value in weekday:
            item = {"weekday": name, "avgActiveParticipants": value}
            if total_participants:
                item["shareOfCourse"] = float(value) / total_participants
            weekday_rows.append(item)
        sections.append(
            (
                "Weekday Distribution",
                "Equivalent to the dashboard's average weekday activity distribution.",
                weekday_rows,
                {"chart": "column", "x": "weekday", "y": "avgActiveParticipants"},
            )
        )

    if not participants.empty:
        histogram = (
            participants.groupby("activeWeeks", dropna=False)
            .size()
            .reset_index(name="studentCount")
            .sort_values("activeWeeks")
        )
        sections.append(
            (
                "Participant Activity Histogram",
                "Matches the dashboard's active-weeks histogram at course level.",
                histogram,
                {"chart": "column", "x": "activeWeeks", "y": "studentCount"},
            )
        )

        labels = _participant_labels(participants.get("participantId", []))
        participant_table = participants.copy()
        if "participantId" in participant_table.columns:
            participant_table["student"] = participant_table["participantId"].map(
                labels
            )
        keep = [
            column
            for column in (
                "student",
                "activeWeeks",
                "activeDaysPerWeek",
                "meanElementsPerDay",
                "activityLevel",
                "hasChatActivity",
            )
            if column in participant_table.columns
        ]
        sections.append(
            (
                "Participant Activity Table",
                "Pseudonymised participant-level activity metrics from ParticipantCourseAnalytics.",
                participant_table[keep],
                {},
            )
        )

    return sections


def _performance_sections(buffer: CaptureBuffer, metadata: Mapping[str, Any]):
    sections: list[tuple[str, str, Any, dict[str, Any]]] = []
    lookups = metadata.get("lookups", {})
    participants = _table_df(buffer, "ParticipantPerformance")
    progress = _table_df(buffer, "ActivityProgress")
    activities = _table_df(buffer, "ActivityPerformance")
    instances = _table_df(buffer, "InstancePerformance")

    if participants.empty and progress.empty and activities.empty and instances.empty:
        sections.append(
            (
                "Performance Overview",
                "Course performance summaries could not be generated for this run.",
                None,
                {"placeholder": True},
            )
        )
        return sections

    if not participants.empty:
        histogram = participants.copy()
        if "totalErrorRate" in histogram.columns:
            histogram["errorRateBucket"] = (
                (histogram["totalErrorRate"] * 100).round().clip(0, 100)
            )
            histogram = (
                histogram.groupby("errorRateBucket", dropna=False)
                .size()
                .reset_index(name="studentCount")
                .sort_values("errorRateBucket")
            )
            sections.append(
                (
                    "Participant Performance Histogram",
                    "Matches the dashboard's total-error-rate distribution.",
                    histogram,
                    {"chart": "column", "x": "errorRateBucket", "y": "studentCount"},
                )
            )

        labels = _participant_labels(participants.get("participantId", []))
        participant_table = participants.copy()
        if "participantId" in participant_table.columns:
            participant_table["student"] = participant_table["participantId"].map(
                labels
            )
        keep = [
            column
            for column in (
                "student",
                "totalErrorRate",
                "firstErrorRate",
                "lastErrorRate",
                "totalPerformance",
            )
            if column in participant_table.columns
        ]
        sections.append(
            (
                "Participant Performance Table",
                "Pseudonymised participant-level performance metrics.",
                participant_table[keep],
                {},
            )
        )

    activity_lookup = {
        **lookups.get("practice_quizzes", {}),
        **lookups.get("microlearnings", {}),
    }

    if not progress.empty:
        progress = progress.copy()
        if "practiceQuizId" in progress.columns:
            progress["activityId"] = progress["practiceQuizId"]
        elif "microLearningId" in progress.columns:
            progress["activityId"] = progress["microLearningId"]
        else:
            progress["activityId"] = ""
        progress["activityName"] = (
            progress["activityId"]
            .map(activity_lookup)
            .fillna(progress["activityId"].astype(str))
        )
        sections.append(
            (
                "Activity Progress",
                "Started/completed/repeated counts per activity, similar to the dashboard's progress tab.",
                progress[
                    [
                        column
                        for column in (
                            "activityName",
                            "startedCount",
                            "completedCount",
                            "repeatedCount",
                        )
                        if column in progress.columns
                    ]
                ],
                {},
            )
        )

    if not activities.empty:
        activities = activities.copy()
        if "practiceQuizId" in activities.columns:
            activities["activityId"] = activities["practiceQuizId"]
        elif "microLearningId" in activities.columns:
            activities["activityId"] = activities["microLearningId"]
        else:
            activities["activityId"] = ""
        activities["activityName"] = (
            activities["activityId"]
            .map(activity_lookup)
            .fillna(activities["activityId"].astype(str))
        )
        sections.append(
            (
                "Activity Performance",
                "Activity-level correctness/error rates from ActivityPerformance.",
                activities[
                    [
                        column
                        for column in (
                            "activityName",
                            "totalErrorRate",
                            "totalPartialRate",
                            "totalCorrectRate",
                            "averageTimeSpent",
                        )
                        if column in activities.columns
                    ]
                ],
                {},
            )
        )

    if not instances.empty:
        instances = instances.copy()
        instances["instanceName"] = (
            instances.get("instanceId", "")
            .map(lookups.get("element_instances", {}))
            .fillna(
                instances.get("instanceId", "").astype(str)
                if "instanceId" in instances.columns
                else ""
            )
        )
        sections.append(
            (
                "Instance Performance",
                "Element-instance level performance rows, mirroring the quiz detail dashboard.",
                instances[
                    [
                        column
                        for column in (
                            "instanceName",
                            "responseCount",
                            "totalErrorRate",
                            "totalPartialRate",
                            "totalCorrectRate",
                            "averageTimeSpent",
                        )
                        if column in instances.columns
                    ]
                ],
                {},
            )
        )

    return sections


def _chat_sections(buffer: CaptureBuffer, metadata: Mapping[str, Any]):
    sections: list[tuple[str, str, Any, dict[str, Any]]] = []
    lookups = metadata.get("lookups", {})
    aggregated = _table_df(buffer, "AggregatedChatbotAnalytics")
    topics = _table_df(buffer, "ChatTopicCluster")
    outcomes = _table_df(buffer, "ParticipantChatOutcome")

    if aggregated.empty and topics.empty and outcomes.empty:
        sections.append(
            (
                "Chat Overview",
                "Chat analytics are unavailable in this workbook.",
                None,
                {"placeholder": True},
            )
        )
        return sections

    chatbot_lookup = lookups.get("chatbots", {})
    course_lookup = lookups.get("courses", {})

    if not aggregated.empty:
        aggregated = aggregated.copy()
        aggregated = _with_lookup(
            aggregated, "chatbotId", chatbot_lookup, "chatbotName"
        )
        aggregated = _with_lookup(aggregated, "courseId", course_lookup, "courseName")
        keep = [
            column
            for column in (
                "type",
                "timestamp",
                "chatbotName",
                "courseName",
                "activeParticipants",
                "newParticipants",
                "returningParticipants",
                "threads",
                "userMessages",
                "assistantMessages",
                "creditExhaustionRate",
            )
            if column in aggregated.columns
        ]
        sections.append(
            (
                "Chatbot KPI Rollup",
                "High-level chatbot adoption and message volume rollup.",
                aggregated[keep],
                {},
            )
        )

        if {"timestamp", "userMessages"}.issubset(aggregated.columns):
            daily = (
                aggregated.loc[
                    aggregated["type"] == "DAILY", ["timestamp", "userMessages"]
                ]
                .groupby("timestamp", as_index=False)
                .sum()
                .rename(columns={"timestamp": "day"})
            )
            if not daily.empty:
                sections.append(
                    (
                        "Daily Chat Messages",
                        "Daily user-message volume across captured chatbots.",
                        daily,
                        {"chart": "line", "x": "day", "y": "userMessages"},
                    )
                )

    if not topics.empty:
        topics = topics.copy()
        topics = _with_lookup(topics, "chatbotId", chatbot_lookup, "chatbotName")
        topic_title = "Topic Clusters"
        topic_subtitle = "NLP-derived cluster rollup for captured chatbots."
        if len(topics) == 1:
            topic_title = "Retained Topic Cluster"
            row = topics.iloc[0]
            topic_subtitle = (
                "Single retained cluster after privacy/noise collapse: "
                f"{int(row.get('messageCount', 0) or 0)} messages from "
                f"{int(row.get('participantCount', 0) or 0)} participants."
            )
        topic_columns = [
            column
            for column in (
                "chatbotName",
                "clusterLabel",
                "messageCount",
                "participantCount",
            )
            if column in topics.columns
        ]
        topic_options: dict[str, Any] = {}
        if (
            "messageCount" in topic_columns
            and "clusterLabel" in topic_columns
            and len(topics) > 1
        ):
            topic_options = {
                "chart": "bar",
                "x": "clusterLabel",
                "y": "messageCount",
                "top_n": 10,
                "sort_by": "messageCount",
            }
        sections.append(
            (
                topic_title,
                topic_subtitle,
                topics[topic_columns],
                topic_options,
            )
        )

    if not outcomes.empty:
        labels = _participant_labels(outcomes.get("participantId", []))
        outcomes = outcomes.copy()
        if "participantId" in outcomes.columns:
            outcomes["student"] = outcomes["participantId"].map(labels)
        sections.append(
            (
                "Chat Outcomes",
                "Participant-level chat dose versus outcome summary.",
                outcomes[
                    [
                        column
                        for column in (
                            "student",
                            "chatMessagesInCourse",
                            "chatDoseBucket",
                            "firstErrorRate",
                            "lastErrorRate",
                            "errorRateDelta",
                            "hasBothModalities",
                        )
                        if column in outcomes.columns
                    ]
                ],
                {},
            )
        )

    return sections


def _live_quiz_sections(buffer: CaptureBuffer, metadata: Mapping[str, Any]):
    sections: list[tuple[str, str, Any, dict[str, Any]]] = []
    lookups = metadata.get("lookups", {})
    participants = _table_df(buffer, "ParticipantLiveQuizAnalytics")
    aggregated = _table_df(buffer, "AggregatedLiveQuizAnalytics")

    if participants.empty and aggregated.empty:
        sections.append(
            (
                "Live Quiz Overview",
                "No assessment-mode live quiz analytics were captured for this run.",
                None,
                {"placeholder": True},
            )
        )
        return sections

    quiz_lookup = lookups.get("live_quizzes", {})

    if not aggregated.empty:
        aggregated = aggregated.copy()
        aggregated = _with_lookup(aggregated, "liveQuizId", quiz_lookup, "liveQuizName")
        quiz_columns = [
            column
            for column in (
                "liveQuizName",
                "participantCount",
                "responseCount",
                "meanFirstCorrectness",
                "meanLastCorrectness",
                "lateSubmitterRate",
            )
            if column in aggregated.columns
        ]
        quiz_options: dict[str, Any] = {}
        if "liveQuizName" in quiz_columns and "participantCount" in quiz_columns:
            quiz_options = {
                "chart": "column",
                "x": "liveQuizName",
                "y": "participantCount",
            }
        sections.append(
            (
                "Aggregated Live Quiz Metrics",
                "Live quiz rollup at quiz level — participation and mean correctness per quiz.",
                aggregated[quiz_columns],
                quiz_options,
            )
        )

    if not participants.empty:
        labels = _participant_labels(participants.get("participantId", []))
        participants = participants.copy()
        participants = _with_lookup(
            participants, "liveQuizId", quiz_lookup, "liveQuizName"
        )
        if "participantId" in participants.columns:
            participants["student"] = participants["participantId"].map(labels)
        sections.append(
            (
                "Participant Live Quiz Metrics",
                "Pseudonymised participant-level live quiz performance.",
                participants[
                    [
                        column
                        for column in (
                            "student",
                            "liveQuizName",
                            "totalResponses",
                            "firstCorrectCount",
                            "lastCorrectCount",
                            "averageTimeSpent",
                            "totalBasePoints",
                            "totalCorrectnessPoints",
                            "totalBonusPoints",
                        )
                        if column in participants.columns
                    ]
                ],
                {},
            )
        )

    return sections


def _platform_sections(buffer: CaptureBuffer, metadata: Mapping[str, Any]):
    sections: list[tuple[str, str, Any, dict[str, Any]]] = []
    platform = _table_df(buffer, "PlatformSemesterAnalytics")
    if platform.empty:
        sections.append(
            (
                "Platform Overview",
                "Platform semester analytics were not captured in this run.",
                None,
                {"placeholder": True},
            )
        )
        return sections

    if "semesterStart" in platform.columns:
        platform = platform.sort_values("semesterStart", ascending=False).reset_index(
            drop=True
        )

    sections.append(
        (
            "Semester Rollup",
            "Compact semester-level platform metrics.",
            platform,
            {"chart": "column", "x": "semesterLabel", "y": "quizDistinctParticipants"},
        )
    )
    return sections


def _write_table(
    workbook,
    worksheet,
    df,
    *,
    start_row: int,
    title: str | None = None,
    subtitle: str | None = None,
    formats: Mapping[str, Any],
    table_name: str,
    autofit: bool = True,
):
    import pandas as pd

    row = start_row
    if title:
        worksheet.write(row, 0, title, formats["section_title"])
        row += 1
    if subtitle:
        worksheet.write(row, 0, subtitle, formats["section_subtitle"])
        row += 1

    if df is None:
        worksheet.write(row, 0, "Unavailable for this run.", formats["note"])
        return row + 2

    if not isinstance(df, pd.DataFrame):
        df = pd.DataFrame(df)

    if df.empty and len(df.columns) == 0:
        worksheet.write(row, 0, "Unavailable for this run.", formats["note"])
        return row + 2

    data_row = row
    for col_idx, column in enumerate(df.columns):
        worksheet.write(data_row, col_idx, column, formats["header"])

    if not df.empty:
        for rel_row, (_, series_row) in enumerate(df.iterrows(), start=1):
            for col_idx, column in enumerate(df.columns):
                _write_data_cell(
                    worksheet,
                    data_row + rel_row,
                    col_idx,
                    series_row[column],
                    column,
                    formats,
                )
    else:
        worksheet.write(
            data_row + 1,
            0,
            "No rows captured for this table in the selected dry run.",
            formats["note"],
        )

    last_row = data_row + max(len(df), 1)
    last_col = max(len(df.columns) - 1, 0)
    worksheet.add_table(
        data_row,
        0,
        last_row,
        last_col,
        {
            "name": table_name[:255],
            "style": "Table Style Medium 2",
            "columns": [{"header": column} for column in df.columns],
            "autofilter": True,
            "banded_rows": True,
        },
    )

    if autofit:
        for col_idx, column in enumerate(df.columns):
            worksheet.set_column(
                col_idx,
                col_idx,
                _column_width(df[column] if column in df else [], column),
                formats[_format_name_for_column(column)],
            )

    return last_row + 3


def _add_chart(
    workbook,
    worksheet,
    *,
    chart_type: str,
    x_col: int,
    y_col: int,
    first_row: int,
    last_row: int,
    title: str,
    position: str,
):
    if last_row <= first_row:
        return
    chart = workbook.add_chart({"type": chart_type})
    chart.add_series(
        {
            "categories": [worksheet.name, first_row, x_col, last_row, x_col],
            "values": [worksheet.name, first_row, y_col, last_row, y_col],
            "name": title,
        }
    )
    chart.set_title({"name": title})
    chart.set_legend({"none": True})
    chart.set_size({"width": 520, "height": 280})
    worksheet.insert_chart(position, chart)


def _summary_sheet(
    workbook,
    worksheet,
    *,
    title: str,
    intro: str,
    sections: Sequence[tuple[str, str, Any, dict[str, Any]]],
    formats: Mapping[str, Any],
):
    import pandas as pd

    worksheet.write(0, 0, title, formats["title"])
    worksheet.write(1, 0, intro, formats["subtitle"])
    worksheet.freeze_panes(2, 0)
    row = 3
    chart_slots = ["J3", "J22", "J41", "J60"]
    chart_idx = 0

    for section_title, section_subtitle, data, options in sections:
        before = row

        render_data = data
        sort_by = options.get("sort_by") if options.get("chart") else None
        if sort_by and data is not None:
            df_sort = data if isinstance(data, pd.DataFrame) else pd.DataFrame(data)
            if sort_by in df_sort.columns:
                render_data = df_sort.sort_values(sort_by, ascending=False).reset_index(
                    drop=True
                )

        row = _write_table(
            workbook,
            worksheet,
            render_data,
            start_row=row,
            title=section_title,
            subtitle=section_subtitle,
            formats=formats,
            table_name=f"tbl_{worksheet.name}_{before}".replace(" ", "_"),
        )
        if options.get("chart") and render_data is not None:
            df = (
                render_data
                if isinstance(render_data, pd.DataFrame)
                else pd.DataFrame(render_data)
            )
            if not df.empty:
                chart_slots_idx = min(chart_idx, len(chart_slots) - 1)
                top_n = options.get("top_n")
                chart_rows = min(top_n, len(df)) if top_n else len(df)
                _add_chart(
                    workbook,
                    worksheet,
                    chart_type=options["chart"],
                    x_col=df.columns.get_loc(options["x"]),
                    y_col=df.columns.get_loc(options["y"]),
                    first_row=before + 3,
                    last_row=before + 2 + chart_rows,
                    title=section_title,
                    position=chart_slots[chart_slots_idx],
                )
                chart_idx += 1


def write_excel(
    buffer: CaptureBuffer,
    output_path: Path,
    metadata: Mapping[str, Any],
) -> None:
    """Write ``buffer`` to a structured dry-run workbook."""

    import pandas as pd

    refs = _load_analytics_reference()
    used_names: set[str] = set()
    omitted_domains = _omitted_domain_notes(metadata)
    omitted_tables = {
        table for domain in omitted_domains for table in _DOMAIN_TABLES.get(domain, ())
    }
    include_platform = "Platform" not in omitted_domains

    with pd.ExcelWriter(output_path, engine="xlsxwriter") as writer:
        workbook = writer.book
        formats = {
            "title": workbook.add_format(
                {"bold": True, "font_name": "Arial", "font_size": 16}
            ),
            "subtitle": workbook.add_format(
                {"font_name": "Arial", "font_size": 10, "font_color": "#555555"}
            ),
            "section_title": workbook.add_format(
                {"bold": True, "font_name": "Arial", "font_size": 12}
            ),
            "section_subtitle": workbook.add_format(
                {"font_name": "Arial", "font_size": 9, "font_color": "#666666"}
            ),
            "header": workbook.add_format(
                {
                    "bold": True,
                    "font_name": "Arial",
                    "bg_color": "#D9E2F3",
                    "border": 1,
                }
            ),
            "note": workbook.add_format(
                {"font_name": "Arial", "italic": True, "font_color": "#666666"}
            ),
            "default": workbook.add_format({"font_name": "Arial"}),
            "date": workbook.add_format(
                {"font_name": "Arial", "num_format": "yyyy-mm-dd"}
            ),
            "datetime": workbook.add_format(
                {"font_name": "Arial", "num_format": "yyyy-mm-dd hh:mm:ss"}
            ),
            "int": workbook.add_format({"font_name": "Arial", "num_format": "#,##0"}),
            "percent": workbook.add_format(
                {"font_name": "Arial", "num_format": "0.0%"}
            ),
        }

        # 00 Run Health
        run_health = workbook.add_worksheet(_safe_sheet("00 Run Health", used_names))
        writer.sheets[run_health.name] = run_health
        run_health.write(0, 0, "Analytics Dry-Run Workbook", formats["title"])
        run_health.write(
            1,
            0,
            "This workbook balances human-readable summaries with raw captured tables from the dry run.",
            formats["subtitle"],
        )
        run_health.freeze_panes(2, 0)

        meta_rows = _visible_metadata_rows(metadata)
        row = _write_table(
            workbook,
            run_health,
            pd.DataFrame(meta_rows),
            start_row=3,
            title="Run Metadata",
            subtitle="Scope, execution context, and generation metadata.",
            formats=formats,
            table_name="tbl_run_metadata",
        )

        domain_rows = []
        for domain, tables in _DOMAIN_TABLES.items():
            if domain in omitted_domains:
                status = "skipped"
                note = omitted_domains[domain]
                tables_label = "intentionally omitted"
            else:
                status, note = _domain_table_status(buffer, tables)
                tables_label = (
                    ", ".join(table for table in tables if table in buffer.table_status)
                    or "none"
                )
            domain_rows.append(
                {
                    "domain": domain,
                    "status": status,
                    "tables": tables_label,
                    "note": note,
                }
            )
        row = _write_table(
            workbook,
            run_health,
            pd.DataFrame(domain_rows),
            start_row=row,
            title="Domain Status",
            subtitle="Produced, empty, skipped, or failed domains for this workbook.",
            formats=formats,
            table_name="tbl_domain_status",
        )

        scripts_df = pd.DataFrame(buffer.scripts)
        if scripts_df.empty:
            scripts_df = pd.DataFrame(
                [
                    {
                        "script": "none",
                        "status": "skipped",
                        "elapsed_s": 0.0,
                        "rows_written": 0,
                        "error": "no scripts recorded",
                    }
                ]
            )
        _write_table(
            workbook,
            run_health,
            scripts_df[
                [
                    column
                    for column in (
                        "script",
                        "status",
                        "elapsed_s",
                        "rows_written",
                        "error",
                    )
                    if column in scripts_df.columns
                ]
            ],
            start_row=row,
            title="Script Matrix",
            subtitle="One row per analytics script in the run.",
            formats=formats,
            table_name="tbl_scripts",
        )

        index_sheet = workbook.add_worksheet(_safe_sheet("01 Index", used_names))
        writer.sheets[index_sheet.name] = index_sheet

        # Summary sheets
        summary_specs = [
            (
                "10 Activity",
                "Activity Summary",
                "Course activity views modelled after the lecturer analytics dashboard.",
                _activity_sections(buffer, metadata),
            ),
            (
                "11 Performance",
                "Performance Summary",
                "Course performance views modelled after the lecturer analytics dashboard.",
                _performance_sections(buffer, metadata),
            ),
            (
                "12 Chat",
                "Chat Summary",
                "Readable chatbot and topic-cluster summaries, with raw tables preserved separately.",
                _chat_sections(buffer, metadata),
            ),
            (
                "13 Live Quiz",
                "Live Quiz Summary",
                "Assessment-mode live quiz summaries for the captured course scope.",
                _live_quiz_sections(buffer, metadata),
            ),
        ]
        if include_platform:
            summary_specs.append(
                (
                    "14 Platform",
                    "Platform Summary",
                    "Compact semester rollup for platform-level analytics written by the dry run.",
                    _platform_sections(buffer, metadata),
                )
            )

        visible_summary_rows = [
            {
                "sheet": "00 Run Health",
                "kind": "Summary",
                "description": "Run scope, warnings, and per-script status.",
            }
        ]

        for sheet_name, title, intro, sections in summary_specs:
            worksheet = workbook.add_worksheet(_safe_sheet(sheet_name, used_names))
            writer.sheets[worksheet.name] = worksheet
            _summary_sheet(
                workbook,
                worksheet,
                title=title,
                intro=intro,
                sections=sections,
                formats=formats,
            )
            if not _has_visible_summary_content(sections):
                worksheet.hide()
                continue
            visible_summary_rows.append(
                {
                    "sheet": worksheet.name,
                    "kind": "Summary",
                    "description": intro,
                }
            )

        # Raw sheets
        raw_sheet_names: list[tuple[str, str]] = []
        for table in buffer.table_status:
            if table in omitted_tables:
                continue
            status = buffer.table_status.get(table)
            if status not in {"produced", "empty"}:
                continue
            sheet_name = _safe_sheet(f"90 Raw - {table}", used_names)
            worksheet = workbook.add_worksheet(sheet_name)
            writer.sheets[sheet_name] = worksheet
            worksheet.write(0, 0, f"Raw Table: {table}", formats["title"])
            reference = refs.get(table, {})
            subtitle_parts = []
            if reference.get("grain"):
                subtitle_parts.append(f"Grain: {reference['grain']}")
            if reference.get("source"):
                subtitle_parts.append(f"Source: {reference['source']}")
            if not subtitle_parts:
                subtitle_parts.append(
                    "Direct capture of rows the pipeline would have written."
                )
            worksheet.write(1, 0, " | ".join(subtitle_parts), formats["subtitle"])
            notes = " | ".join(_visible_table_notes(buffer.table_notes.get(table, [])))
            if notes:
                worksheet.write(2, 0, notes, formats["section_subtitle"])

            df = _table_df(buffer, table)
            data_start = 3
            for col_idx, column in enumerate(df.columns):
                worksheet.write(data_start, col_idx, column, formats["header"])
            if not df.empty:
                for rel_row, (_, series_row) in enumerate(df.iterrows(), start=1):
                    for col_idx, column in enumerate(df.columns):
                        _write_data_cell(
                            worksheet,
                            data_start + rel_row,
                            col_idx,
                            series_row[column],
                            column,
                            formats,
                        )
            else:
                worksheet.write(
                    data_start + 1,
                    0,
                    "No rows captured for this table in the selected dry run.",
                    formats["note"],
                )

            last_row = data_start + max(len(df), 1)
            last_col = max(len(df.columns) - 1, 0)
            worksheet.add_table(
                data_start,
                0,
                last_row,
                last_col,
                {
                    "name": f"raw_{table}"[:255],
                    "style": "Table Style Medium 2",
                    "columns": [{"header": column} for column in df.columns],
                    "autofilter": True,
                },
            )
            worksheet.autofilter(data_start, 0, last_row, last_col)
            worksheet.freeze_panes(data_start + 1, 0)
            for col_idx, column in enumerate(df.columns):
                worksheet.set_column(
                    col_idx,
                    col_idx,
                    _column_width(df[column] if column in df else [], column),
                    formats[_format_name_for_column(column)],
                )
            if status == "empty":
                worksheet.hide()
                continue
            raw_sheet_names.append((sheet_name, table))

        # 99 Diagnostics
        diagnostics = workbook.add_worksheet(_safe_sheet("99 Diagnostics", used_names))
        writer.sheets[diagnostics.name] = diagnostics
        diagnostics.write(0, 0, "Diagnostics", formats["title"])
        diagnostics.write(
            1,
            0,
            "Concise diagnostics for skipped or failed write captures. Full SQL is stored on a hidden debug sheet.",
            formats["subtitle"],
        )
        diagnostics.freeze_panes(2, 0)

        _write_table(
            workbook,
            diagnostics,
            pd.DataFrame(_diagnostics_rows(buffer.skipped_writes)),
            start_row=3,
            title="Skipped / Failed Writes",
            subtitle="High-signal diagnostics only.",
            formats=formats,
            table_name="tbl_diagnostics",
        )

        # Hidden debug SQL sheet
        debug_sheet = workbook.add_worksheet(_safe_sheet("99 Debug SQL", used_names))
        writer.sheets[debug_sheet.name] = debug_sheet
        debug_sheet.hide()
        debug_df = pd.DataFrame(
            buffer.skipped_writes
            or [{"verb": "none", "sql": "", "params": "", "table": "", "note": ""}]
        )
        _write_table(
            workbook,
            debug_sheet,
            debug_df,
            start_row=0,
            title="Full Debug SQL",
            subtitle="Hidden sheet with full skipped-write payloads.",
            formats=formats,
            table_name="tbl_debug_sql",
        )

        # Populate the index after all sheet names are known.
        index_sheet.write(0, 0, "Workbook Index", formats["title"])
        index_sheet.write(
            1,
            0,
            "Guide to summary, raw, and diagnostic sheets in this dry-run workbook.",
            formats["subtitle"],
        )
        index_rows = list(visible_summary_rows)
        for sheet_name, table in raw_sheet_names:
            index_rows.append(
                {
                    "sheet": sheet_name,
                    "kind": "Raw",
                    "description": f"Raw capture for {table} ({buffer.table_status.get(table)})",
                }
            )
        index_rows.append(
            {
                "sheet": "99 Diagnostics",
                "kind": "Diagnostics",
                "description": "Concise skipped-write diagnostics.",
            }
        )
        header_row, first_data_row = _table_row_positions(
            start_row=3,
            title="Sheet Guide",
            subtitle="Use this as the navigation entry point into the workbook.",
        )
        row = _write_table(
            workbook,
            index_sheet,
            pd.DataFrame(index_rows),
            start_row=3,
            title="Sheet Guide",
            subtitle="Use this as the navigation entry point into the workbook.",
            formats=formats,
            table_name="tbl_index",
        )
        for offset, entry in enumerate(index_rows, start=first_data_row):
            target = entry["sheet"].replace("'", "''")
            index_sheet.write_url(
                offset,
                0,
                f"internal:'{target}'!A1",
                formats["default"],
                string=entry["sheet"],
            )
        index_sheet.write(row, 0, "Legend", formats["section_title"])
        index_sheet.write(row + 1, 0, "produced", formats["default"])
        index_sheet.write(
            row + 1,
            1,
            "Captured rows exist for this table or domain.",
            formats["default"],
        )
        index_sheet.write(row + 2, 0, "empty", formats["default"])
        index_sheet.write(
            row + 2,
            1,
            "Script ran but produced zero rows for the selected scope.",
            formats["default"],
        )
        index_sheet.write(row + 3, 0, "skipped", formats["default"])
        index_sheet.write(
            row + 3,
            1,
            "Target DB schema drift or preflight rules prevented capture.",
            formats["default"],
        )
        index_sheet.write(row + 4, 0, "failed", formats["default"])
        index_sheet.write(
            row + 4,
            1,
            "The interceptor could not safely capture the would-be write.",
            formats["default"],
        )
