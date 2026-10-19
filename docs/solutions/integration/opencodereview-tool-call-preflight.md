---
type: Solution
title: Preflight the exact OpenCodeReview tool-call contract
description: Qualify the released CLI and require a real tool call before a manually triggered final review can publish status or feedback.
module: ci-final-review
date: 2026-08-29
problem_type: integration
severity: high
symptoms:
  - 'ocr llm test passed, but every review item failed immediately.'
  - 'The review produced zero findings, tokens, and tool calls.'
  - 'OpenRouter returned HTTP 404 responses before model work began.'
root_cause: 'The text-only preflight did not exercise the tool-bearing review request, while ocr review loaded its current-user default config instead of OCR_CONFIG_PATH.'
tags:
  - open-code-review
  - openrouter
  - github-actions
  - llm-tools
  - final-review
---

# OpenCodeReview preflight passed while tool-bearing reviews failed

## Current review routes

Draft reviews use DeepSeek V4.1 Flash 1017 through OpenRouter; manual reviews
and the bounded draft advisor use Mistral-hosted `zai-glm-5-3`. Both models use
maximum reasoning. The manual tool canary and stack topology request call the
fixed Mistral endpoint directly. OCR uses the runner-local
[adapter](../../../.github/scripts/ocr-mistral-adapter.cjs), which translates
`max_completion_tokens` to `max_tokens` and restores native thinking chunks
from bounded memory when OCR replays an assistant turn. Answer text and thinking
metadata remain separate so strict topology JSON stays parseable. Mistral's
structured-output grammar rejects `uniqueItems` on topology layer arrays with
HTTP 400. The request schema omits that keyword; `validateTopologyResult`
still rejects duplicate layer numbers before publication. The topology call
allows up to 65,536 completion tokens and ten minutes for maximum reasoning;
length-truncated answers fail closed.

The upstream `MISTRAL_API_KEY` exists only in the adapter or direct request
process. OCR receives a random loopback capability, and its mode-0600 config
uses `auth_token_cmd` to read that capability from the environment. The attempt
wrapper closes the adapter before returning. The manual config must omit `llm.url`:
OCR 1.13.0 gives a saved URL precedence over `OCR_LLM_URL`, so a saved upstream
URL bypasses the adapter and a saved loopback URL becomes stale on the next
attempt. The released-binary probe exposed this precedence; each manual attempt
supplies its fresh URL through the environment. The draft runner starts its
adapters in the trusted parent and writes fresh loopback configuration into an
isolated temporary home. Live compatibility requires authorized hosted runs
after trusted-policy activation.

### Compression can remove replay identity

OCR can replace the conversation prefix and omit echoed reasoning while keeping
an assistant tool turn. Matching only the old prefix then rejects a retained
native response as missing. A tool-call ID alone cannot establish provenance
across concurrent workers.

The adapter retains the exact-prefix and reasoned-turn matches, then allows a
reasoning-free tool turn to match within its validated conversation cache key.
The normalized assistant text and complete tool calls must still match exactly;
ambiguous native payloads fail closed. Existing memory bounds, usage accounting
and retries remain in force. The
[adapter regression tests](../../../.github/scripts/ocr-mistral-adapter.test.cjs)
cover compressed replay, missing keys, changed tools and cross-task rejection.

Qualify tool extensions with the pinned released binary against synthetic
providers. A successful MCP initialization proves discovery; actual tool
invocation, bounded source reads and separate usage receipts prove the
[draft runner contract](../../../.github/scripts/ocr-draft-review.test.cjs).

The sections below record the original OpenRouter failure and its resolution.
Their provider selection and high-reasoning settings are historical.

## Problem

The manually triggered final-review workflow used `ocr llm test` as its model
preflight. That command could complete even when the route selected for the
actual tool-bearing review request failed immediately. The workflow then fanned
out across the changed files, so one compatibility mismatch appeared as many
identical failures and no useful review activity.

OpenCodeReview 1.11.0 also has two configuration behaviors that matter here:
the read-only `llm test` command can use `OCR_CONFIG_PATH`, while `ocr review`
loads the current user's default configuration path. A runner-temporary config
therefore did not prove or configure the same path that the real review used.

## Symptoms

- `ocr llm test` succeeded before the review.
- Every review item failed in milliseconds with HTTP 404 responses.
- The result reported zero findings, zero tokens, and zero tool calls.
- The provider field was empty, so the repeated item failures did not identify
  a usable provider route.

## What Didn't Work

- A text-completion smoke test proved authentication and a basic model request,
  but not function-tool support or the actual completion-token and reasoning
  fields.
- Setting `OCR_CONFIG_PATH` for `ocr review` isolated a file that the review
  command did not read.
- Forcing a provider order attempted to predict provider compatibility instead
  of verifying the exact request through OpenRouter's automatic routing.
- Treating the zero-activity result as a clean review would have confused a
  failed producer with valid evidence.

## Solution

Build one fixed, public-safe request that uses the same model, high reasoning,
16,384-token completion cap, and function-tool shape as the final reviewer. The
canary succeeds only when OpenRouter returns the exact named function and exact
marker arguments
([final-ai-review.js](../../../.github/scripts/final-ai-review.js#L460)).
Sanitize failures through an allowlist of HTTP status, error code, provider, and
a bounded message; never print the request, key, choices, or tool arguments
([final-ai-review.js](../../../.github/scripts/final-ai-review.js#L520)).

Write the mode-0600 OCR configuration to the current user's default path and
remove it after the review
([final-ai-review.js](../../../.github/scripts/final-ai-review.js#L629)). Keep
the job on a fresh GitHub-hosted runner, run the canary before `ocr review`, and
publish only after the always-run cleanup succeeds
([check-ocr-final-review.yml](../../../.github/workflows/check-ocr-final-review.yml#L359)).

Pin the manually triggered workflow to the exact qualified OpenCodeReview
release. Use `--effort low` for one OCR review round while leaving the model's
reasoning setting at `high`; those controls affect different layers
([check-ocr-final-review.yml](../../../.github/workflows/check-ocr-final-review.yml#L384)).

Every job that writes a final-review status shares one status-lock concurrency
group. Set `cancel-in-progress: false` and `queue: max` on those jobs. Without
the explicit queue, GitHub retains only one pending job per group and cancels an
older pending writer when another PR event queues one, which can leave the
exact-head check rollup failed even though no job step ran.

## Why This Works

The canary tests the request capability the real review needs, not merely model
reachability. Automatic routing lets OpenRouter choose a compatible provider
for that exact tool-bearing request. The default-path config matches the path
the released `review` command actually reads, and the hosted runner plus
always-run cleanup bounds the secret file's lifetime.

The offline exact-binary probe remains separate: it confirms the released
CLI's wire shape against a fake endpoint without claiming live model behavior.
The first hosted `/final-review` and `/final-review-stack` runs remain the
live integration proof
([ci-and-deployment.md](../../ci-and-deployment.md#ai-review)).

## Prevention

- Keep source-level tests that require the canary before every manual OCR
  review invocation and reject `OCR_CONFIG_PATH`, legacy `OCR_LLM_*` overrides,
  or the old text-only preflight
  ([final-ai-review.test.js](../../../.github/scripts/final-ai-review.test.js#L505)).
- Re-run the synthetic exact-release probe whenever the pinned OCR version or
  request fields change.
- Treat zero model activity as a producer failure until logs prove the review
  ran; never convert it into clean-review evidence.
- Do not move these jobs to persistent self-hosted runners without redesigning
  configuration isolation and cleanup.
