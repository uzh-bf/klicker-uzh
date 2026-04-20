"""`_meta` builder for MCP tool declarations.

Keys are top-level on the dict we hand to FastMCP; FastMCP auto-merges its
own `fastmcp` namespace at emit time, so we never touch that key ourselves.
"""

from __future__ import annotations

from typing import Any, Literal

Audience = Literal["participant", "lecturer", "any"]
"""Which role may invoke this tool sensibly. The backend is still the
authoritative gate — this is a hint for client-side `allowedTools` filtering.
`any` covers role-agnostic tools like `whoami`."""

Category = Literal[
    "discovery",
    "practice-read",
    "practice-write",
    "feedback",
    "analytics",
    "live-session",
    "authoring",
    "gamification",
    "meta",
]
"""Coarse grouping for `allowedTools` filters in the chat consumer."""

LawfulBasis = Literal["legitimate_interest", "consent", "contract"]
"""GDPR Art. 6 lawful basis. `contract` = necessary to perform the student's
enrolment contract with KlickerUZH (submitting responses, posting Q&A).
`consent` = telemetry-style signals the student opts into. Default for reads
is `legitimate_interest`."""

SolutionExposure = Literal[
    "none",
    "submission_gated",
    "post_submission_only",
    "authoring_self",
]
"""Does this tool's payload contain correct-answer content? Backend gates all
exposure server-side; this label is for the chat consumer's declarative
filters and for the compliance audit. `authoring_self` = lecturer pool (no
participant-facing risk)."""


def tool_meta(
    *,
    audience: Audience,
    category: Category,
    lawful_basis: LawfulBasis = "legitimate_interest",
    solution_exposure: SolutionExposure = "none",
) -> dict[str, Any]:
    """Build the `_meta` dict for an `@mcp.tool(meta=...)` kwarg."""
    return {
        "audience": audience,
        "category": category,
        "lawful_basis": lawful_basis,
        "solution_exposure": solution_exposure,
    }


__all__ = [
    "Audience",
    "Category",
    "LawfulBasis",
    "SolutionExposure",
    "tool_meta",
]
