# Audit public image links

## Goal

Keep public image URLs already present in Element/ElementInstance content in
assessment audit snapshots. Stop downloading, fingerprinting, copying, verifying,
or renewing image evidence.

## Scope

One cohesive PR against `v3-audit`: backend baseline/refresh producers, removal
of the media-policy runtime and chart, and current engineering guidance.
Historical version-1 media envelopes remain readable without changing their
canonical bytes. No schema migration, frontend, auth, gamification, seed, or
submission behavior change. Normal element snapshot and audit integrity checks
remain. No running deployment or retained Blob data is changed.

## Verification

Use an isolated plain Docker toolchain container; do not start Devrouter/DevPod.
Run focused audit, baseline/producer and worker-selection tests, package checks,
and Helm rendering. Attempt broader repository checks as available; record gaps
in the draft PR. Native worker implements backend slice; native review follows.
External executor/simplifier skipped because this branch has no provider opt-in.

## Progress

- Created `feat/audit-image-links` from `origin/v3-audit` at `bc0ae19bb`.
- Confirmed public URLs already survive in effective content snapshots.
- Removed media staging, capture/replacement producers, renewal scheduling,
  privileged media worker/chart resources, and unused image-detector dependency.
- Retained historical media schemas and export compatibility.
- Focused verification: 92 audit unit tests, 14 baseline/producer tests,
  22 workflow-selection tests, 8 activation/rollout database tests,
  12 outbox/monitor database tests; updated CI chart assertion also passes.
- Activation fixture includes an unreachable public image URL and passes.
- Full monorepo build passed (29 tasks); Helm render with monitoring enabled
  and dependency-version consistency checks passed.
- Independent native review found a stale CI assertion; fixed and verified.
- Broader repository checks encountered disposable-container Git/identity
  constraints; direct package checks and full build results recorded in PR.
