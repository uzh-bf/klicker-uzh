"""Tests for lecturer-role tools.

Each test stubs `/api/graphql` with pytest-httpx, patches the bearer-token
extractor so the tool sees an authenticated request, then inspects the outgoing
GraphQL body to confirm:
- the correct persisted operation is invoked (sha256 present)
- variables are shaped correctly for the mutation
- `status` defaults to DRAFT
- options get marshalled from pydantic models into plain dicts
- None-valued fields are dropped so the backend applies its defaults
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import patch

import pytest
from pytest_httpx import HTTPXMock

from klicker_mcp.gql.ops import OPERATIONS
from klicker_mcp.tools.lecturer import (
    Choice,
    FreeTextRestrictions,
    NumericalRange,
    NumericalRestrictions,
    create_choices_question,
    create_content_element,
    create_flashcard,
    create_free_text_question,
    create_numerical_question,
    list_my_questions,
)


def _mock_graphql(httpx_mock: HTTPXMock, operation_name: str, response_data: dict[str, Any]) -> None:
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


@pytest.mark.asyncio
async def test_create_choices_question_defaults_to_draft(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(
        httpx_mock,
        "ManipulateChoicesQuestion",
        {"manipulateChoicesQuestion": {"id": 7, "status": "DRAFT"}},
    )

    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await create_choices_question(
            question_type="SC",
            name="q-1",
            content="What is 2+2?",
            choices=[
                Choice(ix=0, value="3", correct=False),
                Choice(ix=1, value="4", correct=True),
            ],
        )

    body = _sent_body(httpx_mock)
    assert body["operationName"] == "ManipulateChoicesQuestion"
    assert body["extensions"]["persistedQuery"]["sha256Hash"] == OPERATIONS["ManipulateChoicesQuestion"]
    assert body["variables"]["status"] == "DRAFT"
    assert body["variables"]["type"] == "SC"
    assert body["variables"]["options"]["choices"] == [
        {"ix": 0, "value": "3", "correct": False},
        {"ix": 1, "value": "4", "correct": True},
    ]
    # id, explanation, tags, pointsMultiplier, basePoints were not provided:
    # they should be dropped so the backend applies its defaults.
    assert "id" not in body["variables"]
    assert "explanation" not in body["variables"]
    assert result == {"id": 7, "status": "DRAFT"}


@pytest.mark.asyncio
async def test_create_choices_question_honors_explicit_ready(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(
        httpx_mock,
        "ManipulateChoicesQuestion",
        {"manipulateChoicesQuestion": {"id": 8, "status": "READY"}},
    )

    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        await create_choices_question(
            question_type="MC",
            name="q-2",
            content="?",
            choices=[
                Choice(ix=0, value="a", correct=True),
                Choice(ix=1, value="b", correct=True),
            ],
            status="READY",
        )

    body = _sent_body(httpx_mock)
    assert body["variables"]["status"] == "READY"


@pytest.mark.asyncio
async def test_create_choices_question_requires_bearer_token() -> None:
    from klicker_mcp.tools._helpers import NotAuthenticatedError

    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value=None):
        with pytest.raises(NotAuthenticatedError):
            await create_choices_question(
                question_type="SC",
                name="q",
                content="?",
                choices=[
                    Choice(ix=0, value="a", correct=True),
                    Choice(ix=1, value="b", correct=False),
                ],
            )


@pytest.mark.asyncio
async def test_create_free_text_question_marshals_restrictions(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(
        httpx_mock,
        "ManipulateFreeTextQuestion",
        {"manipulateFreeTextQuestion": {"id": 9}},
    )

    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        await create_free_text_question(
            name="ft",
            content="Explain it.",
            solutions=["answer"],
            restrictions=FreeTextRestrictions(min_length=10, max_length=200),
        )

    body = _sent_body(httpx_mock)
    opts = body["variables"]["options"]
    assert opts["restrictions"] == {"minLength": 10, "maxLength": 200}
    assert opts["solutions"] == ["answer"]
    assert body["variables"]["status"] == "DRAFT"


@pytest.mark.asyncio
async def test_create_numerical_question_marshals_ranges(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(
        httpx_mock,
        "ManipulateNumericalQuestion",
        {"manipulateNumericalQuestion": {"id": 10}},
    )

    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        await create_numerical_question(
            name="n",
            content="pi to 2dp?",
            exact_solutions=[3.14],
            solution_ranges=[NumericalRange(min=3.13, max=3.15)],
            accuracy=2,
            unit="m",
            restrictions=NumericalRestrictions(min=0.0, max=10.0),
        )

    body = _sent_body(httpx_mock)
    opts = body["variables"]["options"]
    assert opts["exactSolutions"] == [3.14]
    assert opts["solutionRanges"] == [{"min": 3.13, "max": 3.15}]
    assert opts["restrictions"] == {"min": 0.0, "max": 10.0}
    assert opts["unit"] == "m"


@pytest.mark.asyncio
async def test_create_flashcard_and_content_element(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(
        httpx_mock,
        "ManipulateFlashcardElement",
        {"manipulateFlashcardElement": {"id": 11}},
    )
    _mock_graphql(
        httpx_mock,
        "ManipulateContentElement",
        {"manipulateContentElement": {"id": 12}},
    )

    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        flashcard = await create_flashcard(name="fc", content="front?", explanation="back!")
        content = await create_content_element(name="c", content="# Reading")

    assert flashcard == {"id": 11}
    assert content == {"id": 12}

    requests = httpx_mock.get_requests()
    assert len(requests) == 2
    first = json.loads(requests[0].content)
    second = json.loads(requests[1].content)
    assert first["operationName"] == "ManipulateFlashcardElement"
    assert second["operationName"] == "ManipulateContentElement"
    assert first["variables"]["status"] == "DRAFT"
    assert second["variables"]["status"] == "DRAFT"


@pytest.mark.asyncio
async def test_list_my_questions_uses_sensible_defaults(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(
        httpx_mock,
        "GetUserElements",
        {"userElements": {"numOfElements": 0, "elements": []}},
    )

    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        result = await list_my_questions()

    body = _sent_body(httpx_mock)
    vars_ = body["variables"]
    assert vars_["showOwned"] is True
    assert vars_["showShared"] is False
    assert vars_["showArchived"] is False
    assert vars_["sortByType"] == "MODIFIED"
    assert vars_["sortByAsc"] is False
    assert vars_["numEntries"] == 20
    assert vars_["offset"] == 0
    assert vars_["tagIds"] == []
    assert result == {"numOfElements": 0, "elements": []}


@pytest.mark.asyncio
async def test_list_my_questions_respects_filters(httpx_mock: HTTPXMock) -> None:
    _mock_graphql(
        httpx_mock,
        "GetUserElements",
        {"userElements": {"numOfElements": 1, "elements": [{"id": 1}]}},
    )

    with patch("klicker_mcp.tools._helpers.get_bearer_token", return_value="tkn"):
        await list_my_questions(
            status="DRAFT",
            question_type="SC",
            search_string="math",
            num_entries=5,
            offset=10,
        )

    body = _sent_body(httpx_mock)
    vars_ = body["variables"]
    assert vars_["status"] == "DRAFT"
    assert vars_["type"] == "SC"
    assert vars_["searchString"] == "math"
    assert vars_["numEntries"] == 5
    assert vars_["offset"] == 10


@pytest.mark.asyncio
async def test_all_lecturer_tools_are_registered() -> None:
    from klicker_mcp.server import mcp

    tools = await mcp.list_tools()
    names = {t.name for t in tools}
    expected = {
        "whoami",
        "create_choices_question",
        "create_free_text_question",
        "create_numerical_question",
        "create_flashcard",
        "create_content_element",
        "list_my_questions",
    }
    missing = expected - names
    assert not missing, f"missing tools: {missing}"
