# Auto routing evaluation

Repeatable evidence for choosing the Chat Auto router's tier map. The scripts
below share one price table:

| Question                                                              | Script                                       | Calls                                 |
| --------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------- |
| How does real Auto traffic split across tiers, and what does it cost? | `observe.py`                                 | LiteLLM spend logs (read-only)        |
| How does a router config classify the evaluation questions?           | `replay.py`                                  | classifier, embeddings, short answers |
| How fast and expensive is each model and effort?                      | `bench.py`                                   | full answers; `--no-judge` required   |
| How good is each arm's answer?                                        | `bench.py --import-answers` + DeepEval GEval | judge only, no target calls           |
| Which of two arms does the judge prefer?                              | `pairwise.py`                                | Arena judge only, explicit opt-in     |
| What do these imply for candidate tier maps?                          | `analyze.py`                                 | none                                  |

Answer quality and pairwise preference are graded with the pinned DeepEval
framework in `evaluation/framework`; the custom pairwise judge prompt, verdict
parser and both-orders logic were removed in its favour. DeepEval is installed
in the framework environment only, so quality commands run it with
`evaluation/framework/.venv/bin/python`. The
[routing skill](../../.agents/skills/klicker-model-routing-eval/SKILL.md)
gives the full procedure and decision rules, and
[evaluation/README.md](../README.md) documents the launcher.

## Setup

```bash
cd evaluation/routing
uv sync --frozen
uv run --frozen pytest -q   # offline; pairwise tests skip without DeepEval

# Native Arena tests run under the framework environment (DeepEval lives there):
../framework/.venv/bin/python -m pytest -q
```

Outputs go to `evaluation/routing/_local/`, which Git ignores. The scripts
read the synthetic FinEco ground truth in `evaluation/data/ground_truth/` by
default. Never point them at production content.

## Credentials

The live scripts read a key from their environment. Inject it through
`rs-infisical-operator` and never pass a key as an argument.

- `replay.py`: `UPSTREAM_OPENAI_BASE_URL` and `UPSTREAM_OPENAI_API_KEY`, the
  same upstream boundary as the local LiteLLM config (OpenRouter).
- `bench.py`: the variable named by `--api-key-env` (default
  `OPENROUTER_API_KEY`).
- `observe.py`: `LITELLM_OBSERVE_API_KEY`, a LiteLLM key allowed to read the
  Klicker team's spend logs. Today this is `LITELLM_MASTER_KEY` from the
  `ai-generic-prd` operator profile, used only for GET requests. Look up the
  team ID once with `GET /team/list` (alias `KlickerUZH`).
- `pairwise.py --execute-live`: the framework judge settings
  (`LITELLM_API_BASE`, `LITELLM_API_KEY`) through
  `customization.custom_model.create_eval_model`. `--check` reads neither a
  credential nor a judge model.

## Examples

```bash
# Real traffic for one week: per-alias usage plus each router's logged tier
# decisions. The prd proxy is reachable on the tailnet; its address is
# PROXY_BASE_URL in ai-infrastructure/deployment litellm/prd-generic/cm.yaml.
rs-infisical-operator --profile ai-generic-prd run \
  --map LITELLM_MASTER_KEY=LITELLM_OBSERVE_API_KEY -- \
  uv run --frozen python src/routing_eval/observe.py \
  --base-url <prd-proxy-url> --team-id <klicker-team-id> \
  --start 2026-09-24 --end 2026-09-30 --out _local/observe.json

# Tier distribution of both local routers, two repeats each.
uv run --frozen python src/routing_eval/replay.py --router auto-router --out _local/replay-v1.jsonl
uv run --frozen python src/routing_eval/replay.py --router auto-router-v2 --out _local/replay-v2.jsonl

# Latency, cost and token usage per arm; no judge call is made.
uv run --frozen python src/routing_eval/bench.py \
  --arms gpt-6-luna:high,gpt-6-luna:xhigh,gpt-6.1-sol:low,gpt-6.1-sol:medium,gpt-6.1-sol:high \
  --no-judge --out _local/bench.jsonl

# Offline: one standard DeepEval QA artifact per arm and repeat, plus a
# manifest that maps artifacts to arms. Never overwrites existing artifacts.
uv run --frozen python src/routing_eval/bench.py \
  --import-answers _local/bench-text.jsonl --qa-dir _local/qa

# Native GEval quality per arm through the existing framework launcher
# (setup: evaluation/README.md), one run per artifact, then one report:
../../util/_run_klicker_eval.sh --mode eval --qa-file _local/qa/qa_pairs_gpt-6-luna-high_rep0.json \
  --metrics ../data/metrics/klicker_routing_quality.yaml
uv run --frozen python src/routing_eval/analyze.py --bench _local/bench.jsonl \
  --quality _local/qa/manifest.json _local/qa/eval_results_<timestamp>.json

# Pairwise: offline check of pairing, reference join and the judge budget.
uv run --frozen python src/routing_eval/pairwise.py \
  --answers-a _local/arm-a.jsonl --answers-b _local/arm-b.jsonl --check

# Optional live Arena pass (explicit opt-in, judge calls only, serial).
../framework/.venv/bin/python src/routing_eval/pairwise.py \
  --answers-a _local/arm-a.jsonl --answers-b _local/arm-b.jsonl \
  --label-a gpt-6-luna:high --label-b gpt-6.1-sol:low \
  --max-cases 25 --out _local/pairwise.jsonl --execute-live

# One report.
uv run --frozen python src/routing_eval/analyze.py \
  --replay _local/replay-v1.jsonl _local/replay-v2.jsonl --bench _local/bench.jsonl \
  --compare gpt-6.1-sol:low~gpt-6-luna:xhigh \
  --tier-map v1=SIMPLE:gpt-6-luna:high,MEDIUM:gpt-6-luna:xhigh,COMPLEX:gpt-6.1-sol:high,REASONING:gpt-6.1-sol:medium \
  --tier-map v2=SIMPLE:gpt-6-luna:high,MEDIUM:gpt-6.1-sol:low,COMPLEX:gpt-6.1-sol:medium,REASONING:gpt-6.1-sol:high \
  --mix observe:_local/observe.json#klickeruzh/azure/auto-router \
  --monthly-requests <requests> > _local/report.md
```

## Limits

- Historical raw reports are unchanged. `analyze.py` still reads the 1-10
  judge grades stored in earlier graded bench files; new ungraded runs show
  that quality as absent and report native DeepEval 0-1 scores separately via
  `--quality`. No score is translated between the two scales.
- The pairwise comparison is native `ArenaGEval`: contestant names are masked,
  positions are randomised, one winner is named per case and there is no tie
  option. Each case costs exactly two judge requests (winner and rewritten
  reason) with explicit YAML steps, one attempt and no retry; a third request
  within a case is refused before it is sent. `--execute-live` needs an
  explicit `--max-cases` admission bound and creates `--out` exclusively
  (0600), so it never overwrites a historical run.
- Replay and bench run through OpenRouter, so their latency is not Azure
  latency. Use `observe.py` for production latency.
- The benchmark uses a short tutor prompt, not a chatbot's full system prompt,
  knowledge-base context or tools. Real prompts are longer and more cacheable.
- `observe.py` reads the tier from the routing decision LiteLLM logs on each
  routed request, so v1 and v2 stay separate even though they share aliases.
- Real prompts are large: in late September 2026, Klicker Auto requests
  averaged 14,000–24,000 prompt tokens per tier. `analyze.py` therefore costs
  each tier from the observed prompt and cached tokens when `--mix observe:`
  is used; a replay or explicit mix understates cost.
- `prices.yaml` holds list prices. Spend logs report LiteLLM's own cost, which
  lags new models: for GPT-6 it reported about a third of list cost.
