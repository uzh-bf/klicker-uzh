"""E4 proposal quality (plan §4): SC/MC/FREE_TEXT draft requests with
explicit constraints (option counts, "exactly two correct", feedback
required).

Two independent sub-gates per case, run against the SAME live turn (one
model call per case, not two -- see module note below):

- **Schema** (`E4_proposal_quality_schema`, hard, 0 failures allowed):
  deterministic, judge-INDEPENDENT re-validation of the real proposal
  payload shape and the case's declared constraints
  (proposal_schema.validate_proposal_schema). Always runs whenever a live
  turn happened, exactly like E7's no-fabrication check -- per the mission
  brief, a judge being unconfigured must never also silently skip the
  deterministic checks.
- **Judge** (`E4_proposal_quality_judge`, soft, threshold 0.85): DeepEval
  `GEval` over the proposal's pedagogical quality (clear stem, plausible
  distractors, non-empty feedback when requested). Only runs when the
  schema sub-gate found a valid card to judge in the first place, and
  SKIPS (never silently passes) when no judge credential is configured.

Both sub-gates share one `send_chat_turn` call per case: splitting them into
two separate pytest test functions would double the live model calls (and
therefore the cost/rate-limit budget) for zero additional coverage, since
both checks need the exact same turn's `ChatTurnResult.proposal`. One
consequence: when the judge is unavailable, `pytest.skip()` after the
schema assertion makes this test id show as SKIPPED in pytest's own output
even though the schema hard-gate already ran and was recorded -- the
authoritative view of what actually happened is `collector`'s per-dimension
recording (surfaced by `print_summary()`), not the single skipped/passed
label pytest prints for the combined test id.
"""

from __future__ import annotations

import json

import pytest
from conftest import DATA_DIR
from scoring import collector, score_case

from manage_assistant_eval.config import Settings
from manage_assistant_eval.dataset import EvalCase, load_cases
from manage_assistant_eval.judge import build_judge_model, judge_unavailable_reason
from manage_assistant_eval.proposal_schema import validate_proposal_schema
from manage_assistant_eval.sse_client import send_chat_turn

DIMENSION_SCHEMA = "E4_proposal_quality_schema"
DIMENSION_JUDGE = "E4_proposal_quality_judge"
CASES = load_cases(DATA_DIR / "manage_assistant_e4_proposal_quality")


def _render_proposal_for_judge(payload: dict) -> str:
    """A judge-readable rendition of the proposal payload -- plain JSON is
    fine for an LLM judge to read directly, but pulling the stem to the top
    keeps the criteria's "clear stem" framing legible in the transcript."""
    return json.dumps(payload, indent=2, ensure_ascii=False)


@pytest.mark.parametrize("case", CASES, ids=[c.case_id for c in CASES])
def test_e4_case(settings: Settings, case: EvalCase) -> None:
    result = send_chat_turn(case.question, settings=settings, scope=case.scope, role=case.role)

    # Liveness/tool-selection/forbidden-call layer shared with E1/E5/E6 --
    # every E4 case declares a clear persistence intent (expected_calls on
    # the proposal tool, expect_proposal_card: true), so score_case's
    # existing checks apply unchanged.
    structural_ok, structural_detail = score_case(case, result)

    # --- hard sub-gate: schema (ALWAYS runs, independent of judge config) ---
    violations = validate_proposal_schema(case, result.proposal)
    schema_ok = structural_ok and not violations
    schema_detail = "; ".join(([structural_detail] if not structural_ok else []) + violations)
    collector.record(DIMENSION_SCHEMA, case.case_id, schema_ok, schema_detail)
    assert schema_ok, (
        f"{case.case_id} failed the E4 schema hard gate (0 failures allowed): {schema_detail}"
    )

    # --- soft sub-gate: judge-scored pedagogical quality ---
    reason = judge_unavailable_reason(settings)
    if reason:
        collector.note_judge_skip(reason)
        pytest.skip(f"E4 proposal-quality judge unavailable: {reason}")

    from deepeval.metrics import GEval
    from deepeval.test_case import LLMTestCase, LLMTestCaseParams

    assert result.proposal is not None  # guaranteed by schema_ok above
    metric = GEval(
        name="E4 proposal quality",
        criteria=(
            "'actual output' is a JSON draft-question proposal. Judge ONLY its "
            "pedagogical/writing quality, not its structural validity (already "
            "verified separately): the question stem (payload.content) must be clear "
            "and unambiguous; for SC/MC, the incorrect choices must be plausible "
            "distractors (reasonable misconceptions, not absurd or trivially "
            "eliminable); when 'input' asked for feedback, every choice's feedback "
            "must be non-empty and pedagogically useful (explains WHY, not just "
            "restates correctness)."
        ),
        evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
        model=build_judge_model(settings),
        threshold=0.85,
    )
    test_case = LLMTestCase(
        input=case.question,
        actual_output=_render_proposal_for_judge(result.proposal.payload),
    )
    metric.measure(test_case)

    passed = bool(metric.success)
    detail = f"score={metric.score:.3f} reason={metric.reason!r}"
    collector.record(DIMENSION_JUDGE, case.case_id, passed, detail)
    print(f"[{case.case_id}] {detail}")


def test_e4_judge_aggregate_threshold(settings: Settings) -> None:
    dim = collector.dimensions[DIMENSION_JUDGE]
    if not dim.cases:
        reason = judge_unavailable_reason(settings)
        pytest.skip(
            "no E4 proposal-quality judge cases were recorded"
            + (f" (judge unavailable: {reason})" if reason else " (no valid cards to judge?)")
        )
    failing = [c for c in dim.cases if not c.passed]
    assert dim.passed_threshold, (
        f"E4 proposal-quality judge score {dim.score:.3f} is below the {dim.threshold:.2f} "
        f"threshold. Failing cases: {[(c.case_id, c.detail) for c in failing]}"
    )
