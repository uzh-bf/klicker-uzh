"""Native DeepEval Arena comparison of two routing answer sets.

Compares two answer files (JSON lines with `q`, `text` and an optional `rep`,
one file per arm) with the pinned DeepEval ArenaGEval: contestant names are
masked and positions randomised natively, and one judge pass returns the
winner plus a rewritten reason per case. Criteria and evaluation steps come
from evaluation/data/metrics/klicker_routing_pairwise.yaml, so a case costs
exactly two judge requests (winner and reason) with no step generation, no
tie concept and no retry.

The script never constructs a judge or reads credentials by default:

    # Offline validation: inputs, pairing, reference join and request budget.
    uv run --frozen python src/routing_eval/pairwise.py \
        --answers-a _local/arm-a.jsonl --answers-b _local/arm-b.jsonl --check

--execute-live is the explicit opt-in for the judge. It requires an explicit
--max-cases admission bound, validates every pair, refuses an existing --out
before the judge is constructed, then runs serially with
create_eval_model(enforce_zero_retries=True) from the evaluation framework
(DeepEval is not a routing dependency; use the framework environment). Each
case allows exactly two judge requests, the native judge cost is recorded when
the model reports one, and the first judge error stops the run without retry.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

import yaml
from common import DEFAULT_GT_DIR, Question, load_questions, read_jsonl

ROUTING_DIR = Path(__file__).resolve().parents[2]
DEFAULT_PAIRWISE_METRICS = ROUTING_DIR.parent / "data" / "metrics" / "klicker_routing_pairwise.yaml"


def load_answers(path: Path) -> dict[tuple[str, int], str]:
    """Answer rows keyed by (question id, repeat); rejects unusable or duplicate rows."""
    out: dict[tuple[str, int], str] = {}
    for lineno, row in enumerate(read_jsonl([path]), 1):
        qid = row.get("q")
        text = row.get("text")
        if not isinstance(qid, str) or not qid.strip():
            raise ValueError(f"{path}:{lineno}: missing question id (q)")
        if not isinstance(text, str) or not text.strip():
            raise ValueError(f"{path}:{lineno}: missing answer text (text)")
        rep = row.get("rep", 0)
        if not isinstance(rep, int) or isinstance(rep, bool) or rep < 0:
            raise ValueError(f"{path}:{lineno}: repeat index (rep) must be a non-negative integer")
        if (qid, rep) in out:
            raise ValueError(f"{path}:{lineno}: duplicate row for {qid!r} rep {rep}")
        out[(qid, rep)] = text
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


def load_pairwise_spec(path: Path) -> dict:
    """Criteria and explicit evaluation steps for the native Arena metric."""
    data = yaml.safe_load(Path(path).read_text())
    if not isinstance(data, list) or len(data) != 1 or not isinstance(data[0], dict):
        raise ValueError(f"{path}: expected one pairwise metric definition")
    spec = data[0]
    name = spec.get("name")
    criteria = spec.get("criteria")
    steps = spec.get("evaluation_steps")
    if not isinstance(name, str) or not name.strip():
        raise ValueError(f"{path}: name must be a non-empty string")
    if not isinstance(criteria, str) or not criteria.strip():
        raise ValueError(f"{path}: criteria must be a non-empty string")
    if (
        not isinstance(steps, list)
        or not steps
        or not all(isinstance(step, str) and step.strip() for step in steps)
    ):
        raise ValueError(f"{path}: evaluation_steps must be a non-empty list of strings")
    return {"name": name, "criteria": criteria, "evaluation_steps": list(steps)}


def build_arena_case(question: str, reference: str, contestants: list[tuple[str, str]]):
    """ArenaTestCase with one shared question and reference and per-arm answers.

    The native class enforces unique contestant names and identical input and
    expected_output; only the answers differ between contestants.
    """
    from deepeval.test_case import ArenaTestCase, Contestant, LLMTestCase

    if len(contestants) != 2:
        raise ValueError("pairwise comparison expects exactly two contestants")
    names = [name for name, _ in contestants]
    if any(not isinstance(name, str) or not name.strip() for name in names) or len(
        set(names)
    ) != len(names):
        raise ValueError("contestant labels must be non-empty and unique")
    return ArenaTestCase(
        contestants=[
            Contestant(
                name=name,
                test_case=LLMTestCase(
                    input=question, actual_output=text, expected_output=reference
                ),
            )
            for name, text in contestants
        ]
    )


def judge_case(model, spec: dict, case) -> tuple[str, str]:
    """One native ArenaGEval pass: winner plus rewritten reason (two requests)."""
    from deepeval.metrics import ArenaGEval
    from deepeval.test_case import SingleTurnParams

    metric = ArenaGEval(
        name=spec["name"],
        criteria=spec["criteria"],
        evaluation_steps=spec["evaluation_steps"],
        evaluation_params=[
            SingleTurnParams.INPUT,
            SingleTurnParams.ACTUAL_OUTPUT,
            SingleTurnParams.EXPECTED_OUTPUT,
        ],
        model=model,
        async_mode=False,
    )
    winner = metric.measure(case, _show_indicator=False)
    return winner, str(metric.reason)


def load_judge_model():
    """Framework judge model under the single-attempt contract (live only).

    Imports customization.custom_model from the evaluation framework checkout,
    so live runs need the framework environment with DeepEval and the existing
    judge settings (LITELLM_API_BASE/LITELLM_API_KEY). enforce_zero_retries
    keeps one attempt per request with the configured timeout.
    """
    framework_src = ROUTING_DIR.parent / "framework" / "src"
    if not framework_src.is_dir():
        raise SystemExit(
            f"evaluation framework not found at {framework_src}; run: "
            "git submodule update --init --checkout evaluation/framework"
        )
    if str(framework_src) not in sys.path:
        sys.path.insert(0, str(framework_src))
    from customization.custom_model import create_eval_model

    return create_eval_model(enforce_zero_retries=True)


def _accounting_model(inner):
    """Serial judge wrapper: per-case request budget and native cost capture.

    `begin_case` admits exactly the two native Arena requests (winner and
    rewritten reason); a third request raises before it can be sent. Native
    models return (output, cost) tuples, so the cost is accumulated and the
    output unwrapped for the non-native DeepEval path.
    """
    from deepeval.models import DeepEvalBaseLLM

    class AccountingModel(DeepEvalBaseLLM):
        def __init__(self):
            super().__init__()
            self.calls = 0
            self.cost_usd = 0.0
            self._case_limit = None

        def load_model(self, *args, **kwargs):
            return None

        def get_model_name(self):
            return inner.get_model_name()

        def begin_case(self) -> None:
            self._case_limit = self.calls + 2

        def generate(self, *args, schema=None, **kwargs):
            if self._case_limit is not None and self.calls >= self._case_limit:
                raise RuntimeError(
                    "native Arena made a third judge request for one case; refusing it"
                )
            self.calls += 1
            result = inner.generate(*args, schema=schema, **kwargs)
            if isinstance(result, tuple):  # native models return (output, cost)
                result, cost = result
                if isinstance(cost, (int, float)):
                    self.cost_usd += float(cost)
            return result

        async def a_generate(self, *args, **kwargs):
            raise NotImplementedError("pairwise judgment is serial (async_mode=False)")

    return AccountingModel()


def _planned(args) -> dict:
    """Load inputs, pair answers and validate labels; no judge is touched."""
    answers_a = load_answers(args.answers_a)
    answers_b = load_answers(args.answers_b)
    pairs = plan_pairs(answers_a, answers_b, load_questions(args.gt_dir), args.limit)
    if not pairs:
        raise SystemExit("no paired (question, repeat) answers in the two files")
    for question, _ in pairs:
        if not question.reference.strip():
            raise SystemExit(f"{question.id}: empty ground-truth reference")
    spec = load_pairwise_spec(args.metrics)
    label_a = args.label_a or args.answers_a.stem
    label_b = args.label_b or args.answers_b.stem
    if label_a == label_b:
        raise SystemExit("contestant labels are identical; pass --label-a and --label-b")
    return {
        "answers_a": answers_a,
        "answers_b": answers_b,
        "pairs": pairs,
        "spec": spec,
        "labels": (label_a, label_b),
    }


def check_report(args) -> dict:
    """Offline report: inputs, pairing, reference join and request budget."""
    planned = _planned(args)
    cases = len(planned["pairs"])
    framework_python = ROUTING_DIR.parent / "framework" / ".venv" / "bin" / "python"
    return {
        "cases": cases,
        "request_budget": 2 * cases,
        "repeats": sorted({rep for _, rep in planned["pairs"]}),
        "spec": str(args.metrics),
        "labels": list(planned["labels"]),
        "max_cases": args.max_cases,
        "within_max_cases": args.max_cases is None or cases <= args.max_cases,
        "framework_python": str(framework_python) if framework_python.is_file() else None,
    }


def _print_check(report: dict) -> None:
    print("pairwise check (offline; no judge, no credentials)")
    print(f"labels: {report['labels'][0]} vs {report['labels'][1]}")
    print(f"paired cases: {report['cases']} (repeats {report['repeats']})")
    print(f"native judge budget: {report['request_budget']} requests (2 per case, serial)")
    print(f"spec: {report['spec']}")
    if report["framework_python"]:
        print(f"framework environment: {report['framework_python']}")
    else:
        print("framework environment: missing (needed only for --execute-live)")
    if not report["within_max_cases"]:
        print(f"result: NOT OK: {report['cases']} cases exceed --max-cases {report['max_cases']}")
    elif report["max_cases"] is None:
        print("result: OK; --execute-live still needs an explicit --max-cases")
    else:
        print("result: OK")


def run_live(args) -> int:
    """Serial native Arena run; explicit opt-in, bounded, no retry."""
    planned = _planned(args)  # validates every pair before any judge exists
    pairs = planned["pairs"]
    if args.max_cases is None:
        raise SystemExit("--execute-live needs an explicit --max-cases admission bound")
    if len(pairs) > args.max_cases:
        raise SystemExit(
            f"refusing to run {len(pairs)} cases above --max-cases {args.max_cases}; "
            "lower --limit or raise --max-cases explicitly"
        )
    if args.out is None:
        raise SystemExit("--execute-live requires --out FILE")
    if args.out.exists():
        raise SystemExit(f"refusing to overwrite existing output: {args.out}")
    label_a, label_b = planned["labels"]
    model = _accounting_model(load_judge_model())
    try:
        fd = os.open(args.out, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError as exc:
        raise SystemExit(f"refusing to overwrite existing output: {args.out}") from exc
    out = os.fdopen(fd, "w")
    out.write(
        json.dumps(
            {
                "kind": "run",
                "arm_a": label_a,
                "arm_b": label_b,
                "spec": str(args.metrics),
                "planned_cases": len(pairs),
                "request_bound": 2 * len(pairs),
                "max_cases": args.max_cases,
            }
        )
        + "\n"
    )
    results = []
    for question, rep in pairs:
        model.begin_case()
        case = build_arena_case(
            question.text,
            question.reference,
            [
                (label_a, planned["answers_a"][(question.id, rep)]),
                (label_b, planned["answers_b"][(question.id, rep)]),
            ],
        )
        before_calls, before_cost = model.calls, model.cost_usd
        try:
            winner, reason = judge_case(model, planned["spec"], case)
            calls = model.calls - before_calls
            if calls != 2:
                raise RuntimeError(
                    f"native Arena accounting expected 2 judge requests, counted {calls}"
                )
            record = {
                "kind": "case",
                "q": question.id,
                "rep": rep,
                "winner": winner,
                "reason": reason,
                "calls": calls,
                "cost_usd": round(model.cost_usd - before_cost, 6),
                "error": None,
            }
        except Exception as exc:  # noqa: BLE001 - recorded and stops the run
            record = {
                "kind": "case",
                "q": question.id,
                "rep": rep,
                "winner": None,
                "reason": None,
                "calls": model.calls - before_calls,
                "cost_usd": round(model.cost_usd - before_cost, 6),
                "error": f"{type(exc).__name__}: {str(exc)[:200]}",
            }
        results.append(record)
        out.write(json.dumps(record) + "\n")
        out.flush()
        if record["error"]:
            break
    out.close()
    errors = sum(record["error"] is not None for record in results)
    print(f"judged {len(results) - errors}/{len(pairs)} cases, {errors} error(s); wrote {args.out}")
    return 1 if errors or len(results) != len(pairs) else 0


def run(args) -> int:
    """CLI dispatch; refuses without an explicit mode before reading inputs."""
    if not args.check and not args.execute_live:
        raise SystemExit(
            "pairwise.py does not run a judge by default. Use --check for the "
            "offline report, or --execute-live for the bounded native DeepEval "
            "Arena run (two judge requests per case, single attempt, no retry)."
        )
    if args.check and args.execute_live:
        raise SystemExit("--check and --execute-live are mutually exclusive")
    try:
        if args.check:
            report = check_report(args)
            _print_check(report)
            return 0 if report["within_max_cases"] else 1
        return run_live(args)
    except ValueError as exc:
        raise SystemExit(f"pairwise: {exc}") from exc


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--answers-a", required=True, type=Path, help="answer JSON lines for arm A")
    ap.add_argument("--answers-b", required=True, type=Path, help="answer JSON lines for arm B")
    ap.add_argument("--label-a", help="contestant label for arm A (default: file stem)")
    ap.add_argument("--label-b", help="contestant label for arm B (default: file stem)")
    ap.add_argument("--gt-dir", type=Path, default=DEFAULT_GT_DIR)
    ap.add_argument(
        "--metrics",
        type=Path,
        default=DEFAULT_PAIRWISE_METRICS,
        help="pairwise criteria and evaluation steps YAML",
    )
    ap.add_argument("--limit", type=int, help="use at most this many questions")
    ap.add_argument(
        "--max-cases",
        type=int,
        help="explicit admission bound; required with --execute-live",
    )
    ap.add_argument("--out", type=Path, help="JSON lines output for --execute-live")
    mode = ap.add_mutually_exclusive_group()
    mode.add_argument(
        "--check",
        action="store_true",
        help="offline validation report; no judge, no credentials",
    )
    mode.add_argument(
        "--execute-live",
        action="store_true",
        help="explicit opt-in to run the native Arena judge serially",
    )
    raise SystemExit(run(ap.parse_args()))


if __name__ == "__main__":
    main()
