"""Blind pairwise judge for two sets of answers to the same questions.

Each answer pair is judged twice, once in each presentation order, with
freshly randomised labels so neither the position nor a fixed label can
decide the verdict. The judge sees the question and the reference facts, not
which system wrote which answer. Output is a JSON report with a per-question
preference, position consistency, the win rate of system A and a paired
bootstrap 95% confidence interval over questions.

Answer files are JSON lines with `q` (question id), `text` and an optional
`rep`, one file per system. Answers pair up on
(`q`, `rep`) and each question is scored as the mean over its repeats.

    uv run python src/routing_eval/pairwise.py \
        --answers-a _local/answers-v1.jsonl --answers-b _local/answers-v2.jsonl \
        --gt-dir <questions-with-reference-facts> --out _local/pairwise.json

The judge defaults to the same non-OpenAI model, endpoint and key variable as
`bench.py`. Reference facts can be real course material: keep the answer files
and the report in the ignored `_local/` directory.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import random
import re
import string
from collections import defaultdict
from pathlib import Path
from statistics import mean

from common import DEFAULT_GT_DIR, Question, load_questions, read_jsonl

JUDGE_PROMPT = """You compare two tutor answers to the same question. The
reference facts were written by the lecturer from the course material.

Prefer the answer that states more of the reference facts correctly, with
fewer contradictions of them and fewer specific claims they do not support.
Do not prefer an answer for length, tone or formatting. If neither is clearly
better, answer "tie".

Return only JSON: {"winner": "<label of the better answer, or tie>",
"note": "<one short sentence>"}

QUESTION:
{q}

REFERENCE FACTS:
{ref}

ANSWER {la}:
{a}

ANSWER {lb}:
{b}"""

LABEL_POOL = string.ascii_uppercase


def pick_labels(rng: random.Random) -> tuple[str, str]:
    """Two distinct random labels, so no fixed label stands for a position."""
    first, second = rng.sample(LABEL_POOL, 2)
    return first, second


def build_prompt(q: Question, shown: list[tuple[str, str]]) -> str:
    (la, a), (lb, b) = shown
    return (
        JUDGE_PROMPT.replace("{q}", q.text)
        .replace("{ref}", q.reference)
        .replace("{la}", la)
        .replace("{lb}", lb)
        .replace("{a}", a)
        .replace("{b}", b)
    )


def parse_verdict(raw: str | None, labels: tuple[str, str]) -> str | None:
    """Map the judge's reply to the shown label, `tie` or None when unusable."""
    m = re.search(r"\{.*\}", raw or "", re.S)
    if not m:
        return None
    try:
        winner = str(json.loads(m.group(0)).get("winner", "")).strip().strip("\"'").upper()
    except (json.JSONDecodeError, AttributeError):
        return None
    if winner == "TIE":
        return "tie"
    return winner if winner in labels else None


async def judge_both_orders(judge_fn, q: Question, text_a: str, text_b: str, rng: random.Random):
    """Judge one pair in both orders; return the system ('A', 'B', 'tie' or None) each time.

    `judge_fn(prompt, labels)` is async and returns the winning label, `tie` or
    None. Labels are drawn before the first await, so a seed fixes every draw.
    """
    plans = []
    for first_is_a in (True, False):
        labels = pick_labels(rng)
        order = [("A", text_a), ("B", text_b)] if first_is_a else [("B", text_b), ("A", text_a)]
        shown = [(labels[0], order[0][1]), (labels[1], order[1][1])]
        plans.append((labels, {labels[0]: order[0][0], labels[1]: order[1][0]}, shown))
    replies = await asyncio.gather(
        *(judge_fn(build_prompt(q, shown), lab) for lab, _, shown in plans)
    )
    return tuple(
        system_by_label.get(w, w) if w in (*labels, "tie") else None
        for (labels, system_by_label, _), w in zip(plans, replies, strict=True)
    )


def score(verdict: str | None) -> float | None:
    """Credit to system A for one verdict."""
    return {"A": 1.0, "tie": 0.5, "B": 0.0}.get(verdict)


def preference(first: str | None, second: str | None) -> str | None:
    """Overall preference: a system only when both orders pick it."""
    if first is None or second is None:
        return None
    return first if first == second else "tie"


def bootstrap_ci(values: list[float], *, resamples: int = 2000, seed: int = 0):
    """95% percentile bootstrap CI of the mean, resampling questions."""
    if not values:
        return None, None
    rng = random.Random(seed)
    boots = sorted(mean(rng.choices(values, k=len(values))) for _ in range(resamples))
    return boots[int(0.025 * resamples)], boots[int(0.975 * resamples) - 1]


def aggregate(results: dict[str, list[tuple[str | None, str | None]]], **bootstrap) -> dict:
    """Summarise per-question order pairs, one tuple per repeat.

    A question's score is the mean credit to A over all its usable verdicts,
    so an inconsistent pair counts as half. Position consistency is the share
    of judged pairs where both orders named the same system (or both tied).
    """
    per_question, consistent, judged, dropped = {}, 0, 0, 0
    for qid, pairs in sorted(results.items()):
        scores = []
        for first, second in pairs:
            s1, s2 = score(first), score(second)
            if s1 is None or s2 is None:
                dropped += 1
                continue
            scores += [s1, s2]
            judged += 1
            consistent += first == second
        if scores:
            per_question[qid] = {
                "score_a": mean(scores),
                "preference": "A" if mean(scores) > 0.5 else "B" if mean(scores) < 0.5 else "tie",
            }
    values = [v["score_a"] for v in per_question.values()]
    lo, hi = bootstrap_ci(values, **bootstrap)
    return {
        "n_questions": len(per_question),
        "n_pairs_judged": judged,
        "n_pairs_dropped": dropped,
        "win_rate_a": mean(values) if values else None,
        "ci95": [lo, hi],
        "position_consistency": consistent / judged if judged else None,
        "per_question": per_question,
    }


def load_answers(path: Path) -> dict[tuple[str, int], str]:
    out = {}
    for row in read_jsonl([path]):
        if row.get("q") is not None and row.get("text") is not None:
            out[(row["q"], row.get("rep", 0))] = row["text"]
    return out


def plan_pairs(a: dict, b: dict, questions: list[Question], limit: int | None):
    """(question, rep) pairs answered by both systems, limited to `limit` questions."""
    by_id = {q.id: q for q in questions}
    keys = sorted(set(a) & set(b), key=lambda k: (k[0], k[1]))
    keys = [k for k in keys if k[0] in by_id]
    if limit is not None:
        allowed = list(dict.fromkeys(k[0] for k in keys))[:limit]
        keys = [k for k in keys if k[0] in allowed]
    return [(by_id[qid], rep) for qid, rep in keys]


async def run(args) -> dict:
    from openai import AsyncOpenAI

    questions = load_questions(args.gt_dir)
    a, b = load_answers(args.answers_a), load_answers(args.answers_b)
    pairs = plan_pairs(a, b, questions, args.limit)
    if not pairs:
        raise SystemExit("no (question, rep) pairs answered by both systems")
    if 2 * len(pairs) > args.max_calls:
        raise SystemExit(f"{2 * len(pairs)} judge calls exceed --max-calls {args.max_calls}")
    client = AsyncOpenAI(base_url=args.base_url, api_key=os.environ[args.api_key_env])
    rng = random.Random(args.seed)
    sem = asyncio.Semaphore(args.concurrency)

    async def ask(prompt: str, labels: tuple[str, str]) -> str | None:
        async with sem:
            try:
                r = await client.chat.completions.create(
                    model=args.judge,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=300,
                    temperature=0,
                )
            except Exception:  # noqa: BLE001 - an unusable verdict is dropped and counted
                return None
        return parse_verdict(r.choices[0].message.content, labels)

    results = defaultdict(list)
    verdicts = await asyncio.gather(
        *(judge_both_orders(ask, q, a[(q.id, rep)], b[(q.id, rep)], rng) for q, rep in pairs)
    )
    for (q, _), verdict in zip(pairs, verdicts, strict=True):
        results[q.id].append(verdict)
    report = aggregate(results, resamples=args.resamples, seed=args.seed)
    report["judge"] = args.judge
    return report


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--answers-a", type=Path, required=True)
    ap.add_argument("--answers-b", type=Path, required=True)
    ap.add_argument(
        "--gt-dir", type=Path, default=DEFAULT_GT_DIR, help="questions with reference facts"
    )
    ap.add_argument("--limit", type=int, help="judge at most this many questions")
    ap.add_argument("--max-calls", type=int, default=200, help="refuse more judge calls than this")
    ap.add_argument("--base-url", default="https://openrouter.ai/api/v1")
    ap.add_argument("--api-key-env", default="OPENROUTER_API_KEY")
    ap.add_argument("--judge", default="anthropic/claude-opus-5.5")
    ap.add_argument("--concurrency", type=int, default=8)
    ap.add_argument("--resamples", type=int, default=2000)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", type=Path)
    args = ap.parse_args()
    report = asyncio.run(run(args))
    text = json.dumps(report, indent=2)
    if args.out:
        args.out.write_text(text + "\n")
    print(json.dumps({k: v for k, v in report.items() if k != "per_question"}, indent=2))


if __name__ == "__main__":
    main()
