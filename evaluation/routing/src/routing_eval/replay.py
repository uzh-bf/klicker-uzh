"""Replay ground-truth questions through a LiteLLM complexity router.

Builds the router from a LiteLLM proxy config (by default the local
`util/litellm/config.yaml`) with the LiteLLM SDK, sends each question to the
named router model and records which tier deployment answered. Classification,
semantic matching and answers use the upstream configured in that file, so the
run needs `UPSTREAM_OPENAI_BASE_URL` and `UPSTREAM_OPENAI_API_KEY` (for the
local config: OpenRouter). Output is JSON lines without question or answer
text.

    uv run python src/routing_eval/replay.py --router auto-router-v2 \
        --repeats 2 --out _local/replay-v2.jsonl
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

import litellm
import yaml
from common import DEFAULT_GT_DIR, ROUTING_DIR, load_questions
from litellm import Router

DEFAULT_CONFIG = ROUTING_DIR.parents[1] / "util" / "litellm" / "config.yaml"


def build_router(config: dict) -> tuple[Router, dict[str, dict[str, str]]]:
    model_list = config["model_list"]
    tiers_by_router = {}
    for entry in model_list:
        # Deployment ids equal model names so the routed tier is readable.
        entry.setdefault("model_info", {})["id"] = entry["model_name"]
        params = entry["litellm_params"]
        if "reasoning_effort" in params:
            params.setdefault("allowed_openai_params", ["reasoning_effort"])
        tiers = params.get("complexity_router_config", {}).get("tiers")
        if tiers:
            tiers_by_router[entry["model_name"]] = {v: k for k, v in tiers.items()}
    fallbacks = config.get("router_settings", {}).get("fallbacks", [])
    return Router(model_list=model_list, fallbacks=fallbacks), tiers_by_router


async def run(args: argparse.Namespace) -> None:
    litellm.drop_params = True
    router, tiers_by_router = build_router(yaml.safe_load(Path(args.config).read_text()))
    if args.router not in tiers_by_router:
        raise SystemExit(f"{args.router} is not a complexity router in {args.config}")
    tier_of = tiers_by_router[args.router]
    questions = load_questions(args.gt_dir)[: args.limit]
    sem = asyncio.Semaphore(args.concurrency)
    out = open(args.out, "w") if args.out else sys.stdout

    async def one(q, rep):
        kwargs = {} if args.full else {"max_tokens": 16}
        async with sem:
            try:
                r = await router.acompletion(
                    model=args.router, messages=[{"role": "user", "content": q.text}], **kwargs
                )
            except Exception as e:  # noqa: BLE001 - recorded per row
                row = {"error": f"{type(e).__name__}: {str(e)[:200]}"}
            else:
                deployment = (getattr(r, "_hidden_params", {}) or {}).get("model_id")
                usage = r.usage
                details = getattr(usage, "completion_tokens_details", None)
                row = {
                    "deployment": deployment,
                    "tier": tier_of.get(deployment, "FALLBACK"),
                    "in": usage.prompt_tokens,
                    "out": usage.completion_tokens,
                    "reasoning": getattr(details, "reasoning_tokens", None),
                }
        out.write(json.dumps({"router": args.router, "q": q.id, "rep": rep, **row}) + "\n")
        out.flush()

    await asyncio.gather(*(one(q, r) for r in range(args.repeats) for q in questions))


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    ap.add_argument("--router", default="auto-router")
    ap.add_argument("--gt-dir", type=Path, default=DEFAULT_GT_DIR)
    ap.add_argument("--repeats", type=int, default=2, help="repeats expose classifier instability")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--concurrency", type=int, default=4)
    ap.add_argument("--full", action="store_true", help="generate full answers (costs more)")
    ap.add_argument("--out", type=Path)
    asyncio.run(run(ap.parse_args()))


if __name__ == "__main__":
    main()
