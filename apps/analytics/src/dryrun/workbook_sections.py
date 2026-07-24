"""Summary data and formatting helpers for analytics dry-run workbooks."""

from __future__ import annotations

import datetime as dt
import json
import math
import re
from pathlib import Path
from typing import Any, Mapping, Sequence

from src.dryrun.interceptor import CaptureBuffer, _truncate

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


_HIDDEN_METADATA_KEYS = {"lookups", "script_domains", "omitted_domain_notes"}


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

    if hasattr(value, "item") and not isinstance(value, (str, bytes, dt.datetime, dt.date, dt.time)):
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
    if lowered.endswith("count") or lowered.startswith("total") or lowered.startswith("num"):
        return "int"
    return "default"


def _domain_table_status(buffer: CaptureBuffer, tables: Sequence[str]) -> tuple[str, str]:
    statuses = [buffer.table_status.get(table) for table in tables if table in buffer.table_status]
    if not statuses:
        return "skipped", "No captured or empty output tables for this domain."
    if any(status == "produced" for status in statuses):
        return "produced", "At least one table in this domain contains captured rows."
    if any(status == "failed" for status in statuses):
        return "failed", "One or more write captures in this domain failed."
    if any(status == "empty" for status in statuses):
        return "empty", "Scripts ran, but this domain produced zero rows for the selected scope."
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
    for idx, participant_id in enumerate(sorted({value for value in values if value is not None}), start=1):
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


def _activity_degradation_reasons(buffer: CaptureBuffer, aggregated, participants) -> list[str]:
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
        reasons.append("Participant activity metrics are all zero in the captured course table.")

    return reasons


def _section_is_placeholder(section: tuple[str, str, Any, dict[str, Any]]) -> bool:
    return bool(section[3].get("placeholder"))


def _has_visible_summary_content(sections: Sequence[tuple[str, str, Any, dict[str, Any]]]) -> bool:
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
        {"metric": "Captured participants", "value": total_participants or len(participants)},
        {
            "metric": "Daily windows",
            "value": int((aggregated.get("type") == "DAILY").sum()) if "type" in aggregated.columns else 0,
        },
        {
            "metric": "Weekly windows",
            "value": int((aggregated.get("type") == "WEEKLY").sum()) if "type" in aggregated.columns else 0,
        },
    ]
    sections.append(("Key Metrics", "", kpis, {}))

    degradation_reasons = _activity_degradation_reasons(buffer, aggregated, participants)
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
            participant_table["student"] = participant_table["participantId"].map(labels)
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
            histogram["errorRateBucket"] = (histogram["totalErrorRate"] * 100).round().clip(0, 100)
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
            participant_table["student"] = participant_table["participantId"].map(labels)
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
            progress["activityId"].map(activity_lookup).fillna(progress["activityId"].astype(str))
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
            activities["activityId"].map(activity_lookup).fillna(activities["activityId"].astype(str))
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
            .fillna(instances.get("instanceId", "").astype(str) if "instanceId" in instances.columns else "")
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
        aggregated = _with_lookup(aggregated, "chatbotId", chatbot_lookup, "chatbotName")
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
                aggregated.loc[aggregated["type"] == "DAILY", ["timestamp", "userMessages"]]
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
        if "messageCount" in topic_columns and "clusterLabel" in topic_columns and len(topics) > 1:
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
        participants = _with_lookup(participants, "liveQuizId", quiz_lookup, "liveQuizName")
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
        platform = platform.sort_values("semesterStart", ascending=False).reset_index(drop=True)

    sections.append(
        (
            "Semester Rollup",
            "Compact semester-level platform metrics.",
            platform,
            {"chart": "column", "x": "semesterLabel", "y": "quizDistinctParticipants"},
        )
    )
    return sections
