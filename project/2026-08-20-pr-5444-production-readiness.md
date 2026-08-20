# Production-readiness review — PR #5444

## Scope and merge posture

- Pull request: [#5444](https://github.com/uzh-bf/klicker-uzh/pull/5444), the replacement for closed PR #5322.
- Base: `v3` at `365f07873f1023a7597b131caa97e810a0c6b7f2`.
- Head: `bd5122d3920bc4c201a4c01f08b7fd7db31a5c40`.
- Source behavior is unchanged from the reviewed implementation head `1e377e32a`; later commits update readiness evidence, runtime documentation, and this current-head report.

**Verdict: ready to merge as the no-consumer foundation; not ready for first production adoption.**

The branch adds the shared GrowthBook package but no application import, active product flag, live endpoint, service, migration, or production data operation. The user decision is to defer adopter-only findings until the first consumer implementation, where browser and Node behavior can be exercised in a real integration.

GitHub currently reports `mergeable: MERGEABLE`; checks for the current documentation-only head are still rerunning. The PR remains `BLOCKED` because no code-owner review is recorded. This report does not authorize merging or deployment.

## Evidence boundary

The reviewed slice contains the package, tests, documentation, plans, and review cleanup. GrowthBook `1.6.5` behavior was checked from the pinned installed source, with SDK payloads mocked in package tests. No service, cluster, live GrowthBook endpoint, production secret, or adopting application was accessed.

## Current-head verification

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Feature-flags tests | Passed: 27 tests in 3 files | Local Vitest run with `CI=true` |
| Feature-flags typecheck and build | Passed | Local package checks |
| Repository check and build | Passed: 25/25 checks and 23/23 build tasks | Local repository gates; Node 26 warning against the pinned Node 24 toolchain remained non-fatal |
| Commit and pre-push gates | Passed | Hooks ran without `--no-verify`; local gitleaks reported zero leaks |
| GitHub checks for #5444 | Rerunning | The current `bd5122d` run has completed passes for security analysis, builds, and several checks; repository checks, SonarCloud, and test jobs remain in progress. |
| Review feedback | None pending | No unresolved threads or submitted reviews; CodeRabbit posted only a rate-limit notice |

The substantive branch diff is 24 files with 1,289 additions and 20 deletions, excluding `pnpm-lock.yaml` and `project/` planning/readiness artifacts. The complete three-dot diff is 29 files with 2,899 additions and 20 deletions, including this refreshed report.

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

- Obtain the required code-owner review configured by `CODEOWNERS` (`@rschlaefli`).
- No code, CI, or security finding currently blocks the foundation merge.

## Follow-up after merge

- Carry FF-02 through FF-14 into the first consumer implementation, currently PR #5323.
- Do not treat this foundation merge as production-adoption approval; verify the consumer in a production-like browser or Node runtime before rollout.

## Review method

The current source head is the same implementation reviewed for PR #5322, with only evidence/documentation commits after `1e377e32a`. This report refreshes the PR identity, current GitHub checks, merge posture, and the explicit decision to defer adopter-only findings until they can be tested at a consumer boundary.
