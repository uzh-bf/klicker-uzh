---
type: Solution
title: Public PR runtime dependencies must cross the trusted artifact boundary
description: Diagnose and prevent all-shard startup failures when candidate code imports a workspace package that the trusted v3 Playwright action does not transfer.
module: playwright-ci
date: 2026-09-03
problem_type: test_failure
severity: medium
symptoms:
  - 'Every Playwright shard failed before running a test'
  - 'The shared build job passed while backend startup raised ERR_MODULE_NOT_FOUND'
  - 'The missing workspace package had built successfully but was absent from the downloaded artifact'
root_cause: 'Candidate code added a runtime workspace dependency, but public PR jobs packaged artifacts with the trusted v3 composite action, which did not transfer that package.'
tags:
  - playwright
  - github-actions
  - public-pr
  - artifacts
  - rollup
  - workspace-dependencies
---

# Public PR runtime dependencies must cross the trusted artifact boundary

## Problem

PR [#5693](https://github.com/uzh-bf/klicker-uzh/pull/5693) made the
GraphQL backend import the shared feature-flag package at runtime. The
Playwright build compiled both packages successfully, but every shard stopped
before test execution because `apps/backend-docker/dist/index.js` imported
`@klicker-uzh/feature-flags/node` and the transferred artifact did not contain
that package.

The public workflow deliberately calls both composite actions from `v3`, not
from candidate code (`.github/workflows/public-pr-playwright-shards.yml:197`
and `.github/workflows/public-pr-playwright-shards.yml:313`). Its trusted build
action transfers an explicit allowlist of service and package outputs
(`.github/actions/playwright-build/action.yml:167-188`).

## Symptoms

- The build reported success for `@klicker-uzh/feature-flags:build:test` and
  `@klicker-uzh/backend-docker:build:test`.
- All eight shards failed during service startup with
  `ERR_MODULE_NOT_FOUND` for
  `packages/feature-flags/dist/node.js`.
- Downloading `playwright-build-artifact` confirmed that
  `apps/backend-docker/dist` was present while `packages/feature-flags/dist`
  was absent.
- Later Hatchet and PostgreSQL shutdown errors were consequences of the failed
  service process, not the initiating fault.

## What Didn't Work

Adding `packages/feature-flags/dist` to the candidate branch's copy of the
composite action could not repair that candidate's run. GitHub resolved the
action from `refs/heads/v3`, so the candidate edit did not define the artifact
that its shards downloaded.

Treating the build job's success as artifact proof also failed. Compilation and
cross-job transfer are separate contracts; the action can upload a valid
artifact while silently omitting an unlisted package because other listed paths
exist.

## Solution

Keep the backend service artifact self-contained for this dependency. The
Rollup externalization predicate now bundles the feature-flag Node adapter and
its GrowthBook runtime while preserving external imports for the other
workspace and third-party dependencies
(`apps/backend-docker/rollup.config.js:5-20`). The already-transferred
`apps/backend-docker/dist` tree therefore carries the new runtime code without
changing the trusted artifact allowlist.

Verify both production and test builds. The generated backend entry must
contain `NodeFeatureFlagClient` and `GrowthBookClient`, and it must not retain
imports for `@klicker-uzh/feature-flags`, `@growthbook/growthbook`, or
`dom-mutator`.

## Why This Works

The trusted action already transfers `apps/backend-docker/dist`
(`.github/actions/playwright-build/action.yml:173`). Bundling the new runtime
code into that existing boundary makes the candidate compatible with the
current trusted action. It also keeps the production container's backend entry
self-contained for the same feature-flag dependency.

## Prevention

- Before adding a runtime workspace import to an artifacted service, identify
  whether the CI handoff transfers that package or expects the service bundle
  to contain it.
- For public PRs, inspect the action at `refs/heads/v3`; the candidate's copy is
  not the executing contract.
- If trusted orchestration must transfer a new path, land and prove that
  contract on `v3` first. Otherwise, bundle the dependency into an existing
  artifact boundary.
- When every shard fails before tests, inspect the first service-process error
  and the downloaded build artifact before investigating test selectors,
  readiness checks, or teardown logs.
