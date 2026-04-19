"""Tests for participant-role tools.

Same pattern as `test_lecturer_tools.py`: stub `/api/graphql` with pytest-httpx,
patch bearer-token extractor, inspect outgoing GraphQL body for operation name,
persisted sha256, variable shape, and response pass-through.
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import patch

import pytest
from pytest_httpx import HTTPXMock

from klicker_mcp.gql.ops import OPERATIONS
from klicker_mcp.tools.participant import (
    ChoicesResponse,
    StackResponse,
    bookmark_stack,
    flag_element,
    get_assessment_results,
    get_course_leaderboard,
    get_course_overview,
    get_course_timeline,
    get_group_activity,
    get_microlearning,
    get_my_achievements,
    get_practice_quiz,
    get_previous_stack_evaluation,
    list_bookmarks,
    list_group_activities,
    list_live_qa,
    list_my_courses,
    list_practice_quizzes,
    post_live_qa_question,
    rate_element,
    send_confusion_signal,
    submit_stack_response,
    upvote_live_qa,
)


def _mock_graphql(httpx_mock: HTTPXMock, _operation_name: str, response_data: dict[str, Any]) -> None:
    httpx_mock.add_response(
        url="http://localhost:3000/api/graphql",
        method="POST",
        json={"data": response_data},
    )


def _sent_body(httpx_mock: HTTPXMock) -> dict[str, Any]:
    request = httpx_mock.get_request()
    assert request is not None
    body: dict[str, Any] = json.loads(request.content)
    return body


# --- Discovery / read ------------------------------------------------------


@pytest.mark.asyncio
async def test_list_my_courses(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(httpx_mock, "GetParticipantCourses", {"participantCourses": [{"id": "c1"}]})
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await list_my_courses()

    body = _sent_body(httpx_mock)
    assert body["operationName"] == "GetParticipantCourses"
    assert body["extensions"]["persistedQuery"]["sha256Hash"] == OPERATIONS["GetParticipantCourses"]
    assert result == [{"id": "c1"}]


@pytest.mark.asyncio
async def test_list_practice_quizzes(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(httpx_mock, "GetPracticeQuizList", {"getPracticeQuizList": []})
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await list_practice_quizzes()
    assert result == []
    body = _sent_body(httpx_mock)
    assert body["operationName"] == "GetPracticeQuizList"


@pytest.mark.asyncio
async def test_get_practice_quiz_tolerates_missing_bearer(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(httpx_mock, "GetPracticeQuiz", {"practiceQuiz": {"id": "pq"}})
    with patch("klicker_mcp.tools.participant.get_bearer_token", return_value=None):
        result = await get_practice_quiz(id="pq")

    request = httpx_mock.get_request()
    assert request is not None
    assert "authorization" not in (k.lower() for k in request.headers.keys())
    assert result == {"id": "pq"}


@pytest.mark.asyncio
async def test_get_practice_quiz_sends_token_when_available(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(httpx_mock, "GetPracticeQuiz", {"practiceQuiz": {"id": "pq"}})
    with patch("klicker_mcp.tools.participant.get_bearer_token", return_value="tkn"):
        await get_practice_quiz(id="pq")

    request = httpx_mock.get_request()
    assert request is not None
    assert request.headers.get("authorization") == "Bearer tkn"


@pytest.mark.asyncio
async def test_get_microlearning(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(httpx_mock, "GetMicroLearning", {"microLearning": {"id": "ml"}})
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await get_microlearning(id="ml")
    body = _sent_body(httpx_mock)
    assert body["variables"] == {"id": "ml"}
    assert result == {"id": "ml"}


@pytest.mark.asyncio
async def test_get_previous_stack_evaluation(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(
        httpx_mock,
        "GetPreviousStackEvaluation",
        {"getPreviousStackEvaluation": {"id": 42, "score": 10}},
    )
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await get_previous_stack_evaluation(stack_id=42)
    body = _sent_body(httpx_mock)
    assert body["variables"] == {"stackId": 42}
    assert result == {"id": 42, "score": 10}


@pytest.mark.asyncio
async def test_list_bookmarks(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(httpx_mock, "GetBookmarkedElementStacks", {"getBookmarkedElementStacks": []})
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        await list_bookmarks(course_id="c1")
    body = _sent_body(httpx_mock)
    assert body["variables"] == {"courseId": "c1"}


@pytest.mark.asyncio
async def test_list_live_qa(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(httpx_mock, "GetFeedbacks", {"feedbacks": [{"id": 1}]})
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await list_live_qa(quiz_id="q1")
    assert result == [{"id": 1}]


@pytest.mark.asyncio
async def test_get_course_overview_splits_payload(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(
        httpx_mock,
        "GetCourseOverviewData",
        {
            "getCourseOverviewData": {"id": "c1"},
            "participantGroups": [{"id": "g1"}],
        },
    )
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await get_course_overview(course_id="c1")
    assert result == {"overview": {"id": "c1"}, "groups": [{"id": "g1"}]}


@pytest.mark.asyncio
async def test_get_course_leaderboard_default_mode(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(
        httpx_mock,
        "GetStudentCourseLeaderboard",
        {"getStudentCourseLeaderboard": {"leaderboard": []}},
    )
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        await get_course_leaderboard(course_id="c1")
    body = _sent_body(httpx_mock)
    assert body["variables"] == {"courseId": "c1", "mode": "course"}


@pytest.mark.asyncio
async def test_get_my_achievements(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(
        httpx_mock,
        "SelfWithAchievements",
        {"selfWithAchievements": {"participant": {"xp": 42}}},
    )
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await get_my_achievements()
    assert result == {"participant": {"xp": 42}}


@pytest.mark.asyncio
async def test_get_course_timeline(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(httpx_mock, "GetCourseStudentTimelines", {"getCourseStudentTimelines": []})
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await get_course_timeline()
    assert result == []


@pytest.mark.asyncio
async def test_get_assessment_results(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(
        httpx_mock,
        "GetStudentAssessmentResults",
        {"studentAssessmentResults": {"liveQuizzes": []}},
    )
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await get_assessment_results(course_id="c1")
    assert result == {"liveQuizzes": []}


@pytest.mark.asyncio
async def test_list_group_activities(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(httpx_mock, "GetCourseGroupActivities", {"groupActivities": []})
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        await list_group_activities(course_id="c1")


@pytest.mark.asyncio
async def test_get_group_activity(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(
        httpx_mock,
        "GroupActivityDetails",
        {"groupActivityDetails": {"id": "ga"}},
    )
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        await get_group_activity(activity_id="ga", group_id="g1")
    body = _sent_body(httpx_mock)
    assert body["variables"] == {"activityId": "ga", "groupId": "g1"}


# --- Hero write ------------------------------------------------------------


@pytest.mark.asyncio
async def test_submit_stack_response_marshals_choices_and_numeric(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(
        httpx_mock,
        "RespondToElementStack",
        {
            "respondToElementStack": {
                "id": 5,
                "status": "CORRECT",
                "score": 10,
            }
        },
    )
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await submit_stack_response(
            stack_id=5,
            course_id="c1",
            responses=[
                StackResponse(
                    instance_id=1,
                    type="SC",
                    choices_response=[
                        ChoicesResponse(ix=0, selected=False),
                        ChoicesResponse(ix=1, selected=True),
                    ],
                ),
                StackResponse(instance_id=2, type="NUMERICAL", numerical_response=3.14),
            ],
            stack_answer_time=30,
        )

    body = _sent_body(httpx_mock)
    assert body["operationName"] == "RespondToElementStack"
    assert body["variables"]["isOwner"] is False
    assert body["variables"]["stackAnswerTime"] == 30
    responses = body["variables"]["responses"]
    assert responses[0] == {
        "instanceId": 1,
        "type": "SC",
        "choicesResponse": [
            {"ix": 0, "selected": False},
            {"ix": 1, "selected": True},
        ],
    }
    assert responses[1] == {
        "instanceId": 2,
        "type": "NUMERICAL",
        "numericalResponse": 3.14,
    }
    assert result["score"] == 10


@pytest.mark.asyncio
async def test_submit_stack_response_marshals_flashcard_and_content(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(
        httpx_mock,
        "RespondToElementStack",
        {"respondToElementStack": {"id": 6}},
    )
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        await submit_stack_response(
            stack_id=6,
            course_id="c1",
            responses=[
                StackResponse(instance_id=3, type="FLASHCARD", flashcard_response="PARTIAL"),
                StackResponse(instance_id=4, type="CONTENT", content_response=True),
                StackResponse(instance_id=5, type="FREE_TEXT", free_text_response="hi"),
                StackResponse(instance_id=6, type="SELECTION", selection_response=[0, 2]),
            ],
        )

    body = _sent_body(httpx_mock)
    responses = body["variables"]["responses"]
    assert responses[0] == {"instanceId": 3, "type": "FLASHCARD", "flashcardResponse": "PARTIAL"}
    # Backend field name is the typoed `contentReponse` (no 's').
    assert responses[1] == {"instanceId": 4, "type": "CONTENT", "contentReponse": True}
    assert responses[2] == {"instanceId": 5, "type": "FREE_TEXT", "freeTextResponse": "hi"}
    assert responses[3] == {"instanceId": 6, "type": "SELECTION", "selectionResponse": [0, 2]}


@pytest.mark.asyncio
async def test_submit_stack_response_requires_bearer() -> None:
    from klicker_mcp.tools._helpers import NotAuthenticatedError

    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value=None):
        with pytest.raises(NotAuthenticatedError):
            await submit_stack_response(
                stack_id=1,
                course_id="c",
                responses=[StackResponse(instance_id=1, type="CONTENT", content_response=True)],
            )


# --- Remaining writes ------------------------------------------------------


@pytest.mark.asyncio
async def test_bookmark_stack(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(httpx_mock, "BookmarkElementStack", {"bookmarkElementStack": [5]})
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await bookmark_stack(stack_id=5, course_id="c1", bookmarked=True)
    body = _sent_body(httpx_mock)
    assert body["variables"] == {"stackId": 5, "courseId": "c1", "bookmarked": True}
    assert result == [5]


@pytest.mark.asyncio
async def test_flag_element(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(httpx_mock, "FlagElement", {"flagElement": {"id": 1}})
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        await flag_element(element_instance_id=10, element_id=20, content="typo in Q")
    body = _sent_body(httpx_mock)
    assert body["variables"] == {
        "elementInstanceId": 10,
        "elementId": 20,
        "content": "typo in Q",
    }


@pytest.mark.asyncio
async def test_rate_element(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(httpx_mock, "RateElement", {"rateElement": {"id": 1, "upvote": 1}})
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        await rate_element(element_instance_id=10, element_id=20, rating=1)
    body = _sent_body(httpx_mock)
    assert body["variables"]["rating"] == 1


@pytest.mark.asyncio
async def test_post_live_qa_question(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(
        httpx_mock,
        "CreateFeedback",
        {"createFeedback": {"id": 7, "content": "?"}},
    )
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await post_live_qa_question(quiz_id="q1", content="Why?")
    body = _sent_body(httpx_mock)
    assert body["variables"] == {"quizId": "q1", "content": "Why?"}
    assert result["id"] == 7


@pytest.mark.asyncio
async def test_upvote_live_qa(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(httpx_mock, "UpvoteFeedback", {"upvoteFeedback": {"id": 1, "votes": 5}})
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        await upvote_live_qa(feedback_id=1)
    body = _sent_body(httpx_mock)
    assert body["variables"] == {"feedbackId": 1, "increment": 1}


@pytest.mark.asyncio
async def test_send_confusion_signal(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(
        httpx_mock,
        "AddConfusionTimestep",
        {"addConfusionTimestep": {"difficulty": 1, "speed": -1}},
    )
    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        await send_confusion_signal(quiz_id="q1", difficulty=1, speed=-1)
    body = _sent_body(httpx_mock)
    assert body["variables"] == {"quizId": "q1", "difficulty": 1, "speed": -1}


# --- Registration sanity ---------------------------------------------------


@pytest.mark.asyncio
async def test_all_participant_tools_are_registered() -> None:
    from klicker_mcp.server import mcp

    tools = await mcp.list_tools()
    names = {t.name for t in tools}
    expected = {
        "list_my_courses",
        "list_practice_quizzes",
        "get_practice_quiz",
        "get_microlearning",
        "get_previous_stack_evaluation",
        "submit_stack_response",
        "bookmark_stack",
        "list_bookmarks",
        "flag_element",
        "rate_element",
        "list_live_qa",
        "post_live_qa_question",
        "upvote_live_qa",
        "send_confusion_signal",
        "get_course_overview",
        "get_course_leaderboard",
        "get_my_achievements",
        "get_course_timeline",
        "get_assessment_results",
        "list_group_activities",
        "get_group_activity",
    }
    missing = expected - names
    assert not missing, f"missing tools: {missing}"
