---
module: chat-model-registry
date: 2026-10-11
problem_type: test_failure
severity: medium
symptoms:
  - "Model registry parity fails during test collection after image promotion."
  - "Deployed registry accepts multiple BASE entries while the control-source validator rejects them."
root_cause: An image-only promotion advanced released images without advancing the control branch's shared registry policy.
tags: [registry, promotion, configuration, parity]
---

# Image promotion leaves the control-source registry validator behind

## Problem

The [alpha.86 promotion](https://github.com/uzh-bf/klicker-uzh/pull/6464)
changed image references on `v3`. Its qualified image source on `v3-ai`
already accepted GPT-6 Luna as the required BASE fallback and additional BASE
entries. The control source still required GPT-5.6 Luna as the sole BASE model
and Auto as ADVANCED. Parsing the declared deployment registry failed during
test collection, independently of whether the running images were healthy.

## Symptoms

The registry parity suite raised Zod policy errors before collecting tests.
Other unit suites ran successfully. The same failure reproduced in the
unmodified promotion tree with a service-free container.

## What Didn't Work

Retrying an unchanged suite cannot reconcile different policy versions.
Changing deployed model settings to satisfy the older parser would undo the
released contract. Merging the complete image-source branch would import
unrelated application changes into a bounded compatibility repair.

## Solution

Align `packages/util/src/chatModelRegistry.ts` and both built-in registry
fallback entries with the released policy. Restore its documented amendments
in [ADR 0020](../../adr/0020-two-tier-chatbot-approval.md). Keep the other
default entries and deployed configuration unchanged.

The existing `apps/chat/test/modelRegistryParity.test.ts` compares structured
results from both real consumers, including the declared deployment
registries. Its synthetic cases protect required fallback and Auto guards.
Credit-route tests own synthetic accounting prices so changes to current
provider prices do not invalidate their billing-behavior checks.

## Why This Works

Image-source qualification and control-source validation are separate seams,
as documented in [ADR 0051](../../adr/0051-ai-releases-tag-v3-ai-with-deploy-parity.md).
Matching the shared policy and built-in fallback metadata repairs the control
seam without changing the published images or live configuration.

## Prevention

Inspect registry-policy parity when promotion changes the released policy.
Prove the failing control tree and corrected consumers separately. Do not
treat a control-source CI failure as evidence of runtime failure, or healthy
pods as evidence that the consumer workflow has passed.
