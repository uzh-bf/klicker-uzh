---
type: Solution
title: Nested development routes disappear despite complete filesystem discovery
description: Avoid the initial cross-router filter update in Pages-only development apps and detect incomplete route inventories.
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
to finish out of order. Startup observation identified the first suspension:
initializing the client router filter triggers a Turbopack project update even
when the app has no App Router routes. Later scans see the initialized filter
and skip that update, so they can publish a complete inventory first. The older
scan then resumes and overwrites it with its earlier, incomplete snapshot.

This was observed in real unpatched app starts, not only a synthetic callback
test. PWA published 43 routes before an older scan overwrote them with zero.
The shared file set still contained all 43 pages. A successful top-level
request therefore did not prove that nested routes could resolve.

## Configuration and limits

The shared [Next configuration](../../../packages/next-config/index.js) accepts
an explicit `pagesRouterOnly` opt-in. Auth, Control, Manage and PWA use it to
disable `experimental.clientRouterFilter` only in development. Chat and other
consumers keep the upstream default. Production and test configuration are
unchanged. Remove an app's opt-in when adding App Router routes: this filter
supports navigation between the two routers.

Disabling the unused filter removes the observed initial project update.
It does not serialize every possible watcher event. Later environment,
TypeScript configuration or middleware changes can still reach asynchronous
update paths. The setting is experimental and needs requalification when
upgrading Next. There is no framework patch, polling override, bundler switch,
global preload or additional test retry.

## Prevention and qualification

The local [readiness contract](../../../util/dev-runtime.sh) compares dynamic
source routes with the running server's HTTP development manifest before
accepting its shell page. An incomplete, malformed or unavailable inventory is
not evidence of corrupt disk cache and must not trigger automatic cache repair.
This check covers only selected apps and stays within the startup deadline.

The configuration matrix and readiness regressions run in the existing checks
workflow. Runtime qualification must separately prove complete manifests,
synthetic nested HTTP routes and normal browser navigation on repeated fresh
application-process starts. Preserve caches and dependency isolation, verify
the resolved unpatched package, and avoid diagnostic preloads during that proof.
One green startup is insufficient for this intermittent defect.

Dependency mount isolation remains necessary, but did not alone prevent this
failure. Upgrading to unpatched 16.3.4 did not remove the overlapping publication
path in the actual-handler comparison. A serialization patch was investigated
and passed its own tests, but the narrower configuration removes the observed
trigger without maintaining a fork of Next's internal callback.

CI already builds and serves the apps with `next start`. This incident concerns
local `next dev`; it does not justify changing CI serving or runner settings.

## Upstream references

- [Next 16.2.11 development route watcher](https://github.com/vercel/next.js/blob/v16.2.11/packages/next/src/server/lib/router-utils/setup-dev-bundler.ts)
- [Client router filter inputs](https://github.com/vercel/next.js/blob/v16.2.11/packages/next/src/lib/create-client-router-filter.ts)
- [Next guidance for using both routers](https://nextjs.org/docs/app/guides/migrating/app-router-migration#using-app-router-together-with-pages-router)
