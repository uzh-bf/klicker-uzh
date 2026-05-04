"""Participant-role tools: quiz discovery, response submission, feedback.

All tools forward the user's KlickerUZH JWT. Backend enforces the
`asParticipant` role guard on each op, so we don't duplicate that check
locally (thin-adapter invariant).

Every write tool is a deliberate student action (submit a response, flag an
element, post a live-Q&A question). Each `@mcp.tool` declares the full
annotation set (`readOnlyHint`, `destructiveHint`, `idempotentHint`,
`openWorldHint`) so MCP clients can gate writes behind explicit user approval.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field

from klicker_mcp.app import mcp
from klicker_mcp.gql import AsyncGraphQLClient
from klicker_mcp.tools._annotations import CUMULATIVE_WRITE, IDEMPOTENT_WRITE, READ_ONLY
from klicker_mcp.tools._helpers import get_bearer_token, require_bearer_token
from klicker_mcp.tools._instrumentation import instrument
from klicker_mcp.tools._meta import tool_meta

ElementType = Literal[
    "SC",
    "MC",
    "KPRIM",
    "FREE_TEXT",
    "NUMERICAL",
    "CONTENT",
    "FLASHCARD",
    "SELECTION",
    "CASE_STUDY",
]
FlashcardCorrectness = Literal["CORRECT", "PARTIAL", "INCORRECT"]
LeaderboardMode = Literal["practiceQuiz", "microLearning", "course"]


class ChoicesResponse(BaseModel):
    """One selection within a single-choice / multi-choice / KPrim response."""

    ix: Annotated[int, Field(description="0-based index of the choice being reported.")]
    selected: Annotated[bool, Field(description="True if the student selected this choice.")]


class StackResponse(BaseModel):
    """A response to a single element inside a stack.

    Exactly one of the typed-response fields should be populated, matching the
    element's `type`. All others are dropped before sending.
    """

    instance_id: Annotated[int, Field(description="ID of the `ElementInstance` being answered.")]
    type: Annotated[
        ElementType,
        Field(description="Element type — determines which response field below is read."),
    ]
    choices_response: Annotated[
        list[ChoicesResponse] | None,
        Field(description="For SC/MC/KPRIM: one entry per choice with `ix` + `selected`."),
    ] = None
    numerical_response: Annotated[float | None, Field(description="For NUMERICAL: the student's numeric answer.")] = (
        None
    )
    free_text_response: Annotated[str | None, Field(description="For FREE_TEXT: the student's typed answer.")] = None
    flashcard_response: Annotated[
        FlashcardCorrectness | None,
        Field(description="For FLASHCARD: self-assessed correctness."),
    ] = None
    content_response: Annotated[
        bool | None,
        Field(description="For CONTENT: true once the student has marked the content as read."),
    ] = None
    selection_response: Annotated[
        list[int] | None,
        Field(description="For SELECTION: list of selected indices."),
    ] = None

    def to_graphql(self) -> dict[str, Any]:
        payload: dict[str, Any] = {"instanceId": self.instance_id, "type": self.type}
        if self.choices_response is not None:
            payload["choicesResponse"] = [c.model_dump() for c in self.choices_response]
        if self.numerical_response is not None:
            payload["numericalResponse"] = self.numerical_response
        if self.free_text_response is not None:
            payload["freeTextResponse"] = self.free_text_response
        if self.flashcard_response is not None:
            payload["flashcardResponse"] = self.flashcard_response
        if self.content_response is not None:
            # Note: backend field is `contentReponse` (typo preserved in the schema).
            payload["contentReponse"] = self.content_response
        if self.selection_response is not None:
            payload["selectionResponse"] = self.selection_response
        return payload


# --- Discovery / read ------------------------------------------------------


@mcp.tool(
    title="List my courses",
    annotations=READ_ONLY,
    meta=tool_meta(audience="participant", category="discovery"),
)
@instrument
async def list_my_courses() -> list[dict[str, Any]]:
    """List courses the authenticated participant is enrolled in."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute("GetParticipantCourses", bearer_token=token)
    return data.get("participantCourses") or []


@mcp.tool(
    title="List practice quizzes",
    annotations=READ_ONLY,
    meta=tool_meta(audience="participant", category="discovery"),
)
@instrument
async def list_practice_quizzes() -> list[dict[str, Any]]:
    """List practice quizzes visible to the participant, grouped by course."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute("GetPracticeQuizList", bearer_token=token)
    return data.get("getPracticeQuizList") or []


@mcp.tool(
    title="Get practice quiz",
    annotations=READ_ONLY,
    meta=tool_meta(audience="participant", category="practice-read"),
)
@instrument
async def get_practice_quiz(
    id: Annotated[str, Field(description="Practice quiz ID.")],
) -> dict[str, Any]:
    """Return a practice quiz with its stacks.

    This op is an open field on the backend (no auth required), so the tool
    tolerates a missing bearer token. Sent without `Authorization` if no
    header is present.

    Solutions are never returned ahead of a submitted response — the backend
    gates that server-side via `PracticeQuizDataWithoutSolutions`.
    """
    token = get_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute("GetPracticeQuiz", variables={"id": id}, bearer_token=token)
    return data.get("practiceQuiz") or {}


@mcp.tool(
    title="Get micro-learning",
    annotations=READ_ONLY,
    meta=tool_meta(audience="participant", category="practice-read"),
)
@instrument
async def get_microlearning(
    id: Annotated[str, Field(description="Micro-learning ID.")],
) -> dict[str, Any]:
    """Return a micro-learning activity with its stacks (solutions gated server-side)."""
    token = get_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute("GetMicroLearning", variables={"id": id}, bearer_token=token)
    return data.get("microLearning") or {}


@mcp.tool(
    title="Get previous stack evaluation",
    annotations=READ_ONLY,
    meta=tool_meta(
        audience="participant",
        category="practice-read",
        solution_exposure="post_submission_only",
    ),
)
@instrument
async def get_previous_stack_evaluation(
    stack_id: Annotated[int, Field(description="ElementStack ID.")],
) -> dict[str, Any]:
    """Return the participant's previous evaluation for a stack (micro-learning only)."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute(
            "GetPreviousStackEvaluation",
            variables={"stackId": stack_id},
            bearer_token=token,
        )
    return data.get("getPreviousStackEvaluation") or {}


@mcp.tool(
    title="List my bookmarks",
    annotations=READ_ONLY,
    meta=tool_meta(audience="participant", category="practice-read"),
)
@instrument
async def list_bookmarks(
    course_id: Annotated[str, Field(description="Course ID to list bookmarked stacks for.")],
) -> list[dict[str, Any]]:
    """List stacks the participant has bookmarked in a course."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute(
            "GetBookmarkedElementStacks",
            variables={"courseId": course_id},
            bearer_token=token,
        )
    return data.get("getBookmarkedElementStacks") or []


@mcp.tool(
    title="List live Q&A entries",
    annotations=READ_ONLY,
    meta=tool_meta(audience="participant", category="live-session"),
)
@instrument
async def list_live_qa(
    quiz_id: Annotated[str, Field(description="Live-quiz ID to list Q&A feedback for.")],
) -> list[dict[str, Any]]:
    """List live-quiz Q&A entries (student questions to the lecturer)."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute("GetFeedbacks", variables={"quizId": quiz_id}, bearer_token=token)
    return data.get("feedbacks") or []


@mcp.tool(
    title="Get course overview",
    annotations=READ_ONLY,
    meta=tool_meta(audience="participant", category="gamification"),
)
@instrument
async def get_course_overview(
    course_id: Annotated[str, Field(description="Course ID.")],
) -> dict[str, Any]:
    """Return course-level gamification data: XP, level, groups, leaderboard."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute("GetCourseOverviewData", variables={"courseId": course_id}, bearer_token=token)
    return {
        "overview": data.get("getCourseOverviewData") or {},
        "groups": data.get("participantGroups") or [],
    }


@mcp.tool(
    title="Get course leaderboard",
    annotations=READ_ONLY,
    meta=tool_meta(audience="participant", category="gamification"),
)
@instrument
async def get_course_leaderboard(
    course_id: Annotated[str, Field(description="Course ID.")],
    mode: Annotated[
        LeaderboardMode,
        Field(description="Scope: practiceQuiz, microLearning, or overall course."),
    ] = "course",
) -> dict[str, Any]:
    """Return the course leaderboard and the participant's rank."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute(
            "GetStudentCourseLeaderboard",
            variables={"courseId": course_id, "mode": mode},
            bearer_token=token,
        )
    return data.get("getStudentCourseLeaderboard") or {}


@mcp.tool(
    title="Get my achievements",
    annotations=READ_ONLY,
    meta=tool_meta(audience="participant", category="gamification"),
)
@instrument
async def get_my_achievements() -> dict[str, Any]:
    """Return the participant's profile, XP/level, and achievement catalog."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute("SelfWithAchievements", bearer_token=token)
    return data.get("selfWithAchievements") or {}


@mcp.tool(
    title="Get course timeline",
    annotations=READ_ONLY,
    meta=tool_meta(audience="participant", category="gamification"),
)
@instrument
async def get_course_timeline() -> list[dict[str, Any]]:
    """Return per-day XP/points timelines across the participant's courses."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute("GetCourseStudentTimelines", bearer_token=token)
    return data.get("getCourseStudentTimelines") or []


@mcp.tool(
    title="Get assessment results",
    annotations=READ_ONLY,
    meta=tool_meta(audience="participant", category="analytics"),
)
@instrument
async def get_assessment_results(
    course_id: Annotated[str, Field(description="Course ID.")],
) -> dict[str, Any]:
    """Return assessment-mode results across live quizzes, practice quizzes, micro-learnings, group activities."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute(
            "GetStudentAssessmentResults",
            variables={"courseId": course_id},
            bearer_token=token,
        )
    return data.get("studentAssessmentResults") or {}


@mcp.tool(
    title="List group activities",
    annotations=READ_ONLY,
    meta=tool_meta(audience="participant", category="discovery"),
)
@instrument
async def list_group_activities(
    course_id: Annotated[str, Field(description="Course ID.")],
) -> list[dict[str, Any]]:
    """List group activities in a course."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute(
            "GetCourseGroupActivities",
            variables={"courseId": course_id},
            bearer_token=token,
        )
    return data.get("groupActivities") or []


@mcp.tool(
    title="Get group activity details",
    annotations=READ_ONLY,
    meta=tool_meta(
        audience="participant",
        category="practice-read",
        solution_exposure="post_submission_only",
    ),
)
@instrument
async def get_group_activity(
    activity_id: Annotated[str, Field(description="Group activity ID.")],
    group_id: Annotated[str, Field(description="ParticipantGroup ID.")],
) -> dict[str, Any]:
    """Return detailed state for one group activity + this group's submissions and results."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute(
            "GroupActivityDetails",
            variables={"activityId": activity_id, "groupId": group_id},
            bearer_token=token,
        )
    return data.get("groupActivityDetails") or {}


# --- Hero write: submit stack response ------------------------------------


@mcp.tool(
    title="Submit practice stack response",
    annotations=CUMULATIVE_WRITE,
    meta=tool_meta(
        audience="participant",
        category="practice-write",
        lawful_basis="contract",
        solution_exposure="post_submission_only",
    ),
)
@instrument
async def submit_stack_response(
    stack_id: Annotated[int, Field(description="ElementStack ID being answered.")],
    course_id: Annotated[str, Field(description="Course ID that owns the stack.")],
    responses: Annotated[
        list[StackResponse],
        Field(
            description=(
                "One entry per element in the stack. For each, set exactly the response "
                "field matching its `type` (e.g. `choices_response` for SC/MC/KPRIM, "
                "`numerical_response` for NUMERICAL)."
            ),
            min_length=1,
        ),
    ],
    stack_answer_time: Annotated[
        int,
        Field(description="Total seconds the student spent on this stack.", ge=0),
    ] = 0,
) -> dict[str, Any]:
    """Submit the participant's responses to a stack and get synchronous scoring.

    Returns per-instance evaluations and the overall stack score. Practice quizzes
    and micro-learnings both route through this mutation; the backend distinguishes
    them by context. `isOwner` is forced to `false` because MCP is never a lecturer
    preview-mode caller.
    """
    token = require_bearer_token()
    variables = {
        "isOwner": False,
        "stackId": stack_id,
        "courseId": course_id,
        "responses": [r.to_graphql() for r in responses],
        "stackAnswerTime": stack_answer_time,
    }
    async with AsyncGraphQLClient() as client:
        data = await client.execute("RespondToElementStack", variables=variables, bearer_token=token)
    return data.get("respondToElementStack") or {}


# --- Remaining writes ------------------------------------------------------


@mcp.tool(
    title="Bookmark stack",
    annotations=IDEMPOTENT_WRITE,
    meta=tool_meta(audience="participant", category="feedback"),
)
@instrument
async def bookmark_stack(
    stack_id: Annotated[int, Field(description="ElementStack ID.")],
    course_id: Annotated[str, Field(description="Course ID that owns the stack.")],
    bookmarked: Annotated[bool, Field(description="True to bookmark, false to remove the bookmark.")] = True,
) -> list[int]:
    """Toggle a bookmark on a stack. Returns the updated list of bookmarked stack IDs."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute(
            "BookmarkElementStack",
            variables={"stackId": stack_id, "courseId": course_id, "bookmarked": bookmarked},
            bearer_token=token,
        )
    return data.get("bookmarkElementStack") or []


@mcp.tool(
    title="Flag element for lecturer",
    annotations=IDEMPOTENT_WRITE,
    meta=tool_meta(audience="participant", category="feedback"),
)
@instrument
async def flag_element(
    element_instance_id: Annotated[int, Field(description="ElementInstance ID to flag.")],
    element_id: Annotated[int, Field(description="Underlying Element ID.")],
    content: Annotated[
        str,
        Field(description="Feedback message visible to the lecturer.", min_length=1),
    ],
) -> dict[str, Any]:
    """Flag an element with written feedback for the lecturer."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute(
            "FlagElement",
            variables={
                "elementInstanceId": element_instance_id,
                "elementId": element_id,
                "content": content,
            },
            bearer_token=token,
        )
    return data.get("flagElement") or {}


@mcp.tool(
    title="Rate element",
    annotations=IDEMPOTENT_WRITE,
    meta=tool_meta(audience="participant", category="feedback"),
)
@instrument
async def rate_element(
    element_instance_id: Annotated[int, Field(description="ElementInstance ID.")],
    element_id: Annotated[int, Field(description="Underlying Element ID.")],
    rating: Annotated[
        int,
        Field(
            description="Rating: 1 = thumbs up, -1 = thumbs down, 0 = clear rating.",
            ge=-1,
            le=1,
        ),
    ],
) -> dict[str, Any]:
    """Rate an element up/down."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute(
            "RateElement",
            variables={
                "elementInstanceId": element_instance_id,
                "elementId": element_id,
                "rating": rating,
            },
            bearer_token=token,
        )
    return data.get("rateElement") or {}


@mcp.tool(
    title="Post live Q&A question",
    annotations=CUMULATIVE_WRITE,
    meta=tool_meta(
        audience="participant",
        category="live-session",
        lawful_basis="contract",
    ),
)
@instrument
async def post_live_qa_question(
    quiz_id: Annotated[str, Field(description="Live-quiz ID.")],
    content: Annotated[str, Field(description="Question text shown to the lecturer.", min_length=1)],
) -> dict[str, Any]:
    """Post a question to a live quiz's Q&A channel.

    Anonymity is controlled server-side by the live-quiz configuration;
    lecturers may or may not see the author.
    """
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute(
            "CreateFeedback",
            variables={"quizId": quiz_id, "content": content},
            bearer_token=token,
        )
    return data.get("createFeedback") or {}


@mcp.tool(
    title="Upvote live Q&A question",
    annotations=IDEMPOTENT_WRITE,
    meta=tool_meta(audience="participant", category="live-session"),
)
@instrument
async def upvote_live_qa(
    feedback_id: Annotated[int, Field(description="Feedback (question) ID.")],
    increment: Annotated[
        int,
        Field(description="+1 to upvote, -1 to remove a previous upvote.", ge=-1, le=1),
    ] = 1,
) -> dict[str, Any]:
    """Upvote (or remove upvote from) a live-quiz Q&A question."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute(
            "UpvoteFeedback",
            variables={"feedbackId": feedback_id, "increment": increment},
            bearer_token=token,
        )
    return data.get("upvoteFeedback") or {}


@mcp.tool(
    title="Send confusion signal",
    annotations=CUMULATIVE_WRITE,
    meta=tool_meta(
        audience="participant",
        category="live-session",
        lawful_basis="consent",
    ),
)
@instrument
async def send_confusion_signal(
    quiz_id: Annotated[str, Field(description="Live-quiz ID.")],
    difficulty: Annotated[
        int,
        Field(description="-2..+2; negative = too easy, positive = too hard.", ge=-2, le=2),
    ],
    speed: Annotated[
        int,
        Field(description="-2..+2; negative = too slow, positive = too fast.", ge=-2, le=2),
    ],
) -> dict[str, Any]:
    """Send a difficulty/speed confusion signal to the lecturer during a live quiz."""
    token = require_bearer_token()
    async with AsyncGraphQLClient() as client:
        data = await client.execute(
            "AddConfusionTimestep",
            variables={"quizId": quiz_id, "difficulty": difficulty, "speed": speed},
            bearer_token=token,
        )
    return data.get("addConfusionTimestep") or {}
