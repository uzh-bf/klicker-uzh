"""Offline helpers from the retired blind pairwise judge.

The script no longer runs a live LLM judge: running it fails immediately with
a pointer to the supported path. Grade answer quality with DeepEval through
util/_run_klicker_eval.sh (setup: evaluation/README.md; decision rules:
.agents/skills/klicker-model-routing-eval/SKILL.md).

The preserved helpers build the blind both-order prompts and parse verdicts
(`build_prompt`, `parse_verdict`, `pick_labels`), run both presentation orders
against an injected judge function (`judge_both_orders`), read and pair answer
files (JSON lines with `q`, `text` and an optional `rep`, one file per system:
`load_answers`, `plan_pairs`), and summarise per-question win rates, position
consistency and a bootstrap 95% confidence interval (`aggregate`,
`bootstrap_ci`, `preference`, `score`). Historical reports and the tests use
them offline.
"""

from __future__ import annotations

import asyncio
import json
import random
import re
import string
from pathlib import Path
from statistics import mean

from common import Question, read_jsonl

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


def run(args) -> None:
    """Refuse the removed live judge before credentials, provider or file access."""
    raise SystemExit(
        "pairwise.py no longer runs a live LLM judge. Grade answer quality with "
        "DeepEval through util/_run_klicker_eval.sh (see evaluation/README.md). "
        "The offline helpers (build_prompt, judge_both_orders, aggregate, "
        "bootstrap_ci) remain for historical reports."
    )


def main():
    run(None)


if __name__ == "__main__":
    main()
