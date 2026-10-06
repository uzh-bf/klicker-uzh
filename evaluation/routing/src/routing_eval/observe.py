"""Aggregate real Auto traffic from LiteLLM spend logs.

Reads `/spend/logs/v2` from a LiteLLM proxy for one team or key alias and a
time window, then reduces the rows to per-model counts, tokens, cached tokens,
spend and latency percentiles. For each complexity router it also reports the
real tier mix, classification causes and per-tier statistics from the routing
decision LiteLLM logs on each routed request. Only allow-listed numeric, model
and routing fields are read; prompts, responses, users and keys never reach
the output.

The proxy key comes from LITELLM_OBSERVE_API_KEY and must be allowed to read
the team's spend logs. Inject it through rs-infisical-operator; never pass it
as an argument.

    uv run python src/routing_eval/observe.py \
        --base-url https://<litellm-host> --team-id <team-id> \
        --start 2026-10-01 --end 2026-10-07 --out _local/observe.json
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
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


def _ms(value) -> float | None:
    return float(value) if isinstance(value, (int, float)) else None


def reduce_row(row: dict) -> dict:
    """Keep only the fields the aggregation needs. Content never passes."""
    start, end, first = (
        _ts(row.get("startTime")),
        _ts(row.get("endTime")),
        _ts(row.get("completionStartTime")),
    )
    latency = _ms(row.get("request_duration_ms"))
    if latency is None and start and end:
        latency = (end - start).total_seconds() * 1000
    ttft = _ms(row.get("ttft_ms"))
    if ttft is None and start and first and first > start:
        ttft = (first - start).total_seconds() * 1000
    group = row.get("model_group") or row.get("model") or "unknown"
    # A complexity router logs its decision on the generation row; the
    # `signals` list can echo matched text, so only these four fields are read.
    decision = (row.get("metadata") or {}).get("routing_decision") or {}
    if not isinstance(decision, dict):
        decision = {}
    routed = decision.get("routed_model")
    call_type = row.get("call_type") or ""
    if routed:
        key = routed
    elif "embedding" in call_type and "router" in group.rsplit("/", 1)[-1]:
        key = f"{group} (embedding)"
    else:
        key = group
    return {
        "key": key,
        "router": decision.get("router_model_name") if routed else None,
        "tier": decision.get("tier") if routed else None,
        "cause": decision.get("cause") if routed else None,
        "failed": (row.get("status") or "success") != "success",
        "prompt": int(row.get("prompt_tokens") or 0),
        "completion": int(row.get("completion_tokens") or 0),
        "cached": _cached_tokens(row),
        "spend": float(row.get("spend") or 0.0),
        "latency_ms": latency,
        "ttft_ms": ttft,
    }


def _stats(rs: list[dict], prices: dict, model: str, total: int) -> dict:
    prompt = sum(r["prompt"] for r in rs)
    cached = sum(r["cached"] for r in rs)
    lat = [r["latency_ms"] for r in rs if r["latency_ms"] is not None]
    ttft = [r["ttft_ms"] for r in rs if r["ttft_ms"] is not None]
    costs = [cost_usd(prices, model, r["prompt"], r["completion"], r["cached"]) for r in rs]
    return {
        "requests": len(rs),
        "share": round(len(rs) / total, 4) if total else 0,
        "failures": sum(r["failed"] for r in rs),
        "prompt_tokens": prompt,
        "completion_tokens": sum(r["completion"] for r in rs),
        "cached_tokens": cached,
        "cache_rate": round(cached / prompt, 4) if prompt else 0,
        "spend_usd": round(sum(r["spend"] for r in rs), 6),
        "list_cost_usd": round(sum(c for c in costs if c is not None), 6),
        "latency_ms": {"p50": percentile(lat, 50), "p90": percentile(lat, 90)},
        "ttft_ms": {"p50": percentile(ttft, 50), "p90": percentile(ttft, 90)},
    }


def aggregate(rows: list[dict], prices: dict) -> dict:
    reduced = list(map(reduce_row, rows))
    by_key: dict[str, list[dict]] = defaultdict(list)
    by_router: dict[str, list[dict]] = defaultdict(list)
    for r in reduced:
        by_key[r["key"]].append(r)
        if r["router"]:
            by_router[r["router"]].append(r)
    total = len(reduced)
    out = {
        "requests": total,
        "models": {k: _stats(rs, prices, k, total) for k, rs in sorted(by_key.items())},
        "routers": {},
    }
    for router, rs in sorted(by_router.items()):
        n = len(rs)
        tiers = Counter(r["tier"] for r in rs)
        per_tier = {}
        for tier in TIERS:
            trs = [r for r in rs if r["tier"] == tier]
            if trs:
                per_tier[tier] = _stats(trs, prices, trs[0]["key"], n) | {
                    "routed_models": dict(Counter(r["key"] for r in trs))
                }
        out["routers"][router] = {
            "requests": n,
            "tier_mix": {t: round(tiers[t] / n, 4) for t in TIERS},
            "causes": dict(Counter(r["cause"] for r in rs)),
            "tiers": per_tier,
        }
    return out


def _get_page(client: httpx.Client, params: dict, attempts: int = 4) -> dict:
    """GET one page, retrying dropped connections; spend-log pages are large."""
    for attempt in range(attempts):
        try:
            r = client.get("/spend/logs/v2", params=params)
            r.raise_for_status()
            return r.json()
        except (httpx.TransportError, httpx.HTTPStatusError) as e:
            retryable = isinstance(e, httpx.TransportError) or e.response.status_code >= 500
            if not retryable or attempt == attempts - 1:
                raise
            time.sleep(2**attempt)
    raise AssertionError("unreachable")


def fetch(args) -> list[dict]:
    """Fetch one UTC day at a time; the API caps a single query's total."""
    key = os.environ.get("LITELLM_OBSERVE_API_KEY")
    if not key:
        raise SystemExit("LITELLM_OBSERVE_API_KEY is not set; inject it with rs-infisical-operator")
    scope = {"page_size": args.page_size, "exclude_internal_health_checks": "true"}
    if args.team_id:
        scope["team_id"] = args.team_id
    if args.key_alias:
        scope["key_alias"] = args.key_alias
    rows = []
    day, last = date.fromisoformat(args.start), date.fromisoformat(args.end)
    with httpx.Client(
        base_url=args.base_url, headers={"Authorization": f"Bearer {key}"}, timeout=180
    ) as c:
        while day <= last:
            params = {**scope, "start_date": f"{day} 00:00:00", "end_date": f"{day} 23:59:59"}
            page = 1
            while True:
                body = _get_page(c, {**params, "page": page})
                if body.get("total_is_capped"):
                    raise SystemExit(f"{day}: result total is capped; narrow the scope")
                rows.extend(body.get("data") or [])
                if page >= (body.get("total_pages") or 1):
                    break
                page += 1
            day += timedelta(days=1)
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
    ap.add_argument(
        "--page-size", type=int, default=50, help="rows carry payloads; keep pages small"
    )
    ap.add_argument("--out", type=Path)
    args = ap.parse_args()
    if not (args.team_id or args.key_alias):
        raise SystemExit("set --team-id or --key-alias so the window stays scoped")
    result = aggregate(fetch(args), load_prices())
    result["window"] = {"start": args.start, "end": args.end}
    text = json.dumps(result, indent=2)
    (args.out.write_text(text + "\n") if args.out else sys.stdout.write(text + "\n"))


if __name__ == "__main__":
    main()
