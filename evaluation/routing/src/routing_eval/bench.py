"""Benchmark model and effort arms on the ground-truth questions.

Each arm answers every question with streaming through an OpenAI-compatible
endpoint (OpenRouter by default, or a LiteLLM proxy). The run records time to
first answer token, total latency and token usage. Runs require --no-judge:
the live grading that used to run here was removed, and answer quality is
graded with DeepEval through util/_run_klicker_eval.sh (see
evaluation/README.md). Output is JSON lines; answer text is written only with
--keep-text.

    uv run python src/routing_eval/bench.py \
        --arms gpt-6-luna:xhigh,gpt-6.1-sol:low --repeats 2 --no-judge \
        --out _local/bench.jsonl
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import sys
import time
from pathlib import Path

from common import DEFAULT_GT_DIR, load_questions
from openai import AsyncOpenAI

DEFAULT_SYSTEM = (
    "You are a course tutor for a university finance course. Answer the "
    "student's question accurately and clearly. Use LaTeX for formulas."
)


async def answer(client, args, model, effort, system, question):
    t0 = time.monotonic()
    first, parts, usage = None, [], None
    extra = {"reasoning": {"effort": effort}} if args.effort_style == "openrouter" else {}
    kwargs = {"reasoning_effort": effort} if args.effort_style == "openai" and effort else {}
    stream = await client.chat.completions.create(
        model=f"{args.model_prefix}{model}",
        messages=[{"role": "system", "content": system}, {"role": "user", "content": question}],
        stream=True,
        stream_options={"include_usage": True},
        extra_body=extra or None,
        **kwargs,
    )
    async for chunk in stream:
        if chunk.choices and chunk.choices[0].delta.content:
            if first is None:
                first = time.monotonic() - t0
            parts.append(chunk.choices[0].delta.content)
        if chunk.usage:
            usage = chunk.usage
    total = time.monotonic() - t0
    out_details = getattr(usage, "completion_tokens_details", None)
    in_details = getattr(usage, "prompt_tokens_details", None)
    return {
        "ttft": round(first or total, 2),
        "total": round(total, 2),
        "in": getattr(usage, "prompt_tokens", None),
        "cached": getattr(in_details, "cached_tokens", None),
        "out": getattr(usage, "completion_tokens", None),
        "reasoning": getattr(out_details, "reasoning_tokens", None),
    }, "".join(parts)


async def run(args):
    if not args.no_judge:
        raise SystemExit(
            "bench.py no longer grades answers with a live judge. Re-run with "
            "--no-judge to record answers, TTFT and token usage; grade answer "
            "quality with DeepEval through util/_run_klicker_eval.sh (see "
            "evaluation/README.md)."
        )
    client = AsyncOpenAI(base_url=args.base_url, api_key=os.environ[args.api_key_env])
    system = args.system_file.read_text() if args.system_file else DEFAULT_SYSTEM
    arms = [tuple((a.split(":") + [None])[:2]) for a in args.arms.split(",")]
    questions = load_questions(args.gt_dir)[: args.limit]
    jobs = [(arm, q, rep) for rep in range(args.repeats) for arm in arms for q in questions]
    if len(jobs) > args.max_calls:
        raise SystemExit(f"{len(jobs)} answer calls exceed --max-calls {args.max_calls}")
    random.Random(args.seed).shuffle(jobs)
    sem = asyncio.Semaphore(args.concurrency)
    out = open(args.out, "w") if args.out else sys.stdout
    texts = open(args.keep_text, "w") if args.keep_text else None

    async def one(arm, q, rep):
        model, effort = arm
        async with sem:
            try:
                res, text = await answer(client, args, model, effort, system, q.text)
            except Exception as e:  # noqa: BLE001 - recorded per row
                res, text = {"error": f"{type(e).__name__}: {str(e)[:200]}"}, None
        label = f"{model}:{effort}" if effort else model
        out.write(json.dumps({"arm": label, "q": q.id, "rep": rep, **res}) + "\n")
        out.flush()
        if texts and text is not None:
            texts.write(json.dumps({"arm": label, "q": q.id, "rep": rep, "text": text}) + "\n")

    await asyncio.gather(*(one(*j) for j in jobs))


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--arms", required=True, help="comma-separated model[:effort]")
    ap.add_argument("--repeats", type=int, default=2)
    ap.add_argument("--gt-dir", type=Path, default=DEFAULT_GT_DIR)
    ap.add_argument("--limit", type=int)
    ap.add_argument("--base-url", default="https://openrouter.ai/api/v1")
    ap.add_argument("--api-key-env", default="OPENROUTER_API_KEY")
    ap.add_argument("--model-prefix", default="openai/", help="empty for a LiteLLM proxy")
    ap.add_argument(
        "--effort-style",
        choices=("openrouter", "openai", "none"),
        default="openrouter",
        help="openrouter: reasoning.effort; openai: reasoning_effort; none: the alias fixes it",
    )
    ap.add_argument(
        "--no-judge",
        action="store_true",
        help="required: record answers, latency and usage; grade quality with DeepEval",
    )
    ap.add_argument("--system-file", type=Path)
    ap.add_argument("--concurrency", type=int, default=8)
    ap.add_argument("--max-calls", type=int, default=500, help="refuse larger runs")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", type=Path)
    ap.add_argument("--keep-text", type=Path, help="also write answer text (synthetic data only)")
    asyncio.run(run(ap.parse_args()))


if __name__ == "__main__":
    main()
