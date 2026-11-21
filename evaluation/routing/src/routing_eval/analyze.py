"""Turn replay, bench and observe outputs into one Markdown report.

    uv run python src/routing_eval/analyze.py \
        --replay _local/replay-v1.jsonl _local/replay-v2.jsonl \
        --bench _local/bench.jsonl \
        --compare gpt-6.1-sol:low~gpt-6-luna:xhigh \
        --tier-map v1=SIMPLE:gpt-6-luna:high,MEDIUM:gpt-6-luna:xhigh,COMPLEX:gpt-6.1-sol:high,REASONING:gpt-6.1-sol:medium \
        --tier-map v2=SIMPLE:gpt-6-luna:high,MEDIUM:gpt-6.1-sol:low,COMPLEX:gpt-6.1-sol:medium,REASONING:gpt-6.1-sol:high \
        --mix replay:auto-router > _local/report.md

`--mix` selects the tier mix for projections: `replay:<router>` uses a replay
file, `observe:<path>[#router]` uses real traffic from observe.py, and
`SIMPLE=0.13,MEDIUM=0.74,...` sets it explicitly.

`--quality` adds native DeepEval GEval results: pass the manifest.json written
by `bench.py --import-answers` first, then the framework eval_results files.
Each result row joins its artifact by the recorded `qa_file` and keeps its
native 0-1 scores.
"""

from __future__ import annotations

import argparse
import json
import random
from collections import Counter, defaultdict
from pathlib import Path
from statistics import mean

from common import TIERS, cost_usd, load_prices, percentile, read_jsonl


def quality(grade: dict | None) -> float | None:
    if not grade:
        return None
    try:
        return mean(float(grade[k]) for k in ("correctness", "completeness", "clarity"))
    except (KeyError, TypeError, ValueError):
        return None


def quality_stats(rows: list[dict]) -> dict[str, dict]:
    """Per-arm native GEval summary; major errors are counted separately."""
    by_arm = defaultdict(list)
    for r in rows:
        by_arm[r["arm"]].append(r)
    stats = {}
    for arm, rs in sorted(by_arm.items()):

        def metric_mean(name):
            vals = [r["grade"][name] for r in rs if name in r["grade"]]
            return mean(vals) if vals else None

        qs = [q for r in rs if (q := quality(r["grade"])) is not None]
        stats[arm] = {
            "n": len(rs),
            "correctness": metric_mean("correctness"),
            "completeness": metric_mean("completeness"),
            "clarity": metric_mean("clarity"),
            "mean": mean(qs) if qs else None,
            "major_errors": sum(r["grade"].get("major_error") is True for r in rs),
        }
    return stats


GEVAL_CORE = ("correctness", "completeness", "clarity")


def load_quality(manifest_path: Path, eval_paths: list[Path]) -> tuple[list[dict], int]:
    """Framework eval results as grade rows, mapped explicitly and offline.

    Each result row joins its import artifact by the `qa_file` it records; the
    manifest then gives the arm. Metric payloads map by their `<Name> [GEval]`
    runtime name, the question is the row `input`, and scores stay native 0-1
    values. `major_error` follows the metric's own success flag. Skipped rows,
    judge errors and rows with missing core scores are counted and excluded.
    """
    manifest = json.loads(Path(manifest_path).read_text())
    artifacts = {Path(a["file"]).name: a for a in manifest["artifacts"]}
    rows, unusable = [], 0
    for path in eval_paths:
        for row in json.loads(Path(path).read_text()).get("results", []):
            qa_file = Path(str(row.get("qa_file") or "")).name
            if qa_file not in artifacts:
                raise SystemExit(f"{path}: qa_file {qa_file!r} is not in {manifest_path}")
            metrics = {
                key[: -len(" [GEval]")].strip().lower().replace(" ", "_"): payload
                for key, payload in (row.get("metrics") or {}).items()
                if key.endswith(" [GEval]") and isinstance(payload, dict)
            }
            scores = {}
            for name in GEVAL_CORE:
                payload = metrics.get(name) or {}
                score = payload.get("score")
                if payload.get("error") or not isinstance(score, (int, float)):
                    scores = None
                    break
                scores[name] = float(score)
            question = str(row.get("input") or "").strip()
            if scores is None or not question or row.get("skipped") or row.get("evaluation_error"):
                unusable += 1
                continue
            grade = dict(scores)
            major = metrics.get("major_error") or {}
            flag = major.get("success")
            if flag is not None:
                grade["major_error"] = not flag
            rows.append({"arm": artifacts[qa_file]["arm"], "q": question, "grade": grade})
    if not rows:
        raise SystemExit(f"no usable GEval results in {[str(p) for p in eval_paths]}")
    return rows, unusable


def arm_stats(rows: list[dict], prices: dict) -> dict[str, dict]:
    by_arm = defaultdict(list)
    for r in rows:
        by_arm[r["arm"]].append(r)
    stats = {}
    for arm, rs in sorted(by_arm.items()):
        ok = [r for r in rs if "error" not in r]
        model = arm.split(":")[0]
        costs = [
            cost_usd(prices, model, r["in"] or 0, r["out"] or 0, r.get("cached") or 0) for r in ok
        ]
        qs = [q for r in ok if (q := quality(r.get("grade"))) is not None]
        stats[arm] = {
            "n": len(rs),
            "errors": len(rs) - len(ok),
            "graded": len(qs),
            "ttft_p50": percentile([r["ttft"] for r in ok], 50),
            "ttft_p90": percentile([r["ttft"] for r in ok], 90),
            "total_p50": percentile([r["total"] for r in ok], 50),
            "total_p90": percentile([r["total"] for r in ok], 90),
            "out_mean": mean(r["out"] or 0 for r in ok) if ok else None,
            "usd": mean(c for c in costs if c is not None)
            if any(c is not None for c in costs)
            else None,
            "quality": mean(qs) if qs else None,
            "major_errors": sum(bool((r.get("grade") or {}).get("major_error")) for r in ok),
        }
    return stats


def paired(rows: list[dict], a: str, b: str, *, resamples: int = 2000, seed: int = 0) -> dict:
    """Mean per-question quality difference a - b with a bootstrap 95% CI."""
    per = defaultdict(lambda: defaultdict(list))
    for r in rows:
        q = quality(r.get("grade"))
        if q is not None:
            per[r["arm"]][r["q"]].append(q)
    common = sorted(set(per[a]) & set(per[b]))
    diffs = [mean(per[a][q]) - mean(per[b][q]) for q in common]
    if not diffs:
        return {"n": 0, "diff": None, "lo": None, "hi": None}
    rng = random.Random(seed)
    boots = sorted(mean(rng.choices(diffs, k=len(diffs))) for _ in range(resamples))
    return {
        "n": len(diffs),
        "diff": mean(diffs),
        "lo": boots[int(0.025 * resamples)],
        "hi": boots[int(0.975 * resamples) - 1],
    }


def replay_mix(rows: list[dict], router: str) -> tuple[dict[str, float], float]:
    """Tier shares for one router plus the share of questions whose tier varied."""
    rs = [r for r in rows if r.get("router") == router and r.get("tier") in TIERS]
    counts = Counter(r["tier"] for r in rs)
    tiers_by_q = defaultdict(set)
    for r in rs:
        tiers_by_q[r["q"]].add(r["tier"])
    unstable = sum(len(t) > 1 for t in tiers_by_q.values()) / len(tiers_by_q) if tiers_by_q else 0
    return {t: counts[t] / len(rs) if rs else 0 for t in TIERS}, unstable


def parse_mix(spec: str, replay_rows: list[dict]) -> tuple[dict[str, float], str, dict | None]:
    """Tier mix, its source and, for observed traffic, the per-tier token profile."""
    if spec.startswith("replay:"):
        router = spec.split(":", 1)[1]
        return replay_mix(replay_rows, router)[0], f"replay of `{router}`", None
    if spec.startswith("observe:"):
        path, _, router = spec.split(":", 1)[1].partition("#")
        data = json.loads(Path(path).read_text())
        routers = data.get("routers") or {}
        if not router and len(routers) == 1:
            router = next(iter(routers))
        if router not in routers:
            raise SystemExit(
                f"observe output has no router {router!r}; choose one of {sorted(routers)}"
            )
        observed = routers[router]
        profile = {
            tier: {
                "prompt": s["prompt_tokens"] / s["requests"],
                "cached": s["cached_tokens"] / s["requests"],
            }
            for tier, s in observed["tiers"].items()
            if s["requests"]
        }
        return observed["tier_mix"], f"observed `{router}` traffic {data.get('window')}", profile
    mix = {k: float(v) for k, v in (p.split("=") for p in spec.split(","))}
    return {t: mix.get(t, 0.0) for t in TIERS}, "explicit mix", None


def project(
    tier_map: dict[str, str],
    mix: dict[str, float],
    stats: dict[str, dict],
    prices: dict | None = None,
    profile: dict | None = None,
) -> dict:
    """Mix-weighted arm metrics. With an observed token profile, cost uses the
    tier's real prompt and cached tokens plus the arm's benchmark output tokens,
    because benchmark prompts lack the chatbot's system prompt and context."""

    def value(tier, field):
        arm = tier_map[tier]
        s = stats.get(arm, {})
        if field == "usd" and profile and tier in profile and s.get("out_mean") is not None:
            p = profile[tier]
            return cost_usd(
                prices,
                arm.split(":")[0],
                round(p["prompt"]),
                round(s["out_mean"]),
                round(p["cached"]),
            )
        return s.get(field)

    def weighted(field):
        vals = [(mix[t], value(t, field)) for t in TIERS]
        if any(v is None for w, v in vals if w):
            return None
        return sum(w * v for w, v in vals if w)

    return {f: weighted(f) for f in ("usd", "quality", "ttft_p50", "total_p50")}


def fmt(v, digits=2):
    return "–" if v is None else f"{v:.{digits}f}"


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--replay", nargs="*", type=Path, default=[])
    ap.add_argument("--bench", nargs="*", type=Path, default=[])
    ap.add_argument("--compare", action="append", default=[], help="arm_a~arm_b")
    ap.add_argument("--tier-map", action="append", default=[], help="name=TIER:arm,...")
    ap.add_argument("--mix", help="replay:<router> | observe:<path>[#router] | SIMPLE=0.1,...")
    ap.add_argument("--monthly-requests", type=int, help="scale projected cost to a month")
    ap.add_argument(
        "--quality",
        nargs="+",
        type=Path,
        help="bench import manifest.json plus framework eval_results files",
    )
    args = ap.parse_args()
    prices = load_prices()
    replay_rows = read_jsonl(args.replay)
    bench_rows = read_jsonl(args.bench)
    quality_rows, quality_unusable = [], 0
    if args.quality:
        if len(args.quality) < 2:
            raise SystemExit(
                "--quality needs the import manifest.json plus at least one eval results file"
            )
        quality_rows, quality_unusable = load_quality(args.quality[0], args.quality[1:])
    out = ["# Auto routing analysis", ""]

    if replay_rows:
        out += [
            "## Tier distribution (replay)",
            "",
            "| Router | " + " | ".join(TIERS) + " | Unstable | Errors |",
        ]
        out += ["| --- " * (len(TIERS) + 3) + "|"]
        for router in sorted({r["router"] for r in replay_rows}):
            mix, unstable = replay_mix(replay_rows, router)
            errors = sum("error" in r for r in replay_rows if r["router"] == router)
            cells = " | ".join(f"{mix[t]:.0%}" for t in TIERS)
            out.append(f"| `{router}` | {cells} | {unstable:.0%} | {errors} |")
        out += [
            "",
            "Unstable is the share of questions routed to different tiers across repeats.",
            "",
        ]

    stats = arm_stats(bench_rows, prices) if bench_rows else {}
    if stats:
        out += [
            "## Arms",
            "",
            "| Arm | TTFT p50/p90 s | Total p50/p90 s | Out tokens | USD/answer | Quality | Major errors | Graded/n |",
            "| --- | --- | --- | --- | --- | --- | --- | --- |",
        ]
        for arm, s in stats.items():
            out.append(
                f"| `{arm}` | {fmt(s['ttft_p50'], 1)}/{fmt(s['ttft_p90'], 1)} "
                f"| {fmt(s['total_p50'], 1)}/{fmt(s['total_p90'], 1)} | {fmt(s['out_mean'], 0)} "
                f"| {fmt(s['usd'], 5)} | {fmt(s['quality'])} | {s['major_errors']} | {s['graded']}/{s['n']} |"
            )
        out += [
            "",
            "Quality is the judge's mean of correctness, completeness and clarity "
            "(1–10; only earlier graded bench files carry grades).",
            "",
        ]

    if quality_rows:
        qstats = quality_stats(quality_rows)
        out += [
            "## Answer quality (DeepEval GEval)",
            "",
            "| Arm | Correctness | Completeness | Clarity | Mean | Major errors | Cases |",
            "| --- | --- | --- | --- | --- | --- | --- |",
        ]
        for arm, s in qstats.items():
            out.append(
                f"| `{arm}` | {fmt(s['correctness'])} | {fmt(s['completeness'])} "
                f"| {fmt(s['clarity'])} | {fmt(s['mean'])} | {s['major_errors']} | {s['n']} |"
            )
        out += [
            "",
            "Native GEval scores (0–1) from the framework eval results; "
            f"{quality_unusable} unusable row(s) were skipped. Major errors counts "
            "answers the major_error metric failed.",
            "",
        ]

    if quality_rows and args.compare:
        out += [
            "## Paired quality difference (DeepEval GEval)",
            "",
            "| A − B | Questions | Diff | 95% CI |",
            "| --- | --- | --- | --- |",
        ]
        for pair in args.compare:
            a, b = pair.split("~")
            p = paired(quality_rows, a, b)
            out.append(
                f"| `{a}` − `{b}` | {p['n']} | {fmt(p['diff'], 3)} "
                f"| [{fmt(p['lo'], 3)}, {fmt(p['hi'], 3)}] |"
            )
        out += [
            "",
            "Per-question native GEval mean difference (0–1), averaged over repeats.",
            "",
        ]

    if args.compare and bench_rows:
        out += [
            "## Paired comparisons",
            "",
            "| A − B | Questions | Diff | 95% CI |",
            "| --- | --- | --- | --- |",
        ]
        for pair in args.compare:
            a, b = pair.split("~")
            p = paired(bench_rows, a, b)
            out.append(
                f"| `{a}` − `{b}` | {p['n']} | {fmt(p['diff'])} | [{fmt(p['lo'])}, {fmt(p['hi'])}] |"
            )
        out += ["", "A CI that excludes 0 is a reliable difference on this question set.", ""]

    if args.tier_map and stats and args.mix:
        mix, source, profile = parse_mix(args.mix, replay_rows)
        out += [
            "## Router projections",
            "",
            f"Tier mix from {source}: " + ", ".join(f"{t} {mix[t]:.0%}" for t in TIERS) + ".",
            "",
            "| Map | USD/answer | Monthly USD | Quality | TTFT p50 s | Total p50 s |",
            "| --- | --- | --- | --- | --- | --- |",
        ]
        for spec in args.tier_map:
            name, body = spec.split("=", 1)
            tier_map = dict(p.split(":", 1) for p in body.split(","))
            pr = project(tier_map, mix, stats, prices, profile)
            monthly = (
                pr["usd"] * args.monthly_requests
                if pr["usd"] is not None and args.monthly_requests
                else None
            )
            out.append(
                f"| {name} | {fmt(pr['usd'], 5)} | {fmt(monthly, 0)} | {fmt(pr['quality'])} "
                f"| {fmt(pr['ttft_p50'], 1)} | {fmt(pr['total_p50'], 1)} |"
            )
        out += [
            "",
            "Projections weight each tier's arm by the mix and exclude classifier and "
            "embedding calls. "
            + (
                "Cost uses the observed prompt and cached tokens per tier with each arm's "
                "benchmark output tokens; latency and quality come from the benchmark."
                if profile
                else "Cost assumes the benchmark's short prompts, so it understates real cost."
            ),
            "",
        ]
    print("\n".join(out))


if __name__ == "__main__":
    main()
