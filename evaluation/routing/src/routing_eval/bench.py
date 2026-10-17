"""Benchmark model and effort arms on the ground-truth questions.

Each arm answers every question with streaming through an OpenAI-compatible
endpoint (OpenRouter by default, or a LiteLLM proxy). The run records time to
first answer token, total latency and token usage. Runs require --no-judge:
the live grading that used to run here was removed, and answer quality is
graded with DeepEval through util/_run_klicker_eval.sh (see
evaluation/README.md). Output is JSON lines; answer text is written only with
--keep-text, which also records the system prompt of each answer so the
offline import below can render the exact generation input. Ground truth
never reaches the answered model: only the question text is sent.

    uv run python src/routing_eval/bench.py \
        --arms gpt-6-luna:xhigh,gpt-6.1-sol:low --repeats 2 --no-judge \
        --out _local/bench.jsonl

--import-answers runs offline and converts a --keep-text file into one
framework QA artifact per arm and repeat (question, actual_answer,
expected_answer) plus a manifest.json that maps artifact files to arms. The
artifacts feed util/_run_klicker_eval.sh --mode eval with the routing quality
metrics. Artifacts and the manifest are created exclusively with owner-only
permissions, so the import refuses to overwrite historical outputs:

    uv run python src/routing_eval/bench.py \
        --import-answers _local/bench-text.jsonl --qa-dir _local/qa
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import re
import sys
import time
from pathlib import Path

from common import DEFAULT_GT_DIR, load_questions, read_jsonl
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
    if getattr(args, "import_answers", None):
        import_answers(args)
        return
    if getattr(args, "qa_dir", None):
        raise SystemExit("--qa-dir requires --import-answers")
    if not args.arms:
        raise SystemExit(
            "--arms is required to record answers; use --import-answers for the "
            "offline QA import instead"
        )
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
            texts.write(
                json.dumps({"arm": label, "q": q.id, "rep": rep, "text": text, "system": system})
                + "\n"
            )

    await asyncio.gather(*(one(*j) for j in jobs))


def _qa_token(arm: str) -> str:
    """Filename-safe arm token; the artifact metadata keeps the real label."""
    return re.sub(r"[^A-Za-z0-9._-]+", "-", arm).strip("-") or "arm"


def _write_exclusive(path: Path, text: str) -> None:
    """Create a new file with owner-only permissions; never overwrite."""
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as fh:
        fh.write(text)


def import_answers(args) -> None:
    """Convert a --keep-text answers file into framework QA artifacts (offline).

    Writes one artifact per arm and repeat with the plain question, the
    captured answer and the ground-truth reference joined by question id,
    plus a manifest that maps artifact files to arms. Rows without a question
    id, repeat index, arm, answer text or system provenance are rejected, as
    are unknown question ids, duplicate rows and artifact name collisions.
    No model client is constructed and no credential is read.
    """
    answers = args.import_answers
    if not answers.is_file():
        raise SystemExit(f"--import-answers file not found: {answers}")
    if not args.qa_dir:
        raise SystemExit("--qa-dir is required with --import-answers")
    questions = load_questions(args.gt_dir)
    by_id = {q.id: q for q in questions}
    fallback_system = args.system_file.read_text() if args.system_file else None
    rows = read_jsonl([answers])
    if not rows:
        raise SystemExit(f"no answer rows found in {answers}")

    groups: dict[tuple[str, int], list[tuple[str, str, str | None]]] = {}
    seen: set[tuple[str, int, str]] = set()
    for lineno, row in enumerate(rows, 1):
        qid = row.get("q")
        if not isinstance(qid, str) or not qid.strip():
            raise SystemExit(f"{answers}:{lineno}: missing question id (q)")
        if qid not in by_id:
            raise SystemExit(
                f"{answers}:{lineno}: question id {qid!r} has no ground truth in {args.gt_dir}"
            )
        rep = row.get("rep")
        if not isinstance(rep, int) or isinstance(rep, bool) or rep < 0:
            raise SystemExit(f"{answers}:{lineno}: missing or invalid repeat index (rep)")
        arm = row.get("arm")
        if not isinstance(arm, str) or not arm.strip():
            raise SystemExit(f"{answers}:{lineno}: missing arm label (arm)")
        text = row.get("text")
        if not isinstance(text, str) or not text.strip():
            raise SystemExit(f"{answers}:{lineno}: missing answer text (text)")
        if (arm, rep, qid) in seen:
            raise SystemExit(f"{answers}:{lineno}: duplicate answer row for {qid!r} rep {rep}")
        seen.add((arm, rep, qid))
        system = row.get("system")
        groups.setdefault((arm, rep), []).append(
            (qid, text, system if isinstance(system, str) and system.strip() else None)
        )

    plan = []
    used: dict[str, str] = {}
    for (arm, rep), group in sorted(groups.items()):
        filename = f"qa_pairs_{_qa_token(arm)}_rep{rep}.json"
        if filename in used and used[filename] != arm:
            raise SystemExit(
                f"artifact name collision: {arm!r} and {used[filename]!r} both map to {filename}"
            )
        used[filename] = arm
        resolved = []
        for _, _, captured in group:
            if captured is not None:
                resolved.append((captured, "answers-capture"))
            elif fallback_system is not None and fallback_system.strip():
                resolved.append((fallback_system, "cli-system-file"))
            else:
                raise SystemExit(
                    f"{filename}: answer rows carry no captured system prompt; "
                    "re-capture with this bench version or pass --system-file used for generation"
                )
        systems = {system for system, _ in resolved}
        if len(systems) != 1:
            raise SystemExit(f"{filename}: answer rows disagree on the generation system prompt")
        sources = {source for _, source in resolved}
        plan.append(
            (
                filename,
                arm,
                rep,
                group,
                systems.pop(),
                sources.pop() if len(sources) == 1 else "mixed",
            )
        )
    targets = [args.qa_dir / filename for filename, *_ in plan] + [args.qa_dir / "manifest.json"]
    existing = [path for path in targets if path.exists()]
    if existing:
        raise SystemExit(
            "refusing to overwrite existing artifacts: " + ", ".join(str(path) for path in existing)
        )
    args.qa_dir.mkdir(parents=True, exist_ok=True)
    artifacts = []
    for filename, arm, rep, group, system, system_source in plan:
        model, _, effort = arm.partition(":")
        results = [
            {
                "id": qid,
                "question": by_id[qid].text,
                "actual_answer": text,
                "expected_answer": by_id[qid].reference,
            }
            for qid, text, _ in sorted(group)
        ]
        generation = {
            "arm": arm,
            "model": model,
            "effort": effort or None,
            "api": "chat.completions",
            "stream": True,
            "system_prompt": system,
            "system_source": system_source,
            "user_message": "verbatim ground-truth question text",
            "render": "messages=[{system}, {user}]",
            "ground_truth_sent_to_target": False,
            "answers_file": str(answers),
            "ground_truth_dir": str(args.gt_dir),
        }
        artifact = {
            "metadata": {"agent_id": arm, "arm": arm, "rep": rep, "generation": generation},
            "results": results,
        }
        path = args.qa_dir / filename
        _write_exclusive(path, json.dumps(artifact, indent=2, ensure_ascii=False) + "\n")
        artifacts.append(
            {
                "file": filename,
                "arm": arm,
                "rep": rep,
                "cases": len(results),
                "generation": generation,
            }
        )
        print(f"wrote {path} ({len(results)} cases)")
    manifest = {
        "generator": "bench.py --import-answers",
        "answers_file": str(answers),
        "ground_truth_dir": str(args.gt_dir),
        "artifacts": artifacts,
    }
    manifest_path = args.qa_dir / "manifest.json"
    _write_exclusive(manifest_path, json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {manifest_path} ({len(artifacts)} artifacts)")
    print(
        "grade with: util/_run_klicker_eval.sh --mode eval --qa-file <artifact> "
        "--metrics evaluation/data/metrics/klicker_routing_quality.yaml"
    )


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--arms", help="comma-separated model[:effort] (answer recording)")
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
    ap.add_argument(
        "--keep-text",
        type=Path,
        help="also write answer text with the generation system prompt (synthetic data only)",
    )
    ap.add_argument(
        "--import-answers",
        type=Path,
        help="offline: convert a --keep-text answers file into framework QA artifacts",
    )
    ap.add_argument(
        "--qa-dir",
        type=Path,
        help="offline: destination for QA artifacts and manifest.json (with --import-answers)",
    )
    asyncio.run(run(ap.parse_args()))


if __name__ == "__main__":
    main()
