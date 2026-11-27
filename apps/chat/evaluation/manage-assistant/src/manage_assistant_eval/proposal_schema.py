"""Deterministic E4 (proposal quality) schema/constraint validation.

This is the "0 schema failures" hard sub-gate from the plan's E4 row
(`project/2026-07-26-pr-5109-verification-and-extension-plan.md` §4.1). It
independently re-checks the SAME invariants
`elementCreateDraftProposalSchema`/`createElementDraftProposal`
(apps/mcp-lecturer/src/service.ts:170-213,624-644) already enforce
server-side -- deliberately not "trust the server already validated this",
because the whole point of an eval harness is to catch a *regression* in
that server-side validation, not merely to re-confirm today's behavior.
Independently re-deriving the same shape here means a future service.ts bug
(e.g. an SC proposal shipping zero correct choices) fails this gate even if
the server-side zod check that should have caught it also regressed.

Real payload shape being checked (`ManageProposalResult.payload`, mirrored in
models.ProposalCard.payload):

    {
      "basePoints": true,
      "content": str,           # non-empty, required
      "explanation"?: str,      # optional
      "name": str,               # non-empty, required
      "options": { ... },        # shape depends on `type`, see below
      "pointsMultiplier": 1,
      "status": "DRAFT",
      "tags": [str, ...],
      "type": "SC" | "MC" | "FREE_TEXT",
    }

SC/MC `options`:
    { "choices": [{"ix": int, "correct": bool, "feedback"?: str, "value": str}, ...],
      "displayMode": "LIST", "hasAnswerFeedbacks": bool, "hasSampleSolution": true }

FREE_TEXT `options`:
    { "hasSampleSolution": false, "restrictions": {} }
"""

from __future__ import annotations

from typing import Any

from .dataset import EvalCase
from .models import ProposalCard

EXPECTED_KIND = "element.create.proposal"
VALID_TYPES = {"SC", "MC", "FREE_TEXT"}


def validate_proposal_schema(case: EvalCase, proposal: ProposalCard | None) -> list[str]:
    """Returns a list of human-readable schema/constraint violations, empty
    if the proposal is well-formed and honors every constraint the case
    declares. `proposal is None` is itself a violation when the case is an
    E4 proposal-quality case (it always is, by construction -- callers pass
    the whole test only after confirming a persistence-intent question was
    asked), since there is nothing to validate schema-wise without a card at
    all."""
    if proposal is None:
        return ["no proposal card was produced -- nothing to validate"]

    violations: list[str] = []

    if proposal.kind != EXPECTED_KIND:
        violations.append(
            f"unexpected proposal kind {proposal.kind!r} (expected {EXPECTED_KIND!r})"
        )
    if not proposal.requires_confirmation:
        violations.append(
            "requiresConfirmation is not true -- an unconfirmable card is not a proposal"
        )

    payload = proposal.payload
    if not isinstance(payload, dict):
        violations.append(f"payload is not an object: {payload!r}")
        return violations  # nothing further can be checked structurally

    name = payload.get("name")
    if not isinstance(name, str) or not name.strip():
        violations.append(f"payload.name is missing or empty: {name!r}")

    content = payload.get("content")
    if not isinstance(content, str) or not content.strip():
        violations.append(f"payload.content is missing or empty: {content!r}")

    q_type = payload.get("type")
    if q_type not in VALID_TYPES:
        violations.append(f"payload.type {q_type!r} is not one of {sorted(VALID_TYPES)}")
        return violations  # type-specific checks below need a valid type

    if case.expected_type and q_type != case.expected_type:
        violations.append(
            f"case declares expected_type={case.expected_type!r} but payload.type={q_type!r}"
        )

    if q_type == "FREE_TEXT":
        options = payload.get("options")
        if not isinstance(options, dict):
            violations.append(f"FREE_TEXT payload.options is not an object: {options!r}")
        elif "restrictions" not in options:
            violations.append("FREE_TEXT payload.options is missing 'restrictions'")
        return violations

    # SC / MC: choices are required and constrained.
    options = payload.get("options")
    if not isinstance(options, dict):
        violations.append(f"{q_type} payload.options is not an object: {options!r}")
        return violations

    choices = options.get("choices")
    if not isinstance(choices, list) or len(choices) < 2:
        violations.append(
            f"{q_type} payload.options.choices must have >= 2 entries, got {choices!r}"
        )
        return violations

    violations.extend(_check_option_count(case, q_type, choices))
    violations.extend(_check_correct_count(case, q_type, choices))
    if case.require_feedback:
        violations.extend(_check_feedback(options, choices))

    return violations


def _check_option_count(case: EvalCase, q_type: str, choices: list[Any]) -> list[str]:
    if case.expected_option_count is None:
        return []
    if len(choices) != case.expected_option_count:
        return [
            f"case declares expected_option_count={case.expected_option_count} but "
            f"{q_type} payload has {len(choices)} choice(s)"
        ]
    return []


def _correct_count(choices: list[Any]) -> int:
    return sum(1 for c in choices if isinstance(c, dict) and c.get("correct") is True)


def _check_correct_count(case: EvalCase, q_type: str, choices: list[Any]) -> list[str]:
    correct = _correct_count(choices)
    if case.expected_correct_count is not None:
        if correct != case.expected_correct_count:
            return [
                f"case declares expected_correct_count={case.expected_correct_count} but "
                f"{q_type} payload has {correct} correct choice(s)"
            ]
        return []
    # No explicit constraint declared: fall back to the same invariant
    # elementCreateDraftProposalSchema itself enforces server-side (SC exactly
    # one, MC at least one) -- re-derived independently, see module docstring.
    if q_type == "SC" and correct != 1:
        return [f"SC payload must have exactly 1 correct choice, got {correct}"]
    if q_type == "MC" and correct < 1:
        return [f"MC payload must have at least 1 correct choice, got {correct}"]
    return []


def _check_feedback(options: dict[str, Any], choices: list[Any]) -> list[str]:
    violations: list[str] = []
    if options.get("hasAnswerFeedbacks") is not True:
        violations.append(
            "case requires feedback but payload.options.hasAnswerFeedbacks is not true"
        )
    empty = [
        c.get("value")
        for c in choices
        if isinstance(c, dict) and not str(c.get("feedback") or "").strip()
    ]
    if empty:
        violations.append(f"case requires feedback but these choices have none: {empty!r}")
    return violations
