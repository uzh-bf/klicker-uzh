"""Turn replay, bench and observe outputs into one Markdown report.

    uv run python src/routing_eval/analyze.py \
        --replay _local/replay-v1.jsonl _local/replay-v2.jsonl \
        --bench _local/bench.jsonl \
        --compare gpt-6.1-sol:low~gpt-6-luna:xhigh \
        --tier-map v1=SIMPLE:gpt-6-luna:high,MEDIUM:gpt-6-luna:xhigh,COMPLEX:gpt-6.1-sol:high,REASONING:gpt-6.1-sol:medium \
        --tier-map v2=SIMPLE:gpt-6-luna:high,MEDIUM:gpt-6.1-sol:low,COMPLEX:gpt-6.1-sol:medium,REASONING:gpt-6.1-sol:high \
        --mix replay:auto-router > _local/report.md

`--mix` selects the tier mix for projections: `replay:<router>` uses a replay
file, `observe:<path>` uses real traffic from observe.py, and
`SIMPLE=0.13,MEDIUM=0.74,...` sets it explicitly.
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


def parse_mix(spec: str, replay_rows: list[dict]) -> tuple[dict[str, float], str]:
    if spec.startswith("replay:"):
        router = spec.split(":", 1)[1]
        return replay_mix(replay_rows, router)[0], f"replay of `{router}`"
    if spec.startswith("observe:"):
        data = json.loads(Path(spec.split(":", 1)[1]).read_text())
        if "tier_mix" not in data:
            raise SystemExit("observe output has no tier_mix; rerun observe.py with --tier-map")
        return data["tier_mix"], f"observed traffic {data.get('window')}"
    mix = {k: float(v) for k, v in (p.split("=") for p in spec.split(","))}
    return {t: mix.get(t, 0.0) for t in TIERS}, "explicit mix"


def project(tier_map: dict[str, str], mix: dict[str, float], stats: dict[str, dict]) -> dict:
    def weighted(field):
        vals = [(mix[t], stats.get(tier_map[t], {}).get(field)) for t in TIERS]
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
    ap.add_argument("--mix", help="replay:<router> | observe:<path> | SIMPLE=0.1,...")
    ap.add_argument("--monthly-requests", type=int, help="scale projected cost to a month")
    args = ap.parse_args()
    prices = load_prices()
    replay_rows = read_jsonl(args.replay)
    bench_rows = read_jsonl(args.bench)
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
            "Quality is the judge's mean of correctness, completeness and clarity (1–10).",
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
        mix, source = parse_mix(args.mix, replay_rows)
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
            pr = project(tier_map, mix, stats)
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
            "Projections weight each tier's arm by the mix. They exclude classifier and "
            "embedding calls and assume the benchmark's prompt size and cache rate.",
            "",
        ]
    print("\n".join(out))


if __name__ == "__main__":
    main()
