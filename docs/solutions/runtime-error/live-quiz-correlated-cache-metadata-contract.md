---
module: live-quiz-response
date: 2026-08-12
problem_type: runtime_error
severity: high
symptoms:
  - 'Correlated submissions returned 400 Invalid correlated response metadata in production-shaped Redis hashes.'
  - 'Valid selection answers were rejected when their IDs were not correct solution IDs.'
  - 'Malformed restrictions could reach encrypted outbox validation and surface as a 500.'
root_cause: "The Redis producer's operational hash was passed directly to a stricter response contract, and selectable IDs were conflated with grading solution IDs."
tags: [live-quiz, response-api, redis, metadata, outbox]
---

# Correlated response metadata has a producer contract

## Problem

The live-quiz response API consumes Redis hashes that serve several purposes: routing, grading, timing, and response validation. The correlated-response contract only accepts a narrow subset of those fields. Passing the complete operational hash directly to the strict parser caused production-shaped submissions to fail before admission.

Selection questions also have two different ID sets: every selectable answer and the subset that is correct for grading. Treating the correct subset as the complete selectable set rejects legitimate answers.

## Symptoms

The strict parser rejected operational fields such as namespace and timestamps. Selection responses using a valid non-solution option were rejected. Invalid JSON restrictions were converted into absent restrictions and then failed later during outbox validation.

## What Didn't Work

Passing `hgetall` output directly to `parseCorrelatedResponseInstanceInfo` coupled a broad operational cache shape to a narrow response contract. Reusing the grading solution IDs for `selectionAnswerIds` looked convenient but changed the meaning of the field. Filtering malformed parsed restrictions to `undefined` made malformed metadata indistinguishable from omitted metadata.

## Solution

`adaptLiveQuizResponseInstanceInfo` now whitelists the contract fields, maps legacy selection metadata, and derives legacy case-study shape only when it can be validated ([`apps/response-api/src/liveQuizResponseRequest.ts:121-159`](/Users/rschlae/Git/klicker/klicker-uzh/trees/pr5134-stack-a:121), [`apps/response-api/src/liveQuizResponseRequest.ts:250-266`](/Users/rschlae/Git/klicker/klicker-uzh/trees/pr5134-stack-a:250)). The loader keeps routing mode lookup on the operational hash while passing only adapted metadata to correlated admission.

The GraphQL cache writer emits canonical selection and case-study metadata ([`packages/graphql/src/services/liveQuizzes.ts:1282-1337`](/Users/rschlae/Git/klicker/klicker-uzh/trees/pr5134-stack-a:1282)). The pure helper keeps all selectable answer IDs separate from correct solution IDs ([`packages/graphql/src/services/liveQuizResponseCacheMetadata.ts:1-14`](/Users/rschlae/Git/klicker/klicker-uzh/trees/pr5134-stack-a:1)), with a regression test for that distinction ([`packages/graphql/test/liveQuizResponseCacheMetadata.test.ts:5-14`](/Users/rschlae/Git/klicker/klicker-uzh/trees/pr5134-stack-a:5)). Malformed restriction JSON is rejected as a 400 and passed through to fail-closed validation rather than being treated as absent ([`apps/response-api/src/correlatedResponseHandler.ts:64-83`](/Users/rschlae/Git/klicker/klicker-uzh/trees/pr5134-stack-a:64)).

## Why This Works

The producer may retain operational fields without expanding the public response contract. The adapter is the compatibility boundary, so strict validation sees only fields it understands. Selection validation can accept every answer entry while the worker still receives the correct-only solution list for grading. Invalid metadata remains distinguishable from omitted optional metadata and cannot be durably acknowledged.

## Prevention

Test the adapter with the actual Redis `hgetall` shape, including unrelated operational fields and each question variant. Keep producer metadata helpers pure where possible so field-semantics regressions can be tested without a live Redis or GraphQL service. Treat legacy cache fallbacks as compatibility behavior with an explicit sunset or rejection path; do not infer complete selectable metadata from grading solutions.
