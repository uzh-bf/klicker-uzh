"""Domain summary builders for analytics dry-run workbooks."""

from __future__ import annotations

import json
from typing import Any, Mapping, Sequence

from src.dryrun.interceptor import CaptureBuffer


def truncate_text(value: str, limit: int) -> str:
    return value if len(value) <= limit else value[: limit - 3] + "..."


def table_dataframe(buffer: CaptureBuffer, table: str):
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


def has_visible_summary_content(sections: Sequence[tuple[str, str, Any, dict[str, Any]]]) -> bool:
    return any(not _section_is_placeholder(section) for section in sections)


def _json_compact(value: Any) -> str:
    if value is None or value == "":
        return ""
    if isinstance(value, str):
        return truncate_text(value, 120)
    try:
        return truncate_text(json.dumps(value, sort_keys=True), 120)
    except Exception:
        return truncate_text(str(value), 120)


def build_activity_sections(buffer: CaptureBuffer, metadata: Mapping[str, Any]):
    sections: list[tuple[str, str, Any, dict[str, Any]]] = []
    lookups = metadata.get("lookups", {})
    course_name = lookups.get("course_name", metadata.get("course_id", "course"))
    aggregated = table_dataframe(buffer, "AggregatedAnalytics")
    course = table_dataframe(buffer, "AggregatedCourseAnalytics")
    participants = table_dataframe(buffer, "ParticipantCourseAnalytics")

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


def build_performance_sections(buffer: CaptureBuffer, metadata: Mapping[str, Any]):
    sections: list[tuple[str, str, Any, dict[str, Any]]] = []
    lookups = metadata.get("lookups", {})
    participants = table_dataframe(buffer, "ParticipantPerformance")
    progress = table_dataframe(buffer, "ActivityProgress")
    activities = table_dataframe(buffer, "ActivityPerformance")
    instances = table_dataframe(buffer, "InstancePerformance")

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


def build_chat_sections(buffer: CaptureBuffer, metadata: Mapping[str, Any]):
    sections: list[tuple[str, str, Any, dict[str, Any]]] = []
    lookups = metadata.get("lookups", {})
    aggregated = table_dataframe(buffer, "AggregatedChatbotAnalytics")
    topics = table_dataframe(buffer, "ChatTopicCluster")
    outcomes = table_dataframe(buffer, "ParticipantChatOutcome")

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


def build_live_quiz_sections(buffer: CaptureBuffer, metadata: Mapping[str, Any]):
    sections: list[tuple[str, str, Any, dict[str, Any]]] = []
    lookups = metadata.get("lookups", {})
    participants = table_dataframe(buffer, "ParticipantLiveQuizAnalytics")
    aggregated = table_dataframe(buffer, "AggregatedLiveQuizAnalytics")

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


def build_platform_sections(buffer: CaptureBuffer, metadata: Mapping[str, Any]):
    sections: list[tuple[str, str, Any, dict[str, Any]]] = []
    platform = table_dataframe(buffer, "PlatformSemesterAnalytics")
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
