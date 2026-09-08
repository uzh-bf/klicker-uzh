---
type: Solution
title: Nested development routes disappear despite complete filesystem discovery
description: Serialize Next.js development route scans and prove ordering against the actual dependency handler.
module: local-development
date: 2026-09-08
problem_type: runtime_error
severity: high
symptoms:
  - Nested Pages Router routes return HTTP 404 although their source files exist.
  - The development pages manifest contains only top-level routes or is empty.
root_cause: Async Watchpack aggregation callbacks can overlap and publish an older route inventory after a newer scan.
tags: [nextjs, watchpack, playwright, local-development]
---

# Nested development routes disappear despite complete filesystem discovery

## Problem

The local manage app could serve its landing page while cockpit navigation
failed with `PageNotFoundError` and `ENOENT`. Readiness of one route did not
establish readiness of the complete development route inventory.

## Diagnosis

The missing route source existed. Direct synthetic HTTP requests also failed,
so the problem was not a Playwright selector or login transition. Watchpack
discovered the complete page tree when exercised independently. The running
development pages manifest nevertheless omitted nested routes.

Next.js 16.2.11 registers an asynchronous `aggregated` event callback. Event
delivery does not await that callback. Its route inventory and publication
steps cross asynchronous server-propagation calls, allowing overlapping scans
to finish out of order. The regression executes the actual dependency handler
with a controlled propagation barrier and reproduces this overlap in the
unpatched CommonJS and ESM distributions.

## Patch and limits

[The pinned Next.js patch](../../../patches/next@16.2.11.patch) serializes the entire callback per watcher and
reads the latest inventory when each queued invocation starts. The original
error handler covers only the latter part of the callback. The queue also
handles earlier failures, rejecting initial startup or warning after startup,
without preventing later events from running.

This is a development-watcher patch, not a production routing change or a
general filesystem-recovery mechanism. It does not make intermediate route
mutations transactional. No global preload, bundler switch, warm-up workaround
or increased test retry count is required.

## Verification and retirement

`node --test util/next-dev-aggregation.test.mjs` runs the actual-handler ordering
and failure-recovery regressions in the existing CI checks workflow. Tests run uncached; the optional
`NEXT_AGGREGATION_PACKAGE_DIR` selects an unpatched package for a negative
control. Keep the exact version selector in `pnpm-workspace.yaml` and commit
the generated lockfile with the patch. Turbo's Docker prune must retain the
patch in both its install and full-source contexts.

On a Next.js upgrade, do not mechanically widen the patch selector. Test the
new upstream handler, then remove this patch only when ordering/recovery checks
and repeated focused startup/browser qualification pass without it. The test
extraction intentionally fails when its dependency-code anchors change, so a
new package layout needs explicit review rather than silently skipping proof.
