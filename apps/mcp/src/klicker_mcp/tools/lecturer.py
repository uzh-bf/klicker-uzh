"""Lecturer-role tools: question authoring (draft-by-default) and listing.

Every create/update tool defaults `status` to `DRAFT`. LLM-authored questions
are never visible to students until a human lecturer reviews and promotes them.
Role authorisation itself is enforced by the backend (`asUserFullAccess` guard
on each `manipulate*` mutation); this module forwards the bearer token and
surfaces any backend errors verbatim.
"""

from __future__ import annotations

from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from klicker_mcp.app import mcp
from klicker_mcp.gql import AsyncGraphQLClient
from klicker_mcp.tools._helpers import drop_none, require_bearer_token

ElementStatus = Literal["DRAFT", "REVIEW", "READY"]
ChoicesType = Literal["SC", "MC", "KPRIM"]
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
SortByType = Literal["CREATED", "MODIFIED", "STATUS", "TITLE", "TYPE"]
DisplayMode = Literal["LIST", "GRID"]


class Choice(BaseModel):
    """One option of a single-choice, multi-choice, or KPrim question."""

    ix: Annotated[int, Field(description="0-based index of this choice in the list.")]
    value: Annotated[str, Field(description="Markdown text shown to the student.")]
    correct: Annotated[
        bool | None,
        Field(
            description=(
                "For SC/MC: true = correct option. For KPRIM: true/false independently per row. "
                "Omit if no sample solution is configured."
            ),
        ),
    ] = None
    feedback: Annotated[
        str | None,
        Field(
            description="Markdown shown to the student when they pick this choice (requires `has_answer_feedbacks`)."
        ),
    ] = None


class NumericalRange(BaseModel):
    """A range of accepted numerical answers (inclusive)."""

    min: Annotated[float | None, Field(description="Lower bound (inclusive). Omit for half-open range.")] = None
    max: Annotated[float | None, Field(description="Upper bound (inclusive). Omit for half-open range.")] = None


class NumericalRestrictions(BaseModel):
    """UI-level restrictions on the numerical input the student can type."""

    min: Annotated[float | None, Field(description="Smallest value the student may enter.")] = None
    max: Annotated[float | None, Field(description="Largest value the student may enter.")] = None


class FreeTextRestrictions(BaseModel):
    """Restrictions on the free-text response box."""

    model_config = ConfigDict(populate_by_name=True)

    min_length: Annotated[
        int | None,
        Field(default=None, alias="minLength", description="Minimum accepted length in characters."),
    ] = None
    max_length: Annotated[
        int | None,
        Field(default=None, alias="maxLength", description="Maximum accepted length in characters."),
    ] = None
    pattern: Annotated[str | None, Field(default=None, description="Regex the student's answer must match.")] = None


@mcp.tool
async def create_choices_question(
    question_type: Annotated[
        ChoicesType,
        Field(description="SC = single-choice, MC = multi-choice, KPRIM = four true/false rows."),
    ],
    name: Annotated[str, Field(description="Internal name shown only in the question pool, not to students.")],
    content: Annotated[str, Field(description="The question body, in Markdown. Rendered to students.")],
    choices: Annotated[list[Choice], Field(description="Ordered list of answer options.", min_length=2)],
    explanation: Annotated[
        str | None,
        Field(description="Markdown explanation shown to the student after they submit their answer."),
    ] = None,
    has_sample_solution: Annotated[
        bool,
        Field(description="If true, the `correct` flag on each choice is used to score the response."),
    ] = True,
    has_answer_feedbacks: Annotated[
        bool,
        Field(description="If true, each choice's `feedback` is shown to the student after they answer."),
    ] = False,
    display_mode: Annotated[DisplayMode, Field(description="How choices render in the UI.")] = "LIST",
    tags: Annotated[
        list[str] | None,
        Field(description="Tag names to attach. Existing tags are matched by name; new ones are created."),
    ] = None,
    points_multiplier: Annotated[
        int | None, Field(description="Score multiplier for this question (1 = normal).")
    ] = None,
    base_points: Annotated[
        bool | None,
        Field(description="If true, students get base participation points just for attempting."),
    ] = None,
    status: Annotated[
        ElementStatus,
        Field(
            description=(
                "Lifecycle status. Defaults to DRAFT — question is NOT published. "
                "Promote explicitly after lecturer review."
            ),
        ),
    ] = "DRAFT",
    question_id: Annotated[
        int | None,
        Field(description="Existing question ID to update. Omit to create a new question."),
    ] = None,
) -> dict[str, Any]:
    """Create or update a single-choice, multi-choice, or KPrim question.

    Defaults to `status=DRAFT` — questions created via MCP are never published
    to students until a human lecturer reviews them in the manage UI and
    explicitly promotes them to READY.
    """
    token = require_bearer_token()
    options = {
        "choices": [c.model_dump(exclude_none=True) for c in choices],
        "hasSampleSolution": has_sample_solution,
        "hasAnswerFeedbacks": has_answer_feedbacks,
        "displayMode": display_mode,
    }
    variables = drop_none(
        {
            "id": question_id,
            "type": question_type,
            "status": status,
            "name": name,
            "content": content,
            "explanation": explanation,
            "options": options,
            "tags": tags,
            "pointsMultiplier": points_multiplier,
            "basePoints": base_points,
        }
    )
    async with AsyncGraphQLClient() as client:
        data = await client.execute("ManipulateChoicesQuestion", variables=variables, bearer_token=token)
    return data.get("manipulateChoicesQuestion") or {}


@mcp.tool
async def create_free_text_question(
    name: Annotated[str, Field(description="Internal name for the question pool.")],
    content: Annotated[str, Field(description="Question body in Markdown.")],
    explanation: Annotated[
        str | None,
        Field(description="Markdown explanation shown after submission."),
    ] = None,
    solutions: Annotated[
        list[str] | None,
        Field(description="Accepted answer strings. Students' responses are matched exactly (case-sensitive)."),
    ] = None,
    has_sample_solution: Annotated[
        bool, Field(description="If true, `solutions` are used to score the response.")
    ] = True,
    placeholder: Annotated[str | None, Field(description="Placeholder shown in the answer box.")] = None,
    restrictions: Annotated[
        FreeTextRestrictions | None,
        Field(description="Optional length / regex constraints on the answer."),
    ] = None,
    tags: Annotated[list[str] | None, Field(description="Tag names.")] = None,
    points_multiplier: Annotated[int | None, Field(description="Score multiplier.")] = None,
    base_points: Annotated[bool | None, Field(description="Base participation points on attempt.")] = None,
    status: Annotated[ElementStatus, Field(description="Defaults to DRAFT.")] = "DRAFT",
    question_id: Annotated[int | None, Field(description="Existing question ID to update.")] = None,
) -> dict[str, Any]:
    """Create or update a free-text question. Defaults to DRAFT."""
    token = require_bearer_token()
    options = drop_none(
        {
            "solutions": solutions,
            "hasSampleSolution": has_sample_solution,
            "placeholder": placeholder,
            "restrictions": (restrictions.model_dump(exclude_none=True, by_alias=True) if restrictions else None),
        }
    )
    variables = drop_none(
        {
            "id": question_id,
            "status": status,
            "name": name,
            "content": content,
            "explanation": explanation,
            "options": options or None,
            "tags": tags,
            "pointsMultiplier": points_multiplier,
            "basePoints": base_points,
        }
    )
    async with AsyncGraphQLClient() as client:
        data = await client.execute("ManipulateFreeTextQuestion", variables=variables, bearer_token=token)
    return data.get("manipulateFreeTextQuestion") or {}


@mcp.tool
async def create_numerical_question(
    name: Annotated[str, Field(description="Internal name.")],
    content: Annotated[str, Field(description="Question body in Markdown.")],
    explanation: Annotated[str | None, Field(description="Explanation shown after submission.")] = None,
    exact_solutions: Annotated[
        list[float] | None,
        Field(description="Exact numerical answers counted as correct."),
    ] = None,
    solution_ranges: Annotated[
        list[NumericalRange] | None,
        Field(description="Ranges of answers counted as correct (inclusive)."),
    ] = None,
    accuracy: Annotated[
        int | None,
        Field(description="Decimal places required when matching exact solutions."),
    ] = None,
    unit: Annotated[str | None, Field(description="Unit appended to the student's input for display.")] = None,
    placeholder: Annotated[str | None, Field(description="Placeholder in the answer input.")] = None,
    has_sample_solution: Annotated[bool, Field(description="If true, solutions score the response.")] = True,
    restrictions: Annotated[
        NumericalRestrictions | None,
        Field(description="UI-level min/max the student can enter."),
    ] = None,
    tags: Annotated[list[str] | None, Field(description="Tag names.")] = None,
    points_multiplier: Annotated[int | None, Field(description="Score multiplier.")] = None,
    base_points: Annotated[bool | None, Field(description="Base points on attempt.")] = None,
    status: Annotated[ElementStatus, Field(description="Defaults to DRAFT.")] = "DRAFT",
    question_id: Annotated[int | None, Field(description="Existing question ID to update.")] = None,
) -> dict[str, Any]:
    """Create or update a numerical question. Defaults to DRAFT."""
    token = require_bearer_token()
    options = drop_none(
        {
            "exactSolutions": exact_solutions,
            "solutionRanges": ([r.model_dump(exclude_none=True) for r in solution_ranges] if solution_ranges else None),
            "accuracy": accuracy,
            "unit": unit,
            "placeholder": placeholder,
            "hasSampleSolution": has_sample_solution,
            "restrictions": restrictions.model_dump(exclude_none=True) if restrictions else None,
        }
    )
    variables = drop_none(
        {
            "id": question_id,
            "status": status,
            "name": name,
            "content": content,
            "explanation": explanation,
            "options": options or None,
            "tags": tags,
            "pointsMultiplier": points_multiplier,
            "basePoints": base_points,
        }
    )
    async with AsyncGraphQLClient() as client:
        data = await client.execute("ManipulateNumericalQuestion", variables=variables, bearer_token=token)
    return data.get("manipulateNumericalQuestion") or {}


@mcp.tool
async def create_flashcard(
    name: Annotated[str, Field(description="Internal name.")],
    content: Annotated[str, Field(description="Front of the flashcard (question / prompt), Markdown.")],
    explanation: Annotated[str, Field(description="Back of the flashcard (answer / explanation), Markdown.")],
    tags: Annotated[list[str] | None, Field(description="Tag names.")] = None,
    points_multiplier: Annotated[int | None, Field(description="Score multiplier.")] = None,
    base_points: Annotated[bool | None, Field(description="Base points on attempt.")] = None,
    status: Annotated[ElementStatus, Field(description="Defaults to DRAFT.")] = "DRAFT",
    question_id: Annotated[int | None, Field(description="Existing flashcard ID to update.")] = None,
) -> dict[str, Any]:
    """Create or update a flashcard element. Defaults to DRAFT."""
    token = require_bearer_token()
    variables = drop_none(
        {
            "id": question_id,
            "status": status,
            "name": name,
            "content": content,
            "explanation": explanation,
            "tags": tags,
            "pointsMultiplier": points_multiplier,
            "basePoints": base_points,
        }
    )
    async with AsyncGraphQLClient() as client:
        data = await client.execute("ManipulateFlashcardElement", variables=variables, bearer_token=token)
    return data.get("manipulateFlashcardElement") or {}


@mcp.tool
async def create_content_element(
    name: Annotated[str, Field(description="Internal name.")],
    content: Annotated[
        str,
        Field(description="Reading material / explanation content shown to students, Markdown."),
    ],
    tags: Annotated[list[str] | None, Field(description="Tag names.")] = None,
    points_multiplier: Annotated[int | None, Field(description="Score multiplier.")] = None,
    base_points: Annotated[bool | None, Field(description="Base points on attempt.")] = None,
    status: Annotated[ElementStatus, Field(description="Defaults to DRAFT.")] = "DRAFT",
    question_id: Annotated[int | None, Field(description="Existing content element ID to update.")] = None,
) -> dict[str, Any]:
    """Create or update a content (non-question) element. Defaults to DRAFT."""
    token = require_bearer_token()
    variables = drop_none(
        {
            "id": question_id,
            "status": status,
            "name": name,
            "content": content,
            "tags": tags,
            "pointsMultiplier": points_multiplier,
            "basePoints": base_points,
        }
    )
    async with AsyncGraphQLClient() as client:
        data = await client.execute("ManipulateContentElement", variables=variables, bearer_token=token)
    return data.get("manipulateContentElement") or {}


@mcp.tool
async def list_my_questions(
    status: Annotated[
        ElementStatus | None,
        Field(description="Filter to a single status (DRAFT / REVIEW / READY). Omit to list all."),
    ] = None,
    question_type: Annotated[
        ElementType | None, Field(description="Filter to a single element type. Omit to list all.")
    ] = None,
    search_string: Annotated[str | None, Field(description="Free-text search across name + content.")] = None,
    tag_ids: Annotated[
        list[int] | None,
        Field(description="Only include questions tagged with all of these tag IDs."),
    ] = None,
    show_owned: Annotated[bool, Field(description="Include the user's own questions.")] = True,
    show_shared: Annotated[bool, Field(description="Include questions shared with the user.")] = False,
    show_dependencies: Annotated[
        bool, Field(description="Include questions the user depends on via shared activities.")
    ] = False,
    show_untagged: Annotated[bool, Field(description="Include questions with no tags at all.")] = True,
    show_archived: Annotated[bool, Field(description="Include archived questions.")] = False,
    has_sample_solution: Annotated[
        bool,
        Field(description="If true, only questions with a sample solution are returned."),
    ] = False,
    has_answer_feedbacks: Annotated[
        bool,
        Field(description="If true, only questions with per-answer feedback are returned."),
    ] = False,
    sort_by: Annotated[SortByType, Field(description="Field to sort on.")] = "MODIFIED",
    sort_ascending: Annotated[bool, Field(description="True = ascending; False = descending (newest first).")] = False,
    num_entries: Annotated[int, Field(description="Page size.", ge=1, le=200)] = 20,
    offset: Annotated[int, Field(description="Pagination offset.", ge=0)] = 0,
) -> dict[str, Any]:
    """List the lecturer's questions from the question pool, with filters.

    Returns `{numOfElements, elements}` where `elements` is a page of
    polymorphic question objects (`__typename` tells them apart).
    """
    token = require_bearer_token()
    variables: dict[str, Any] = {
        "status": status,
        "type": question_type,
        "hasSampleSolution": has_sample_solution,
        "hasAnswerFeedbacks": has_answer_feedbacks,
        "searchString": search_string,
        "showOwned": show_owned,
        "showShared": show_shared,
        "showDependencies": show_dependencies,
        "tagIds": tag_ids or [],
        "showUntagged": show_untagged,
        "sortByType": sort_by,
        "sortByAsc": sort_ascending,
        "showArchived": show_archived,
        "numEntries": num_entries,
        "offset": offset,
        "activityId": None,
        "multiplier": None,
    }
    async with AsyncGraphQLClient() as client:
        data = await client.execute("GetUserElements", variables=variables, bearer_token=token)
    return data.get("userElements") or {}
