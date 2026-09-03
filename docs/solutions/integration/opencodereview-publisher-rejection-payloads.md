---
type: Solution
title: Preserve rejected OpenCodeReview publisher inputs
description: Retain only the exact public JSON payload that a trusted final-review publisher rejected so its strict parser can be diagnosed offline.
module: ci-final-review
date: 2026-08-30
problem_type: integration
severity: medium
symptoms:
  - 'OpenCodeReview completed, but the trusted publisher rejected a finding.'
  - 'The workflow failed with an invalid confidence score.'
  - 'The rejected result disappeared with the hosted runner.'
root_cause: 'Publisher failures occurred after producer diagnostics and retained no copy of the free-form JSON payload that failed strict validation.'
tags:
  - open-code-review
  - github-actions
  - workflow-artifacts
  - final-review
---

# OpenCodeReview publisher failures lost the rejected payload

## Problem

The manual final-review workflow can produce a structurally valid result that
the trusted publisher still rejects. OpenCodeReview findings contain free-form
text, while the publisher requires exact confidence, autofix, and motivating
line markers before it writes a review or clean status
([final-ai-review.js](../../../.github/scripts/final-ai-review.js#L2451)).

In [PR #5593](https://github.com/uzh-bf/klicker-uzh/pull/5593),
[workflow run 33304066293](https://github.com/uzh-bf/klicker-uzh/actions/runs/33304066293)
completed model review but failed publication with
`Finding 1 has an invalid confidence score`. The result existed on the hosted
runner, but no artifact survived for exact parser replay.

## Symptoms

- OpenCodeReview completed instead of failing as the result producer.
- The publisher rejected one finding before posting review output.
- An exact-head rerun failed with the same validation message.
- The completed workflow retained no result artifact.

## What Didn't Work

- Producer-failure logging did not help because the producer succeeded.
- Repeating the paid review reproduced the publisher error but did not reveal
  whether the marker was missing, reordered, or malformed.
- A sanitized summary would lose the exact free-form syntax needed to replay
  the strict parser faithfully.
- Relaxing the parser would change review policy without first recovering the
  evidence that failed it.

## Solution

Upload only the exact JSON inputs involved in the failed validation or
publisher step. The individual job keeps its initial, resumed, or final result
JSON as applicable
([check-ocr-final-review.yml](../../../.github/workflows/check-ocr-final-review.yml#L503)).
The stack job normally keeps `final-ai-stack-code-result.json` and the optional
`final-ai-stack-topology-result.json`. An incremental validation or resume
failure may instead retain the exact affected range result JSONs, while a
combine failure retains every range result passed to that failed combine step
([check-ocr-final-review.yml](../../../.github/workflows/check-ocr-final-review.yml#L1015)).

These paths run only after the corresponding validation or publisher step
fails, require the expected files, and retain the artifact for one day. They
upload no stderr, provider configuration, manifest, review-range directory as
a directory, unrelated wildcard input, or runner workspace. Because the
repository is public, treat the artifacts as public output and use only public
pull-request inputs in this diagnostic path.

Download a rejected payload for offline parser diagnosis. Do not replay the
review, publish feedback, or infer a clean result from the artifact without the
normal trusted workflow and its separate authority checks.

## Why This Works

The artifact preserves the exact publisher input, including malformed
free-form text, while excluding broader runner state. The original publisher
still fails and the final status remains unchanged, so the diagnostic step
cannot turn rejected evidence into a successful review.

The one-day lifetime limits exposure and storage. It is proportionate only
while every retained input comes from public pull-request diffs, public review
context, and model output intended for publication.

## Prevention

- Keep source tests that assert the exact failure condition, pinned upload
  action, file list, and one-day retention
  ([final-ai-review.test.js](../../../.github/scripts/final-ai-review.test.js#L839),
  [final-ai-stack-review.test.js](../../../.github/scripts/final-ai-stack-review.test.js#L1157)).
- Do not add stderr, credentials, configuration, manifests, review ranges, or
  wildcard directories to publisher-failure artifacts.
- Revisit the design before accepting non-public inputs, longer retention,
  broader access, or automatic replay.
- Treat hosted artifact creation as unproved until this workflow change exists
  on the default branch and a controlled publisher failure exercises it.
