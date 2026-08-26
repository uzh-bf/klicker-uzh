---
type: Execution Plan
title: Restore pinned knowledge-base URL ingestion on Node 24
description: Correct the custom DNS lookup callback shape without weakening URL pinning or SSRF protections.
timestamp: '2026-08-26'
tags:
  - knowledge-base
  - ingestion
  - security
---

# Restore pinned knowledge-base URL ingestion on Node 24

## Goal

Restore URL-source preparation in the general Hatchet worker on Node 24 while preserving the existing public-IPv4 validation, per-redirect address pinning, MIME restrictions, and source-size limits.

## Research

- Problem: Staging URL ingestion fails before the ingestion API receives a request.
- Evidence: The worker reproduces `ERR_INVALID_IP_ADDRESS` when Node 24 invokes the custom lookup with `all: true`; the implementation always returns a scalar address.
- Evidence: The official Node 24 DNS contract requires an array of `{ address, family }` entries when `all: true`, and a scalar address plus family otherwise.
- Decision: Keep the lookup private. Exercise it through a focused hoisted mock of `node:https.request`; do not add a test-only export or helper module.
- Risk: This is an SSRF control surface. The correction must change only the callback result shape and retain the already-validated pinned IPv4 address.

## Delegation Map

- Slice: Node 24 lookup compatibility and regression protection.
- Owner: main.
- Reason: The production and test seams are tightly coupled, and delegation costs more than the bounded edit.
- Acceptance: Focused Hatchet tests reproduce and protect both lookup callback shapes; Hatchet check and build pass; the complete committed range receives security-aware final review.

## Slice 1: Correct the pinned lookup result shape

- Problem: Node 24 may request all lookup results, but the custom callback always returns the single-result form.
- Decision: Return `[{ address, family: 4 }]` only when `options.all` is true; retain `(address, 4)` for the single-result form.
- Do: Extend `packages/hatchet/test/kbIngestionApi.test.ts` through the private HTTPS request seam, then make the minimal change in `packages/hatchet/src/kbIngestionApi.ts`.
- Test obligation: Extend the existing Hatchet unit suite at the Node lookup contract seam. The regression must fail with the current implementation and cover both `all: true` and non-`all` calls.
- Check: Run the focused test on Node 24, the Hatchet package test suite, package check and build, repository formatting/static checks in proportion to the changed scope, and inspect the exact diff.
- Commit: `fix(kb): support pinned URL lookup on Node 24`.

## Delivery

- Do: Push one branch and open one draft PR against the current `v3-ai` branch.
- Check: Complete the required final review, monitor exact-head CI, and mark the PR ready only after review and CI gates pass.
- Post-deploy proof gate: After a separately authorized merge and staging rollout, retry the retained synthetic RFC plain-text resource exactly once. Require accepted operation, worker/API evidence, terminal success, serving identity, and Manage UI readiness before cleanup is considered.

## Authority

- Granted: focused source and test edits, this plan, local verification, conventional commits, normal push, draft PR creation/update, required read-only reviews, exact-head CI monitoring, and marking the PR ready after all gates pass.
- Withheld: merge, deployment, cluster changes, graph activation, fixture retry, UI cleanup, resource deletion, production actions, secret access, and manual retries.

## Terminal

Return the immutable branch head, PR link and state, exact-head CI result, review disposition, and the unchanged post-deploy proof gate.

## Pause

Pause for unexpected scope expansion, a conflict with the refreshed `v3-ai` base, a required reviewer that cannot be satisfied, or any need to cross a withheld authority boundary.

## Progress

- 2026-08-26: Fresh base recorded as `origin/v3-ai@0fab2e33d7cc7cde35032bd533b6a718b276ba72`.
- 2026-08-26: Planning review returned `DONE_WITH_CONCERNS`; accepted the private HTTPS mock and no-doc-change recommendations, and promoted the package to the full path because DNS pinning is an SSRF control surface.
- 2026-08-26: Node 24.16.0 regression reproduced before the fix: the focused Hatchet run failed because the pinned lookup returned a scalar address for `all: true` (104 passed, 1 failed).
- 2026-08-26: The callback now returns the validated pinned IPv4 in Node's requested shape. The focused/full Hatchet run passed 105 tests; package type-check, build, and affected-file Biome checks passed.
- 2026-08-26: The retained failed staging RFC fixture was not retried. Staging proof remains separately gated after merge and deployment.
- 2026-08-26: The configured slice-reviewer provider failed with a credit-limit error. The Sol fallback completed the same immutable correctness/security review of `e663e6ca1` with `DONE` and no findings.
- 2026-08-26: The exact runtime `rs-kb-ingestion-pinned-lookup` was stopped after verification; DevPod reported `Stopped` and devrouter freed 11 routes.
- 2026-08-26: With explicit approval, the unpublished branch rebased cleanly onto `origin/v3-ai@bd35688fb256def04b531d9fb4285969947afbe3`; the upstream chat-only paths did not overlap this package.
