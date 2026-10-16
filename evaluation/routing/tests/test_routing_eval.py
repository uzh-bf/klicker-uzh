import argparse
import asyncio
import json

import bench
import pytest
from analyze import paired, project
from common import cost_usd
from observe import aggregate

PRICES = {"gpt-6-luna": {"input": 0.1, "output": 0.5, "cached_input": 0.01}}


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
