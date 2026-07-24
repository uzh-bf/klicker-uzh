"""Buffer-first parity tests for the chat_quiz_correlation module.

These tests lock in the shape and semantics of the in-memory pandas path used
when the dryrun CaptureBuffer is active (script 11 against an unmigrated prod
DB). They do NOT exercise the DB — the point is to guarantee that the
buffer-backed fallback emits rows that match the production SQL's
ParticipantChatOutcome contract closely enough to populate the workbook.
"""

from __future__ import annotations

import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.dryrun.interceptor import CaptureBuffer, intercept_writes  # noqa: E402


_CHAT_ROWS = [
    {"type": "COURSE", "courseId": "c1", "participantId": f"p{i}", "userMessages": msgs}
    for i, msgs in enumerate([0, 1, 3, 8, 20, 40, 100], start=1)
]
_PERF_ROWS = [
    {
        "courseId": "c1",
        "participantId": f"p{i}",
        "firstErrorRate": 0.5 - i * 0.05,
        "lastErrorRate": 0.4 - i * 0.05,
    }
    for i in range(1, 8)
]


def _populate(buffer: CaptureBuffer) -> None:
    buffer.record("ParticipantChatAnalytics", _CHAT_ROWS)
    buffer.record("ParticipantPerformance", _PERF_ROWS)


def test_report_source_counts_accepts_empty_buffer():
    from src.modules.chat_quiz_correlation.compute_chat_quiz_correlation import (
        report_source_counts,
    )

    buffer = CaptureBuffer()
    with intercept_writes(buffer):
        report_source_counts(session=None, course_ids=["c1"])


def test_report_source_counts_accepts_populated_buffer():
    from src.modules.chat_quiz_correlation.compute_chat_quiz_correlation import (
        report_source_counts,
    )

    buffer = CaptureBuffer()
    _populate(buffer)
    with intercept_writes(buffer):
        # No exception — DB is never touched because buffer_registry is active.
        report_source_counts(session=None, course_ids=["c1"])


def test_compute_outcomes_writes_rows_into_buffer_with_expected_columns():
    from src.modules.chat_quiz_correlation.compute_chat_quiz_correlation import (
        compute_participant_chat_outcomes,
    )

    buffer = CaptureBuffer()
    _populate(buffer)

    with intercept_writes(buffer):
        written = compute_participant_chat_outcomes(session=None, course_ids=["c1"])

    assert written == len(_CHAT_ROWS)
    captured = buffer.rows_by_table["ParticipantChatOutcome"]
    assert len(captured) == len(_CHAT_ROWS)

    expected_columns = {
        "participantId",
        "courseId",
        "chatMessagesInCourse",
        "chatDoseBucket",
        "firstErrorRate",
        "lastErrorRate",
        "errorRateDelta",
        "hasBothModalities",
        "createdAt",
        "updatedAt",
    }
    assert expected_columns.issubset(set(captured[0].keys()))


def test_compute_outcomes_bucket_assignment_matches_percentile_semantics():
    from src.modules.chat_quiz_correlation.compute_chat_quiz_correlation import (
        compute_participant_chat_outcomes,
    )

    buffer = CaptureBuffer()
    _populate(buffer)
    with intercept_writes(buffer):
        compute_participant_chat_outcomes(session=None, course_ids=["c1"])

    by_participant = {row["participantId"]: row for row in buffer.rows_by_table["ParticipantChatOutcome"]}
    assert by_participant["p1"]["chatDoseBucket"] == "NONE"  # zero messages
    assert by_participant["p2"]["chatDoseBucket"] == "LOW"
    assert by_participant["p7"]["chatDoseBucket"] == "HIGH"


def test_compute_outcomes_sets_has_both_modalities_only_when_both_present():
    from src.modules.chat_quiz_correlation.compute_chat_quiz_correlation import (
        compute_participant_chat_outcomes,
    )

    # A participant with chat activity but no performance row: hasBothModalities = False.
    buffer = CaptureBuffer()
    buffer.record(
        "ParticipantChatAnalytics",
        [
            {
                "type": "COURSE",
                "courseId": "c1",
                "participantId": "chat-only",
                "userMessages": 10,
            }
        ],
    )
    buffer.record(
        "ParticipantPerformance",
        [
            {
                "courseId": "c1",
                "participantId": "perf-only",
                "firstErrorRate": 0.1,
                "lastErrorRate": 0.05,
            }
        ],
    )

    with intercept_writes(buffer):
        compute_participant_chat_outcomes(session=None, course_ids=["c1"])

    captured = {row["participantId"]: row for row in buffer.rows_by_table["ParticipantChatOutcome"]}
    assert captured["chat-only"]["hasBothModalities"] is False
    # Chat-only participant should still have chatMessagesInCourse > 0 and
    # a non-NONE bucket.
    assert captured["chat-only"]["chatMessagesInCourse"] == 10
    assert captured["perf-only"]["hasBothModalities"] is False
    assert captured["perf-only"]["chatMessagesInCourse"] == 0
    assert captured["perf-only"]["chatDoseBucket"] == "NONE"


def test_compute_outcomes_error_rate_delta_equals_last_minus_first():
    from src.modules.chat_quiz_correlation.compute_chat_quiz_correlation import (
        compute_participant_chat_outcomes,
    )

    buffer = CaptureBuffer()
    _populate(buffer)
    with intercept_writes(buffer):
        compute_participant_chat_outcomes(session=None, course_ids=["c1"])

    for row in buffer.rows_by_table["ParticipantChatOutcome"]:
        if row["firstErrorRate"] is None or row["lastErrorRate"] is None:
            continue
        assert row["errorRateDelta"] == row["lastErrorRate"] - row["firstErrorRate"]


def test_compute_outcomes_timestamps_are_utc_datetimes():
    from src.modules.chat_quiz_correlation.compute_chat_quiz_correlation import (
        compute_participant_chat_outcomes,
    )

    buffer = CaptureBuffer()
    _populate(buffer)
    with intercept_writes(buffer):
        compute_participant_chat_outcomes(session=None, course_ids=["c1"])

    # CaptureBuffer._coerce_value strips tzinfo but normalises to UTC first.
    for row in buffer.rows_by_table["ParticipantChatOutcome"]:
        assert isinstance(row["createdAt"], datetime)
        assert isinstance(row["updatedAt"], datetime)
        assert row["createdAt"].tzinfo is None
        assert row["updatedAt"].tzinfo is None


def test_compute_outcomes_returns_zero_when_buffer_empty():
    from src.modules.chat_quiz_correlation.compute_chat_quiz_correlation import (
        compute_participant_chat_outcomes,
    )

    buffer = CaptureBuffer()
    with intercept_writes(buffer):
        written = compute_participant_chat_outcomes(session=None, course_ids=["c1"])
    assert written == 0
    assert "ParticipantChatOutcome" not in buffer.rows_by_table


def test_compute_outcomes_scopes_by_course_id():
    from src.modules.chat_quiz_correlation.compute_chat_quiz_correlation import (
        compute_participant_chat_outcomes,
    )

    buffer = CaptureBuffer()
    buffer.record(
        "ParticipantChatAnalytics",
        [
            {
                "type": "COURSE",
                "courseId": "c1",
                "participantId": "p1",
                "userMessages": 5,
            },
            {
                "type": "COURSE",
                "courseId": "c2",
                "participantId": "p9",
                "userMessages": 5,
            },
        ],
    )
    buffer.record(
        "ParticipantPerformance",
        [
            {
                "courseId": "c1",
                "participantId": "p1",
                "firstErrorRate": 0.1,
                "lastErrorRate": 0.05,
            },
            {
                "courseId": "c2",
                "participantId": "p9",
                "firstErrorRate": 0.1,
                "lastErrorRate": 0.05,
            },
        ],
    )

    with intercept_writes(buffer):
        compute_participant_chat_outcomes(session=None, course_ids=["c1"])

    courses = {row["courseId"] for row in buffer.rows_by_table["ParticipantChatOutcome"]}
    assert courses == {"c1"}
