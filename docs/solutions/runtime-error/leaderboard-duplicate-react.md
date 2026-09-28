---
type: Solution
title: Leaderboard crashes with a second React runtime
description: Motion peer resolution caused a production hook failure that Turbopack Playwright coverage did not detect.
module: shared-components
date: 2026-09-28
problem_type: runtime_error
severity: high
symptoms:
  - Opening a populated completed-quiz leaderboard shows the unexpected-error page.
  - Motion useReducedMotion throws when reading useState from a null dispatcher.
root_cause: Motion and Framer Motion resolved React 19.2.7 while the application renderer used React 19.2.8.
tags: [leaderboard, react, motion, pnpm, playwright, webpack]
---

# Leaderboard crashes with a second React runtime

## Cause and repair

[The leaderboard animation change](https://github.com/uzh-bf/klicker-uzh/pull/5792)
introduced Motion 13.1.1. Its lockfile peer snapshot, and the nested Framer Motion
snapshot, resolved React and React DOM 19.2.7. The applications and
shared-components resolved 19.2.8. Opening a populated leaderboard mounted
`useReducedMotion` from the second React instance, whose dispatcher was unset.

The production Manage Webpack assets contained both React instances. A direct
React DOM render of the Motion hook also reproduced the null-dispatcher failure
with the original dependency tree. This was a client rendering failure, not a
leaderboard query failure.

Refresh the Motion peer resolution in [pnpm-lock.yaml](../../../pnpm-lock.yaml)
to the application's React 19.2.8 instance, including the Framer Motion snapshot.
Keep Motion's version unchanged. A filtered pnpm update also rewrote unrelated
peer snapshots; retain only the generated Motion changes and verify with a
frozen-lockfile install. Other packages may legitimately retain older React
versions, so global deduplication is unnecessary for this repair.

## Why Playwright passed

[The introducing PR's Playwright run](https://github.com/uzh-bf/klicker-uzh/actions/runs/35534095874)
passed all eight shards. Shard 5 ran the positive leaderboard test in
[O2-live-quiz-collaboration.spec.ts](../../../playwright/tests/O2-live-quiz-collaboration.spec.ts),
which opens an embedded leaderboard and asserts that a valid temporary
participant is visible. The test was neither missing nor skipped.

The build-job log identifies `NODE_ENV=test next build --turbopack` for Manage.
Its [production build script](../../../apps/frontend-manage/package.json) uses
`next build --webpack`. The green browser result therefore did not establish
production bundle behavior. A successful Webpack compilation alone also cannot
prove that a conditionally mounted component renders.

## Regression coverage

[react-runtime.test.mjs](../../../packages/shared-components/test/react-runtime.test.mjs)
checks React module identity across Motion, Framer Motion, and React DOM, then
renders the same reduced-motion hook through React DOM. Both checks fail with
the original lockfile and pass after the peer-resolution repair, including in
production mode. The shared-components `check` script runs them before TypeScript,
so normal repository checks catch this dependency mismatch independently of the
Playwright bundler.

This guard protects the reproduced React identity failure. It does not turn the
Turbopack E2E suite into production Webpack coverage; bundle-specific failures
still require a browser check against a production build.
