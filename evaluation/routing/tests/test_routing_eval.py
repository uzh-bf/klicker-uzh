import argparse
import asyncio
import json
import sys
from pathlib import Path

import bench
import pytest
from analyze import load_quality, paired, project, quality_stats
from common import cost_usd
from observe import aggregate

PRICES = {"gpt-6-luna": {"input": 0.1, "output": 0.5, "cached_input": 0.01}}
FRAMEWORK_SRC = Path(bench.__file__).resolve().parents[3] / "framework" / "src"


def test_observe_reports_routed_tiers_without_request_content():
    marker = "SYNTHETIC-PROMPT-MARKER"
    routed = {
        "model_group": "klickeruzh/azure/auto-router",
        "model": "azure/responses/gpt-6-luna",
        "call_type": "aresponses",
        "status": "success",
        "prompt_tokens": 1000,
        "completion_tokens": 200,
        "spend": 0.001,
        "request_duration_ms": 5000,
        "ttft_ms": 2000,
        "messages": [{"role": "user", "content": marker}],
        "response": {"content": marker},
        "user": marker,
        "api_key": marker,
        "metadata": {
            "usage_object": {"prompt_tokens_details": {"cached_tokens": 400}},
            "routing_decision": {
                "tier": "MEDIUM",
                "cause": "llm_classifier",
                "signals": [marker],
                "routed_model": "klickeruzh/azure/gpt-6-luna-xhigh",
                "router_model_name": "klickeruzh/azure/auto-router",
            },
        },
    }
    embedding = {
        "model_group": "klickeruzh/azure/auto-router",
        "model": "text-embedding-3-small",
        "call_type": "aembedding",
        "prompt_tokens": 16,
        "metadata": {"routing_decision": None},
    }
    out = aggregate([routed, embedding], PRICES)
    assert marker not in json.dumps(out)
    stats = out["models"]["klickeruzh/azure/gpt-6-luna-xhigh"]
    assert stats["cached_tokens"] == 400 and stats["cache_rate"] == 0.4
    assert stats["latency_ms"]["p50"] == 5000 and stats["ttft_ms"]["p50"] == 2000
    assert "klickeruzh/azure/auto-router (embedding)" in out["models"]
    router = out["routers"]["klickeruzh/azure/auto-router"]
    assert router["requests"] == 1 and router["tier_mix"]["MEDIUM"] == 1.0
    assert router["causes"] == {"llm_classifier": 1}


def test_cost_charges_cached_prompt_tokens_at_the_cached_rate():
    # 600 uncached + 400 cached input tokens, 200 output tokens.
    expected = (600 * 0.1 + 400 * 0.01 + 200 * 0.5) / 1e6
    assert cost_usd(PRICES, "klickeruzh/azure/gpt-6-luna-xhigh", 1000, 200, 400) == expected
    assert cost_usd(PRICES, "unknown-model", 1, 1) is None


def _row(arm, q, score):
    grade = {"correctness": score, "completeness": score, "clarity": score}
    return {"arm": arm, "q": q, "grade": grade}


def test_paired_difference_uses_only_questions_both_arms_answered():
    rows = [_row("a", "q1", 9), _row("b", "q1", 7), _row("a", "q2", 8), _row("b", "q2", 8)]
    rows.append(_row("a", "q3", 1))  # unmatched, must be ignored
    p = paired(rows, "a", "b")
    assert p["n"] == 2 and p["diff"] == 1.0 and p["lo"] <= 1.0 <= p["hi"]


def test_projection_weights_each_tier_arm_by_the_mix():
    stats = {"cheap": {"usd": 1.0, "quality": 7.0}, "strong": {"usd": 5.0, "quality": 9.0}}
    tier_map = {"SIMPLE": "cheap", "MEDIUM": "strong", "COMPLEX": "strong", "REASONING": "strong"}
    mix = {"SIMPLE": 0.5, "MEDIUM": 0.5, "COMPLEX": 0.0, "REASONING": 0.0}
    pr = project(tier_map, mix, stats)
    assert pr["usd"] == 3.0 and pr["quality"] == 8.0


def test_bench_refuses_to_run_without_explicit_no_judge(monkeypatch, tmp_path):
    """The removed live judge guard must fire before provider, dataset or output access."""
    constructed = []
    dataset_reads = []

    class SpyClient:
        def __init__(self, **kwargs):
            constructed.append(kwargs)

    def spy_load_questions(gt_dir):
        dataset_reads.append(gt_dir)
        raise AssertionError("dataset read before the guard")

    monkeypatch.setattr(bench, "AsyncOpenAI", SpyClient)
    monkeypatch.setattr(bench, "load_questions", spy_load_questions)
    monkeypatch.setenv("BENCH_REGRESSION_API_KEY", "offline-placeholder")
    out = tmp_path / "bench.jsonl"
    args = argparse.Namespace(
        arms="gpt-6-luna:high",
        repeats=1,
        gt_dir=tmp_path / "missing-gt",
        limit=None,
        base_url="https://unreachable.invalid/v1",
        api_key_env="BENCH_REGRESSION_API_KEY",
        model_prefix="openai/",
        effort_style="openrouter",
        no_judge=False,
        system_file=None,
        concurrency=1,
        max_calls=10,
        seed=0,
        out=out,
        keep_text=None,
    )
    with pytest.raises(SystemExit):
        asyncio.run(bench.run(args))
    assert constructed == []
    assert dataset_reads == []
    assert not out.exists()


def _forbidden(message):
    def boom(*args, **kwargs):
        raise AssertionError(message)

    return boom


def _gt_dir(tmp_path, questions=(("gt_1", "What is X?", "X is 4."),)):
    gt = tmp_path / "gt"
    gt.mkdir(exist_ok=True)
    for qid, question, reference in questions:
        (gt / f"{qid}.md").write_text(f"---\nquestion: {question}\n---\n{reference}\n")
    return gt


def _answer_row(**overrides):
    row = {"arm": "gpt-6-luna:high", "q": "gt_1", "rep": 0, "text": "X is 4.", "system": "SYS"}
    row.update(overrides)
    return row


def _answers_file(tmp_path, rows, name="answers.jsonl"):
    path = tmp_path / name
    path.write_text("\n".join(json.dumps(row) for row in rows))
    return path


def _import_args(answers, qa_dir, gt_dir, system_file=None):
    return argparse.Namespace(
        import_answers=answers, qa_dir=qa_dir, gt_dir=gt_dir, system_file=system_file
    )


def test_import_answers_writes_standard_qa_artifacts_and_manifest(tmp_path, monkeypatch):
    """The offline import must never construct a provider client or read a key."""
    monkeypatch.setattr(
        bench, "AsyncOpenAI", _forbidden("client constructed for an offline import")
    )
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    gt = _gt_dir(tmp_path)
    answers = _answers_file(
        tmp_path,
        [
            _answer_row(rep=0),
            _answer_row(rep=1, text="X is 4 again."),
            _answer_row(arm="gpt-6.1-sol:low", text="X is 4.", system="SYS-B"),
        ],
    )
    qa_dir = tmp_path / "qa"
    bench.import_answers(_import_args(answers, qa_dir, gt))

    manifest = json.loads((qa_dir / "manifest.json").read_text())
    assert [(a["arm"], a["rep"], a["cases"]) for a in manifest["artifacts"]] == [
        ("gpt-6-luna:high", 0, 1),
        ("gpt-6-luna:high", 1, 1),
        ("gpt-6.1-sol:low", 0, 1),
    ]
    artifact = json.loads((qa_dir / manifest["artifacts"][1]["file"]).read_text())
    assert artifact["metadata"]["agent_id"] == "gpt-6-luna:high"
    assert artifact["metadata"]["rep"] == 1
    generation = artifact["metadata"]["generation"]
    assert (
        generation["system_prompt"] == "SYS" and generation["ground_truth_sent_to_target"] is False
    )
    assert artifact["results"] == [
        {
            "id": "gt_1",
            "question": "What is X?",
            "actual_answer": "X is 4 again.",
            "expected_answer": "X is 4.",
        }
    ]


@pytest.mark.parametrize(
    "rows",
    [
        [_answer_row(q=None)],
        [_answer_row(q="gt_9")],
        [_answer_row(rep=None)],
        [_answer_row(rep=-1)],
        [_answer_row(arm=None)],
        [_answer_row(text=" ")],
        [_answer_row(), _answer_row()],
        [_answer_row(system=None)],
    ],
)
def test_import_answers_rejects_incomplete_duplicate_and_unknown_rows(tmp_path, rows):
    gt = _gt_dir(tmp_path)
    answers = _answers_file(tmp_path, rows)
    qa_dir = tmp_path / "qa"
    with pytest.raises(SystemExit):
        bench.import_answers(_import_args(answers, qa_dir, gt))
    assert not qa_dir.exists()


def test_import_answers_requires_consistent_system_and_rejects_collisions(tmp_path):
    gt = _gt_dir(
        tmp_path,
        (("gt_1", "What is X?", "X is 4."), ("gt_2", "What is Y?", "Y is 5.")),
    )
    mixed = _answers_file(
        tmp_path,
        [_answer_row(), _answer_row(q="gt_2", text="Y is 5.", system="SYS-2")],
        name="mixed.jsonl",
    )
    with pytest.raises(SystemExit, match="disagree"):
        bench.import_answers(_import_args(mixed, tmp_path / "qa", gt))
    collision = _answers_file(
        tmp_path, [_answer_row(arm="a:b"), _answer_row(arm="a b")], name="collision.jsonl"
    )
    with pytest.raises(SystemExit, match="collision"):
        bench.import_answers(_import_args(collision, tmp_path / "qa", gt))


def test_import_answers_preflights_conflicts_and_never_overwrites(tmp_path):
    gt = _gt_dir(tmp_path)
    answers = _answers_file(
        tmp_path, [_answer_row(rep=0), _answer_row(rep=1, text="X is 4 again.")]
    )
    qa_dir = tmp_path / "qa"
    qa_dir.mkdir()
    conflict = qa_dir / "qa_pairs_gpt-6-luna-high_rep1.json"
    conflict.write_text("historical")
    with pytest.raises(SystemExit, match="refusing to overwrite"):
        bench.import_answers(_import_args(answers, qa_dir, gt))
    assert list(qa_dir.iterdir()) == [conflict]
    assert conflict.read_text() == "historical"


def test_bench_run_dispatches_the_offline_import_without_a_client(tmp_path, monkeypatch):
    monkeypatch.setattr(
        bench, "AsyncOpenAI", _forbidden("client constructed for an offline import")
    )
    gt = _gt_dir(tmp_path)
    answers = _answers_file(tmp_path, [_answer_row()])
    qa_dir = tmp_path / "qa"
    args = argparse.Namespace(import_answers=answers, qa_dir=qa_dir, gt_dir=gt, system_file=None)
    asyncio.run(bench.run(args))
    assert (qa_dir / "manifest.json").is_file()


def test_imported_artifact_loads_through_the_native_framework_loader(tmp_path):
    pytest.importorskip("deepeval")
    gt = _gt_dir(tmp_path)
    answers = _answers_file(tmp_path, [_answer_row(text="X is 4.0")])
    qa_dir = tmp_path / "qa"
    bench.import_answers(_import_args(answers, qa_dir, gt))
    sys.path.insert(0, str(FRAMEWORK_SRC))
    try:
        from utils.utils import create_dataset_from_file
    finally:
        sys.path.remove(str(FRAMEWORK_SRC))
    cases = create_dataset_from_file(qa_dir / "qa_pairs_gpt-6-luna-high_rep0.json").test_cases
    assert [(c.input, c.actual_output, c.expected_output) for c in cases] == [
        ("What is X?", "X is 4.0", "X is 4.")
    ]


def _geval_row(qa_file, question, correctness, completeness, clarity, major_success):
    return {
        "input": question,
        "qa_file": qa_file,
        "metrics": {
            "Correctness [GEval]": {"score": correctness, "success": correctness >= 0.7},
            "Completeness [GEval]": {"score": completeness, "success": completeness >= 0.7},
            "Clarity [GEval]": {"score": clarity, "success": clarity >= 0.6},
            "Major Error [GEval]": {
                "score": 1.0 if major_success else 0.0,
                "success": major_success,
                "threshold": 0.5,
            },
        },
    }


def test_analyze_maps_native_geval_results_through_the_import_manifest(tmp_path):
    manifest = tmp_path / "manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "artifacts": [
                    {"file": "qa_pairs_arm-a_rep0.json", "arm": "arm-a", "rep": 0},
                    {"file": "qa_pairs_arm-b_rep0.json", "arm": "arm-b", "rep": 0},
                ]
            }
        )
    )
    results = tmp_path / "eval_results_1.json"
    results.write_text(
        json.dumps(
            {
                "results": [
                    _geval_row("qa_pairs_arm-a_rep0.json", "What is X?", 1.0, 0.8, 0.9, True),
                    _geval_row("qa_pairs_arm-b_rep0.json", "What is X?", 0.0, 0.4, 0.8, False),
                    {
                        "input": "What is Y?",
                        "qa_file": "qa_pairs_arm-a_rep0.json",
                        "metrics": {},
                        "skipped": True,
                    },
                ]
            }
        )
    )
    rows, unusable = load_quality(manifest, [results])
    assert unusable == 1
    stats = quality_stats(rows)
    assert stats["arm-a"]["mean"] == pytest.approx((1.0 + 0.8 + 0.9) / 3)
    assert stats["arm-a"]["major_errors"] == 0
    assert stats["arm-b"]["major_errors"] == 1
    p = paired(rows, "arm-a", "arm-b")
    assert p["n"] == 1 and p["diff"] > 0


def test_analyze_rejects_eval_rows_without_a_manifest_artifact(tmp_path):
    manifest = tmp_path / "manifest.json"
    manifest.write_text(json.dumps({"artifacts": []}))
    results = tmp_path / "eval_results_2.json"
    results.write_text(
        json.dumps({"results": [_geval_row("unknown.json", "What is X?", 1.0, 1.0, 1.0, True)]})
    )
    with pytest.raises(SystemExit, match="not in"):
        load_quality(manifest, [results])
