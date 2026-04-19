"""Tests for participant-analytics tools.

Same shape as `test_participant_tools.py`: stub `/api/graphql` with pytest-httpx,
patch bearer-token extractor, inspect outgoing GraphQL body for operation name,
persisted sha256, variable shape, and response pass-through.
"""

from __future__ import annotations

from unittest.mock import patch

import pytest
from pytest_httpx import HTTPXMock

from klicker_mcp.gql.ops import OPERATIONS
from klicker_mcp.tools.participant_analytics import (
    get_bookmarks_across_courses,
    get_mastery_map,
    get_my_activity_performance,
    get_my_course_analytics,
    get_my_mistakes,
    get_my_performance,
    get_my_recent_activity,
    get_my_response_history,
    get_my_srs_state,
    get_weak_topics,
)

from .conftest import mock_graphql, sent_body

# --- get_my_course_analytics ----------------------------------------------


@pytest.mark.asyncio
async def test_get_my_course_analytics_returns_all_tiers(httpx_mock: HTTPXMock) -> None:
    mock_graphql(
        httpx_mock,
        {
            "participantCourseAnalytics": [
                {"id": "1", "type": "DAILY"},
                {"id": "2", "type": "WEEKLY"},
                {"id": "3", "type": "COURSE"},
            ]
        },
    )
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await get_my_course_analytics(course_id="c1")

    body = sent_body(httpx_mock)
    assert body["operationName"] == "ParticipantCourseAnalytics"
    assert body["extensions"]["persistedQuery"]["sha256Hash"] == OPERATIONS["ParticipantCourseAnalytics"]
    assert body["variables"] == {"courseId": "c1"}
    assert len(result) == 3


@pytest.mark.asyncio
async def test_get_my_course_analytics_timeframe_filter(httpx_mock: HTTPXMock) -> None:
    mock_graphql(
        httpx_mock,
        {
            "participantCourseAnalytics": [
                {"id": "1", "type": "DAILY"},
                {"id": "2", "type": "WEEKLY"},
                {"id": "3", "type": "COURSE"},
            ]
        },
    )
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await get_my_course_analytics(course_id="c1", timeframe="WEEKLY")

    assert result == [{"id": "2", "type": "WEEKLY"}]


# --- get_my_performance ---------------------------------------------------


@pytest.mark.asyncio
async def test_get_my_performance(httpx_mock: HTTPXMock) -> None:
    mock_graphql(httpx_mock, {"participantPerformance": {"id": "p1", "totalPerformance": "HIGH"}})
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await get_my_performance(course_id="c1")

    body = sent_body(httpx_mock)
    assert body["operationName"] == "ParticipantPerformance"
    assert body["extensions"]["persistedQuery"]["sha256Hash"] == OPERATIONS["ParticipantPerformance"]
    assert body["variables"] == {"courseId": "c1"}
    assert result == {"id": "p1", "totalPerformance": "HIGH"}


@pytest.mark.asyncio
async def test_get_my_performance_null_row(httpx_mock: HTTPXMock) -> None:
    mock_graphql(httpx_mock, {"participantPerformance": None})
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await get_my_performance(course_id="c1")
    assert result == {}


# --- get_my_activity_performance ------------------------------------------


@pytest.mark.asyncio
async def test_get_my_activity_performance(httpx_mock: HTTPXMock) -> None:
    mock_graphql(
        httpx_mock,
        {"participantActivityPerformance": [{"id": "a1", "activityId": "act1", "completion": 0.5}]},
    )
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await get_my_activity_performance(course_id="c1")

    body = sent_body(httpx_mock)
    assert body["operationName"] == "ParticipantActivityPerformance"
    assert body["extensions"]["persistedQuery"]["sha256Hash"] == OPERATIONS["ParticipantActivityPerformance"]
    assert body["variables"] == {"courseId": "c1"}
    assert result == [{"id": "a1", "activityId": "act1", "completion": 0.5}]


# --- get_my_response_history ----------------------------------------------


@pytest.mark.asyncio
async def test_get_my_response_history_default_args(httpx_mock: HTTPXMock) -> None:
    mock_graphql(httpx_mock, {"myResponseHistory": {"total": 0, "items": []}})
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await get_my_response_history()

    body = sent_body(httpx_mock)
    assert body["operationName"] == "MyResponseHistory"
    assert body["extensions"]["persistedQuery"]["sha256Hash"] == OPERATIONS["MyResponseHistory"]
    assert body["variables"] == {"limit": 20, "offset": 0}
    assert result == {"total": 0, "items": []}


@pytest.mark.asyncio
async def test_get_my_response_history_with_filters(httpx_mock: HTTPXMock) -> None:
    mock_graphql(httpx_mock, {"myResponseHistory": {"total": 1, "items": [{"instanceId": 1}]}})
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        await get_my_response_history(
            course_id="c1",
            correctness_in=["CORRECT"],
            limit=50,
            offset=10,
        )

    body = sent_body(httpx_mock)
    assert body["variables"] == {
        "courseId": "c1",
        "correctnessIn": ["CORRECT"],
        "limit": 50,
        "offset": 10,
    }


# --- get_my_mistakes ------------------------------------------------------


@pytest.mark.asyncio
async def test_get_my_mistakes_hardcodes_correctness(httpx_mock: HTTPXMock) -> None:
    mock_graphql(httpx_mock, {"myResponseHistory": {"total": 2, "items": []}})
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        await get_my_mistakes(course_id="c1", limit=10, offset=0)

    body = sent_body(httpx_mock)
    assert body["operationName"] == "MyResponseHistory"
    # The filter is hard-coded, not user-controllable.
    assert body["variables"] == {
        "courseId": "c1",
        "correctnessIn": ["WRONG", "PARTIAL"],
        "limit": 10,
        "offset": 0,
    }


@pytest.mark.asyncio
async def test_get_my_mistakes_omits_course_id_when_none(httpx_mock: HTTPXMock) -> None:
    mock_graphql(httpx_mock, {"myResponseHistory": {"total": 0, "items": []}})
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        await get_my_mistakes()

    body = sent_body(httpx_mock)
    assert body["variables"] == {
        "correctnessIn": ["WRONG", "PARTIAL"],
        "limit": 20,
        "offset": 0,
    }


# --- get_my_srs_state -----------------------------------------------------


@pytest.mark.asyncio
async def test_get_my_srs_state(httpx_mock: HTTPXMock) -> None:
    mock_graphql(httpx_mock, {"mySRSState": [{"instanceId": 1, "eFactor": 2.5}]})
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await get_my_srs_state(practice_quiz_id="pq1")

    body = sent_body(httpx_mock)
    assert body["operationName"] == "MySRSState"
    assert body["extensions"]["persistedQuery"]["sha256Hash"] == OPERATIONS["MySRSState"]
    assert body["variables"] == {"practiceQuizId": "pq1"}
    assert result == [{"instanceId": 1, "eFactor": 2.5}]


# --- get_weak_topics ------------------------------------------------------


@pytest.mark.asyncio
async def test_get_weak_topics_trims_to_limit(httpx_mock: HTTPXMock) -> None:
    mock_graphql(
        httpx_mock,
        {
            "participantTopicAccuracy": [
                {"tagId": 1, "tagName": "a", "totalCount": 10, "correctCount": 2},
                {"tagId": 2, "tagName": "b", "totalCount": 10, "correctCount": 5},
                {"tagId": 3, "tagName": "c", "totalCount": 10, "correctCount": 7},
                {"tagId": 4, "tagName": "d", "totalCount": 10, "correctCount": 9},
            ]
        },
    )
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await get_weak_topics(course_id="c1", limit=2)

    body = sent_body(httpx_mock)
    assert body["operationName"] == "ParticipantTopicAccuracy"
    assert body["extensions"]["persistedQuery"]["sha256Hash"] == OPERATIONS["ParticipantTopicAccuracy"]
    assert body["variables"] == {"courseId": "c1"}
    # Backend sorts weakest-first, so the top-2 slice takes tags "a" and "b".
    assert [row["tagName"] for row in result] == ["a", "b"]


@pytest.mark.asyncio
async def test_get_weak_topics_default_limit(httpx_mock: HTTPXMock) -> None:
    mock_graphql(httpx_mock, {"participantTopicAccuracy": []})
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await get_weak_topics(course_id="c1")
    assert result == []


# --- get_mastery_map ------------------------------------------------------


@pytest.mark.asyncio
async def test_get_mastery_map_reshapes_rows(httpx_mock: HTTPXMock) -> None:
    mock_graphql(
        httpx_mock,
        {
            "participantTopicAccuracy": [
                {"tagId": 1, "tagName": "algebra", "totalCount": 10, "correctCount": 4},
                {"tagId": 2, "tagName": "geometry", "totalCount": 5, "correctCount": 5},
            ]
        },
    )
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await get_mastery_map(course_id="c1")

    assert result == [
        {"topic": "algebra", "mastery": 0.4, "coverage": 10},
        {"topic": "geometry", "mastery": 1.0, "coverage": 5},
    ]


@pytest.mark.asyncio
async def test_get_mastery_map_handles_zero_total(httpx_mock: HTTPXMock) -> None:
    mock_graphql(
        httpx_mock,
        {"participantTopicAccuracy": [{"tagId": 1, "tagName": "unanswered", "totalCount": 0, "correctCount": 0}]},
    )
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await get_mastery_map(course_id="c1")
    assert result == [{"topic": "unanswered", "mastery": 0.0, "coverage": 0}]


# --- get_my_recent_activity -----------------------------------------------


@pytest.mark.asyncio
async def test_get_my_recent_activity(httpx_mock: HTTPXMock) -> None:
    mock_graphql(
        httpx_mock,
        {
            "myRecentActivity": [
                {"type": "RESPONSE", "timestamp": "2026-04-01T00:00:00Z", "summary": "x", "targetId": "1"},
            ]
        },
    )
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await get_my_recent_activity(limit=10)

    body = sent_body(httpx_mock)
    assert body["operationName"] == "MyRecentActivity"
    assert body["extensions"]["persistedQuery"]["sha256Hash"] == OPERATIONS["MyRecentActivity"]
    assert body["variables"] == {"limit": 10}
    assert result == [
        {"type": "RESPONSE", "timestamp": "2026-04-01T00:00:00Z", "summary": "x", "targetId": "1"},
    ]


@pytest.mark.asyncio
async def test_get_my_recent_activity_default_limit(httpx_mock: HTTPXMock) -> None:
    mock_graphql(httpx_mock, {"myRecentActivity": []})
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        await get_my_recent_activity()
    body = sent_body(httpx_mock)
    assert body["variables"] == {"limit": 20}


# --- get_bookmarks_across_courses -----------------------------------------


@pytest.mark.asyncio
async def test_get_bookmarks_across_courses(httpx_mock: HTTPXMock) -> None:
    mock_graphql(
        httpx_mock,
        {"myBookmarksAcrossCourses": [{"courseId": "c1", "courseName": "K1", "stacks": []}]},
    )
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await get_bookmarks_across_courses()

    body = sent_body(httpx_mock)
    assert body["operationName"] == "MyBookmarksAcrossCourses"
    assert body["extensions"]["persistedQuery"]["sha256Hash"] == OPERATIONS["MyBookmarksAcrossCourses"]
    assert body["variables"] == {}
    assert result == [{"courseId": "c1", "courseName": "K1", "stacks": []}]


# --- Auth guard -----------------------------------------------------------


@pytest.mark.asyncio
async def test_get_my_performance_requires_bearer() -> None:
    from klicker_mcp.tools._helpers import NotAuthenticatedError

    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value=None):
        with pytest.raises(NotAuthenticatedError):
            await get_my_performance(course_id="c1")


# --- Registration sanity --------------------------------------------------


@pytest.mark.asyncio
async def test_all_participant_analytics_tools_registered() -> None:
    from klicker_mcp.server import mcp

    tools = await mcp.list_tools()
    names = {t.name for t in tools}
    expected = {
        "get_my_course_analytics",
        "get_my_performance",
        "get_my_activity_performance",
        "get_my_response_history",
        "get_my_mistakes",
        "get_my_srs_state",
        "get_weak_topics",
        "get_mastery_map",
        "get_my_recent_activity",
        "get_bookmarks_across_courses",
    }
    missing = expected - names
    assert not missing, f"missing tools: {missing}"
