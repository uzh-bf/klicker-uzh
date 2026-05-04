"""Per-tool assertion table for annotations + _meta.

Acts as a regression net for the P0b retrofit: any new tool added to the MCP
server must either appear here (with correct metadata) or remove the entry.
Drift in `readOnlyHint`, `audience`, `category`, or `solution_exposure` fails
the test and names the offending tool in the diff.
"""

from __future__ import annotations

from typing import TypedDict

import pytest


class ToolExpectation(TypedDict):
    title: str
    read_only: bool
    idempotent: bool
    audience: str
    category: str
    lawful_basis: str
    solution_exposure: str


EXPECTED: dict[str, ToolExpectation] = {
    # --- common -------------------------------------------------------------
    "whoami": {
        "title": "Who am I",
        "read_only": True,
        "idempotent": True,
        "audience": "any",
        "category": "meta",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    # --- lecturer -----------------------------------------------------------
    "create_choices_question": {
        "title": "Create choices question",
        "read_only": False,
        "idempotent": False,
        "audience": "lecturer",
        "category": "authoring",
        "lawful_basis": "contract",
        "solution_exposure": "authoring_self",
    },
    "create_free_text_question": {
        "title": "Create free-text question",
        "read_only": False,
        "idempotent": False,
        "audience": "lecturer",
        "category": "authoring",
        "lawful_basis": "contract",
        "solution_exposure": "authoring_self",
    },
    "create_numerical_question": {
        "title": "Create numerical question",
        "read_only": False,
        "idempotent": False,
        "audience": "lecturer",
        "category": "authoring",
        "lawful_basis": "contract",
        "solution_exposure": "authoring_self",
    },
    "create_flashcard": {
        "title": "Create flashcard",
        "read_only": False,
        "idempotent": False,
        "audience": "lecturer",
        "category": "authoring",
        "lawful_basis": "contract",
        "solution_exposure": "authoring_self",
    },
    "create_content_element": {
        "title": "Create content element",
        "read_only": False,
        "idempotent": False,
        "audience": "lecturer",
        "category": "authoring",
        "lawful_basis": "contract",
        "solution_exposure": "authoring_self",
    },
    "list_my_questions": {
        "title": "List my questions",
        "read_only": True,
        "idempotent": True,
        "audience": "lecturer",
        "category": "authoring",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "authoring_self",
    },
    # --- participant --------------------------------------------------------
    "list_my_courses": {
        "title": "List my courses",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "discovery",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "list_practice_quizzes": {
        "title": "List practice quizzes",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "discovery",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "get_practice_quiz": {
        "title": "Get practice quiz",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "practice-read",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "get_microlearning": {
        "title": "Get micro-learning",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "practice-read",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "get_previous_stack_evaluation": {
        "title": "Get previous stack evaluation",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "practice-read",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "post_submission_only",
    },
    "list_bookmarks": {
        "title": "List my bookmarks",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "practice-read",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "list_live_qa": {
        "title": "List live Q&A entries",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "live-session",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "get_course_overview": {
        "title": "Get course overview",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "gamification",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "get_course_leaderboard": {
        "title": "Get course leaderboard",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "gamification",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "get_my_achievements": {
        "title": "Get my achievements",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "gamification",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "get_course_timeline": {
        "title": "Get course timeline",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "gamification",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "get_assessment_results": {
        "title": "Get assessment results",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "analytics",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "list_group_activities": {
        "title": "List group activities",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "discovery",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "get_group_activity": {
        "title": "Get group activity details",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "practice-read",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "post_submission_only",
    },
    "submit_stack_response": {
        "title": "Submit practice stack response",
        "read_only": False,
        "idempotent": False,
        "audience": "participant",
        "category": "practice-write",
        "lawful_basis": "contract",
        "solution_exposure": "post_submission_only",
    },
    "bookmark_stack": {
        "title": "Bookmark stack",
        "read_only": False,
        "idempotent": True,
        "audience": "participant",
        "category": "feedback",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "flag_element": {
        "title": "Flag element for lecturer",
        "read_only": False,
        "idempotent": True,
        "audience": "participant",
        "category": "feedback",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "rate_element": {
        "title": "Rate element",
        "read_only": False,
        "idempotent": True,
        "audience": "participant",
        "category": "feedback",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "post_live_qa_question": {
        "title": "Post live Q&A question",
        "read_only": False,
        "idempotent": False,
        "audience": "participant",
        "category": "live-session",
        "lawful_basis": "contract",
        "solution_exposure": "none",
    },
    "upvote_live_qa": {
        "title": "Upvote live Q&A question",
        "read_only": False,
        "idempotent": True,
        "audience": "participant",
        "category": "live-session",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "send_confusion_signal": {
        "title": "Send confusion signal",
        "read_only": False,
        "idempotent": False,
        "audience": "participant",
        "category": "live-session",
        "lawful_basis": "consent",
        "solution_exposure": "none",
    },
    # --- participant analytics ---------------------------------------------
    "get_my_course_analytics": {
        "title": "Get my course analytics",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "analytics",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "get_my_performance": {
        "title": "Get my performance",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "analytics",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "get_my_activity_performance": {
        "title": "Get my activity performance",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "analytics",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "get_my_response_history": {
        "title": "Get my response history",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "analytics",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "submission_gated",
    },
    "get_my_mistakes": {
        "title": "Get my mistakes",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "analytics",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "submission_gated",
    },
    "get_my_srs_state": {
        "title": "Get my SRS state",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "analytics",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "get_weak_topics": {
        "title": "Get my weakest topics",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "analytics",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "get_mastery_map": {
        "title": "Get my topic mastery map",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "analytics",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "get_my_recent_activity": {
        "title": "Get my recent activity",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "analytics",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
    "get_bookmarks_across_courses": {
        "title": "Get bookmarks across courses",
        "read_only": True,
        "idempotent": True,
        "audience": "participant",
        "category": "analytics",
        "lawful_basis": "legitimate_interest",
        "solution_exposure": "none",
    },
}


@pytest.mark.asyncio
async def test_all_tools_have_expected_annotations_and_meta() -> None:
    from klicker_mcp.server import mcp

    tools = await mcp.list_tools()
    by_name = {t.name: t for t in tools}

    assert set(by_name.keys()) == set(EXPECTED.keys()), (
        f"tool registration drift — missing: {set(EXPECTED.keys()) - set(by_name.keys())}, "
        f"unexpected: {set(by_name.keys()) - set(EXPECTED.keys())}"
    )

    for name, expect in EXPECTED.items():
        tool = by_name[name]
        assert tool.title == expect["title"], f"{name}: title"

        annotations = tool.annotations
        assert annotations is not None, f"{name}: missing annotations"
        assert annotations.readOnlyHint is expect["read_only"], f"{name}: readOnlyHint"
        assert annotations.destructiveHint is False, f"{name}: destructiveHint must be False"
        assert annotations.idempotentHint is expect["idempotent"], f"{name}: idempotentHint"
        assert annotations.openWorldHint is False, f"{name}: openWorldHint must be False"

        meta = tool.meta
        assert meta is not None, f"{name}: missing meta"
        assert meta.get("audience") == expect["audience"], f"{name}: audience"
        assert meta.get("category") == expect["category"], f"{name}: category"
        assert meta.get("lawful_basis") == expect["lawful_basis"], f"{name}: lawful_basis"
        assert meta.get("solution_exposure") == expect["solution_exposure"], f"{name}: solution_exposure"
