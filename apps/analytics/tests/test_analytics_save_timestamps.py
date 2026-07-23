from __future__ import annotations

import importlib
from datetime import datetime

import pandas as pd


class _FakeSession:
    def commit(self):
        return None


def _capture_rows(monkeypatch, module):
    captured = {}
    monkeypatch.setattr(
        module,
        "bulk_upsert",
        lambda _session, _model, rows, **_kwargs: captured.setdefault("rows", rows),
    )
    return captured


def test_participant_analytics_uses_one_utc_timestamp(monkeypatch):
    module = importlib.import_module(
        "src.modules.participant_analytics.save_participant_analytics"
    )
    fixed_now = datetime(2026, 7, 23, 12, 30)
    captured = _capture_rows(monkeypatch, module)
    monkeypatch.setattr(module, "utcnow", lambda: fixed_now)
    df = pd.DataFrame(
        [
            {
                "participantId": "participant-1",
                "courseId": "course-1",
                "trialsCount": 1,
                "responseCount": 2,
                "totalScore": 3,
                "totalPoints": 4,
                "totalXp": 5,
                "meanCorrectCount": 0.5,
                "meanPartialCount": 0.25,
                "meanWrongCount": 0.25,
            }
        ]
    )

    module.save_participant_analytics(
        _FakeSession(), df, "2026-07-23T00:00:00Z", "DAILY"
    )

    row = captured["rows"][0]
    assert row["computedAt"] == fixed_now.date()
    assert row["createdAt"] == fixed_now
    assert row["updatedAt"] == fixed_now
    assert row["createdAt"].tzinfo is None


def test_aggregated_analytics_uses_one_utc_timestamp(monkeypatch):
    module = importlib.import_module(
        "src.modules.aggregated_analytics.save_aggregated_analytics"
    )
    fixed_now = datetime(2026, 7, 23, 12, 30)
    captured = _capture_rows(monkeypatch, module)
    monkeypatch.setattr(module, "utcnow", lambda: fixed_now)
    df = pd.DataFrame(
        [
            {
                "courseId": "course-1",
                "participantCount": 1,
                "responseCount": 2,
                "totalScore": 3,
                "totalPoints": 4,
                "totalXp": 5,
            }
        ]
    )

    module.save_aggregated_analytics(
        _FakeSession(), df, "2026-07-23T00:00:00Z", "DAILY"
    )

    row = captured["rows"][0]
    assert row["computedAt"] == fixed_now.date()
    assert row["createdAt"] == fixed_now
    assert row["updatedAt"] == fixed_now
    assert row["createdAt"].tzinfo is None
