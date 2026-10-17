"""Native Arena adapter tests; run them under the evaluation framework.

DeepEval is not a routing dependency, so this module skips in the routing
environment and runs offline against a scripted judge here:

    evaluation/framework/.venv/bin/python -m pytest tests/test_pairwise.py
"""

import argparse
import json
import re
import socket
import sys
from pathlib import Path

import pairwise
import pytest
from common import Question

pytest.importorskip("deepeval")

from deepeval.metrics.arena_g_eval.schema import RewrittenReason, Winner  # noqa: E402
from deepeval.models import DeepEvalBaseLLM  # noqa: E402
from deepeval.test_case import ArenaTestCase, Contestant, LLMTestCase  # noqa: E402

FRAMEWORK_SRC = Path(__file__).resolve().parents[1].parent / "framework" / "src"
if str(FRAMEWORK_SRC) not in sys.path:
    sys.path.insert(0, str(FRAMEWORK_SRC))

Q = Question("gt_1", "What is X?", "X is 4.")
ANSWER_A = "ARM-A-MARKER: X is 4."
ANSWER_B = "ALT-MARKER: X might be 5."


class ScriptedJudge(DeepEvalBaseLLM):
    """Native-shape judge: names the masked contestant whose answer holds a marker.

    Answers the Winner and RewrittenReason requests with JSON like a native
    model would, optionally as an (output, cost) tuple, and records the request
    sequence so tests can assert the per-case request budget.
    """

    def __init__(
        self,
        *,
        marker="ARM-A-MARKER",
        reason="states the reference facts",
        rewritten="rewritten: matches the reference",
        cost=None,
        raw=None,
        fail_after=None,
    ):
        super().__init__()
        self.marker = marker
        self.reason = reason
        self.rewritten = rewritten
        self.cost = cost
        self.raw = raw
        self.fail_after = fail_after
        self.schemas = []

    def load_model(self, *args, **kwargs):
        return self

    def get_model_name(self):
        return "scripted-arena-judge"

    def _winner_for(self, prompt):
        for fake, escaped in re.findall(r'"([A-Za-z]+)": "((?:[^"\\]|\\.)*)"', prompt):
            try:
                decoded = json.loads('"' + escaped + '"')
            except json.JSONDecodeError:
                continue
            if self.marker in decoded:
                return fake
        raise AssertionError("scripted judge found no answer holding the marker")

    def generate(self, prompt, schema=None, **kwargs):
        self.schemas.append(getattr(schema, "__name__", None))
        if self.fail_after is not None and len(self.schemas) > self.fail_after:
            raise RuntimeError("scripted judge failure")
        if self.raw is not None:
            return self.raw
        if schema is Winner:
            payload = {"winner": self._winner_for(prompt), "reason": self.reason}
        elif schema is RewrittenReason:
            payload = {"rewritten_reason": self.rewritten}
        else:
            raise AssertionError(f"unexpected judge request for schema {schema!r}")
        text = json.dumps(payload)
        return (text, self.cost) if self.cost is not None else text

    async def a_generate(self, *args, **kwargs):
        raise NotImplementedError("the pairwise adapter is serial")


def _case():
    return pairwise.build_arena_case(
        Q.text, Q.reference, [("arm-a", ANSWER_A), ("arm-b", ANSWER_B)]
    )


def _spec():
    return pairwise.load_pairwise_spec(pairwise.DEFAULT_PAIRWISE_METRICS)


def _judge(model):
    model.begin_case()
    return pairwise.judge_case(model, _spec(), _case())


def test_arena_pass_maps_the_masked_winner_and_records_native_cost():
    for cost in (None, 0.004):
        inner = ScriptedJudge(cost=cost)
        model = pairwise._accounting_model(inner)
        winner, reason = _judge(model)
        assert winner == "arm-a" and reason == "rewritten: matches the reference"
        assert inner.schemas == ["Winner", "RewrittenReason"]
        assert model.calls == 2
        assert model.cost_usd == (0.008 if cost else 0.0)


def test_arena_pass_makes_no_network_connection(monkeypatch):
    def blocked(*args, **kwargs):
        raise AssertionError("socket use during an offline Arena pass")

    monkeypatch.setattr(socket, "socket", blocked)
    monkeypatch.setattr(socket, "create_connection", blocked)
    model = pairwise._accounting_model(ScriptedJudge())
    winner, _ = _judge(model)
    assert winner == "arm-a" and model.calls == 2


def test_third_judge_request_is_refused_before_it_is_sent():
    inner = ScriptedJudge()
    model = pairwise._accounting_model(inner)
    _judge(model)
    with pytest.raises(RuntimeError, match="third judge request"):
        model.generate("one more")
    assert model.calls == 2 and inner.schemas == ["Winner", "RewrittenReason"]


def test_invalid_judge_output_fails_without_a_retry():
    inner = ScriptedJudge(raw="not json")
    model = pairwise._accounting_model(inner)
    with pytest.raises(ValueError):
        _judge(model)
    assert model.calls == 1 and inner.schemas == ["Winner"]


def test_arena_requires_identical_references_and_unique_contestants():
    with pytest.raises(ValueError, match="same 'expected_output'"):
        ArenaTestCase(
            contestants=[
                Contestant(
                    name="a",
                    test_case=LLMTestCase(input="q", actual_output="x", expected_output="r1"),
                ),
                Contestant(
                    name="b",
                    test_case=LLMTestCase(input="q", actual_output="y", expected_output="r2"),
                ),
            ]
        )
    with pytest.raises(ValueError, match="unique"):
        pairwise.build_arena_case("q", "r", [("a", "x"), ("a", "y")])


def test_answer_loading_rejects_duplicate_and_incomplete_rows(tmp_path):
    path = tmp_path / "answers.jsonl"

    def load(*rows):
        path.write_text("\n".join(json.dumps(row) for row in rows))
        return pairwise.load_answers(path)

    assert load({"q": "gt_1", "text": "x"}) == {("gt_1", 0): "x"}
    with pytest.raises(ValueError, match="duplicate"):
        load({"q": "gt_1", "text": "x"}, {"q": "gt_1", "text": "y"})
    with pytest.raises(ValueError, match="question id"):
        load({"text": "x"})
    with pytest.raises(ValueError, match="answer text"):
        load({"q": "gt_1", "text": " "})


def test_pairing_requires_both_systems_and_honours_limit(tmp_path):
    def write(name, rows):
        path = tmp_path / name
        path.write_text("\n".join(json.dumps(r) for r in rows))
        return pairwise.load_answers(path)

    a = write("a.jsonl", [{"q": "gt_1", "text": "x"}, {"q": "gt_2", "text": "x"}])
    b = write("b.jsonl", [{"q": "gt_1", "text": "y"}, {"q": "gt_3", "text": "y"}])
    questions = [Question(f"gt_{i}", "q", "ref") for i in (1, 2, 3)]
    assert [(q.id, rep) for q, rep in pairwise.plan_pairs(a, b, questions, None)] == [("gt_1", 0)]
    assert pairwise.plan_pairs(a, b, questions, 0) == []


def test_spec_loader_requires_explicit_steps(tmp_path):
    spec = tmp_path / "spec.yaml"
    spec.write_text("- name: routing_pairwise\n  criteria: compare\n")
    with pytest.raises(ValueError, match="evaluation_steps"):
        pairwise.load_pairwise_spec(spec)


def test_run_refuses_without_a_mode_before_reading_inputs():
    class RecordingArgs:
        check = False
        execute_live = False

        def __getattr__(self, name):
            raise AssertionError(f"args.{name} read before the mode guard")

    with pytest.raises(SystemExit):
        pairwise.run(RecordingArgs())
    with pytest.raises(SystemExit):
        pairwise.run(argparse.Namespace(check=True, execute_live=True))


def _gt_dir(tmp_path, references=("X is 4.", "Y is 5.")):
    gt = tmp_path / "gt"
    gt.mkdir(exist_ok=True)
    for i, (question, reference) in enumerate(zip(("What is X?", "What is Y?"), references), 1):
        (gt / f"gt_{i}.md").write_text(f"---\nquestion: {question}\n---\n{reference}\n")
    return gt


def _answers_file(tmp_path, name, marker):
    path = tmp_path / name
    rows = [
        {"q": "gt_1", "rep": 0, "text": f"{marker}: X is 4."},
        {"q": "gt_2", "rep": 0, "text": f"{marker}: Y is 5."},
    ]
    path.write_text("\n".join(json.dumps(row) for row in rows))
    return path


def _live_args(tmp_path, references=("X is 4.", "Y is 5."), **overrides):
    args = argparse.Namespace(
        answers_a=_answers_file(tmp_path, "a.jsonl", "ARM-A-MARKER"),
        answers_b=_answers_file(tmp_path, "b.jsonl", "ALT-MARKER"),
        label_a="arm-a",
        label_b="arm-b",
        gt_dir=_gt_dir(tmp_path, references),
        metrics=pairwise.DEFAULT_PAIRWISE_METRICS,
        limit=None,
        max_cases=2,
        out=tmp_path / "run.jsonl",
        check=False,
        execute_live=True,
    )
    for key, value in overrides.items():
        setattr(args, key, value)
    return args


def _no_judge(monkeypatch):
    def factory():
        raise AssertionError("judge constructed before input validation and admission")

    monkeypatch.setattr(pairwise, "load_judge_model", factory)


def test_check_is_offline_and_never_builds_the_judge(tmp_path, monkeypatch):
    _no_judge(monkeypatch)
    args = _live_args(tmp_path, check=True, execute_live=False, max_cases=None, out=None)
    report = pairwise.check_report(args)
    assert report["cases"] == 2 and report["request_budget"] == 4
    assert report["within_max_cases"] and report["labels"] == ["arm-a", "arm-b"]
    assert pairwise.run(args) == 0


def test_live_run_records_winners_reasons_costs_and_owner_only_output(tmp_path, monkeypatch):
    inner = ScriptedJudge(cost=0.004)
    monkeypatch.setattr(pairwise, "load_judge_model", lambda: inner)
    args = _live_args(tmp_path)
    assert pairwise.run_live(args) == 0
    records = [json.loads(line) for line in args.out.read_text().splitlines()]
    header, cases = records[0], records[1:]
    assert header["kind"] == "run" and header["request_bound"] == 4
    assert [c["winner"] for c in cases] == ["arm-a", "arm-a"]
    assert all(c["calls"] == 2 and c["error"] is None for c in cases)
    assert all(c["cost_usd"] == 0.008 for c in cases)
    assert inner.schemas == ["Winner", "RewrittenReason"] * 2
    assert args.out.stat().st_mode & 0o077 == 0
    with pytest.raises(SystemExit):
        pairwise.run_live(args)


def test_live_run_stops_after_the_first_judge_error_without_retry(tmp_path, monkeypatch):
    inner = ScriptedJudge(fail_after=0)
    monkeypatch.setattr(pairwise, "load_judge_model", lambda: inner)
    args = _live_args(tmp_path)
    assert pairwise.run_live(args) == 1
    cases = [json.loads(line) for line in args.out.read_text().splitlines()][1:]
    assert len(cases) == 1 and cases[0]["error"] and cases[0]["calls"] == 1
    assert inner.schemas == ["Winner"]


@pytest.mark.parametrize(
    "overrides",
    [
        {"max_cases": None},
        {"max_cases": 1},
    ],
)
def test_live_admission_is_checked_before_the_judge(tmp_path, monkeypatch, overrides):
    _no_judge(monkeypatch)
    with pytest.raises(SystemExit):
        pairwise.run_live(_live_args(tmp_path, **overrides))


def test_live_refuses_existing_output_before_the_judge(tmp_path, monkeypatch):
    _no_judge(monkeypatch)
    out = tmp_path / "run.jsonl"
    out.write_text("historical")
    with pytest.raises(SystemExit):
        pairwise.run_live(_live_args(tmp_path, out=out))
    assert out.read_text() == "historical"


def test_live_validates_every_pair_before_the_judge(tmp_path, monkeypatch):
    _no_judge(monkeypatch)
    args = _live_args(tmp_path, references=("X is 4.", ""))
    with pytest.raises(SystemExit, match="gt_2"):
        pairwise.run_live(args)
