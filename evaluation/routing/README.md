# Auto routing evaluation

Repeatable evidence for choosing the Chat Auto router's tier map. It answers
four questions with separate scripts that share one price table:

| Question                                                              | Script       | Calls                                 |
| --------------------------------------------------------------------- | ------------ | ------------------------------------- |
| How does real Auto traffic split across tiers, and what does it cost? | `observe.py` | LiteLLM spend logs (read-only)        |
| How does a router config classify the evaluation questions?           | `replay.py`  | classifier, embeddings, short answers |
| How fast, good and expensive is each model and effort?                | `bench.py`   | full answers plus one judge call each |
| What do these imply for candidate tier maps?                          | `analyze.py` | none                                  |

The DeepEval comparison of deployed routers uses the existing `eval:klicker`
launcher; the [routing skill](../../.agents/skills/klicker-model-routing-eval/SKILL.md)
gives the full procedure and decision rules.

## Setup

```bash
cd evaluation/routing
uv sync --frozen
uv run --frozen pytest -q   # offline
```

Outputs go to `evaluation/routing/_local/`, which Git ignores. The scripts
read the synthetic FinEco ground truth in `evaluation/data/ground_truth/` by
default. Never point them at production content.

## Credentials

Each script reads one key from its environment. Inject it through
`rs-infisical-operator` and never pass a key as an argument.

- `replay.py`: `UPSTREAM_OPENAI_BASE_URL` and `UPSTREAM_OPENAI_API_KEY`, the
  same upstream boundary as the local LiteLLM config (OpenRouter).
- `bench.py`: the variable named by `--api-key-env` (default
  `OPENROUTER_API_KEY`).
- `observe.py`: `LITELLM_OBSERVE_API_KEY`, a LiteLLM key allowed to read the
  Klicker team's spend logs.

## Examples

```bash
# Real traffic for one week, mapped onto the v2 tiers.
uv run --frozen python src/routing_eval/observe.py \
  --base-url https://<litellm-host> --team-id <klicker-team-id> \
  --start 2026-10-01 --end 2026-10-07 \
  --tier-map SIMPLE=gpt-6-luna-high,MEDIUM=gpt-6.1-sol-low,COMPLEX=gpt-6.1-sol-medium,REASONING=gpt-6.1-sol-high \
  --out _local/observe.json

# Tier distribution of both local routers, two repeats each.
uv run --frozen python src/routing_eval/replay.py --router auto-router --out _local/replay-v1.jsonl
uv run --frozen python src/routing_eval/replay.py --router auto-router-v2 --out _local/replay-v2.jsonl

# Latency, cost and graded quality per arm.
uv run --frozen python src/routing_eval/bench.py \
  --arms gpt-6-luna:high,gpt-6-luna:xhigh,gpt-6.1-sol:low,gpt-6.1-sol:medium,gpt-6.1-sol:high \
  --out _local/bench.jsonl

# One report.
uv run --frozen python src/routing_eval/analyze.py \
  --replay _local/replay-v1.jsonl _local/replay-v2.jsonl --bench _local/bench.jsonl \
  --compare gpt-6.1-sol:low~gpt-6-luna:xhigh \
  --tier-map v1=SIMPLE:gpt-6-luna:high,MEDIUM:gpt-6-luna:xhigh,COMPLEX:gpt-6.1-sol:high,REASONING:gpt-6.1-sol:medium \
  --tier-map v2=SIMPLE:gpt-6-luna:high,MEDIUM:gpt-6.1-sol:low,COMPLEX:gpt-6.1-sol:medium,REASONING:gpt-6.1-sol:high \
  --mix observe:_local/observe.json --monthly-requests <requests> > _local/report.md
```

## Limits

- Replay and bench run through OpenRouter, so their latency is not Azure
  latency. Use `observe.py` for production latency.
- The benchmark uses a short tutor prompt, not a chatbot's full system prompt,
  knowledge-base context or tools. Real prompts are longer and more cacheable.
- Observed tier mix is valid only while one router carries the traffic,
  because v1 and v2 reuse some aliases for different tiers.
- `prices.yaml` holds list prices. Spend logs report LiteLLM's own cost, which
  can differ when its model metadata lags a new model.
