---
type: Solution
title: Select focused GraphQL tests without an extra argument separator
description: Keep filename filters effective and database cleanup confined to disposable task fixtures.
module: graphql
date: 2026-09-05
problem_type: test_failure
severity: medium
symptoms:
  - 'A focused GraphQL test command selected unrelated suites.'
root_cause: 'An extra argument separator reached Vitest and prevented the intended filename filtering.'
tags: [vitest, pnpm, test-isolation]
---

# GraphQL focused tests selected the full suite

## Problem

The GraphQL package's `test` script runs `vitest run`. With the repository's
pnpm 11 toolchain, adding `--` before the filenames passed that separator to
Vitest and selected unrelated suites. Several existing suites use unfiltered
database cleanup, so an accidentally broad run is also a data-safety risk.

## Solution

Pass filenames directly and confirm selection first:

```sh
pnpm --filter @klicker-uzh/graphql exec vitest list --filesOnly test/elementGenerationLease.test.ts
pnpm --filter @klicker-uzh/graphql test test/elementGenerationLease.test.ts
```

Run these commands through the exact worktree's managed container. Before a
database suite, prove that its configured database belongs to this task and
contains only disposable synthetic fixtures. An explicit URL alone does not
prove ownership. Do not substitute `test:local`: that script manages its own
Compose lifecycle and is unsuitable for parallel managed-workspace testing.

## Evidence and prevention

The extra-separator invocation selected the full suite and was cancelled. The
direct-filename invocation selected the intended five files and passed all 57
baseline tests. See the [package scripts](../../../packages/graphql/package.json)
and [cleanup helper](../../../packages/graphql/test/helpers.ts). Recheck the
finite file selection after a test-runner or package-manager change.
