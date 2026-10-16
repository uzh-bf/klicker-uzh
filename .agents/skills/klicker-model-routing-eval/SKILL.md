---
name: klicker-model-routing-eval
description: Measure and compare KlickerUZH Chat Auto router tier maps and model choices with real traffic, replayed classification, latency/cost/quality benchmarks and DeepEval. Use when changing Auto tiers, adding or replacing a chat model, repricing Auto credits, or comparing auto-router versions.
---

# KlickerUZH Auto routing evaluation

Scripts and their flags: [evaluation/routing/README.md](../../../evaluation/routing/README.md).
Router and registry facts: [docs/chat-platform.md](../../../docs/chat-platform.md).
This skill is the procedure and the decision rules.

## Ground rules

- Use only the synthetic ground truth in `evaluation/data/ground_truth/` for
  replay, bench and DeepEval. Production traffic enters only as `observe.py`
  aggregates; never fetch, print or store prompts or answers.
- Inject every key through `rs-infisical-operator`. A missing allowlist
  mapping is a blocker to report, not a reason to use another path. The
  spend-log reader currently uses `LITELLM_MASTER_KEY` from the
  `ai-generic-prd` profile; use it only for GET requests.
- Paid runs need a stated bound: `--limit`, `--repeats` and `--max-calls`
  for bench. The default bench (5 arms × 27 questions × 2) costs a few USD
  for answers only; `bench.py` requires `--no-judge` and no longer grades.
- Answer quality and pairwise preference run through the pinned DeepEval
  framework, not the routing environment: call quality and Arena commands with
  `evaluation/framework/.venv/bin/python` (DeepEval is not a routing
  dependency). The routing environment skips the native pairwise tests.
- The router config lives in `ai-infrastructure/deployment` (`litellm/*-generic/config.yaml`).
  This repository mirrors it in `util/litellm/config.yaml` and records the
  deployed tier map in the `modelRegistry` comment of `deploy/env-uzh-*/values.yaml`.
  Keep all three aligned in the same change.

## Procedure

1. **Observe.** Run `observe.py` for the last full week of production. It
   reports each router's logged tier mix, classifier causes, per-tier prompt,
   cached and output tokens, cache rate, list cost and Azure latency. Check
   that projected cost for the current map matches the observed list cost
   before trusting projections for new maps.
2. **Replay.** Run `replay.py` for every candidate router in the local config
   with at least two repeats. Note the tier mix and the unstable share; an
   unstable share above about 20% means tier choices for MEDIUM matter more
   than the others, because borderline questions land there.
3. **Bench.** Benchmark each model and effort that any candidate map uses,
   plus the current map's arms. `bench.py` requires `--no-judge` and records
   answers, latency and token usage only. Add `--keep-text` when answer quality
   is needed, then convert the capture offline with
   `bench.py --import-answers --qa-dir <dir>` into one standard DeepEval QA
   artifact per arm and repeat plus a manifest; the import overwrites nothing.
   Grade each artifact with `util/_run_klicker_eval.sh --mode eval` and
   `evaluation/data/metrics/klicker_routing_quality.yaml`.
4. **Analyze.** Run `analyze.py` with each candidate as `--tier-map`, the
   observed mix and token profile (`--mix observe:<file>#<router>`), monthly
   volume from the observed week, and `--compare` for every tier where
   candidates differ. `--quality <manifest.json> <eval_results files>` adds the
   native DeepEval 0-1 scores (mean of correctness, completeness and clarity,
   plus major errors); the 1-10 paired comparisons only work on earlier graded
   bench files, and the two scales are never translated. Never quote cost from
   a replay or explicit mix: benchmark prompts lack the chatbot's system
   prompt and course context.
5. **DeepEval.** Compare the arms with the native pairwise Arena below, and
   after both routers exist in staging compare them on the deployed path.
6. **Record** the report, the decision and the rollback in the MR/PR that
   changes the tiers. Keep run outputs in `evaluation/routing/_local/`.

## DeepEval comparison of deployed routers

The `eval:klicker` launcher queries any OpenAI-compatible target. Point it at
the staging LiteLLM proxy with the Klicker staging key, and pass both router
aliases as targets:

```bash
rs-infisical-operator --profile <profile> run \
  --map <stg-litellm-key-secret>=EVAL_API_KEY -- \
  env EVAL_ENDPOINT_URL=https://<stg-litellm-host>/v1/chat/completions \
    EVAL_API_MODE=chat-completions \
  pnpm run eval:klicker -- --mode query-eval \
    --gt-dir "$PWD/evaluation/data/ground_truth/klicker_fineco" \
    --agent-id klickeruzh/azure/auto-router klickeruzh/azure/auto-router-v2 \
    --metrics "$PWD/evaluation/data/metrics/klicker_fineco_semantic_similarity.yaml" \
    --eval-mode ground-truth --env stg-router-compare
```

`EVAL_ENDPOINT_URL` is the full request URL, not an API base. The framework
names its answer file after the agent ID without escaping `/`, so create
`evaluation/framework/data/output/qa_pairs/qa_pairs_klickeruzh/azure/` before
the run. The staging key is `PIPELINES_LITELLM_API_KEY` in the
`klicker-uzh-stg` profile; the same key reaches the judge model when
`LITELLM_API_BASE` points at the proxy and `EVAL_MODEL` is
`klickeruzh/azure/gpt-5.6-luna` with `EVAL_MODEL_CAPABILITY_MODEL=gpt-5.6-luna`.
Without a direct route to the staging proxy, a `kubectl port-forward` to
`svc/litellm` in `stg-litellm` works.

This sends only the question, without a chatbot system prompt or knowledge
base, so it measures the routers and models. For the full chatbot path, use
the launcher's `--local-target` mode against a stack whose registry points
`auto` at each router in turn. The default judge is GPT-5.6 Luna; the routing
scripts no longer run a custom judge, so DeepEval is the only quality path.

### Pairwise answer comparison (native Arena)

`pairwise.py` compares two answer files (one arm each, `q`/`rep`/`text` rows)
with DeepEval's native `ArenaGEval`: contestant names are masked and positions
randomised, one winner is named per case and there is no tie option. Criteria
and explicit steps come from
`evaluation/data/metrics/klicker_routing_pairwise.yaml`, so a case costs
exactly two judge requests (winner and rewritten reason) with no step
generation, one attempt per request and no retry; a third request within a
case is refused. Runs are serial and stop at the first judge error.

```bash
# Offline: pairing, reference join and the request budget. No credential.
uv run --frozen python src/routing_eval/pairwise.py \
  --answers-a _local/arm-a.jsonl --answers-b _local/arm-b.jsonl --check

# Live, explicit opt-in: judge calls only, bounded by --max-cases (required),
# and it refuses to overwrite an existing --out.
../framework/.venv/bin/python src/routing_eval/pairwise.py \
  --answers-a _local/arm-a.jsonl --answers-b _local/arm-b.jsonl \
  --label-a gpt-6-luna:high --label-b gpt-6.1-sol:low \
  --max-cases 25 --out _local/pairwise.jsonl --execute-live
```

## Decision rules

- Prefer the cheaper map unless the stronger one wins a paired comparison
  whose 95% CI excludes 0 on the tier that receives most traffic.
- Count major errors separately from mean quality; a map that halves major
  errors can justify a cost increase that a 0.2-point mean gain cannot.
- Judge latency by time to first token for chat; total time matters less
  because answers stream.
- Reprice Auto credits only from observed cost, including the cache rate,
  never from list prices alone.
- Keep the previous router deployed beside a new one until DeepEval and one
  week of observed traffic confirm the change; retire it in a separate MR.
