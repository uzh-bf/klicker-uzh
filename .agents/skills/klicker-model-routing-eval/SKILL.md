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
  including the judge.
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
   plus the current map's arms. Use a judge from another model family than
   the arms (`--judge`, default Claude Opus).
4. **Analyze.** Run `analyze.py` with each candidate as `--tier-map`, the
   observed mix and token profile (`--mix observe:<file>#<router>`), monthly
   volume from the observed week, and `--compare` for every tier where
   candidates differ. Never quote cost from a replay or explicit mix: benchmark
   prompts lack the chatbot's system prompt and course context.
5. **DeepEval.** After both routers exist in staging, compare them on the
   deployed path (below).
6. **Record** the report, the decision and the rollback in the MR/PR that
   changes the tiers. Keep run outputs in `evaluation/routing/_local/`.

## DeepEval comparison of deployed routers

The `eval:klicker` launcher queries any OpenAI-compatible target. Point it at
the staging LiteLLM proxy with the Klicker staging key, and pass both router
aliases as targets:

```bash
rs-infisical-operator --profile <profile> run \
  --map <stg-litellm-key-secret>=EVAL_API_KEY -- \
  env EVAL_ENDPOINT_URL=https://<stg-litellm-host>/v1 \
  pnpm run eval:klicker -- --mode query-eval \
    --gt-dir "$PWD/evaluation/data/ground_truth/klicker_fineco" \
    --agent-id klickeruzh/azure/auto-router klickeruzh/azure/auto-router-v2 \
    --metrics "$PWD/evaluation/data/metrics/klicker_fineco_semantic_similarity.yaml" \
    --eval-mode ground-truth --env stg-router-compare
```

This sends only the question, without a chatbot system prompt or knowledge
base, so it measures the routers and models. For the full chatbot path, use
the launcher's `--local-target` mode against a stack whose registry points
`auto` at each router in turn. The default judge is GPT-5.6 Luna; when it
judges GPT-6 answers, confirm a close result with the bench's non-OpenAI judge.

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
