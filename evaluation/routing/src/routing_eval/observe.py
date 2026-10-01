"""Aggregate real Auto traffic from LiteLLM spend logs.

Reads `/spend/logs/v2` from a LiteLLM proxy for one team or key alias and a
time window, then reduces the rows to per-model counts, tokens, cached tokens,
spend and latency percentiles. Only allow-listed numeric and model fields are
read; prompts, responses, users and keys never reach the output.

The proxy key comes from LITELLM_OBSERVE_API_KEY and must be allowed to read
the team's spend logs. Inject it through rs-infisical-operator; never pass it
as an argument.

    uv run python src/routing_eval/observe.py \
        --base-url https://<litellm-host> --team-id <team-id> \
        --start 2026-10-01 --end 2026-10-08 --out _local/observe-stg.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import httpx
from common import TIERS, cost_usd, load_prices, percentile


def _ts(value) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None


def _cached_tokens(row: dict) -> int:
    meta = row.get("metadata") or {}
    usage = meta.get("usage_object") or {}
    details = usage.get("prompt_tokens_details") or {}
    extra = meta.get("additional_usage_values") or {}
    for value in (
        details.get("cached_tokens"),
        usage.get("cache_read_input_tokens"),
        extra.get("cache_read_input_tokens"),
    ):
        if isinstance(value, int):
            return value
    return 0


def reduce_row(row: dict) -> dict:
    """Keep only the fields the aggregation needs. Content never passes."""
    start, end, first = (
        _ts(row.get("startTime")),
        _ts(row.get("endTime")),
        _ts(row.get("completionStartTime")),
    )
    return {
        "model": row.get("model_group") or row.get("model") or "unknown",
        "failed": (row.get("status") or "success") != "success",
        "prompt": int(row.get("prompt_tokens") or 0),
        "completion": int(row.get("completion_tokens") or 0),
        "cached": _cached_tokens(row),
        "spend": float(row.get("spend") or 0.0),
        "latency_ms": (end - start).total_seconds() * 1000 if start and end else None,
        "ttft_ms": (first - start).total_seconds() * 1000
        if start and first and first > start
        else None,
    }


def aggregate(rows: list[dict], prices: dict, tier_map: dict[str, str] | None = None) -> dict:
    groups: dict[str, list[dict]] = defaultdict(list)
    for r in map(reduce_row, rows):
        groups[r["model"]].append(r)
    total = sum(len(v) for v in groups.values())
    out = {"requests": total, "models": {}}
    for model, rs in sorted(groups.items()):
        prompt = sum(r["prompt"] for r in rs)
        cached = sum(r["cached"] for r in rs)
        completion = sum(r["completion"] for r in rs)
        lat = [r["latency_ms"] for r in rs if r["latency_ms"] is not None]
        ttft = [r["ttft_ms"] for r in rs if r["ttft_ms"] is not None]
        costs = [cost_usd(prices, model, r["prompt"], r["completion"], r["cached"]) for r in rs]
        list_cost = sum(c for c in costs if c is not None)
        out["models"][model] = {
            "requests": len(rs),
            "share": round(len(rs) / total, 4) if total else 0,
            "failures": sum(r["failed"] for r in rs),
            "prompt_tokens": prompt,
            "completion_tokens": completion,
            "cached_tokens": cached,
            "cache_rate": round(cached / prompt, 4) if prompt else 0,
            "spend_usd": round(sum(r["spend"] for r in rs), 6),
            "list_cost_usd": round(list_cost, 6),
            "latency_ms": {"p50": percentile(lat, 50), "p90": percentile(lat, 90)},
            "ttft_ms": {"p50": percentile(ttft, 50), "p90": percentile(ttft, 90)},
        }
    if tier_map:
        tiers = defaultdict(int)
        for model, stats in out["models"].items():
            alias = model.rsplit("/", 1)[-1]
            tiers[tier_map.get(alias, "OTHER")] += stats["requests"]
        routed = sum(v for k, v in tiers.items() if k in TIERS)
        out["tier_mix"] = {t: round(tiers[t] / routed, 4) if routed else 0 for t in TIERS}
    return out


def fetch(args) -> list[dict]:
    key = os.environ.get("LITELLM_OBSERVE_API_KEY")
    if not key:
        raise SystemExit("LITELLM_OBSERVE_API_KEY is not set; inject it with rs-infisical-operator")
    params = {
        "start_date": f"{args.start} 00:00:00",
        "end_date": f"{args.end} 23:59:59",
        "page_size": 1000,
        "exclude_internal_health_checks": "true",
    }
    if args.team_id:
        params["team_id"] = args.team_id
    if args.key_alias:
        params["key_alias"] = args.key_alias
    rows, page = [], 1
    with httpx.Client(
        base_url=args.base_url, headers={"Authorization": f"Bearer {key}"}, timeout=60
    ) as c:
        while True:
            r = c.get("/spend/logs/v2", params={**params, "page": page})
            r.raise_for_status()
            body = r.json()
            rows.extend(body.get("data") or [])
            if page >= (body.get("total_pages") or 1) or page >= args.max_pages:
                break
            page += 1
    return rows


def main():
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--base-url", required=True)
    ap.add_argument("--team-id")
    ap.add_argument("--key-alias")
    ap.add_argument("--start", required=True, help="YYYY-MM-DD (UTC)")
    ap.add_argument("--end", required=True, help="YYYY-MM-DD (UTC, inclusive)")
    ap.add_argument("--max-pages", type=int, default=50)
    ap.add_argument(
        "--tier-map",
        help="router tiers as SIMPLE=gpt-6-luna-high,MEDIUM=... to derive the real tier mix",
    )
    ap.add_argument("--out", type=Path)
    args = ap.parse_args()
    if not (args.team_id or args.key_alias):
        raise SystemExit("set --team-id or --key-alias so the window stays scoped")
    tier_map = None
    if args.tier_map:
        tier_map = {v: k for k, v in (p.split("=", 1) for p in args.tier_map.split(","))}
    result = aggregate(fetch(args), load_prices(), tier_map)
    result["window"] = {"start": args.start, "end": args.end}
    text = json.dumps(result, indent=2)
    (args.out.write_text(text + "\n") if args.out else sys.stdout.write(text + "\n"))


if __name__ == "__main__":
    main()
