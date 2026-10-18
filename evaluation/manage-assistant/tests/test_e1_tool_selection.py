"""E1 tool selection (plan §4, threshold >= 0.95).

Labeled prompts -> exact-match check on which MCP tool(s) the model called,
per the dataset's `tool_policy` (subset|exact). This is a SOFT threshold,
not a hard gate: individual cases are recorded but not asserted here; only
`test_e1_aggregate_threshold` (which runs last, after every parametrized
case above it has been recorded) asserts the aggregate score. A case whose
`trials` > 1 is scored by majority vote across trials (N-of-M variance
rationale: tolerates occasional LLM phrasing/tool-choice nondeterminism
without treating one flaky trial as a hard failure — see README).
"""

from __future__ import annotations

import pytest
from conftest import DATA_DIR
from scoring import collector, effective_trials, score_case

from manage_assistant_eval.config import Settings
from manage_assistant_eval.dataset import EvalCase, load_cases
from manage_assistant_eval.sse_client import send_chat_turn

DIMENSION = "E1_tool_selection"
CASES = load_cases(DATA_DIR / "manage_assistant_e1_tool_selection")


@pytest.mark.parametrize("case", CASES, ids=[c.case_id for c in CASES])
def test_e1_case(settings: Settings, case: EvalCase) -> None:
    trials = effective_trials(case)
    trial_results = []
    for _ in range(trials):
        result = send_chat_turn(case.question, settings=settings, scope=case.scope, role=case.role)
        trial_results.append(score_case(case, result))

    passes = sum(1 for ok, _ in trial_results if ok)
    passed = passes > trials / 2  # majority vote across trials
    detail = "; ".join(f"trial {i + 1}: {d}" for i, (ok, d) in enumerate(trial_results) if not ok)
    collector.record(
        DIMENSION,
        case.case_id,
        passed,
        detail,
        trials_run=trials,
        trials_dataset=case.trials or 1,
    )

    # Informational only (not asserted): surfaces the diagnostic tool choice
    # for genuinely ambiguous cases (e.g. 08_ambiguous_help_with_variance,
    # which has empty expected/forbidden lists and so always scores as a
    # pass regardless of what tool -- if any -- the model picked).
    print(f"[{case.case_id}] {passes}/{trials} trial(s) passed. {detail}")


def test_e1_aggregate_threshold() -> None:
    dim = collector.dimensions[DIMENSION]
    if not dim.cases:
        pytest.skip("no E1 cases were recorded (should not happen once the env check passes)")
    failing = [c for c in dim.cases if not c.passed]
    assert dim.passed_threshold, (
        f"E1 tool-selection score {dim.score:.3f} is below the {dim.threshold:.2f} threshold. "
        f"Failing cases: {[(c.case_id, c.detail) for c in failing]}"
    )
