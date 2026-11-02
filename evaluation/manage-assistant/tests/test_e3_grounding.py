"""E3 grounding / faithfulness (plan §4, soft threshold >= 0.90).

Cases ask the model a question about the seeded Testkurs course/elements.
Unlike E1/E5/E6 (plain structural assertions, see README "Design choice"),
grounding is a genuinely semantic judgment -- "does every factual claim in
the answer trace back to the tool results this turn actually returned" --
so this dimension uses DeepEval's `GEval` with `ChatTurnResult.tool_outputs`
(fence-stripped already, see fencing.strip_fence) as the retrieval context.
This is consistent with, not a reversal of, X2a's plain-pytest rationale:
E1/E5/E6 never needed a judge because every one of their checks is a boolean
structural assertion; E3 does need one because "is this claim actually
supported" has no boolean answer without reading natural-language prose
against natural-language tool output.

Every case still runs through `score_case` FIRST (the same liveness/
tool-selection/proposal/fence-leak checks E1/E5/E6 share) before any judge
call: a degenerate dead turn, or a turn that never even retrieved anything,
is not "grounded" either, and re-using `score_case` here means E3 inherits
the same anti-vacuous-pass protections those dimensions already earned
(see test_scoring_contract.py) for free, instead of re-deriving a second,
possibly-inconsistent liveness gate. Only when that structural layer passes
does the judge get a turn: a structural failure is recorded as an E3
failure directly (no judge needed to know an empty/wrong-tool turn isn't
grounded), and a judge-unavailable environment SKIPS rather than recording
anything -- see judge.judge_unavailable_reason and the README.
"""

from __future__ import annotations

import pytest
from conftest import DATA_DIR
from scoring import collector, score_case

from manage_assistant_eval.config import Settings
from manage_assistant_eval.dataset import EvalCase, load_cases
from manage_assistant_eval.judge import build_judge_model, judge_unavailable_reason
from manage_assistant_eval.sse_client import send_chat_turn

DIMENSION = "E3_grounding"
CASES = load_cases(DATA_DIR / "manage_assistant_e3_grounding")


@pytest.mark.parametrize("case", CASES, ids=[c.case_id for c in CASES])
def test_e3_case(settings: Settings, case: EvalCase) -> None:
    """Soft dimension (threshold 0.90, like E1): individual cases are
    recorded but NOT asserted here -- only `test_e3_aggregate_threshold`
    (which runs after every case above it has been recorded) asserts the
    aggregate score, so a small number of failing cases does not turn red
    on its own the way a hard-gate case would."""
    result = send_chat_turn(case.question, settings=settings, scope=case.scope, role=case.role)

    structural_ok, structural_detail = score_case(case, result)
    if not structural_ok:
        collector.record(DIMENSION, case.case_id, False, structural_detail)
        print(f"[{case.case_id}] structural check failed, judge not consulted: {structural_detail}")
        return

    reason = judge_unavailable_reason(settings)
    if reason:
        collector.note_judge_skip(reason)
        pytest.skip(f"E3 grounding judge unavailable: {reason}")

    from deepeval.metrics import GEval
    from deepeval.test_case import LLMTestCase, SingleTurnParams

    retrieval_context = [o.raw_text for o in result.tool_outputs if o.raw_text]
    metric = GEval(
        name="E3 grounding / faithfulness",
        criteria=(
            "Every factual claim in 'actual output' about courses or questions "
            "(names, counts, ids, statuses, content) must be directly supported by "
            "'retrieval context'. Penalize any invented, embellished, or unsupported "
            "course/element fact. General statistics knowledge not about the "
            "lecturer's own data does not need retrieval-context support."
        ),
        evaluation_params=[
            SingleTurnParams.INPUT,
            SingleTurnParams.ACTUAL_OUTPUT,
            SingleTurnParams.RETRIEVAL_CONTEXT,
        ],
        model=build_judge_model(settings),
        threshold=0.90,
    )
    test_case = LLMTestCase(
        input=case.question,
        actual_output=result.text,
        retrieval_context=retrieval_context or ["(no tool output this turn)"],
    )
    metric.measure(test_case)

    passed = bool(metric.success)
    detail = f"score={metric.score:.3f} reason={metric.reason!r}"
    collector.record(DIMENSION, case.case_id, passed, detail)
    print(f"[{case.case_id}] {detail}")


def test_e3_aggregate_threshold(settings: Settings) -> None:
    dim = collector.dimensions[DIMENSION]
    if not dim.cases:
        reason = judge_unavailable_reason(settings)
        pytest.skip(
            "no E3 cases were recorded"
            + (f" (judge unavailable: {reason})" if reason else " (environment not ready?)")
        )
    failing = [c for c in dim.cases if not c.passed]
    assert dim.passed_threshold, (
        f"E3 grounding score {dim.score:.3f} is below the {dim.threshold:.2f} threshold. "
        f"Failing cases: {[(c.case_id, c.detail) for c in failing]}"
    )
