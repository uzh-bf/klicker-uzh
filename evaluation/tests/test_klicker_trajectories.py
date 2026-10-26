"""Synthetic contract tests for the Klicker trajectory capture adapter.

Every fixture here is test-owned: a tiny generic version-1 corpus plus version-2
turn receipts written to tmp_path. The tests never start a model, provider,
network, or application runtime. They pin the normalized artifact returned by
import_trajectories and the module CLI against the receipt contract emitted by
evaluation/run-tutor-trajectories.mjs.
"""

import copy
import hashlib
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from adapters import klicker_trajectories  # noqa: E402
from adapters.klicker_trajectories import import_trajectories  # noqa: E402


KB_TOOL = "KB_doc_query"
SOURCE_MAPPING = {"version": 1, "maxSources": 99, "fingerprint": "a" * 64}
RECORDED_AT = "2026-10-13T00:00:00.000Z"
# Raw source material must never survive into a receipt or a normalized turn.
RAW_SOURCE_KEYS = {"title", "url", "content", "excerpt", "chunk", "chunks", "text"}


def _uuid(value: int) -> str:
    """Return a deterministic, syntactically valid version-4 UUID."""
    return f"00000000-0000-4000-8000-{value:012d}"


def _sources() -> list[dict]:
    """Hashed-only source diagnostics, mirroring the producer receipt shape."""
    return [
        {
            "toolCallId": _uuid(900),
            "sourcePosition": 1,
            "citationIndex": 1,
            "identityHash": hashlib.sha256(b"source-0").hexdigest(),
            "type": "document",
            "page": None,
            "startSec": None,
            "endSec": None,
        }
    ]


def _case(
    case_id: str,
    *,
    turns: list[dict],
    mode: str = "tutor",
    group: str = "development",
    language: str = "en",
    support: str = "synthetic support",
    rubric: tuple[str, ...] = ("Criterion one.",),
    assessment_turns: tuple[int, ...] = (1,),
) -> dict:
    return {
        "id": case_id,
        "group": group,
        "language": language,
        "mode": mode,
        "support": support,
        "rubric": list(rubric),
        "assessmentTurns": list(assessment_turns),
        "turns": turns,
    }


def _receipt(
    *,
    case_id: str,
    repeat: int,
    turn: int,
    thread_id: str,
    user_id: str,
    assistant_id: str,
    parent_id: str | None,
    user_text: str,
    assistant_text: str,
    mode: str,
    group: str = "development",
    language: str = "en",
    support: str = "synthetic support",
    arm: str = "baseline",
    model: str = "synthetic-model",
) -> dict:
    return {
        "type": "turn",
        "receiptVersion": 2,
        "arm": arm,
        "caseId": case_id,
        "group": group,
        "language": language,
        "mode": mode,
        "support": support,
        "repeat": repeat,
        "turn": turn,
        "threadId": thread_id,
        "userMessageId": user_id,
        "assistantMessageId": assistant_id,
        "parentId": parent_id,
        "model": model,
        "userText": user_text,
        "assistantText": assistant_text,
        "sources": _sources(),
        "sourceMapping": dict(SOURCE_MAPPING),
        "toolName": KB_TOOL,
        "toolStatus": "completed",
        "latencyMs": 12,
        "creditsUsed": 1,
        "recordedAt": RECORDED_AT,
    }


def _capture(
    case: dict,
    *,
    repeat: int = 0,
    start: int = 1,
    stop_after: int | None = None,
) -> tuple[str, list[dict]]:
    """Build one capture receipt chain, deriving repeatPrevious learner text."""
    counter = start
    thread_id = _uuid(counter)
    counter += 1
    receipts: list[dict] = []
    previous_assistant_id: str | None = None
    previous_assistant_text: str | None = None
    for turn_index, turn in enumerate(case["turns"], start=1):
        if stop_after is not None and turn_index > stop_after:
            break
        if turn.get("repeatPrevious"):
            user_text = (previous_assistant_text or "") + turn["suffix"]
        else:
            user_text = turn["message"]
        assistant_text = f"synthetic answer {turn_index}"
        user_id = _uuid(counter)
        counter += 1
        assistant_id = _uuid(counter)
        counter += 1
        receipts.append(
            _receipt(
                case_id=case["id"],
                repeat=repeat,
                turn=turn_index,
                thread_id=thread_id,
                user_id=user_id,
                assistant_id=assistant_id,
                parent_id=previous_assistant_id,
                user_text=user_text,
                assistant_text=assistant_text,
                mode=case["mode"],
                group=case["group"],
                language=case["language"],
                support=case["support"],
            )
        )
        previous_assistant_id = assistant_id
        previous_assistant_text = assistant_text
    return thread_id, receipts


def _summary(
    *,
    cases: int,
    repeats: int,
    completed: int,
    submitted: int,
    run_submitted: int | None = None,
    status: str = "completed",
    stop_code: str | None = None,
    arm: str = "baseline",
    model: str = "synthetic-model",
) -> dict:
    return {
        "type": "summary",
        "arm": arm,
        "model": model,
        "status": status,
        "stopCode": stop_code,
        "cases": cases,
        "repeats": repeats,
        "runSubmittedTurns": submitted if run_submitted is None else run_submitted,
        "completedTurns": completed,
        "submittedTurns": submitted,
        "creditsUsed": 1,
        "reservedProviderMicroUsd": 100,
        "uncertain": False,
        "recordedAt": RECORDED_AT,
    }


def _error(
    *,
    case_id: str,
    turn: int | None,
    repeat: int = 0,
    code: str = "trajectory_failed",
    arm: str = "baseline",
) -> dict:
    return {
        "type": "error",
        "arm": arm,
        "caseId": case_id,
        "turn": turn,
        "repeat": repeat,
        "code": code,
        "recordedAt": RECORDED_AT,
    }


def _write_jsonl(path: Path, records: list[dict]) -> Path:
    path.write_text("".join(json.dumps(record) + "\n" for record in records), encoding="utf-8")
    return path


def _write_corpus(path: Path, cases: list[dict]) -> Path:
    path.write_text(json.dumps({"version": 1, "cases": cases}), encoding="utf-8")
    return path


def _by_id(normalized: dict, key: str) -> dict:
    return next(result for result in normalized["results"] if result["id"] == key)


def _two_turn_case(case_id: str = "case-two") -> dict:
    return _case(
        case_id,
        turns=[{"message": "First question?"}, {"message": "Second question?"}],
    )


def _strict_case(**overrides) -> dict:
    """A two-turn case with every authored field present, before a mutation."""
    case = _two_turn_case("case-strict")
    case.update(overrides)
    return case


def _strict_corpus(**overrides) -> dict:
    """A version-1 corpus around one strict case, before a mutation."""
    corpus = {"version": 1, "cases": [_strict_case()]}
    corpus.update(overrides)
    return corpus


def _case_without(case: dict, field: str) -> dict:
    """Copy a case without one authored field to exercise required fields."""
    return {key: value for key, value in case.items() if key != field}


def _mutated(receipts: list[dict], index: int, **fields) -> list[dict]:
    mutated = copy.deepcopy(receipts)
    mutated[index].update(fields)
    return mutated


def _valid_fixtures(tmp_path: Path) -> tuple[Path, Path]:
    case = _case("case-cli", turns=[{"message": "Hello?"}])
    _, receipts = _capture(case)
    summary = _summary(cases=1, repeats=1, completed=1, submitted=1)
    receipts_path = _write_jsonl(tmp_path / "receipts.jsonl", [*receipts, summary])
    corpus_path = _write_corpus(tmp_path / "corpus.json", [case])
    return receipts_path, corpus_path


def test_metadata_describes_import_provenance(tmp_path):
    case = _case("case-meta", turns=[{"message": "Only question?"}])
    _, receipts = _capture(case)
    summary = _summary(cases=1, repeats=1, completed=1, submitted=1)
    receipts_path = _write_jsonl(tmp_path / "receipts.jsonl", [*receipts, summary])
    corpus_path = _write_corpus(tmp_path / "corpus.json", [case])

    metadata = import_trajectories(receipts_path, corpus_path)["metadata"]

    assert metadata["format"] == "conversation_capture"
    assert metadata["preserve_capture_records"] is True
    assert metadata["corpus_identity"] == "caller_attested"
    assert metadata["corpus_sha256"] == hashlib.sha256(corpus_path.read_bytes()).hexdigest()
    assert isinstance(metadata["summary"], dict)


def test_complete_capture_including_repeat_previous(tmp_path):
    case = _case(
        "case-complete",
        rubric=("First criterion.", "Second criterion."),
        # Authored out of order to pin ascending normalization.
        assessment_turns=(3, 1),
        turns=[
            {"message": " First  question? "},
            {"repeatPrevious": True, "suffix": " Please continue."},
            {"repeatPrevious": True, "suffix": ""},
        ],
    )
    thread_id, receipts = _capture(case)
    summary = _summary(cases=1, repeats=1, completed=3, submitted=3)
    receipts_path = _write_jsonl(tmp_path / "receipts.jsonl", [*receipts, summary])
    corpus_path = _write_corpus(tmp_path / "corpus.json", [case])

    normalized = import_trajectories(receipts_path, corpus_path)

    assert len(normalized["results"]) == 1
    result = normalized["results"][0]
    assert result["id"] == "case-complete:0"
    assert result["thread_id"] == thread_id
    assert result["chat_mode"] == "tutor"
    assert result["success"] is True
    assert result["assessment_eligible"] is True
    assert result["capture_status"] == "complete"
    assert result["assessment_disposition"] == "eligible"
    # The rubric supplies the expected outcome; the join separator is not pinned.
    assert "First criterion." in result["expected_outcome"]
    assert "Second criterion." in result["expected_outcome"]

    turns = result["turns"]
    assert [turn["role"] for turn in turns] == [
        "user",
        "assistant",
        "user",
        "assistant",
        "user",
        "assistant",
    ]
    # Authored learner text stays byte-identical, including surrounding spaces.
    assert turns[0]["content"] == " First  question? "
    assert turns[1]["content"] == "synthetic answer 1"
    assert turns[2]["content"] == "synthetic answer 1 Please continue."
    assert turns[3]["content"] == "synthetic answer 2"
    # An empty suffix repeats the entire preceding answer without change.
    assert turns[4]["content"] == turns[3]["content"]
    assert turns[5]["content"] == "synthetic answer 3"
    # Only assistant turns carry the source receipt as metadata.
    assert "metadata" not in turns[0]
    assert "metadata" not in turns[2]
    assert "metadata" not in turns[4]
    assert turns[1]["metadata"] == receipts[0]
    assert turns[3]["metadata"] == receipts[1]
    assert turns[5]["metadata"] == receipts[2]
    assert turns[1]["metadata"]["toolName"] == KB_TOOL
    assert turns[1]["metadata"]["toolStatus"] == "completed"

    assert set(result["capture"]) == {
        "case_id",
        "repeat",
        "arm",
        "group",
        "language",
        "mode",
        "support",
        "assessment_turns",
        "error",
    }
    assert result["capture"] == {
        "case_id": "case-complete",
        "repeat": 0,
        "arm": "baseline",
        "group": "development",
        "language": "en",
        "mode": "tutor",
        "support": "synthetic support",
        "assessment_turns": [1, 3],
        "error": None,
    }


def test_numeric_version_and_integral_assessment_selection_accepted(tmp_path):
    case = _case(
        "case-numeric",
        turns=[{"message": "First question?"}, {"message": "Second question?"}],
        assessment_turns=(2.0, 1),
    )
    _, receipts = _capture(case)
    summary = _summary(cases=1, repeats=1, completed=2, submitted=2)
    summary["cases"] = 1.0
    for receipt in receipts:
        receipt["turn"] = float(receipt["turn"])
        receipt["sourceMapping"]["version"] = 1.0
    receipts_path = _write_jsonl(tmp_path / "receipts.jsonl", [*receipts, summary])
    corpus_path = tmp_path / "corpus.json"
    # JSON numbers have no separate integral form: parsed 1.0 and 2.0 are the
    # same JavaScript numbers as 1 and 2, so both stay valid input.
    corpus_path.write_text(json.dumps({"version": 1.0, "cases": [case]}), encoding="utf-8")

    normalized = import_trajectories(receipts_path, corpus_path)

    result = _by_id(normalized, "case-numeric:0")
    assert result["capture"]["assessment_turns"] == [1, 2]
    assert all(type(n) is int for n in result["capture"]["assessment_turns"])


@pytest.mark.parametrize(
    "corpus",
    [
        pytest.param({**_strict_corpus(), "notes": "unexpected"}, id="unknown-root-field"),
        pytest.param(_strict_corpus(version=None), id="version-null"),
        pytest.param(_strict_corpus(version=True), id="version-boolean"),
        pytest.param(_strict_corpus(version=2), id="version-unsupported"),
        pytest.param(
            _strict_corpus(cases=[_strict_case(notes="unexpected")]),
            id="unknown-case-field",
        ),
        pytest.param(
            _strict_corpus(cases=[_case_without(_strict_case(), "rubric")]),
            id="missing-case-rubric",
        ),
        pytest.param(
            _strict_corpus(cases=[_strict_case(assessmentTurns=[])]),
            id="assessment-empty",
        ),
        pytest.param(
            _strict_corpus(cases=[_strict_case(assessmentTurns=[1, 1])]),
            id="assessment-duplicate",
        ),
        pytest.param(
            _strict_corpus(cases=[_strict_case(assessmentTurns=[True])]),
            id="assessment-boolean",
        ),
        pytest.param(
            _strict_corpus(cases=[_strict_case(assessmentTurns=[1.5])]),
            id="assessment-fractional",
        ),
        pytest.param(
            _strict_corpus(cases=[_strict_case(assessmentTurns=[3])]),
            id="assessment-out-of-range",
        ),
        pytest.param(
            _strict_corpus(cases=[_strict_case(group=["development"])]),
            id="group-array",
        ),
        pytest.param(
            _strict_corpus(cases=[_strict_case(language=["en"])]),
            id="language-array",
        ),
        pytest.param(
            _strict_corpus(cases=[_strict_case(mode=["tutor"])]),
            id="mode-array",
        ),
        pytest.param(
            _strict_corpus(
                cases=[
                    _strict_case(
                        turns=[
                            {"message": "First question?"},
                            {"message": "Second question?", "notes": "unexpected"},
                        ]
                    )
                ]
            ),
            id="turn-unknown-field",
        ),
        pytest.param(
            _strict_corpus(
                cases=[
                    _strict_case(
                        turns=[
                            {"message": "First question?"},
                            {
                                "message": "Second question?",
                                "repeatPrevious": True,
                                "suffix": "",
                            },
                        ]
                    )
                ]
            ),
            id="turn-mixed-repeat",
        ),
        pytest.param(
            _strict_corpus(
                cases=[
                    _strict_case(
                        turns=[
                            {"repeatPrevious": True, "suffix": " continue"},
                            {"message": "Second question?"},
                        ]
                    )
                ]
            ),
            id="turn-repeat-first",
        ),
        pytest.param(
            _strict_corpus(
                cases=[
                    _strict_case(
                        turns=[
                            {"message": "First question?"},
                            {"message": None},
                        ]
                    )
                ]
            ),
            id="turn-message-null",
        ),
    ],
)
def test_malformed_corpus_rejected(tmp_path, corpus):
    case = corpus["cases"][0]
    _, receipts = _capture(case)
    summary = _summary(cases=1, repeats=1, completed=len(receipts), submitted=len(receipts))
    receipts_path = _write_jsonl(tmp_path / "receipts.jsonl", [*receipts, summary])
    corpus_path = tmp_path / "corpus.json"
    corpus_path.write_text(json.dumps(corpus), encoding="utf-8")

    with pytest.raises(ValueError):
        import_trajectories(receipts_path, corpus_path)


def test_stopped_capture_retains_all_planned_rows(tmp_path):
    complete = _case("case-a", turns=[{"message": "A1?"}, {"message": "A2?"}])
    partial = _case("case-b", turns=[{"message": "B1?"}, {"message": "B2?"}])
    unstarted = _case("case-c", turns=[{"message": "C1?"}])
    _, complete_receipts = _capture(complete, start=1)
    _, partial_receipts = _capture(partial, start=100, stop_after=1)
    error = _error(case_id="case-b", turn=2)
    summary = _summary(
        cases=3,
        repeats=1,
        completed=3,
        submitted=3,
        status="stopped",
        stop_code="trajectory_failed",
    )
    receipts_path = _write_jsonl(
        tmp_path / "receipts.jsonl",
        [*complete_receipts, *partial_receipts, error, summary],
    )
    corpus_path = _write_corpus(tmp_path / "corpus.json", [complete, partial, unstarted])

    normalized = import_trajectories(receipts_path, corpus_path)

    assert [result["id"] for result in normalized["results"]] == [
        "case-a:0",
        "case-b:0",
        "case-c:0",
    ]

    started = _by_id(normalized, "case-a:0")
    assert started["capture_status"] == "complete"
    assert started["assessment_disposition"] == "eligible"
    assert started["success"] is True
    assert len(started["turns"]) == 4

    stopped = _by_id(normalized, "case-b:0")
    assert stopped["capture_status"] == "incomplete"
    assert stopped["assessment_disposition"] == "capture_incomplete"
    assert stopped["assessment_eligible"] is False
    assert stopped["success"] is False
    assert len(stopped["turns"]) == 2
    assert stopped["capture"]["error"]["code"] == "trajectory_failed"

    not_started = _by_id(normalized, "case-c:0")
    assert not_started["capture_status"] == "not_started"
    assert not_started["assessment_disposition"] == "capture_incomplete"
    assert not_started["success"] is False
    assert not_started["turns"] == []
    assert not_started["thread_id"] is None
    assert not_started["capture"]["error"] is None


def test_missing_summary_rejected(tmp_path):
    case = _case("case-no-summary", turns=[{"message": "Only question?"}])
    _, receipts = _capture(case)
    receipts_path = _write_jsonl(tmp_path / "receipts.jsonl", receipts)
    corpus_path = _write_corpus(tmp_path / "corpus.json", [case])

    with pytest.raises(ValueError):
        import_trajectories(receipts_path, corpus_path)


@pytest.mark.parametrize(
    "malformed",
    [
        {"type": "summary"},
        {"type": "summary", "status": "completed"},
        {"type": "summary", "arm": "baseline", "status": "completed", "cases": "many"},
    ],
)
def test_malformed_summary_rejected(tmp_path, malformed):
    case = _case("case-bad-summary", turns=[{"message": "Only question?"}])
    _, receipts = _capture(case)
    receipts_path = _write_jsonl(tmp_path / "receipts.jsonl", [*receipts, malformed])
    corpus_path = _write_corpus(tmp_path / "corpus.json", [case])

    with pytest.raises(ValueError):
        import_trajectories(receipts_path, corpus_path)


def test_malformed_receipt_line_rejected(tmp_path):
    case = _case("case-bad-line", turns=[{"message": "Only question?"}])
    _, receipts = _capture(case)
    summary = _summary(cases=1, repeats=1, completed=1, submitted=1)
    receipts_path = tmp_path / "receipts.jsonl"
    receipts_path.write_text(
        json.dumps(receipts[0]) + "\nnot-json\n" + json.dumps(summary) + "\n",
        encoding="utf-8",
    )
    corpus_path = _write_corpus(tmp_path / "corpus.json", [case])

    with pytest.raises(ValueError):
        import_trajectories(receipts_path, corpus_path)


def test_duplicate_turn_receipt_rejected(tmp_path):
    case = _two_turn_case("case-duplicate")
    _, receipts = _capture(case)
    duplicate = [*receipts, copy.deepcopy(receipts[0])]
    summary = _summary(cases=1, repeats=1, completed=3, submitted=3)
    receipts_path = _write_jsonl(tmp_path / "receipts.jsonl", [*duplicate, summary])
    corpus_path = _write_corpus(tmp_path / "corpus.json", [case])

    with pytest.raises(ValueError):
        import_trajectories(receipts_path, corpus_path)


def test_learner_text_mismatch_rejected(tmp_path):
    case = _case("case-text", turns=[{"message": "Observed question?"}])
    _, receipts = _capture(case)
    mutated = _mutated(receipts, 0, userText="A different learner turn")
    summary = _summary(cases=1, repeats=1, completed=1, submitted=1)
    receipts_path = _write_jsonl(tmp_path / "receipts.jsonl", [*mutated, summary])
    corpus_path = _write_corpus(tmp_path / "corpus.json", [case])

    with pytest.raises(ValueError):
        import_trajectories(receipts_path, corpus_path)


def test_repeat_previous_text_mismatch_rejected(tmp_path):
    case = _case(
        "case-repeat-text",
        turns=[
            {"message": "First question?"},
            {"repeatPrevious": True, "suffix": " Please continue."},
        ],
    )
    _, receipts = _capture(case)
    mutated = _mutated(receipts, 1, userText="Second question?")
    summary = _summary(cases=1, repeats=1, completed=2, submitted=2)
    receipts_path = _write_jsonl(tmp_path / "receipts.jsonl", [*mutated, summary])
    corpus_path = _write_corpus(tmp_path / "corpus.json", [case])

    with pytest.raises(ValueError):
        import_trajectories(receipts_path, corpus_path)


@pytest.mark.parametrize("field", ["userMessageId", "assistantMessageId", "threadId"])
def test_non_uuid_identifiers_rejected(tmp_path, field):
    case = _case("case-uuid", turns=[{"message": "Only question?"}])
    _, receipts = _capture(case)
    mutated = _mutated(receipts, 0, **{field: "not-a-uuid"})
    summary = _summary(cases=1, repeats=1, completed=1, submitted=1)
    receipts_path = _write_jsonl(tmp_path / "receipts.jsonl", [*mutated, summary])
    corpus_path = _write_corpus(tmp_path / "corpus.json", [case])

    with pytest.raises(ValueError):
        import_trajectories(receipts_path, corpus_path)


@pytest.mark.parametrize("field", ["userMessageId", "assistantMessageId", "threadId"])
def test_uuid_alias_cannot_reuse_identity(tmp_path, field):
    first = _case("case-first", turns=[{"message": "First question?"}])
    second = _case("case-second", turns=[{"message": "Second question?"}])
    _, first_receipts = _capture(first)
    _, second_receipts = _capture(second, start=100)
    second_receipts[0][field] = first_receipts[0][field].replace("-", "")
    summary = _summary(cases=2, repeats=1, completed=2, submitted=2)
    receipts_path = _write_jsonl(
        tmp_path / "receipts.jsonl", [*first_receipts, *second_receipts, summary]
    )
    corpus_path = _write_corpus(tmp_path / "corpus.json", [first, second])

    with pytest.raises(ValueError):
        import_trajectories(receipts_path, corpus_path)


def test_uuid_spelling_and_large_integer_accounting_preserved(tmp_path):
    case = _case("case-values", turns=[{"message": "Question?"}])
    _, receipts = _capture(case)
    receipt = receipts[0]
    for field in ("threadId", "userMessageId", "assistantMessageId"):
        receipt[field] = receipt[field].replace("-", "")
    receipt["latencyMs"] = 10**400
    receipt["sources"][0]["page"] = 10**400
    summary = _summary(cases=1, repeats=1, completed=1, submitted=1)
    receipts_path = _write_jsonl(tmp_path / "receipts.jsonl", [receipt, summary])
    corpus_path = _write_corpus(tmp_path / "corpus.json", [case])

    result = import_trajectories(receipts_path, corpus_path)["results"][0]

    assert result["thread_id"] == receipt["threadId"]
    assert result["turns"][1]["metadata"] == receipt


@pytest.mark.parametrize(
    ("index", "changes"),
    [
        (1, {"parentId": _uuid(9999)}),
        (0, {"parentId": _uuid(9999)}),
        (1, {"threadId": _uuid(9999)}),
        (1, {"model": "other-model"}),
    ],
    ids=["parent-chain", "first-parent", "thread", "model"],
)
def test_capture_identity_mismatch_rejected(tmp_path, index, changes):
    case = _two_turn_case("case-identity")
    _, receipts = _capture(case)
    mutated = _mutated(receipts, index, **changes)
    summary = _summary(cases=1, repeats=1, completed=2, submitted=2)
    receipts_path = _write_jsonl(tmp_path / "receipts.jsonl", [*mutated, summary])
    corpus_path = _write_corpus(tmp_path / "corpus.json", [case])

    with pytest.raises(ValueError):
        import_trajectories(receipts_path, corpus_path)


def test_cumulative_counter_below_local_rejected(tmp_path):
    case = _two_turn_case("case-counter")
    _, receipts = _capture(case)
    # The shared ledger is cumulative; it can never trail the local run count.
    summary = _summary(cases=1, repeats=1, completed=2, submitted=1, run_submitted=2)
    receipts_path = _write_jsonl(tmp_path / "receipts.jsonl", [*receipts, summary])
    corpus_path = _write_corpus(tmp_path / "corpus.json", [case])

    with pytest.raises(ValueError):
        import_trajectories(receipts_path, corpus_path)


@pytest.mark.parametrize("stale_turn", [1, 1.0, None])
def test_stale_error_turn_retained(tmp_path, stale_turn):
    case = _case("case-stale", turns=[{"message": "Q1?"}, {"message": "Q2?"}, {"message": "Q3?"}])
    _, receipts = _capture(case, stop_after=2)
    error = _error(case_id="case-stale", turn=stale_turn, repeat=0.0)
    summary = _summary(
        cases=1,
        repeats=1,
        completed=2,
        submitted=2,
        status="stopped",
        stop_code="trajectory_failed",
    )
    receipts_path = _write_jsonl(tmp_path / "receipts.jsonl", [*receipts, error, summary])
    corpus_path = _write_corpus(tmp_path / "corpus.json", [case])

    normalized = import_trajectories(receipts_path, corpus_path)

    result = _by_id(normalized, "case-stale:0")
    assert result["capture_status"] == "incomplete"
    # The attribution is retained verbatim; no submission is inferred from it.
    assert result["capture"]["error"]["turn"] == stale_turn
    assert result["capture"]["error"]["code"] == "trajectory_failed"


@pytest.mark.parametrize(
    ("target", "updates", "removed"),
    [
        ("mapping", {"version": True}, None),
        ("summary", {"cases": True}, None),
        ("summary", {"status": []}, None),
        ("summary", {"status": {}}, None),
        ("turn", {"turn": True}, None),
        ("turn", {"caseId": []}, None),
        ("turn", {"caseId": {}}, None),
        ("turn", {"toolName": []}, None),
        ("turn", {"toolStatus": {}}, None),
        ("error", {"repeat": False}, None),
        ("error", {"caseId": []}, None),
        ("error", {"unexpected": True}, None),
        ("error", {}, "recordedAt"),
        ("error", {"turn": True}, None),
        ("error", {"turn": 0}, None),
    ],
)
def test_malformed_capture_fields_rejected(tmp_path, target, updates, removed):
    case = _two_turn_case("case-malformed")
    _, receipts = _capture(case, stop_after=1)
    error = _error(case_id=case["id"], turn=2)
    summary = _summary(
        cases=1,
        repeats=1,
        completed=1,
        submitted=1,
        status="stopped",
        stop_code="trajectory_failed",
    )
    record = {
        "mapping": receipts[0]["sourceMapping"],
        "turn": receipts[0],
        "error": error,
        "summary": summary,
    }[target]
    record.update(updates)
    if removed:
        del record[removed]
    receipts_path = _write_jsonl(tmp_path / "receipts.jsonl", [*receipts, error, summary])
    corpus_path = _write_corpus(tmp_path / "corpus.json", [case])

    with pytest.raises(ValueError):
        import_trajectories(receipts_path, corpus_path)


def test_mixed_unsupported_quizzer(tmp_path):
    tutor = _case("case-tutor", turns=[{"message": "Tutor question?"}])
    quizzer = _case("case-quizzer", mode="quizzer", turns=[{"message": "Quiz question?"}])
    _, tutor_receipts = _capture(tutor, start=1)
    _, quizzer_receipts = _capture(quizzer, start=100)
    summary = _summary(cases=2, repeats=1, completed=2, submitted=2)
    receipts_path = _write_jsonl(
        tmp_path / "receipts.jsonl",
        [*tutor_receipts, *quizzer_receipts, summary],
    )
    corpus_path = _write_corpus(tmp_path / "corpus.json", [tutor, quizzer])

    normalized = import_trajectories(receipts_path, corpus_path)

    assert [result["id"] for result in normalized["results"]] == ["case-tutor:0", "case-quizzer:0"]
    eligible = _by_id(normalized, "case-tutor:0")
    assert eligible["success"] is True
    assert eligible["assessment_disposition"] == "eligible"

    unsupported = _by_id(normalized, "case-quizzer:0")
    # Eligibility is decided before generic mode validation: Quizzer is complete
    # but never assessed, and its mode and receipts survive unchanged.
    assert unsupported["chat_mode"] == "quizzer"
    assert unsupported["capture"]["mode"] == "quizzer"
    assert unsupported["capture_status"] == "complete"
    assert unsupported["assessment_disposition"] == "unsupported_mode"
    assert unsupported["success"] is False
    assert unsupported["assessment_eligible"] is False
    assert len(unsupported["turns"]) == 2
    assert unsupported["turns"][1]["metadata"] == quizzer_receipts[0]


def test_group_selection_filters_cases(tmp_path):
    development = _case("case-dev", group="development", turns=[{"message": "Dev question?"}])
    control = _case("case-control", group="control", turns=[{"message": "Control question?"}])
    _, receipts = _capture(development)
    summary = _summary(cases=1, repeats=1, completed=1, submitted=1)
    receipts_path = _write_jsonl(tmp_path / "receipts.jsonl", [*receipts, summary])
    corpus_path = _write_corpus(tmp_path / "corpus.json", [development, control])

    normalized = import_trajectories(receipts_path, corpus_path, group="development")

    assert [result["id"] for result in normalized["results"]] == ["case-dev:0"]
    assert normalized["results"][0]["capture"]["group"] == "development"


def test_repeat_rows_in_corpus_repeat_order(tmp_path):
    case = _case("case-repeat", turns=[{"message": "Only question?"}])
    thread_zero, receipts_zero = _capture(case, repeat=0, start=1)
    thread_one, receipts_one = _capture(case, repeat=1, start=100)
    summary = _summary(cases=1, repeats=2, completed=2, submitted=2)
    receipts_path = _write_jsonl(
        tmp_path / "receipts.jsonl",
        [*receipts_zero, *receipts_one, summary],
    )
    corpus_path = _write_corpus(tmp_path / "corpus.json", [case])

    normalized = import_trajectories(receipts_path, corpus_path)

    assert [result["id"] for result in normalized["results"]] == ["case-repeat:0", "case-repeat:1"]
    first, second = normalized["results"]
    assert first["capture"]["repeat"] == 0
    assert second["capture"]["repeat"] == 1
    assert first["thread_id"] == thread_zero
    assert second["thread_id"] == thread_one
    assert first["thread_id"] != second["thread_id"]


def test_source_metadata_preserved_hashes_only(tmp_path):
    case = _case("case-sources", turns=[{"message": "Only question?"}])
    _, receipts = _capture(case)
    summary = _summary(cases=1, repeats=1, completed=1, submitted=1)
    receipts_path = _write_jsonl(tmp_path / "receipts.jsonl", [*receipts, summary])
    corpus_path = _write_corpus(tmp_path / "corpus.json", [case])

    turns = import_trajectories(receipts_path, corpus_path)["results"][0]["turns"]
    metadata = turns[1]["metadata"]

    assert metadata["sourceMapping"] == SOURCE_MAPPING
    assert metadata["sources"] == receipts[0]["sources"]
    for source in metadata["sources"]:
        assert set(source) & RAW_SOURCE_KEYS == set()
        assert len(source["identityHash"]) == 64


def test_unsupported_source_mapping_version_rejected(tmp_path):
    case = _case("case-mapping", turns=[{"message": "Only question?"}])
    _, receipts = _capture(case)
    mutated = _mutated(
        receipts,
        0,
        sourceMapping={"version": 2, "maxSources": 99, "fingerprint": "a" * 64},
    )
    summary = _summary(cases=1, repeats=1, completed=1, submitted=1)
    receipts_path = _write_jsonl(tmp_path / "receipts.jsonl", [*mutated, summary])
    corpus_path = _write_corpus(tmp_path / "corpus.json", [case])

    with pytest.raises(ValueError):
        import_trajectories(receipts_path, corpus_path)


def test_cli_requires_receipts_corpus_and_output(tmp_path):
    receipts_path, corpus_path = _valid_fixtures(tmp_path)
    output_path = tmp_path / "out.json"

    for args in (
        [str(receipts_path)],
        [str(receipts_path), "--corpus", str(corpus_path)],
        ["--corpus", str(corpus_path), "--output", str(output_path)],
    ):
        with pytest.raises(SystemExit) as exc:
            klicker_trajectories.main(args)
        assert exc.value.code == 2
    assert not output_path.exists()


def test_cli_writes_normalized_output(tmp_path):
    receipts_path, corpus_path = _valid_fixtures(tmp_path)
    output_path = tmp_path / "out.json"

    klicker_trajectories.main(
        [str(receipts_path), "--corpus", str(corpus_path), "--output", str(output_path)]
    )

    written = json.loads(output_path.read_text(encoding="utf-8"))
    assert written["metadata"]["format"] == "conversation_capture"
    assert [result["id"] for result in written["results"]] == ["case-cli:0"]
    assert written == import_trajectories(receipts_path, corpus_path)


def test_cli_output_is_exclusive(tmp_path):
    receipts_path, corpus_path = _valid_fixtures(tmp_path)
    output_path = tmp_path / "out.json"
    output_path.write_text("PRE-EXISTING", encoding="utf-8")

    with pytest.raises(FileExistsError):
        klicker_trajectories.main(
            [str(receipts_path), "--corpus", str(corpus_path), "--output", str(output_path)]
        )
    assert output_path.read_text(encoding="utf-8") == "PRE-EXISTING"


def test_cli_fails_before_output_creation(tmp_path):
    case = _case("case-no-summary", turns=[{"message": "Only question?"}])
    _, receipts = _capture(case)
    receipts_path = _write_jsonl(tmp_path / "receipts.jsonl", receipts)
    corpus_path = _write_corpus(tmp_path / "corpus.json", [case])
    output_path = tmp_path / "out.json"

    with pytest.raises(ValueError):
        klicker_trajectories.main(
            [str(receipts_path), "--corpus", str(corpus_path), "--output", str(output_path)]
        )
    assert not output_path.exists()
