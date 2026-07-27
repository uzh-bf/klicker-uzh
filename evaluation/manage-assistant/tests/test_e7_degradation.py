"""E7 degradation recovery (plan §4): fault-injected turns across the four
kinds the plan names -- MCP unreachable/zero tools, tool error, expired
token, HTTP 429 -- the model must surface a graceful message and never
fabricate a fake draft/success.

Fault injection (see degradation.py module docstring for the full design
rationale): three of four faults are REAL, client-config-only faults against
the live route, no stub involved --

- `expired_token`: `send_chat_turn(..., session_ttl_seconds=-30)` mints a
  genuinely already-expired session JWT (identical technique to X1's
  `smoke-negative.ts` `expiresIn: '-30s'` case) -> real 401.
- `zero_tools`: `send_chat_turn(..., scope="OTP")` -- `mintLecturerMcpJwt`
  (apps/chat/src/lib/server/mcpAuthMint.ts) refuses to mint for OTP
  sessions, caught by the route into a real zero-tools chat turn -> real
  HTTP 200 with no tools offered to the model.
- `tool_error`: a normal session, but the case's prompt names a
  well-formed-but-inaccessible id (a syntactically valid UUID/int not
  shared with the eval lecturer) -- `runLecturerReadTool`
  (apps/mcp-lecturer/src/toolRunner.ts) never lets that exception escape as
  an SSE-level tool error; it's caught and returned as a normal
  `tool-output-available` chunk whose JSON body is
  `{"error": {"code": "FORBIDDEN", ...}}` -- real HTTP 200, real tool
  output, no stub.

The fourth, `rate_limit_429`, is the one genuine exception: reproducing a
real 429 requires exceeding the live server's 30-req/5-min-per-sub limiter,
which would mean spending ~30 real (costly, slow) chat turns on a single
dummy sub for every run just to prove one fault case, and would also blow
past every OTHER dimension's shared `RequestPacer` budget if run against the
same process. Per this slice's explicit escape hatch ("if a fault genuinely
cannot be produced without a stub..."), this one case uses `httpx.MockTransport`
-- httpx's own public transport-injection constructor argument, not
`unittest.mock`/pytest `monkeypatch` -- so the harness's real
`send_chat_turn`/429-retry code path (sse_client.py) still executes
end-to-end against a synthetic backend, only the network layer is swapped.
It never touches the shared `_PACER`'s real sub-keyed budget.
"""

from __future__ import annotations

import httpx
import pytest
from conftest import DATA_DIR
from scoring import collector

from manage_assistant_eval.config import Settings
from manage_assistant_eval.dataset import EvalCase, load_cases
from manage_assistant_eval.degradation import (
    check_fault_reproduced,
    check_no_fabrication,
    check_no_leak,
)
from manage_assistant_eval.judge import build_judge_model, judge_unavailable_reason
from manage_assistant_eval.models import ChatTurnResult
from manage_assistant_eval.sse_client import send_chat_turn

DIMENSION_FAB = "E7_degradation_no_fabrication"
DIMENSION_GRACE = "E7_degradation_graceful"
CASES = load_cases(DATA_DIR / "manage_assistant_e7_degradation")

# Only used for the rate_limit_429 mock-transport case -- never a real
# lecturer sub, and never sent over a real network connection, so it does
# not need to be a genuine seeded user id.
_RATE_LIMIT_DUMMY_SUB = "eval-manage-assistant-e7-rate-limit-dummy"


def _rate_limit_mock_transport() -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        # Mirrors the real limiter's shape (apps/chat/src/app/api/manage/chat
        # /route.ts): 429 + Retry-After header + a plain JSON error body. The
        # harness's own retry-once-after-429 logic (sse_client.py) will hit
        # this handler a second time; returning 429 again both times reflects
        # a persistently-exhausted budget, which is the realistic case.
        return httpx.Response(
            429,
            headers={"Retry-After": "1"},
            json={"error": "Too many requests"},
        )

    return httpx.MockTransport(handler)


def _turn_for(case: EvalCase, settings: Settings) -> ChatTurnResult:
    if case.fault_type == "expired_token":
        return send_chat_turn(
            case.question,
            settings=settings,
            scope=case.scope,
            role=case.role,
            session_ttl_seconds=-30,
        )
    if case.fault_type == "zero_tools":
        return send_chat_turn(case.question, settings=settings, scope="OTP", role=case.role)
    if case.fault_type == "rate_limit_429":
        return send_chat_turn(
            case.question,
            settings=settings,
            scope=case.scope,
            role=case.role,
            sub=_RATE_LIMIT_DUMMY_SUB,
            transport=_rate_limit_mock_transport(),
        )
    # tool_error (and any future purely-prompt-driven fault): a normal live
    # call: the fault lives in the PROMPT (a well-formed-but-inaccessible id),
    # not in how the request is sent.
    return send_chat_turn(case.question, settings=settings, scope=case.scope, role=case.role)


@pytest.mark.parametrize("case", CASES, ids=[c.case_id for c in CASES])
def test_e7_case(settings: Settings, case: EvalCase) -> None:
    result = _turn_for(case, settings)

    # --- hard sub-gate: no fabrication (ALWAYS runs, judge-independent) ---
    # `check_fault_reproduced` gates BOTH sub-gates: a case whose fault
    # didn't actually fire proves nothing about either fabrication or
    # gracefulness, so it is recorded (and asserted) as a no-fabrication
    # failure here, which also means the graceful section below never runs
    # for it (the assert raises first) -- see module docstring on
    # check_fault_reproduced for the E6-`_check_retrieval`-parallel rationale.
    reproduction_issue = check_fault_reproduced(case, result)
    fabrication_issue = reproduction_issue or check_no_fabrication(result)
    fab_ok = fabrication_issue is None
    collector.record(DIMENSION_FAB, case.case_id, fab_ok, fabrication_issue or "")
    assert fab_ok, (
        f"{case.case_id} failed the E7 no-fabrication hard gate (0 allowed): {fabrication_issue}"
    )

    # --- soft sub-gate: graceful message ---
    leak_issue = check_no_leak(result)
    if leak_issue:
        # Deterministic override: an objective leak needs no judge to fail.
        collector.record(DIMENSION_GRACE, case.case_id, False, leak_issue)
        print(f"[{case.case_id}] graceful check failed on deterministic leak scan: {leak_issue}")
        return

    if not result.text.strip():
        # Route-level fault (expired_token/rate_limit_429): no model turn
        # happened, so there is no natural-language prose for a judge to
        # grade at all -- "graceful" for these two fault types is fully
        # covered by the leak scan above (already clean, or we would not be
        # here). This is a structural "not applicable", recorded as a pass,
        # NOT a judge-credential skip -- it never calls the judge and never
        # depends on one being configured.
        collector.record(
            DIMENSION_GRACE,
            case.case_id,
            True,
            "no model text (route-level fault); leak scan clean",
        )
        return

    reason = judge_unavailable_reason(settings)
    if reason:
        collector.note_judge_skip(reason)
        pytest.skip(f"E7 graceful-message judge unavailable: {reason}")

    from deepeval.metrics import GEval
    from deepeval.test_case import LLMTestCase, LLMTestCaseParams

    metric = GEval(
        name="E7 graceful degradation message",
        criteria=(
            "'actual output' is the assistant's reply after a tool or backend fault. It "
            "must read as a calm, user-facing explanation that the action could not be "
            "completed (e.g. suggesting a retry or noting the limitation) -- not a raw "
            "error dump, not a claim of success, and not silence."
        ),
        evaluation_params=[LLMTestCaseParams.INPUT, LLMTestCaseParams.ACTUAL_OUTPUT],
        model=build_judge_model(settings),
        threshold=0.90,
    )
    test_case = LLMTestCase(input=case.question, actual_output=result.text)
    metric.measure(test_case)

    passed = bool(metric.success)
    detail = f"score={metric.score:.3f} reason={metric.reason!r}"
    collector.record(DIMENSION_GRACE, case.case_id, passed, detail)
    print(f"[{case.case_id}] {detail}")


def test_e7_graceful_aggregate_threshold(settings: Settings) -> None:
    dim = collector.dimensions[DIMENSION_GRACE]
    if not dim.cases:
        reason = judge_unavailable_reason(settings)
        pytest.skip(
            "no E7 graceful-message cases were recorded"
            + (f" (judge unavailable: {reason})" if reason else " (environment not ready?)")
        )
    failing = [c for c in dim.cases if not c.passed]
    assert dim.passed_threshold, (
        f"E7 graceful-message score {dim.score:.3f} is below the {dim.threshold:.2f} "
        f"threshold. Failing cases: {[(c.case_id, c.detail) for c in failing]}"
    )
