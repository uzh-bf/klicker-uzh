# Audit stack: v3-audit integration review

Date: 2026-09-10. Base: `v3-audit` at
`352f47fd7443d93aa5720e863d6285b801cceebe`.
All five layers were rebased with native `gh stack rebase`.
No merge, deployment, or change to `v3`/`v3-ai` was performed.

## Verdict

The scoped local verification and independent integrated review support code
review. No confirmed integrated P1/P2 finding remains from these review passes.
This is not production or merge approval: fresh remote CI, browser E2E, and
Azure/staging/pilot verification remain gates.

## Conflict resolutions and follow-up fixes

- Preserved upstream KB workflows, worker draining/runtime modes, feature flags,
  generated-element support, backend CI coverage, and original KB document paths.
- Integrated audit worker identity/role selection without requiring unused KB
  configuration; consolidated duplicate Azurite service definitions.
- Added exact-client disposable PostgreSQL guards before fixture writes and
  destructive cleanup. Corrected historical CI-fixture authors only after
  explicit approval; the outgoing identity guard passes.
- Aligned both audit deployments with shared-runtime health port 8001,
  readiness `/readyz`, liveness `/healthz`, and 90-second termination grace.
  Port 9464 remains the metrics endpoint. Staging rollout remains disabled.
- Fixed unbounded media-reference accumulation: enumerate immediately from
  bounded keyset pages, validate content addresses without retained global
  state, and preserve repeated references' independent retention horizons.
  Shared-media retention extends monotonically in either reference order.
- Moved existing hardening to its owning layers: guards to contract/baseline,
  worker probes to store/baseline, and lecturer/system producer fixes to layer 4.
  Fixed new-assessment activation's use-before-declaration in layer 3.
  Layer 4 performs copied-course activation after the enclosing transaction
  commits; layer 3 alone is deliberately dormant and must not be enabled.
- Restored the registry-to-production-source coverage assertion and included
  the actual bulk producer in `activities.ts`. This is a wiring regression
  guard, not proof of runtime event coverage.

## Independent review

Separate native read-only standards, spec, and rebase-integration passes
inspected the changes. The streaming re-review found no confirmed P1/P2.
The final placement review confirmed that post-commit activation in layer 4
resolves the earlier copied-course transaction-visibility finding.
The main agent reviewed the integrated diff and ran the checks below.

No external-provider executor was used because the repository has no opt-in.
A simplifier was skipped: this pass fixes bounded correctness issues and moves
already reviewed code between layers; further refactoring would expand scope.

## Per-layer verification

Checks ran at each layer's own code and dependencies, in the existing container.
Later-layer compiled output was rebuilt before accepting earlier-layer checks.

| Layer / PR | Passing tests | Build / typechecks |
| --- | --- | --- |
| 1 / #5311 | 35 audit | Prisma and audit build; audit check |
| 2 / #5356 | 67 audit; 10 worker-selection | 10 dependency build tasks; audit, GraphQL, general-worker checks |
| 3 / #5367 | 84 audit; 11 GraphQL audit; 22 worker-selection | 10 dependency build tasks; audit and GraphQL checks |
| 4 / #5369 | 103 audit; 19 GraphQL audit | 10 dependency build tasks; audit and GraphQL checks |
| 5 / #5378 | See integrated verification below | See integrated verification below |

Layer 3's small activation ordering correction was typechecked after its build;
the final integrated build also includes it. Helm rendering with synthetic
enabled audit values verifies both deployments' ports, probes, and grace period.
Independent forge reviews of each layer remain required.

## Integrated verification

The existing `default-fe-00142-app-1` container was reused. No development
runtime was started. The approved bootstrap helper provisioned previously
absent, marked `klicker_test` and `klicker_test_shadow` databases and a restricted
test login. The retained database was not reset, migrated, or relabeled.
Only the disposable fixtures were reset through the complete migration history.
Schema push alone is insufficient because it omits migration-defined SQL CHECKs.

- Frozen dependency install passed.
- Audit: **107 tests passed**, including real PostgreSQL and Azurite.
- GraphQL audit: **23 tests passed** across five focused files.
- Response-worker: **52 tests passed** (26 materialization, 22 helpers, four
  synthetic Redis aggregation); runtime-mode suite: **three passed**.
- Response API: **11 passed**; general-worker role selection: **22 passed**.
- Total: **218 distinct passing tests**; repeated runs are not double-counted.
- Scoped build: **11/11 tasks passed** for GraphQL, response-worker, Response
  API and dependencies, followed by **10/10** for general-worker dependencies
  (seven cached). Audit, GraphQL, both workers, and Response API typechecks pass.
- An initial role-selection invocation used the wrong test directory and found
  no tests; the corrected `src/workflowSelection.test.ts` invocation above
  executed all 22 cases. Empty runs are not counted as passing.
- New streaming tests cover bounded paging/cancellation, malformed evidence,
  content-address validation, and both shared-horizon orderings.
- Tests deliberately stub Hatchet scheduling/Redis where their fixture requires
  it; these results are not proof of a live cloud end-to-end run.

## Remaining release gates and verification limits

- Complete fresh remote CI against the published heads. Trusted Playwright build
  control comes from `v3`; its artifact list still lacks `packages/audit/dist`.
  Prerequisite [#5836](https://github.com/uzh-bf/klicker-uzh/pull/5836) remains open
  and was not merged as part of this task.
- Complete browser E2E, live Azure RBAC/append-only delivery/media retention,
  Hatchet scheduling, load, export verification, and the controlled staging pilot.
- Full root `check:all` is not green in the retained container: host Git metadata
  and the host Devrouter executable are unavailable. Scoped checks replace
  local hooks for this publication; hooks are disabled for rebasing/committing.
  Local gitleaks is unavailable; CI secret scanning remains required.
- GraphQL Rollup emits existing Pothos typing and circular-dependency warnings;
  separate TypeScript checks are the type-safety evidence.
- Stack 2 browser capture is deferred scope, not established by these tests.
