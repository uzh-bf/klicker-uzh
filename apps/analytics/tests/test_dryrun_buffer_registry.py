"""Unit tests for the dry-run buffer registry and its read-site integrations.

These tests cover the narrow bridge between the interceptor's CaptureBuffer
and the analytics modules that need to consume upstream-script output during a
dry run (scripts 1, 2). They do NOT exercise the DB.
"""

from __future__ import annotations

import os
import sys
from datetime import date

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.dryrun import buffer_registry  # noqa: E402
from src.dryrun.interceptor import CaptureBuffer, intercept_writes  # noqa: E402


# ---------------------------------------------------------------------------
# Registry lifecycle
# ---------------------------------------------------------------------------


def test_registry_returns_none_when_inactive():
    # Defensive: another test should not have leaked an active buffer.
    buffer_registry.clear_active()

    assert buffer_registry.is_active() is False
    assert buffer_registry.get_table("ParticipantAnalytics") is None


def test_registry_exposes_buffer_while_intercept_writes_is_active():
    buffer = CaptureBuffer()
    buffer.record(
        "ParticipantAnalytics",
        [
            {
                "type": "DAILY",
                "timestamp": date(2026, 4, 20),
                "courseId": "c1",
                "participantId": "p1",
            }
        ],
    )

    assert buffer_registry.is_active() is False

    with intercept_writes(buffer):
        assert buffer_registry.is_active() is True
        columns, rows = buffer_registry.get_table("ParticipantAnalytics")
        assert rows == [
            {
                "type": "DAILY",
                "timestamp": date(2026, 4, 20),
                "courseId": "c1",
                "participantId": "p1",
            }
        ]
        assert columns == ["type", "timestamp", "courseId", "participantId"]

    # Cleanup on exit must be exact — later scripts must not see a stale buffer.
    assert buffer_registry.is_active() is False
    assert buffer_registry.get_table("ParticipantAnalytics") is None


def test_registry_returns_empty_rows_for_known_table_with_no_rows():
    buffer = CaptureBuffer()
    buffer.mark_table(
        "ParticipantChatAnalytics",
        columns=["type", "userMessages"],
        status="empty",
    )

    with intercept_writes(buffer):
        result = buffer_registry.get_table("ParticipantChatAnalytics")
        assert result is not None
        columns, rows = result
        assert rows == []
        assert columns == ["type", "userMessages"]


# ---------------------------------------------------------------------------
# load_participant_analytics buffer-first path
# ---------------------------------------------------------------------------


def test_load_participant_analytics_uses_buffer_when_active():
    from src.modules.aggregated_analytics.load_participant_analytics import (
        load_participant_analytics,
    )

    buffer = CaptureBuffer()
    buffer.record(
        "ParticipantAnalytics",
        [
            {
                "type": "DAILY",
                "timestamp": date(2026, 4, 20),
                "courseId": "c1",
                "participantId": "p1",
                "responseCount": 5,
            },
            {
                "type": "DAILY",
                "timestamp": date(2026, 4, 21),
                "courseId": "c1",
                "participantId": "p2",
                "responseCount": 3,
            },
            {
                "type": "WEEKLY",
                "timestamp": date(2026, 4, 20),
                "courseId": "c1",
                "participantId": "p1",
                "responseCount": 5,
            },
            {
                "type": "DAILY",
                "timestamp": date(2026, 4, 20),
                "courseId": "c2",
                "participantId": "px",
                "responseCount": 1,
            },
        ],
    )

    with intercept_writes(buffer):
        df = load_participant_analytics(
            session=None,
            timestamp=date(2026, 4, 20),
            analytics_type="DAILY",
            course_ids=["c1"],
        )

    assert len(df) == 1
    assert df.iloc[0]["participantId"] == "p1"
    assert df.iloc[0]["responseCount"] == 5


def test_load_participant_analytics_returns_empty_for_missing_window():
    from src.modules.aggregated_analytics.load_participant_analytics import (
        load_participant_analytics,
    )

    buffer = CaptureBuffer()
    buffer.record(
        "ParticipantAnalytics",
        [
            {
                "type": "DAILY",
                "timestamp": date(2026, 4, 20),
                "courseId": "c1",
                "participantId": "p1",
            }
        ],
    )

    with intercept_writes(buffer):
        df = load_participant_analytics(
            session=None,
            timestamp=date(2026, 5, 1),
            analytics_type="DAILY",
            course_ids=["c1"],
        )

    assert df.empty
