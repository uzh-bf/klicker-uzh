# Production-readiness review — PR #5444

## Scope and merge posture

- Pull request: [#5444](https://github.com/uzh-bf/klicker-uzh/pull/5444), the replacement for closed PR #5322.
- Base: `v3` at `215249bf1fae201bb6997be59fc4021557206b36`.
- Reviewed foundation source head: `d0012347cb880257df8c5a4c209279e977e7f3fc`.
- The current source and plan examples are aligned; this report refresh records
  the final merge evidence without approving the merge or deployment.

**Verdict: ready to merge as the no-consumer foundation; not ready for first production adoption.**

The branch adds the shared GrowthBook package but no application import, active product flag, live endpoint, service, migration, or production data operation. The user decision is to defer adopter-only findings until the first consumer implementation, where browser and Node behavior can be exercised in a real integration.

GitHub reports the foundation as `MERGEABLE` with a `CLEAN` merge state after
the v3 synchronization. The configured code-owner review is approved. The
final current-head check result and review-thread state are recorded in the PR
itself immediately before handoff. This report does not authorize merging or
deployment.

## Evidence boundary

The reviewed slice contains the package, tests, documentation, plans, and review cleanup. GrowthBook `1.6.5` behavior was checked from the pinned installed source, with SDK payloads mocked in package tests. No service, cluster, live GrowthBook endpoint, production secret, or adopting application was accessed.

## Current-head verification

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Feature-flags tests | Passed: 27 tests in 3 files | Local Vitest run with `CI=true` |
| Feature-flags typecheck and build | Passed | Local package checks |
| Repository check and build | Passed: 25/25 checks and 23/23 build tasks | Local repository gates; Node 26 warning against the pinned Node 24 toolchain remained non-fatal |
| Commit and pre-push gates | Passed | Hooks ran without `--no-verify`; local gitleaks reported zero leaks |
| GitHub checks for #5444 | Required current-head gates | The PR description records the final completed GitHub run; local pre-push gates passed for the reviewed source head. |
| Review feedback | Resolved | Six CodeRabbit plan findings were verified and corrected; all six threads are resolved. The configured code-owner review is approved. |

The substantive branch diff is 24 files with 1,291 additions and 20 deletions, excluding `pnpm-lock.yaml` and `project/` planning/readiness artifacts. The complete three-dot diff is 29 files with 2,955 additions and 20 deletions, including this refreshed report.

## Findings carried forward

| Finding | Status and disposition |
| --- | --- |
| FF-01 — Node refresh health | **Resolved.** Failed refreshes retain the previous payload and stay unhealthy; successful recovery marks the client healthy. |
| FF-15 — GrowthBook auto-experiment side effects | **Resolved.** Browser options disable experiment evaluation, visual changes, JavaScript injection, and redirects; regression coverage remains in the package tests. |
| FF-02 — Non-abortable SDK timeout | **Deferred to the first consumer.** GrowthBook `1.6.5` can retain a never-settling fetch after the two-second caller timeout. The first Node or browser consumer must add an abortable deadline or qualify a cancellation-capable SDK path, plus a hung-request recovery test, before production adoption. |
| FF-03–FF-05 — Diagnostics, retry ownership, and cache age | **Deferred to the first consumer.** The adopter must define telemetry/status semantics, retry ownership, and the acceptable stale-cache window against a real rollout. |
| FF-06–FF-10 — Actor privacy, browser cache, streaming/teardown, payload budget, and environment contract | **Deferred to the first consumer.** These require an actual browser or service boundary, payload, lifecycle, and deployment configuration to test meaningfully. |
| FF-11–FF-14 — React lifecycle, package boundary, dedicated package CI, and rollback runbook | **Deferred to the first consumer.** The consumer PR must add the user-facing lifecycle checks, adoption-specific CI gate, and incident/rollback procedure. |

The detailed earlier evidence remains in [the PR #5322 readiness report](2026-08-20-pr-5322-production-readiness.md); its CI and PR-state observations are superseded by this current-head report.

## Blocking before merge

- The configured code-owner review from `@rschlaefli` is approved.
- No source, CI, security, or review finding remains blocking on the reviewed
  foundation slice. The PR must retain its passing current-head checks and
  `MERGEABLE`/`CLEAN` state at merge time.

## Follow-up after merge

- Carry FF-02 through FF-14 into the first consumer implementation, currently PR #5323.
- Do not treat this foundation merge as production-adoption approval; verify the consumer in a production-like browser or Node runtime before rollout.

## Review method

The current source head contains the foundation implementation and the verified
review corrections described above. This report refreshes the PR identity,
current GitHub checks, merge posture, and the explicit decision to defer
adopter-only findings until they can be tested at a consumer boundary.
