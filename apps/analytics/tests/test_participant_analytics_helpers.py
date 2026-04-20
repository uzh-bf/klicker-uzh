from __future__ import annotations

import os
import sys
import types
import importlib
from datetime import datetime, timezone

import pandas as pd
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_detail_to_dict_uses_course_lookup_without_course_relationship(monkeypatch):
    module = importlib.import_module(
        "src.modules.participant_analytics.get_participant_responses"
    )

    created_at = datetime(2026, 4, 20, tzinfo=timezone.utc)
    detail = types.SimpleNamespace(
        createdAt=created_at,
        practiceQuiz=types.SimpleNamespace(courseId="course-1"),
        microLearning=None,
    )
    course_windows = {
        "course-1": {
            "startDate": datetime(2026, 2, 15, tzinfo=timezone.utc),
            "endDate": datetime(2026, 8, 31, tzinfo=timezone.utc),
        }
    }

    monkeypatch.setattr(module, "row_to_dict", lambda row: {"createdAt": row.createdAt})

    result = module._detail_to_dict(detail, "participant-1", course_windows)

    assert result["participantId"] == "participant-1"
    assert result["courseId"] == "course-1"
    assert result["course_start_date"] == datetime(2026, 2, 15, 0, 0, 0)
    assert result["course_end_date"] == datetime(2026, 8, 31, 0, 0, 0)


def test_detail_to_dict_normalizes_timestamps_to_naive_utc(monkeypatch):
    module = importlib.import_module(
        "src.modules.participant_analytics.get_participant_responses"
    )

    detail = types.SimpleNamespace(
        createdAt=datetime(2026, 4, 20, 10, 30, tzinfo=timezone.utc),
        practiceQuiz=types.SimpleNamespace(courseId="course-1"),
        microLearning=None,
    )
    course_windows = {
        "course-1": {
            "startDate": datetime(2026, 2, 15, 1, 0, tzinfo=timezone.utc),
            "endDate": datetime(2026, 8, 31, 2, 0, tzinfo=timezone.utc),
        }
    }

    monkeypatch.setattr(module, "row_to_dict", lambda row: {"createdAt": row.createdAt})

    result = module._detail_to_dict(detail, "participant-1", course_windows)

    assert result["createdAt"].tzinfo is None
    assert result["course_start_date"].tzinfo is None
    assert result["course_end_date"].tzinfo is None


def test_load_course_windows_selects_only_required_course_columns():
    module = importlib.import_module(
        "src.modules.participant_analytics.get_participant_responses"
    )

    captured = {}

    class _FakeMappings:
        def all(self):
            return []

    class _FakeResult:
        def mappings(self):
            return _FakeMappings()

    class _FakeSession:
        def execute(self, stmt):
            captured["stmt"] = stmt
            return _FakeResult()

    session = _FakeSession()

    module._load_course_windows(session, {"course-1"})

    columns = [column.key for column in captured["stmt"].selected_columns]
    assert columns == ["id", "startDate", "endDate"]


def test_window_bounds_accept_aware_strings_and_compare_with_naive_datetimes():
    module = importlib.import_module(
        "src.modules.participant_analytics.get_participant_responses"
    )

    start_ts, end_ts = module._coerce_window_bounds(
        "2026-02-15T00:00:00.000Z",
        "2026-02-15T23:59:59.999Z",
    )
    detail_ts = module.coerce_timestamp(datetime(2026, 2, 15, 12, 0, 0))

    assert start_ts <= detail_ts <= end_ts


def _selection_instance_df(options):
    return pd.DataFrame(
        [
            {
                "elementInstanceId": "instance-1",
                "type": "SELECTION",
                "options": options,
            }
        ]
    )


def _case_study_instance_df(options):
    return pd.DataFrame(
        [
            {
                "elementInstanceId": "instance-1",
                "type": "CASE_STUDY",
                "options": options,
            }
        ]
    )


def test_selection_correctness_without_sample_solution_is_treated_as_correct():
    module = importlib.import_module(
        "src.modules.participant_analytics.compute_correctness"
    )

    result = module.compute_correctness_columns(
        _selection_instance_df({"hasSampleSolution": False, "numberOfInputs": 4}),
        {"elementInstanceId": "instance-1", "response": {}},
    )

    assert result == "CORRECT"


@pytest.mark.parametrize(
    ("response", "expected"),
    [
        ({"selection": [1, 2, 3]}, "CORRECT"),
        ({"selection": [1, 1, 2]}, "PARTIAL"),
        ({"selection": [7, 8]}, "INCORRECT"),
    ],
)
def test_selection_correctness_matches_existing_product_grading(response, expected):
    module = importlib.import_module(
        "src.modules.participant_analytics.compute_correctness"
    )

    result = module.compute_correctness_columns(
        _selection_instance_df(
            {
                "hasSampleSolution": True,
                "numberOfInputs": 3,
                "answerCollectionSolutionIds": [1, 2, 3],
            }
        ),
        {"elementInstanceId": "instance-1", "response": response},
    )

    assert result == expected


def test_selection_correctness_returns_none_when_solution_metadata_missing():
    module = importlib.import_module(
        "src.modules.participant_analytics.compute_correctness"
    )

    result = module.compute_correctness_columns(
        _selection_instance_df({"hasSampleSolution": True, "numberOfInputs": 0}),
        {"elementInstanceId": "instance-1", "response": {"selection": [1, 2]}},
    )

    assert result is None


def test_case_study_correctness_without_sample_solution_is_treated_as_correct():
    module = importlib.import_module(
        "src.modules.participant_analytics.compute_correctness"
    )

    result = module.compute_correctness_columns(
        _case_study_instance_df({"hasSampleSolution": False, "cases": []}),
        {"elementInstanceId": "instance-1", "response": {}},
    )

    assert result == "CORRECT"


@pytest.mark.parametrize(
    ("assessment", "expected"),
    [
        (
            [
                {
                    "caseId": "case-1",
                    "itemResponses": [
                        {
                            "itemId": 11,
                            "criterionResponses": [
                                {"criterionId": "crit-1", "response": 5},
                                {"criterionId": "crit-2", "response": 9},
                            ],
                        }
                    ],
                }
            ],
            "CORRECT",
        ),
        (
            [
                {
                    "caseId": "case-1",
                    "itemResponses": [
                        {
                            "itemId": 11,
                            "criterionResponses": [
                                {"criterionId": "crit-1", "response": 5},
                                {"criterionId": "crit-2", "response": 2},
                            ],
                        }
                    ],
                }
            ],
            "PARTIAL",
        ),
        (
            [
                {
                    "caseId": "case-1",
                    "itemResponses": [
                        {
                            "itemId": 11,
                            "criterionResponses": [
                                {"criterionId": "crit-1", "response": -1},
                                {"criterionId": "crit-2", "response": 2},
                            ],
                        }
                    ],
                }
            ],
            "INCORRECT",
        ),
    ],
)
def test_case_study_correctness_matches_existing_product_grading(
    assessment, expected
):
    module = importlib.import_module(
        "src.modules.participant_analytics.compute_correctness"
    )

    result = module.compute_correctness_columns(
        _case_study_instance_df(
            {
                "hasSampleSolution": True,
                "cases": [
                    {
                        "id": "case-1",
                        "solutions": [
                            {
                                "itemId": 11,
                                "criteriaSolutions": [
                                    {"criterionId": "crit-1", "min": 4, "max": 6},
                                    {"criterionId": "crit-2", "min": 8, "max": 10},
                                ],
                            }
                        ],
                    }
                ],
            }
        ),
        {"elementInstanceId": "instance-1", "response": {"assessment": assessment}},
    )

    assert result == expected


def test_case_study_correctness_returns_none_when_solution_metadata_missing():
    module = importlib.import_module(
        "src.modules.participant_analytics.compute_correctness"
    )

    result = module.compute_correctness_columns(
        _case_study_instance_df(
            {
                "hasSampleSolution": True,
                "cases": [{"id": "case-1", "solutions": []}],
            }
        ),
        {
            "elementInstanceId": "instance-1",
            "response": {"assessment": [{"caseId": "case-1", "itemResponses": []}]},
        },
    )

    assert result is None
