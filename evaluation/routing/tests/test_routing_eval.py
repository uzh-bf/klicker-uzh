import json

from analyze import paired, project
from common import cost_usd
from observe import aggregate

PRICES = {"gpt-6-luna": {"input": 0.1, "output": 0.5, "cached_input": 0.01}}


def test_observe_output_never_contains_request_content():
    marker = "SYNTHETIC-PROMPT-MARKER"
    rows = [
        {
            "model_group": "klickeruzh/azure/gpt-6-luna-high",
            "status": "success",
            "prompt_tokens": 1000,
            "completion_tokens": 200,
            "spend": 0.001,
            "startTime": "2026-10-01T10:00:00Z",
            "completionStartTime": "2026-10-01T10:00:02Z",
            "endTime": "2026-10-01T10:00:05Z",
            "messages": [{"role": "user", "content": marker}],
            "response": {"content": marker},
            "user": marker,
            "api_key": marker,
            "metadata": {"usage_object": {"prompt_tokens_details": {"cached_tokens": 400}}},
        }
    ]
    out = aggregate(rows, PRICES, {"gpt-6-luna-high": "SIMPLE"})
    assert marker not in json.dumps(out)
    stats = out["models"]["klickeruzh/azure/gpt-6-luna-high"]
    assert stats["cached_tokens"] == 400 and stats["cache_rate"] == 0.4
    assert stats["latency_ms"]["p50"] == 5000 and stats["ttft_ms"]["p50"] == 2000
    assert out["tier_mix"]["SIMPLE"] == 1.0


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
