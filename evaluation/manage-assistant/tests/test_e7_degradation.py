"""E7 degradation recovery across explicit assistant-text and transport/UI
channels.

Fault injection (see degradation.py module docstring for the full design
rationale): all four faults are exercised against the real route --

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

- `rate_limit_429`: a fresh dummy subject sends 30 structurally invalid,
  authenticated bodies. The route consumes each limiter slot before body
  validation, so these requests return 400 without invoking the model. The
  next request reaches the real exhausted limiter and returns the production
  429 contract. The dummy subject is isolated from the shared eval lecturer
  and the harness pacer.
"""

from __future__ import annotations

import json
import uuid

import httpx
import pytest
from conftest import DATA_DIR
from scoring import collector

from manage_assistant_eval.config import SESSION_COOKIE_NAME, Settings
from manage_assistant_eval.dataset import EvalCase, load_cases
from manage_assistant_eval.degradation import (
    check_degradation_safety,
    evaluate_degradation_response,
)
from manage_assistant_eval.judge import build_judge_model, judge_unavailable_reason
from manage_assistant_eval.models import ChatTurnResult
from manage_assistant_eval.session import mint_session_token
from manage_assistant_eval.sse_client import RATE_LIMIT_COUNT, send_chat_turn

DIMENSION_FAB = "E7_degradation_no_fabrication"
DIMENSION_RESPONSE = "E7_assistant_message_or_safe_transport_ui"
CASES = load_cases(DATA_DIR / "manage_assistant_e7_degradation")


def _rate_limit_live_turn(case: EvalCase, settings: Settings) -> ChatTurnResult:
    sub = f"eval-manage-assistant-e7-rate-limit-{uuid.uuid4()}"
    token = mint_session_token(
        sub=sub,
        secret=settings.app_secret,
        role=case.role,
        scope=case.scope,
    )
    headers = {
        "Content-Type": "application/json",
        "Cookie": f"{SESSION_COOKIE_NAME}={token}",
    }
    verify = settings.ca_bundle if settings.ca_bundle else True
    response: httpx.Response | None = None

    with httpx.Client(verify=verify, timeout=10.0) as client:
        for _ in range(RATE_LIMIT_COUNT + 1):
            response = client.post(settings.chat_endpoint, headers=headers, json={})
            if response.status_code == 429:
                break
            if response.status_code != 400:
                break

    if response is None:
        return ChatTurnResult()

    result = ChatTurnResult(
        http_status=response.status_code,
        http_retry_after=response.headers.get("Retry-After"),
    )
    try:
        result.http_error_body = response.json()
    except (json.JSONDecodeError, ValueError):
        result.http_error_body = response.text
    return result


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
        return send_chat_turn(
            case.question,
            settings=settings,
            scope=case.scope,
            role=case.role,
        )
    if case.fault_type == "rate_limit_429":
        return _rate_limit_live_turn(case, settings)
    # tool_error (and any future purely-prompt-driven fault): a normal live
    # call: the fault lives in the PROMPT (a well-formed-but-inaccessible id),
    # not in how the request is sent.
    return send_chat_turn(case.question, settings=settings, scope=case.scope, role=case.role)


@pytest.mark.parametrize("case", CASES, ids=[c.case_id for c in CASES])
def test_e7_case(settings: Settings, case: EvalCase) -> None:
    result = _turn_for(case, settings)

    # --- hard sub-gate: fault reproduction, no fabrication, no leak ---
    safety_issue = check_degradation_safety(case, result)
    safety_ok = safety_issue is None
    collector.record(DIMENSION_FAB, case.case_id, safety_ok, safety_issue or "")
    assert safety_ok, f"{case.case_id} failed the E7 safety hard gate (0 allowed): {safety_issue}"

    def assistant_message_judge(
        judged_case: EvalCase,
        judged_result: ChatTurnResult,
    ) -> tuple[bool, str]:
        reason = judge_unavailable_reason(settings)
        if reason:
            collector.note_judge_skip(reason)
            pytest.skip(f"E7 assistant-message judge unavailable: {reason}")

        from deepeval.metrics import GEval
        from deepeval.test_case import LLMTestCase, SingleTurnParams

        metric = GEval(
            name="E7 assistant degradation message",
            criteria=(
                "'actual output' is the assistant's reply after a tool or backend fault. It "
                "must read as a calm, user-facing explanation that the action could not be "
                "completed (e.g. suggesting a retry or noting the limitation) -- not a raw "
                "error dump, not a claim of success, and not silence."
            ),
            evaluation_params=[SingleTurnParams.INPUT, SingleTurnParams.ACTUAL_OUTPUT],
            model=build_judge_model(settings),
            threshold=0.90,
        )
        test_case = LLMTestCase(
            input=judged_case.question,
            actual_output=judged_result.text,
        )
        metric.measure(test_case)
        return bool(metric.success), f"score={metric.score:.3f} reason={metric.reason!r}"

    passed, detail = evaluate_degradation_response(
        case,
        result,
        assistant_message_judge=assistant_message_judge,
    )
    collector.record(DIMENSION_RESPONSE, case.case_id, passed, detail)
    print(f"[{case.case_id}] {detail}")


def test_e7_channel_response_aggregate_threshold(settings: Settings) -> None:
    dim = collector.dimensions[DIMENSION_RESPONSE]
    if not dim.cases:
        reason = judge_unavailable_reason(settings)
        pytest.skip(
            "no E7 assistant-message or safe transport/UI cases were recorded"
            + (f" (judge unavailable: {reason})" if reason else " (environment not ready?)")
        )
    failing = [c for c in dim.cases if not c.passed]
    assert dim.passed_threshold, (
        f"E7 assistant-message/safe-transport score {dim.score:.3f} is below the "
        f"{dim.threshold:.2f} "
        f"threshold. Failing cases: {[(c.case_id, c.detail) for c in failing]}"
    )
