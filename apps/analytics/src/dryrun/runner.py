"""End-to-end dry-run runner.

``run_dryrun`` is the single public entry point:

1. Validates the course id and sets ``ANALYTICS_COURSE_IDS`` /
   ``ANALYTICS_MODE=incremental`` so ``scoped_course_ids`` picks them up.
2. Registers a connection-level ``SET SESSION CHARACTERISTICS AS TRANSACTION
   READ ONLY`` listener on the engine, then opens a probe session to confirm
   the current Postgres role does not have ``INSERT`` on ``Course`` (Layer 1
   in the safety stack — the role grant is the real block).
3. Installs the Python write interceptors and runs each discovered analytics
   script module's ``main()`` in sequence, sharing one ``CaptureBuffer``.
4. Writes the buffer to ``.xlsx``.

Scripts are discovered by globbing ``src/scripts/[0-9]*.py`` and sorting
numerically. Doing it this way avoids duplicating the
``packages/types/src/hatchet.ts`` ``ANALYTICS_SCRIPTS`` map; script ordering
in the dry-run follows the numeric prefix, which matches that map.
"""

from __future__ import annotations

import importlib
import json
import os
import re
import subprocess
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping, Sequence

from sqlalchemy import event, text
from sqlalchemy.engine import Connection, Engine

from src.dryrun.interceptor import CaptureBuffer, intercept_writes, write_excel


class DryRunAbort(RuntimeError):
    """Raised when the harness refuses to continue (e.g. R/W role detected)."""


# Tables a script must be able to READ from the target DB. Writes are NOT
# listed here — the interceptor captures ``bulk_upsert`` rows in memory,
# rewrites ``INSERT INTO <t> … SELECT …`` to a bare SELECT (the target
# table's existence doesn't matter), and logs ``UPDATE`` / ``DELETE`` to
# ``_skipped_writes`` without executing. So a dryrun can compute fresh chat
# / live-quiz / platform analytics against prod even when the write-target
# tables haven't been migrated there yet.
#
# Only scripts that pull from another analytics table at read time need to
# be gated. Today that's just script 11, which correlates each participant's
# chat usage against their quiz outcomes — the chat side comes from
# ``ParticipantChatAnalytics`` (written by script 8, not yet present on
# schemas before the chat-analytics migration lands).
_SCRIPT_REQUIRED_TABLES: dict[str, tuple[str, ...]] = {
    "src.scripts.11_chat_quiz_correlation": ("ParticipantChatAnalytics",),
}

_SCRIPT_OUTPUT_TABLES: dict[str, tuple[str, ...]] = {
    "src.scripts.0_initial_participant_analytics": ("ParticipantAnalytics",),
    "src.scripts.1_initial_aggregated_analytics": ("AggregatedAnalytics",),
    "src.scripts.2_initial_aggregated_course_analytics": ("AggregatedCourseAnalytics",),
    "src.scripts.3_initial_instance_activity_performance": (
        "InstancePerformance",
        "ActivityPerformance",
    ),
    "src.scripts.4_initial_participant_performance": ("ParticipantPerformance",),
    "src.scripts.5_initial_participant_course_analytics": ("ParticipantCourseAnalytics",),
    "src.scripts.6_initial_activity_progress": ("ActivityProgress",),
    "src.scripts.7_participant_activity_performance": ("ParticipantActivityPerformance",),
    "src.scripts.8_initial_chat_analytics": ("ParticipantChatAnalytics",),
    "src.scripts.9_initial_aggregated_chatbot_analytics": ("AggregatedChatbotAnalytics",),
    "src.scripts.10_chat_topic_clustering": ("ChatTopicCluster",),
    "src.scripts.11_chat_quiz_correlation": (
        "ParticipantChatOutcome",
        "ParticipantCourseAnalytics",
    ),
    "src.scripts.13_platform_semester_analytics": (
        "PlatformSemesterAnalytics",
        "AggregatedCourseAnalytics",
    ),
    "src.scripts.14_live_quiz_assessment_analytics": (
        "ParticipantLiveQuizAnalytics",
        "AggregatedLiveQuizAnalytics",
    ),
    "src.scripts.99_mark_analytics_valid": (),
}

_SCRIPT_DOMAIN: dict[str, str] = {
    "src.scripts.0_initial_participant_analytics": "Activity",
    "src.scripts.1_initial_aggregated_analytics": "Activity",
    "src.scripts.2_initial_aggregated_course_analytics": "Activity",
    "src.scripts.3_initial_instance_activity_performance": "Performance",
    "src.scripts.4_initial_participant_performance": "Performance",
    "src.scripts.5_initial_participant_course_analytics": "Activity",
    "src.scripts.6_initial_activity_progress": "Performance",
    "src.scripts.7_participant_activity_performance": "Performance",
    "src.scripts.8_initial_chat_analytics": "Chat",
    "src.scripts.9_initial_aggregated_chatbot_analytics": "Chat",
    "src.scripts.10_chat_topic_clustering": "Chat",
    "src.scripts.11_chat_quiz_correlation": "Chat",
    "src.scripts.13_platform_semester_analytics": "Platform",
    "src.scripts.14_live_quiz_assessment_analytics": "Live Quiz",
    "src.scripts.99_mark_analytics_valid": "Diagnostics",
}

_INTENTIONAL_SKIP_REASONS: dict[str, str] = {
    "src.scripts.13_platform_semester_analytics": (
        "skipped: intentionally omitted for course-scoped dryrun"
    ),
    "src.scripts.99_mark_analytics_valid": (
        "skipped: dryrun omits analytics validity watermark updates"
    ),
}


def _detect_missing_tables(connection: Connection, names: set[str]) -> set[str]:
    if not names:
        return set()
    present = set(
        connection.execute(
            text(
                "SELECT tablename FROM pg_tables "
                "WHERE schemaname = 'public' AND tablename = ANY(:names)"
            ),
            {"names": list(names)},
        )
        .scalars()
        .all()
    )
    return names - present


def _is_missing_schema_error(error: str) -> bool:
    lower = error.lower()
    return "does not exist" in lower or "undefinedtable" in lower or "undefinedcolumn" in lower


def _validate_uuid(value: str) -> None:
    try:
        uuid.UUID(value)
    except (ValueError, TypeError) as exc:
        raise DryRunAbort(f"course id {value!r} is not a valid UUID") from exc


def _redact_host(database_url: str) -> str:
    m = re.match(r"[^:]+://(?:[^@]+@)?([^:/?#]+)", database_url or "")
    return m.group(1) if m else "unknown"


def _git_sha() -> str | None:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
            cwd=str(Path(__file__).resolve().parent),
        )
    except (OSError, subprocess.CalledProcessError):
        return None
    sha = result.stdout.strip()
    return sha or None


def _table_counts(buffer: CaptureBuffer) -> dict[str, int]:
    return {table: buffer.row_count(table) for table in buffer.table_status}


def _rows_written_since(
    buffer: CaptureBuffer,
    before_counts: Mapping[str, int],
    expected_tables: Sequence[str],
) -> int:
    if expected_tables:
        return sum(
            max(0, buffer.row_count(table) - before_counts.get(table, 0))
            for table in expected_tables
        )
    return sum(
        max(0, buffer.row_count(table) - before_counts.get(table, 0))
        for table in buffer.table_status
    )


def _mark_expected_tables(
    buffer: CaptureBuffer,
    module_name: str,
    *,
    status: str,
    note: str | None = None,
) -> None:
    for table in _SCRIPT_OUTPUT_TABLES.get(module_name, ()):
        buffer.mark_table(table, status=status, script=module_name, note=note)


def _intentional_skip_reason(module_name: str, *, scope_mode: str) -> str | None:
    if module_name == "src.scripts.99_mark_analytics_valid":
        return _INTENTIONAL_SKIP_REASONS[module_name]
    if (
        scope_mode == "course"
        and module_name == "src.scripts.13_platform_semester_analytics"
    ):
        return _INTENTIONAL_SKIP_REASONS[module_name]
    return None


def _collect_ids(buffer: CaptureBuffer, column: str) -> set[str]:
    ids: set[str] = set()
    for rows in buffer.rows_by_table.values():
        for row in rows:
            value = row.get(column)
            if value:
                ids.add(str(value))
    return ids


def _query_name_map(
    connection: Connection,
    *,
    sql: str,
    ids: set[str],
) -> dict[str, str]:
    if not ids:
        return {}
    rows = connection.execute(text(sql), {"ids": list(ids)}).all()
    return {str(row[0]): str(row[1]) for row in rows}


def _extract_element_name(payload: Any) -> str:
    if isinstance(payload, Mapping):
        return str(payload.get("name") or "")
    if isinstance(payload, str):
        try:
            decoded = json.loads(payload)
        except Exception:
            return payload
        if isinstance(decoded, Mapping):
            return str(decoded.get("name") or payload)
    return str(payload)


def _collect_reference_lookups(
    connection: Connection,
    buffer: CaptureBuffer,
    course_id: str,
) -> dict[str, Any]:
    course_ids = _collect_ids(buffer, "courseId") | {course_id}
    participant_ids = _collect_ids(buffer, "participantId")
    chatbot_ids = _collect_ids(buffer, "chatbotId")
    practice_quiz_ids = _collect_ids(buffer, "practiceQuizId")
    microlearning_ids = _collect_ids(buffer, "microLearningId")
    live_quiz_ids = _collect_ids(buffer, "liveQuizId")
    instance_ids = _collect_ids(buffer, "instanceId")

    courses = _query_name_map(
        connection,
        sql='SELECT id, name FROM "Course" WHERE id = ANY(:ids)',
        ids=course_ids,
    )
    participants = {}
    if participant_ids:
        rows = connection.execute(
            text(
                'SELECT id, username, email FROM "Participant" WHERE id = ANY(:ids)'
            ),
            {"ids": list(participant_ids)},
        ).all()
        participants = {
            str(row[0]): {
                "username": str(row[1]) if row[1] is not None else "",
                "email": str(row[2]) if row[2] is not None else "",
            }
            for row in rows
        }

    practice_quizzes = _query_name_map(
        connection,
        sql='SELECT id, name FROM "PracticeQuiz" WHERE id = ANY(:ids)',
        ids=practice_quiz_ids,
    )
    microlearnings = _query_name_map(
        connection,
        sql='SELECT id, name FROM "MicroLearning" WHERE id = ANY(:ids)',
        ids=microlearning_ids,
    )
    live_quizzes = _query_name_map(
        connection,
        sql='SELECT id, name FROM "LiveQuiz" WHERE id = ANY(:ids)',
        ids=live_quiz_ids,
    )
    chatbots = _query_name_map(
        connection,
        sql='SELECT id, name FROM "Chatbot" WHERE id = ANY(:ids)',
        ids=chatbot_ids,
    )

    element_instances: dict[str, str] = {}
    if instance_ids:
        rows = connection.execute(
            text(
                'SELECT id, "elementData" FROM "ElementInstance" WHERE id = ANY(:ids)'
            ),
            {"ids": list(instance_ids)},
        ).all()
        element_instances = {
            str(row[0]): _extract_element_name(row[1]) for row in rows
        }

    return {
        "course_name": courses.get(course_id, ""),
        "courses": courses,
        "participants": participants,
        "practice_quizzes": practice_quizzes,
        "microlearnings": microlearnings,
        "live_quizzes": live_quizzes,
        "chatbots": chatbots,
        "element_instances": element_instances,
    }


def _discover_scripts() -> list[str]:
    base = Path(__file__).resolve().parent.parent / "scripts"
    files = [p for p in base.glob("[0-9]*.py") if p.is_file()]

    def numeric_prefix(path: Path) -> int:
        stem = path.stem
        leading = stem.split("_", 1)[0]
        try:
            return int(leading)
        except ValueError:
            return 10**9

    files.sort(key=numeric_prefix)
    return [f"src.scripts.{p.stem}" for p in files]


def _install_read_only_hook(engine: Engine) -> Any:
    """Register a connect-event listener that enforces read-only per connection.

    Idempotent: repeated registrations would attach multiple listeners, so
    callers should only invoke this once per runner invocation. Returns the
    listener function so the caller can remove it on teardown.
    """

    def _on_connect(dbapi_connection: Any, connection_record: Any) -> None:
        cursor = dbapi_connection.cursor()
        try:
            cursor.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY")
        finally:
            cursor.close()

    event.listen(engine, "connect", _on_connect)
    return _on_connect


def _auto_scope_window(connection: Connection, course_id: str) -> None:
    """Default ``ANALYTICS_WINDOW_SINCE`` to the scoped course's ``startDate``.

    The pipeline scripts iterate DAILY/WEEKLY/MONTHLY windows from a hardcoded
    platform epoch (2022-10-23) to today. For a single-course dry-run, this
    adds hundreds of no-op windows before the course even existed. Setting the
    window floor to the course's ``startDate`` makes ``should_skip_window``
    prune everything earlier — the pipeline still runs end-to-end, just without
    the pre-course iterations.

    Respects an operator-provided ``ANALYTICS_WINDOW_SINCE`` — we only set it
    when the caller hasn't.
    """
    if os.environ.get("ANALYTICS_WINDOW_SINCE"):
        return
    row = connection.execute(
        text('SELECT "startDate" FROM "Course" WHERE id = :cid'),
        {"cid": course_id},
    ).first()
    if row is None or row[0] is None:
        return
    start = row[0]
    iso_date = start.strftime("%Y-%m-%d") if hasattr(start, "strftime") else str(start)[:10]
    os.environ["ANALYTICS_WINDOW_SINCE"] = iso_date


def _assert_read_only_role(
    connection: Connection,
    *,
    allow_rw: bool,
) -> str:
    """Check the current Postgres role lacks write privileges on ``Course``.

    Aborts the run unless ``allow_rw`` is True — local dev DBs are R/W and
    the harness still has to work there, so the flag exists as an opt-out.
    The probe uses ``Course`` because every environment has it and it's
    touched by ``99_mark_analytics_valid``.
    """
    row = connection.execute(
        text(
            'SELECT current_user AS u, '
            'has_table_privilege(current_user, \'"Course"\', \'INSERT\') AS can_insert'
        )
    ).one()
    current_user = row.u
    can_insert = bool(row.can_insert)
    if can_insert and not allow_rw:
        raise DryRunAbort(
            f"Refusing to run dryrun: current role {current_user!r} has INSERT "
            f"privilege on Course. Point DATABASE_URL at a read-only role, or "
            f"pass --unsafe-allow-rw-role for local dev runs."
        )
    return current_user


def run_dryrun(
    course_id: str,
    output_path: Path,
    *,
    scripts: list[str] | None = None,
    allow_rw_role: bool = False,
) -> CaptureBuffer:
    """Execute the analytics pipeline against the current DB without writing.

    Returns the populated ``CaptureBuffer`` for callers that want to inspect
    rows programmatically; the ``.xlsx`` workbook at ``output_path`` holds
    the same data for humans.
    """
    _validate_uuid(course_id)
    scope_mode = "course"

    # Env vars must be set BEFORE any script / save module imports — the
    # scripts read them through ``scoped_course_ids`` / ``analytics_mode``.
    os.environ["ANALYTICS_COURSE_IDS"] = course_id
    os.environ.setdefault("ANALYTICS_MODE", "incremental")

    # If a dedicated read-only URL is provided (typical prod setup), promote it
    # to DATABASE_URL before src.db builds its engine so every connection the
    # pipeline opens uses the RO role. The RW URL coexisting in the same env
    # is the whole point — operators don't have to swap secrets per run.
    ro_url = os.environ.get("DATABASE_URL_RO")
    if ro_url:
        os.environ["DATABASE_URL"] = ro_url

    from src.db import engine

    all_required_tables = {t for tables in _SCRIPT_REQUIRED_TABLES.values() for t in tables}
    missing_tables: set[str] = set()

    listener = _install_read_only_hook(engine)
    try:
        with engine.connect() as probe:
            current_user = _assert_read_only_role(probe, allow_rw=allow_rw_role)
            _auto_scope_window(probe, course_id)
            missing_tables = _detect_missing_tables(probe, all_required_tables)
    except Exception:
        event.remove(engine, "connect", listener)
        raise

    lookups: dict[str, Any] = {}
    buffer = CaptureBuffer()
    modules = scripts if scripts is not None else _discover_scripts()
    if not modules:
        raise DryRunAbort("no analytics scripts discovered in src/scripts/")

    print(
        f"[dryrun] course_id={course_id} scripts={len(modules)} "
        f"role={current_user} db={_redact_host(os.environ.get('DATABASE_URL', ''))} "
        f"window_since={os.environ.get('ANALYTICS_WINDOW_SINCE') or '(none)'}",
        flush=True,
    )
    if missing_tables:
        print(
            f"[dryrun] tables absent on target DB (scripts targeting them will be "
            f"skipped): {', '.join(sorted(missing_tables))}",
            flush=True,
        )

    run_error: str | None = None
    total = len(modules)
    try:
        with intercept_writes(buffer):
            for idx, module_name in enumerate(modules, start=1):
                short = module_name.rsplit(".", 1)[-1]

                intentional_skip = _intentional_skip_reason(
                    module_name,
                    scope_mode=scope_mode,
                )
                if intentional_skip:
                    print(f"[dryrun] ({idx}/{total}) {short} {intentional_skip}", flush=True)
                    buffer.record_script(
                        module_name,
                        0.0,
                        rows_written=0,
                        error=intentional_skip,
                        status="skipped",
                    )
                    continue

                # If upstream scripts in THIS run already landed rows for the
                # required table in the CaptureBuffer, the buffer-backed read
                # path will serve them — lets script 11 run against an
                # unmigrated prod DB where ParticipantChatAnalytics is absent.
                preflight_missing = sorted(
                    table
                    for table in set(_SCRIPT_REQUIRED_TABLES.get(module_name, ())) & missing_tables
                    if buffer.row_count(table) == 0
                )
                if preflight_missing:
                    skip_reason = f"skipped: tables missing ({', '.join(preflight_missing)})"
                    print(f"[dryrun] ({idx}/{total}) {short} {skip_reason}", flush=True)
                    _mark_expected_tables(
                        buffer,
                        module_name,
                        status="skipped",
                        note=skip_reason,
                    )
                    buffer.record_script(
                        module_name,
                        0.0,
                        rows_written=0,
                        error=skip_reason,
                        status="skipped",
                    )
                    continue

                print(f"[dryrun] ({idx}/{total}) running {short}", flush=True)
                started = time.perf_counter()
                before_counts = _table_counts(buffer)
                error: str | None = None
                status = "produced"
                try:
                    module = importlib.import_module(module_name)
                    module.main()
                except Exception as exc:
                    error = f"{type(exc).__name__}: {exc}"
                    if _is_missing_schema_error(error):
                        # Column-level drift (or tables we didn't model) — same
                        # treatment as a pre-flight skip so an older prod schema
                        # doesn't look like a real pipeline failure.
                        print(
                            f"[dryrun] ({idx}/{total}) {short} skipped: schema not yet "
                            f"on target DB ({error.splitlines()[0]})",
                            flush=True,
                        )
                        error = f"skipped: {error.splitlines()[0]}"
                        status = "skipped"
                    else:
                        print(
                            f"[dryrun] ({idx}/{total}) {short} failed: {error}",
                            flush=True,
                        )
                        status = "failed"
                else:
                    elapsed_now = time.perf_counter() - started
                    print(
                        f"[dryrun] ({idx}/{total}) {short} done in {elapsed_now:.1f}s",
                        flush=True,
                    )
                    rows_written = _rows_written_since(
                        buffer, before_counts, _SCRIPT_OUTPUT_TABLES.get(module_name, ())
                    )
                    if (
                        _SCRIPT_OUTPUT_TABLES.get(module_name)
                        and rows_written == 0
                    ):
                        status = "empty"
                        _mark_expected_tables(
                            buffer,
                            module_name,
                            status="empty",
                            note="script ran but wrote zero rows",
                        )
                    else:
                        _mark_expected_tables(
                            buffer,
                            module_name,
                            status="produced",
                        )
                elapsed = time.perf_counter() - started
                if error:
                    _mark_expected_tables(
                        buffer,
                        module_name,
                        status=status,
                        note=error,
                    )
                rows_written = _rows_written_since(
                    buffer, before_counts, _SCRIPT_OUTPUT_TABLES.get(module_name, ())
                )
                buffer.record_script(
                    module_name,
                    elapsed,
                    rows_written=rows_written,
                    error=error,
                    status=status,
                )
                if error and _is_fatal(error):
                    run_error = error
                    break
    finally:
        event.remove(engine, "connect", listener)

    with engine.connect() as lookup_conn:
        lookups = _collect_reference_lookups(lookup_conn, buffer, course_id)

    metadata: dict[str, Any] = {
        "course_id": course_id,
        "course_name": lookups.get("course_name", ""),
        "scope_mode": scope_mode,
        "run_at": datetime.now(timezone.utc).isoformat(),
        "db_host": _redact_host(os.environ.get("DATABASE_URL", "")),
        "db_role": current_user,
        "git_sha": _git_sha() or "",
        "scripts_run": len(buffer.scripts),
        "tables_captured": len(
            [table for table, status in buffer.table_status.items() if status in {"produced", "empty"}]
        ),
        "skipped_writes": len(buffer.skipped_writes),
        "missing_tables": ", ".join(sorted(missing_tables)),
        "aborted_with_error": run_error or "",
        "omitted_domains": "Platform",
        "dryrun_omissions": (
            "Platform analytics omitted for course-scoped export; analytics validity "
            "watermark step omitted in dryrun."
        ),
        "lookups": lookups,
        "script_domains": _SCRIPT_DOMAIN,
        "omitted_domain_notes": {
            "Platform": "Intentionally omitted for course-scoped dry run."
        },
    }
    write_excel(buffer, output_path, metadata)
    print(f"[dryrun] wrote {output_path}", flush=True)
    return buffer


def _is_fatal(error: str) -> bool:
    # Read-only role rejections surface as ``ReadOnlySqlTransactionError`` /
    # permission denied; stop the run so the operator sees the first failure
    # instead of a cascade of downstream errors.
    fatal_tokens = (
        "read-only transaction",
        "permission denied",
        "cannot execute",
    )
    lower = error.lower()
    return any(token in lower for token in fatal_tokens)
