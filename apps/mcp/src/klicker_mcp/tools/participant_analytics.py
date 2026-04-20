"""Participant analytics tools.

Read-only wrappers over the `asParticipant`-gated analytics queries. Every tool
forwards the participant's KlickerUZH JWT; the backend enforces
`participantId = ctx.user.sub` server-side, so no local scoping is needed
(thin-adapter invariant, same as `participant.py`).

Two backend ops back two tools each: `MyResponseHistory` powers both
`get_my_response_history` and `get_my_mistakes`, and `ParticipantTopicAccuracy`
powers both `get_weak_topics` and `get_mastery_map`. Exposing both framings
separately is intentional — an LLM reasons better about a tool whose name
encodes the intent than about one it must parameterise correctly.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import Field

from klicker_mcp.app import mcp
from klicker_mcp.gql import AsyncGraphQLClient
from klicker_mcp.tools._annotations import READ_ONLY
from klicker_mcp.tools._helpers import drop_none, require_bearer_token
from klicker_mcp.tools._instrumentation import instrument
from klicker_mcp.tools._meta import tool_meta

AnalyticsTimeframe = Literal["DAILY", "WEEKLY", "MONTHLY", "COURSE"]
ResponseCorrectness = Literal["CORRECT", "PARTIAL", "WRONG"]


@mcp.tool(
    title="Get my course analytics",
    annotations=READ_ONLY,
    meta=tool_meta(audience="participant", category="analytics"),
)
@instrument
async def get_my_course_analytics(
    course_id: Annotated[str, Field(description="Course ID.")],
    timeframe: Annotated[
        AnalyticsTimeframe | None,
        Field(
            description=(
                "Optional client-side filter. If set, only rows of this tier are returned. "
                "Otherwise all tiers (DAILY, WEEKLY, MONTHLY, COURSE) come back in one call."
            ),
        ),
    ] = None,
) -> list[dict[str, Any]]:
    """Return the participant's course analytics rows across tiers."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute(
            "ParticipantCourseAnalytics",
            variables={"courseId": course_id},
            bearer_token=token,
        )
    rows: list[dict[str, Any]] = data.get("participantCourseAnalytics") or []
    if timeframe is None:
        return rows
    return [row for row in rows if row.get("type") == timeframe]


@mcp.tool(
    title="Get my performance",
    annotations=READ_ONLY,
    meta=tool_meta(audience="participant", category="analytics"),
)
@instrument
async def get_my_performance(
    course_id: Annotated[str, Field(description="Course ID.")],
) -> dict[str, Any]:
    """Return the participant's course-level performance tier + error-rate deltas."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute(
            "ParticipantPerformance",
            variables={"courseId": course_id},
            bearer_token=token,
        )
    return data.get("participantPerformance") or {}


@mcp.tool(
    title="Get my activity performance",
    annotations=READ_ONLY,
    meta=tool_meta(audience="participant", category="analytics"),
)
@instrument
async def get_my_activity_performance(
    course_id: Annotated[str, Field(description="Course ID.")],
) -> list[dict[str, Any]]:
    """Return per-activity score + completion rows for the participant."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute(
            "ParticipantActivityPerformance",
            variables={"courseId": course_id},
            bearer_token=token,
        )
    return data.get("participantActivityPerformance") or []


@mcp.tool(
    title="Get my response history",
    annotations=READ_ONLY,
    meta=tool_meta(
        audience="participant",
        category="analytics",
        solution_exposure="submission_gated",
    ),
)
@instrument
async def get_my_response_history(
    course_id: Annotated[
        str | None,
        Field(description="Course ID to filter by. Omit for all courses."),
    ] = None,
    correctness_in: Annotated[
        list[ResponseCorrectness] | None,
        Field(description="Optional filter: only rows whose last-response correctness is in this set."),
    ] = None,
    limit: Annotated[int, Field(description="Max rows to return.", ge=1, le=200)] = 20,
    offset: Annotated[int, Field(description="Pagination offset.", ge=0)] = 0,
) -> dict[str, Any]:
    """Return a paginated page of the participant's response history across elements."""
    token = require_bearer_token()
    variables = drop_none(
        {
            "courseId": course_id,
            "correctnessIn": correctness_in,
            "limit": limit,
            "offset": offset,
        }
    )
    async with AsyncGraphQLClient() as client:
        data = await client.execute("MyResponseHistory", variables=variables, bearer_token=token)
    return data.get("myResponseHistory") or {}


@mcp.tool(
    title="Get my mistakes",
    annotations=READ_ONLY,
    meta=tool_meta(
        audience="participant",
        category="analytics",
        solution_exposure="submission_gated",
    ),
)
@instrument
async def get_my_mistakes(
    course_id: Annotated[
        str | None,
        Field(description="Course ID to filter by. Omit for all courses."),
    ] = None,
    limit: Annotated[int, Field(description="Max rows to return.", ge=1, le=200)] = 20,
    offset: Annotated[int, Field(description="Pagination offset.", ge=0)] = 0,
) -> dict[str, Any]:
    """Return a paginated page of the participant's wrong + partial answers.

    Shares the `MyResponseHistory` backend op with `get_my_response_history`, but
    hard-codes the correctness filter to WRONG + PARTIAL so the LLM cannot widen
    the scope and defeat the tool's semantic purpose.
    """
    token = require_bearer_token()
    variables = drop_none(
        {
            "courseId": course_id,
            "correctnessIn": ["WRONG", "PARTIAL"],
            "limit": limit,
            "offset": offset,
        }
    )
    async with AsyncGraphQLClient() as client:
        data = await client.execute("MyResponseHistory", variables=variables, bearer_token=token)
    return data.get("myResponseHistory") or {}


@mcp.tool(
    title="Get my SRS state",
    annotations=READ_ONLY,
    meta=tool_meta(audience="participant", category="analytics"),
)
@instrument
async def get_my_srs_state(
    practice_quiz_id: Annotated[str, Field(description="Practice quiz ID.")],
) -> list[dict[str, Any]]:
    """Return the participant's SRS state for every element instance in a practice quiz."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute(
            "MySRSState",
            variables={"practiceQuizId": practice_quiz_id},
            bearer_token=token,
        )
    return data.get("mySRSState") or []


@mcp.tool(
    title="Get my weakest topics",
    annotations=READ_ONLY,
    meta=tool_meta(audience="participant", category="analytics"),
)
@instrument
async def get_weak_topics(
    course_id: Annotated[str, Field(description="Course ID.")],
    limit: Annotated[int, Field(description="Max topics to return (weakest first).", ge=1, le=100)] = 10,
) -> list[dict[str, Any]]:
    """Return the participant's weakest topics in a course.

    Backend already sorts by descending error rate (weakest first), so this tool
    just trims to the top-N entries.
    """
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute(
            "ParticipantTopicAccuracy",
            variables={"courseId": course_id},
            bearer_token=token,
        )
    rows: list[dict[str, Any]] = data.get("participantTopicAccuracy") or []
    return rows[:limit]


@mcp.tool(
    title="Get my topic mastery map",
    annotations=READ_ONLY,
    meta=tool_meta(audience="participant", category="analytics"),
)
@instrument
async def get_mastery_map(
    course_id: Annotated[str, Field(description="Course ID.")],
) -> list[dict[str, Any]]:
    """Return a mastery map reshaped as `{topic, mastery, coverage}` per topic.

    `mastery` is the share of correct answers (0..1); `coverage` is the total
    number of responses the participant has submitted on elements tagged with
    the topic. Backend ordering (weakest first) is preserved.
    """
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute(
            "ParticipantTopicAccuracy",
            variables={"courseId": course_id},
            bearer_token=token,
        )
    rows: list[dict[str, Any]] = data.get("participantTopicAccuracy") or []
    out: list[dict[str, Any]] = []
    for row in rows:
        total = row.get("totalCount") or 0
        correct = row.get("correctCount") or 0
        mastery = correct / total if total else 0.0
        out.append({"topic": row.get("tagName"), "mastery": mastery, "coverage": total})
    return out


@mcp.tool(
    title="Get my recent activity",
    annotations=READ_ONLY,
    meta=tool_meta(audience="participant", category="analytics"),
)
@instrument
async def get_my_recent_activity(
    limit: Annotated[int, Field(description="Max entries to return.", ge=1, le=100)] = 20,
) -> list[dict[str, Any]]:
    """Return a chronological feed of the participant's recent responses + achievements."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute(
            "MyRecentActivity",
            variables={"limit": limit},
            bearer_token=token,
        )
    return data.get("myRecentActivity") or []


@mcp.tool(
    title="Get bookmarks across courses",
    annotations=READ_ONLY,
    meta=tool_meta(audience="participant", category="analytics"),
)
@instrument
async def get_bookmarks_across_courses() -> list[dict[str, Any]]:
    """Return the participant's bookmarked stacks, grouped by course."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute("MyBookmarksAcrossCourses", bearer_token=token)
    return data.get("myBookmarksAcrossCourses") or []
