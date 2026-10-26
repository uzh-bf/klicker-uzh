import asyncio
import json
import random

from common import Question
from pairwise import (
    aggregate,
    bootstrap_ci,
    build_prompt,
    judge_both_orders,
    load_answers,
    parse_verdict,
    plan_pairs,
    preference,
)

Q = Question("gt_1", "What is X?", "X is 4.")


def _run(judge_fn, a="answer from A", b="answer from B", seed=0):
    return asyncio.run(judge_both_orders(judge_fn, Q, a, b, random.Random(seed)))


def _prefers(text):
    """A fake judge that always picks the answer containing `text`."""

    async def judge(prompt, labels):
        for label in labels:
            if f"ANSWER {label}:\n{text}" in prompt:
                return label
        return None

    return judge


def test_content_preference_survives_order_swap_and_label_randomisation():
    for seed in range(20):
        assert _run(_prefers("answer from A"), seed=seed) == ("A", "A")
        assert _run(_prefers("answer from B"), seed=seed) == ("B", "B")


def test_position_bias_is_inconsistent_and_labels_are_randomised():
    seen = set()

    async def always_first(prompt, labels):
        seen.add(labels)
        return labels[0]

    assert _run(always_first) == ("A", "B")
    assert preference("A", "B") == "tie"
    assert len({label for labels in seen for label in labels}) > 1


def test_prompt_hides_system_identity_and_verdict_parsing_maps_labels():
    prompt = build_prompt(Q, [("K", "first text"), ("T", "second text")])
    assert "ANSWER K:\nfirst text" in prompt and "ANSWER T:\nsecond text" in prompt
    assert parse_verdict('{"winner": "t"}', ("K", "T")) == "T"
    assert parse_verdict('{"winner": "tie"}', ("K", "T")) == "tie"
    assert parse_verdict('{"winner": "Z"}', ("K", "T")) is None
    assert parse_verdict("not json", ("K", "T")) is None


def test_aggregate_win_rate_consistency_and_ci():
    results = {
        "q1": [("A", "A")],
        "q2": [("A", "A")],
        "q3": [("B", "B")],
        "q4": [("A", "B")],  # position bias: counts as half
        "q5": [("A", None)],  # unusable: dropped
    }
    report = aggregate(results, resamples=500)
    assert report["n_questions"] == 4
    assert report["n_pairs_dropped"] == 1
    assert report["win_rate_a"] == (1 + 1 + 0 + 0.5) / 4
    assert report["position_consistency"] == 3 / 4
    assert report["per_question"]["q4"]["preference"] == "tie"
    lo, hi = report["ci95"]
    assert lo <= report["win_rate_a"] <= hi


def test_bootstrap_ci_is_degenerate_for_unanimous_questions():
    assert bootstrap_ci([1.0] * 10) == (1.0, 1.0)
    assert bootstrap_ci([]) == (None, None)


def test_pairing_requires_both_systems_and_honours_limit(tmp_path):
    def write(name, rows):
        path = tmp_path / name
        path.write_text("\n".join(json.dumps(r) for r in rows))
        return load_answers(path)

    a = write("a.jsonl", [{"q": "gt_1", "text": "x"}, {"q": "gt_2", "text": "x"}])
    b = write("b.jsonl", [{"q": "gt_1", "text": "y"}, {"q": "gt_3", "text": "y"}])
    questions = [Question(f"gt_{i}", "q", "ref") for i in (1, 2, 3)]
    assert [(q.id, rep) for q, rep in plan_pairs(a, b, questions, None)] == [("gt_1", 0)]
    assert plan_pairs(a, b, questions, 0) == []
