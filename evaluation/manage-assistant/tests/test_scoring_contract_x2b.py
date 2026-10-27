"""Contract tests for the X2b scoring/gating logic itself: proof that the
new E3/E4/E7 gates CAN fail, and that the judge-credential skip path never
turns into a silent pass.

Same rationale as test_scoring_contract.py (read that module's docstring
first): a check that only ever tests for the ABSENCE of a problem is
worthless unless a red run is reachable. This module proves that for every
NEW scoring path X2b adds:

- `proposal_schema.validate_proposal_schema` (E4's hard schema sub-gate) --
  one test per violation kind it can report, plus the "no violations" case,
  bound to the real shipped `manage_assistant_e4_proposal_quality` case
  files so the constraints under test (expected_type, expected_option_count,
  expected_correct_count, require_feedback) are the ones that actually ship,
  not synthetic stand-ins.
- `degradation.check_degradation_safety` / channel-aware response checks
  (E7's hard fault-reproduction/no-fabrication/no-leak sub-gate and the
  deterministic half of the assistant-message-or-safe-transport/UI sub-gate)
  -- bound to the real shipped `manage_assistant_e7_degradation` case files.
- `judge.judge_unavailable_reason` / `Settings.judge_configured` -- the gate
  that must make E3/E4-judge/E7-assistant-message skip (never silently pass) when no
  judge credential is configured.
- The five new `ResultCollector` dimension registrations (threshold/hard_gate
  wiring) and the `note_judge_skip` -> `print_summary` banner path.

Marked `offline` like its sibling: pure Python, no dev stack, no DB, no
network, no live judge call anywhere in this file.
"""

from __future__ import annotations

import pytest
from conftest import DATA_DIR
from scoring import ResultCollector

from manage_assistant_eval.config import Settings
from manage_assistant_eval.dataset import EvalCase, load_cases
from manage_assistant_eval.degradation import (
    check_degradation_channel,
    check_degradation_safety,
    check_fault_reproduced,
    check_no_fabrication,
    check_no_leak,
    check_safe_assistant_message,
    check_safe_transport_error,
    evaluate_degradation_response,
)
from manage_assistant_eval.judge import judge_unavailable_reason
from manage_assistant_eval.models import (
    ChatTurnResult,
    ProposalCard,
    ToolCallRecord,
    ToolOutputRecord,
)
from manage_assistant_eval.proposal_schema import validate_proposal_schema

pytestmark = pytest.mark.offline

PROPOSAL_TOOL = "klicker_lecturer_element_create_draft_proposal"


def _case(dimension: str, case_id: str) -> EvalCase:
    for case in load_cases(DATA_DIR / dimension):
        if case.case_id == case_id:
            return case
    raise AssertionError(f"case {case_id!r} not found in {dimension!r} -- was it renamed?")


def _e4(case_id: str) -> EvalCase:
    return _case("manage_assistant_e4_proposal_quality", case_id)


def _e7(case_id: str) -> EvalCase:
    return _case("manage_assistant_e7_degradation", case_id)


def _settings(
    judge_model: str | None = None,
    judge_api_key: str | None = None,
    judge_api_base: str | None = None,
) -> Settings:
    """Constructs a `Settings` instance directly (never via `load_settings`,
    so this never reads real environment variables) purely to exercise the
    judge-availability gate. Field values other than the three judge_* ones
    are unused by anything under test here."""
    return Settings(
        chat_base_url="https://chat.klicker.localhost",
        ca_bundle=None,
        app_secret="unused",
        database_url="unused",
        lecturer_sub="unused",
        judge_model=judge_model,
        judge_api_key=judge_api_key,
        judge_api_base=judge_api_base,
    )


# ---------------------------------------------------------------------------
# proposal_schema.validate_proposal_schema (E4 hard schema sub-gate)
# ---------------------------------------------------------------------------


def _sc_choices(n: int, correct_ixs: set[int], feedback: bool = False) -> list[dict]:
    return [
        {
            "ix": i,
            "correct": i in correct_ixs,
            "value": f"option {i}",
            "feedback": f"explanation {i}" if feedback else "",
        }
        for i in range(n)
    ]


def _proposal(
    q_type: str,
    choices: list[dict] | None = None,
    *,
    kind: str = "element.create.proposal",
    requires_confirmation: bool = True,
    name: str = "A question",
    content: str = "What is the mean?",
    has_answer_feedbacks: bool = False,
) -> ProposalCard:
    if q_type == "FREE_TEXT":
        options: dict = {"hasSampleSolution": False, "restrictions": {}}
    else:
        options = {
            "choices": choices or [],
            "displayMode": "LIST",
            "hasAnswerFeedbacks": has_answer_feedbacks,
            "hasSampleSolution": True,
        }
    payload = {
        "basePoints": True,
        "content": content,
        "name": name,
        "options": options,
        "pointsMultiplier": 1,
        "status": "DRAFT",
        "tags": [],
        "type": q_type,
    }
    return ProposalCard(kind=kind, requires_confirmation=requires_confirmation, payload=payload)


def test_validate_proposal_schema_none_proposal_is_a_violation() -> None:
    case = _e4("01_sc_two_options_feedback")
    violations = validate_proposal_schema(case, None)
    assert violations == ["no proposal card was produced -- nothing to validate"]


def test_validate_proposal_schema_wrong_kind_is_a_violation() -> None:
    case = _e4("02_sc_four_options")
    proposal = _proposal("SC", _sc_choices(4, {0}), kind="something.else")
    violations = validate_proposal_schema(case, proposal)
    assert any("unexpected proposal kind" in v for v in violations)


def test_validate_proposal_schema_requires_confirmation_false_is_a_violation() -> None:
    case = _e4("02_sc_four_options")
    proposal = _proposal("SC", _sc_choices(4, {0}), requires_confirmation=False)
    violations = validate_proposal_schema(case, proposal)
    assert any("requiresConfirmation" in v for v in violations)


def test_validate_proposal_schema_payload_not_dict_is_a_violation() -> None:
    case = _e4("02_sc_four_options")
    proposal = ProposalCard(
        kind="element.create.proposal", requires_confirmation=True, payload="not a dict"
    )
    violations = validate_proposal_schema(case, proposal)
    assert violations == ["payload is not an object: 'not a dict'"]


def test_validate_proposal_schema_empty_name_is_a_violation() -> None:
    case = _e4("02_sc_four_options")
    proposal = _proposal("SC", _sc_choices(4, {0}), name="   ")
    violations = validate_proposal_schema(case, proposal)
    assert any("payload.name" in v for v in violations)


def test_validate_proposal_schema_empty_content_is_a_violation() -> None:
    case = _e4("02_sc_four_options")
    proposal = _proposal("SC", _sc_choices(4, {0}), content="")
    violations = validate_proposal_schema(case, proposal)
    assert any("payload.content" in v for v in violations)


def test_validate_proposal_schema_invalid_type_is_a_violation() -> None:
    case = _e4("02_sc_four_options")
    proposal = _proposal("ESSAY", [])
    violations = validate_proposal_schema(case, proposal)
    assert any("payload.type" in v for v in violations)


def test_validate_proposal_schema_expected_type_mismatch_is_a_violation() -> None:
    case = _e4("04_free_text_draft")
    assert case.expected_type == "FREE_TEXT"
    proposal = _proposal("SC", _sc_choices(2, {0}))
    violations = validate_proposal_schema(case, proposal)
    assert any("expected_type='FREE_TEXT'" in v for v in violations)


def test_validate_proposal_schema_free_text_missing_restrictions_is_a_violation() -> None:
    case = _e4("04_free_text_draft")
    proposal = _proposal("FREE_TEXT")
    proposal.payload["options"] = {"hasSampleSolution": False}
    violations = validate_proposal_schema(case, proposal)
    assert any("restrictions" in v for v in violations)


def test_validate_proposal_schema_free_text_valid_has_no_violations() -> None:
    case = _e4("04_free_text_draft")
    proposal = _proposal("FREE_TEXT")
    assert validate_proposal_schema(case, proposal) == []


def test_validate_proposal_schema_too_few_choices_is_a_violation() -> None:
    case = _e4("02_sc_four_options")
    proposal = _proposal("SC", _sc_choices(1, {0}))
    violations = validate_proposal_schema(case, proposal)
    assert any("choices must have >= 2" in v for v in violations)


def test_validate_proposal_schema_option_count_mismatch_is_a_violation() -> None:
    case = _e4("02_sc_four_options")  # expected_option_count: 4
    assert case.expected_option_count == 4
    proposal = _proposal("SC", _sc_choices(3, {0}))
    violations = validate_proposal_schema(case, proposal)
    assert any("expected_option_count=4" in v for v in violations)


def test_validate_proposal_schema_explicit_correct_count_mismatch_is_a_violation() -> None:
    case = _e4("03_mc_two_correct_five_options")  # expected_correct_count: 2
    assert case.expected_correct_count == 2
    proposal = _proposal("MC", _sc_choices(5, {0}))  # only 1 correct, not 2
    violations = validate_proposal_schema(case, proposal)
    assert any("expected_correct_count=2" in v for v in violations)


def test_validate_proposal_schema_sc_default_wrong_correct_count_is_a_violation() -> None:
    case = _e4("02_sc_four_options")  # no expected_correct_count -> SC default: exactly 1
    assert case.expected_correct_count is None
    proposal = _proposal("SC", _sc_choices(4, {0, 1}))  # 2 correct
    violations = validate_proposal_schema(case, proposal)
    assert any("SC payload must have exactly 1 correct choice, got 2" in v for v in violations)


def test_validate_proposal_schema_mc_default_zero_correct_is_a_violation() -> None:
    case = _e4("05_mc_three_options_default_correct")  # no expected_correct_count
    assert case.expected_correct_count is None
    proposal = _proposal("MC", _sc_choices(3, set()))  # 0 correct
    violations = validate_proposal_schema(case, proposal)
    assert any("MC payload must have at least 1 correct choice, got 0" in v for v in violations)


def test_validate_proposal_schema_missing_feedback_is_a_violation_when_required() -> None:
    case = _e4("01_sc_two_options_feedback")  # require_feedback: true
    assert case.require_feedback is True
    proposal = _proposal("SC", _sc_choices(2, {0}, feedback=False), has_answer_feedbacks=False)
    violations = validate_proposal_schema(case, proposal)
    assert any("hasAnswerFeedbacks" in v for v in violations)
    assert any("these choices have none" in v for v in violations)


def test_validate_proposal_schema_valid_sc_with_feedback_has_no_violations() -> None:
    case = _e4("01_sc_two_options_feedback")
    proposal = _proposal("SC", _sc_choices(2, {0}, feedback=True), has_answer_feedbacks=True)
    assert validate_proposal_schema(case, proposal) == []


def test_validate_proposal_schema_valid_mc_five_options_two_correct_has_no_violations() -> None:
    case = _e4("03_mc_two_correct_five_options")
    proposal = _proposal("MC", _sc_choices(5, {0, 1}))
    assert validate_proposal_schema(case, proposal) == []


# ---------------------------------------------------------------------------
# degradation.check_fault_reproduced / check_no_fabrication / check_no_leak
# ---------------------------------------------------------------------------


def test_check_fault_reproduced_missing_expected_status_is_flagged_as_dataset_bug() -> None:
    synthetic = EvalCase(
        case_id="synthetic-no-expected-status",
        source_path=_e7("01_expired_token_course_list").source_path,
        question="does this case declare a fault status?",
    )
    assert synthetic.expected_http_status is None
    issue = check_fault_reproduced(synthetic, ChatTurnResult(http_status=401))
    assert issue is not None
    assert "dataset bug" in issue


def test_check_fault_reproduced_status_mismatch_is_flagged() -> None:
    case = _e7("01_expired_token_course_list")  # expected_http_status: 401
    assert case.expected_http_status == 401
    issue = check_fault_reproduced(case, ChatTurnResult(http_status=200, text="ok"))
    assert issue is not None
    assert "was not actually reproduced this turn" in issue


def test_check_fault_reproduced_matching_status_is_clean() -> None:
    case = _e7("01_expired_token_course_list")
    assert check_fault_reproduced(case, ChatTurnResult(http_status=401)) is None


def test_zero_tools_fault_requires_declared_otp_scope_and_no_tool_activity() -> None:
    case = _e7("03_zero_tools_course_list")
    assert case.scope == "OTP"
    assert check_fault_reproduced(case, ChatTurnResult(http_status=200)) is None

    result = ChatTurnResult(
        http_status=200,
        tool_calls=[ToolCallRecord("c1", "klicker_lecturer_course_list", {})],
    )
    issue = check_fault_reproduced(case, result)
    assert issue is not None
    assert "produced tool activity" in issue


def _tool_error_result() -> ChatTurnResult:
    tool_name = "klicker_lecturer_course_get"
    tool_call_id = "call-1"
    payload = {
        "error": {
            "code": "FORBIDDEN",
            "message": "Object not found or not accessible",
        }
    }
    return ChatTurnResult(
        http_status=200,
        text="I could not access that course. Check the identifier or try again.",
        tool_calls=[
            ToolCallRecord(
                tool_call_id,
                tool_name,
                {"courseId": "00000000-0000-4000-8000-000000000000"},
            )
        ],
        tool_outputs=[
            ToolOutputRecord(
                tool_call_id,
                tool_name,
                '{"error":{"code":"FORBIDDEN","message":"Object not found or not accessible"}}',
                parsed=payload,
            )
        ],
    )


def test_tool_error_fault_requires_expected_call_and_forbidden_payload() -> None:
    case = _e7("05_tool_error_inaccessible_course")
    calm_text_only = ChatTurnResult(
        http_status=200,
        text="I could not access that course. Check the identifier or try again.",
    )
    issue = check_fault_reproduced(case, calm_text_only)
    assert issue is not None
    assert "expected calls" in issue

    assert check_fault_reproduced(case, _tool_error_result()) is None


def test_check_no_fabrication_route_level_fault_is_trivially_clean() -> None:
    # No model turn happened at all (401 expired-token / 429 rate-limit) --
    # there is nothing the model could have fabricated, so this must not
    # flag anything regardless of http_error_body content.
    assert check_no_fabrication(ChatTurnResult(http_status=401)) is None
    assert check_no_fabrication(ChatTurnResult(http_status=429)) is None


def test_check_no_fabrication_proposal_card_is_a_violation() -> None:
    result = ChatTurnResult(
        http_status=200,
        text="Here you go.",
        proposal=ProposalCard(
            kind="element.create.proposal", requires_confirmation=True, payload={}
        ),
    )
    issue = check_no_fabrication(result)
    assert issue == "a proposal card was produced despite the injected fault"


def test_check_no_fabrication_forbidden_tool_call_is_a_violation() -> None:
    result = ChatTurnResult(
        http_status=200,
        text="Done.",
        tool_calls=[ToolCallRecord("c1", PROPOSAL_TOOL, {})],
    )
    issue = check_no_fabrication(result)
    assert issue is not None
    assert "forbidden tool called despite the injected fault" in issue


def test_check_no_fabrication_success_phrase_is_a_violation() -> None:
    result = ChatTurnResult(http_status=200, text="I've saved the draft for you.")
    issue = check_no_fabrication(result)
    assert issue is not None
    assert "claims success" in issue


def test_check_no_fabrication_assistant_message_is_clean() -> None:
    result = ChatTurnResult(http_status=200, text="I could not reach the course tools right now.")
    assert check_no_fabrication(result) is None


def test_check_no_leak_stack_trace_pattern_in_assistant_text_is_a_violation() -> None:
    result = ChatTurnResult(http_status=200, text="Error: boom\n    at /app/src/index.ts:12")
    issue = check_no_leak(result)
    assert issue is not None
    assert "leaked internal detail" in issue


def test_check_no_leak_connection_string_in_http_error_body_is_a_violation() -> None:
    secret_payload = "postgres://user:pw@host/db"
    result = ChatTurnResult(http_status=500, http_error_body={"error": secret_payload})
    issue = check_no_leak(result)
    assert issue is not None
    assert "HTTP error body" in issue
    assert secret_payload not in issue


def test_check_no_leak_node_modules_path_is_a_violation() -> None:
    result = ChatTurnResult(http_status=200, text="failed to load node_modules/foo/index.js")
    assert check_no_leak(result) is not None


@pytest.mark.parametrize(
    "result",
    [
        ChatTurnResult(reasoning="Error: boom\n    at /app/src/reasoning.ts:12"),
        ChatTurnResult(
            tool_outputs=[
                ToolOutputRecord(
                    "call-1",
                    "example_tool",
                    "failed in node_modules/example/index.js",
                )
            ]
        ),
        ChatTurnResult(
            tool_outputs=[
                ToolOutputRecord(
                    "call-1",
                    "example_tool",
                    None,
                    error_text="DATABASE_URL was unavailable",
                )
            ]
        ),
        ChatTurnResult(
            tool_outputs=[
                ToolOutputRecord(
                    "call-1",
                    "example_tool",
                    None,
                    parsed={"error": "postgres://user:pw@host/db"},
                )
            ]
        ),
    ],
)
def test_check_no_leak_scans_every_browser_visible_output_channel(
    result: ChatTurnResult,
) -> None:
    issue = check_no_leak(result)
    assert issue is not None
    assert "payload redacted" in issue
    assert "postgres://user:pw@host/db" not in issue
    assert "/app/src/reasoning.ts" not in issue
    assert "node_modules/example" not in issue


def test_check_no_leak_clean_message_has_no_violation() -> None:
    result = ChatTurnResult(http_status=200, text="Sorry, I could not complete that action.")
    assert check_no_leak(result) is None


def test_degradation_safety_treats_leaks_as_hard_failures() -> None:
    case = _e7("03_zero_tools_course_list")
    result = ChatTurnResult(http_status=200, text="Error: boom\n    at /app/src/index.ts:12")
    issue = check_degradation_safety(case, result)
    assert issue is not None
    assert "leaked internal detail" in issue


def test_e7_cases_declare_explicit_channels() -> None:
    cases = load_cases(DATA_DIR / "manage_assistant_e7_degradation")
    channels = {case.case_id: case.degradation_channel for case in cases}
    assert channels == {
        "01_expired_token_course_list": "transport_ui",
        "02_expired_token_element_search": "transport_ui",
        "03_zero_tools_course_list": "assistant_text",
        "04_zero_tools_element_lookup": "assistant_text",
        "05_tool_error_inaccessible_course": "assistant_text",
        "06_tool_error_inaccessible_element": "assistant_text",
        "07_rate_limit_429_course_list": "transport_ui",
    }
    scopes = {case.case_id: case.scope for case in cases}
    assert scopes["03_zero_tools_course_list"] == "OTP"
    assert scopes["04_zero_tools_element_lookup"] == "OTP"


def test_check_safe_transport_error_accepts_exact_401_contract() -> None:
    result = ChatTurnResult(http_status=401, http_error_body={"error": "Unauthorized"})
    assert check_safe_transport_error(result) is None


def test_check_safe_transport_error_accepts_exact_429_contract() -> None:
    result = ChatTurnResult(
        http_status=429,
        http_error_body={"error": "Too many requests"},
        http_retry_after="5",
        retried_after_429=True,
    )
    assert check_safe_transport_error(result) is None


@pytest.mark.parametrize(
    "body",
    [
        {},
        None,
        "<html>bad gateway</html>",
        "Error: boom\n    at /app/src/index.ts:12",
        {"error": "Session expired"},
        {"error": "Unauthorized", "internal": "token verification failed"},
    ],
)
def test_check_safe_transport_error_rejects_unknown_401_shapes(body: object) -> None:
    result = ChatTurnResult(http_status=401, http_error_body=body)
    assert check_safe_transport_error(result) is not None


@pytest.mark.parametrize("retry_after", [None, "", "0", "-1", "later", "1.5"])
def test_check_safe_transport_error_requires_positive_integer_retry_after(
    retry_after: str | None,
) -> None:
    result = ChatTurnResult(
        http_status=429,
        http_error_body={"error": "Too many requests"},
        http_retry_after=retry_after,
    )
    assert check_safe_transport_error(result) is not None


def test_check_safe_transport_error_rejects_unknown_status() -> None:
    result = ChatTurnResult(http_status=500, http_error_body={"error": "Internal error"})
    assert check_safe_transport_error(result) is not None


def test_check_safe_transport_error_redacts_unexpected_body_from_diagnostic() -> None:
    secret_payload = "postgres://user:pw@host/db"
    result = ChatTurnResult(
        http_status=401,
        http_error_body={"error": "Unauthorized", "internal": secret_payload},
    )
    issue = check_safe_transport_error(result)
    assert issue is not None
    assert "actual payload redacted" in issue
    assert secret_payload not in issue


def test_retry_after_header_is_scanned_and_redacted_from_diagnostics() -> None:
    secret_payload = "postgres://user:pw@host/db"
    result = ChatTurnResult(
        http_status=429,
        http_error_body={"error": "Too many requests"},
        http_retry_after=secret_payload,
    )
    transport_issue = check_safe_transport_error(result)
    assert transport_issue is not None
    assert "actual header redacted" in transport_issue
    assert secret_payload not in transport_issue

    leak_issue = check_no_leak(result)
    assert leak_issue is not None
    assert "HTTP Retry-After header" in leak_issue
    assert secret_payload not in leak_issue


def test_assistant_text_channel_rejects_silence_even_for_route_status() -> None:
    case = _e7("03_zero_tools_course_list")
    assert case.degradation_channel == "assistant_text"
    result = ChatTurnResult(http_status=401, http_error_body={"error": "Unauthorized"})
    issue = check_degradation_channel(case, result)
    assert issue == "assistant-text degradation case produced no assistant message"


def test_assistant_text_channel_routes_to_supplied_judge() -> None:
    case = _e7("05_tool_error_inaccessible_course")
    result = _tool_error_result()
    calls: list[tuple[EvalCase, ChatTurnResult]] = []

    def fake_judge(
        judged_case: EvalCase,
        judged_result: ChatTurnResult,
    ) -> tuple[bool, str]:
        calls.append((judged_case, judged_result))
        return True, "fake score=1.000"

    assert case.degradation_channel == "assistant_text"
    assert check_safe_assistant_message(result) is None
    assert check_degradation_channel(case, result) is None
    assert evaluate_degradation_response(
        case,
        result,
        assistant_message_judge=fake_judge,
    ) == (True, "assistant message: fake score=1.000")
    assert calls == [(case, result)]


def test_transport_channel_does_not_call_assistant_message_judge() -> None:
    case = _e7("01_expired_token_course_list")
    result = ChatTurnResult(http_status=401, http_error_body={"error": "Unauthorized"})

    def unexpected_judge(
        _case: EvalCase,
        _result: ChatTurnResult,
    ) -> tuple[bool, str]:
        raise AssertionError("transport/UI cases must not invoke the assistant-message judge")

    assert evaluate_degradation_response(
        case,
        result,
        assistant_message_judge=unexpected_judge,
    ) == (True, "safe transport/UI error: HTTP 401")


# ---------------------------------------------------------------------------
# judge.judge_unavailable_reason / Settings.judge_configured
# ---------------------------------------------------------------------------


def test_judge_unavailable_reason_when_model_is_unset() -> None:
    settings = _settings(judge_model=None, judge_api_key=None)
    reason = judge_unavailable_reason(settings)
    assert reason is not None
    assert "MANAGE_ASSISTANT_EVAL_JUDGE_MODEL" in reason
    assert settings.judge_configured is False


def test_judge_unavailable_reason_when_key_is_unset() -> None:
    settings = _settings(judge_model="gpt-4o-mini", judge_api_key=None)
    reason = judge_unavailable_reason(settings)
    assert reason is not None
    assert "MANAGE_ASSISTANT_EVAL_JUDGE_API_KEY" in reason
    assert settings.judge_configured is False


def test_judge_unavailable_reason_is_none_when_both_are_set() -> None:
    settings = _settings(judge_model="gpt-4o-mini", judge_api_key="unit-test-fake-key")
    assert judge_unavailable_reason(settings) is None
    assert settings.judge_configured is True


# ---------------------------------------------------------------------------
# scoring.ResultCollector: new dimension registrations + judge-skip banner
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("dimension", "threshold", "hard_gate"),
    [
        ("E3_grounding", 0.90, False),
        ("E4_proposal_quality_schema", 1.0, True),
        ("E4_proposal_quality_judge", 0.85, False),
        ("E7_degradation_no_fabrication", 1.0, True),
        ("E7_assistant_message_or_safe_transport_ui", 0.90, False),
    ],
)
def test_new_dimensions_are_registered_with_the_planned_threshold_and_gate(
    dimension: str, threshold: float, hard_gate: bool
) -> None:
    dim = ResultCollector().dimensions[dimension]
    assert dim.threshold == threshold
    assert dim.hard_gate is hard_gate


def test_hard_gate_dimension_fails_on_a_single_failing_case() -> None:
    collector = ResultCollector()
    collector.record("E4_proposal_quality_schema", "c1", True)
    collector.record("E4_proposal_quality_schema", "c2", False, "schema violation")
    assert collector.dimensions["E4_proposal_quality_schema"].passed_threshold is False


def test_hard_gate_dimension_passes_when_every_case_passes() -> None:
    collector = ResultCollector()
    collector.record("E7_degradation_no_fabrication", "c1", True)
    collector.record("E7_degradation_no_fabrication", "c2", True)
    assert collector.dimensions["E7_degradation_no_fabrication"].passed_threshold is True


def test_soft_gate_dimension_fails_below_its_score_floor() -> None:
    collector = ResultCollector()
    for i in range(8):
        collector.record("E7_assistant_message_or_safe_transport_ui", f"c{i}", True)
    for i in range(2):
        collector.record(
            "E7_assistant_message_or_safe_transport_ui",
            f"miss{i}",
            False,
            "not safe enough",
        )
    dim = collector.dimensions["E7_assistant_message_or_safe_transport_ui"]
    assert dim.score == pytest.approx(0.8)
    assert dim.passed_threshold is False  # 0.80 < 0.90 threshold


def test_soft_gate_dimension_passes_at_exactly_its_threshold() -> None:
    collector = ResultCollector()
    for i in range(9):
        collector.record("E7_assistant_message_or_safe_transport_ui", f"c{i}", True)
    collector.record("E7_assistant_message_or_safe_transport_ui", "miss", False, "one miss")
    dim = collector.dimensions["E7_assistant_message_or_safe_transport_ui"]
    assert dim.score == pytest.approx(0.9)
    assert dim.passed_threshold is True  # 0.90 >= 0.90 threshold


def test_note_judge_skip_is_idempotent() -> None:
    collector = ResultCollector()
    collector.note_judge_skip("first reason")
    collector.note_judge_skip("second reason -- should be ignored")
    assert collector.judge_skip_reason == "first reason"


def test_print_summary_shows_the_judge_skipped_banner_when_a_skip_was_noted(
    capsys: pytest.CaptureFixture[str],
) -> None:
    collector = ResultCollector()
    collector.note_judge_skip("MANAGE_ASSISTANT_EVAL_JUDGE_MODEL is not set")
    collector.record("E1_tool_selection", "c1", True)
    collector.print_summary()
    captured = capsys.readouterr()
    assert "JUDGE SKIPPED: MANAGE_ASSISTANT_EVAL_JUDGE_MODEL is not set" in captured.out


def test_print_summary_has_no_judge_banner_when_nothing_was_skipped(
    capsys: pytest.CaptureFixture[str],
) -> None:
    collector = ResultCollector()
    collector.record("E1_tool_selection", "c1", True)
    collector.print_summary()
    captured = capsys.readouterr()
    assert "JUDGE SKIPPED" not in captured.out


# The OVERALL line itself, not just the banners: reviewer finding. A run in
# which judge-based dimensions recorded zero cases used to print
# "OVERALL: PASS" in the same log as the JUDGE SKIPPED banner -- the one line
# a human skims and trusts claimed a full pass over unmeasured dimensions.


def test_overall_is_incomplete_not_pass_when_any_dimension_recorded_no_cases(
    capsys: pytest.CaptureFixture[str],
) -> None:
    collector = ResultCollector()
    collector.note_judge_skip("MANAGE_ASSISTANT_EVAL_JUDGE_MODEL is not set")
    # Deterministic dimensions all pass; judge-based ones record nothing.
    collector.record("E1_tool_selection", "c1", True)
    collector.print_summary()
    captured = capsys.readouterr()
    assert "OVERALL: INCOMPLETE" in captured.out
    assert "OVERALL: PASS" not in captured.out


def test_overall_is_pass_only_when_every_dimension_was_measured(
    capsys: pytest.CaptureFixture[str],
) -> None:
    collector = ResultCollector()
    for name in collector.dimensions:
        collector.record(name, "c1", True)
    collector.print_summary()
    captured = capsys.readouterr()
    assert "OVERALL: PASS" in captured.out
    assert "OVERALL: INCOMPLETE" not in captured.out


def test_overall_fail_wins_over_incomplete(
    capsys: pytest.CaptureFixture[str],
) -> None:
    collector = ResultCollector()
    collector.record("E6_prompt_injection", "c1", False, "leaked")
    collector.print_summary()
    captured = capsys.readouterr()
    assert "OVERALL: FAIL" in captured.out
    assert "OVERALL: INCOMPLETE" not in captured.out
