# Production-readiness review — PR #5322

## Scope and verdict

- Repository: `uzh-bf/klicker-uzh`
- Pull request: [#5322](https://github.com/uzh-bf/klicker-uzh/pull/5322)
- Reviewed range: `365f07873f1023a7597b131caa97e810a0c6b7f2..1e377e32a`
- Base: `v3` at `365f07873f1023a7597b131caa97e810a0c6b7f2`
- Implementation head: `1e377e32a` (`fix(feature-flags): restore refresh health state`)
- Review date: 2026-08-20

**Verdict: not-ready.** The old merge-conflict blocker is resolved: GitHub reports
the exact reviewed head as mergeable against `v3`. The PR is nevertheless blocked
by a failed `GitGuardian Security Checks` check, with other required checks still
pending. The failure details are only exposed through the linked GitGuardian
dashboard, so this audit cannot classify or clear it. No production consumer exists
in this PR; the package-level foundation also has the conditional findings below
before first adoption.

This verdict does not authorize merging, deployment, or a production rollout.

## Change and evidence boundary

The reviewed slice is the package-only GrowthBook foundation, its tests, docs,
plans, and test-routing guidance. It adds no application import, database
migration, queue task, production endpoint, secret, or persistent Klicker data
operation. GrowthBook 1.6.5 behavior was checked from the pinned installed source;
SDK payloads remain mocked in unit tests. No service, cluster, live GrowthBook
endpoint, or production secret was accessed.

The local review worktree is clean after the implementation fix. The branch
contains the reviewed tree and the old PR head as a second parent, so the
publication did not require a force-push. `git diff --check` is clean and the
base is an ancestor of the implementation head.

## Verification completed

| Check | Result | Evidence boundary |
| --- | --- | --- |
| Feature-flags tests | Passed: 27 tests in 3 files | Local Vitest run with `CI=true` |
| Feature-flags typecheck | Passed | Local package check |
| Feature-flags build | Passed | Local package build |
| Repository build | Passed: 23/23 Turbo tasks | Local build; existing toolchain warnings remained non-fatal |
| Repository typecheck | Passed: 25/25 Turbo tasks | Local check |
| Commit/pre-push gates | Passed | Hooks ran without `--no-verify`; local gitleaks reported zero leaks |
| GitHub PR publication | Passed | The implementation head was published and reported `mergeable: MERGEABLE` against `v3` |
| GitHub required checks | Blocked | GitGuardian failed; remaining required checks were pending at review time |

No browser or adopting service was run. Consequently, local package checks do not
prove CORS, browser storage, React lifecycle, Node shutdown, telemetry, payload
size, live network, or deployment behavior.

## Findings

| ID | Severity / confidence | Finding and evidence | Required disposition |
| --- | --- | --- | --- |
| PR-01 | **Blocker / confirmed** | The current PR head is mergeable, but GitHub reports `mergeStateStatus: BLOCKED` because `GitGuardian Security Checks` failed; the other required checks were still pending. GitHub exposes no diagnostic for the failed dashboard check through the PR API. | Inspect the GitGuardian result in its dashboard, remediate or explicitly clear a false positive, then wait for all required checks. Do not merge while the check is failed or pending. |
| FF-01 | **Resolved / high** | The initial audit found that Node `refresh()` changed `healthy` to true after GrowthBook 1.6.5 resolved an unsuccessful HTTP/network refresh. Commit `1e377e32a` uses the SDK's result-bearing `init({ skipCache: true })` seam, restores the prior payload on failure, updates health only from `result.success`, and tests both failure retention and later recovery (`packages/feature-flags/src/node.ts:101-131`, `test/node.test.ts`). | Keep the status contract explicit before a Node consumer uses it; the SDK's lower-level `refreshFeatures()` response remains result-less. |
| FF-02 | **Major / high** | The two-second SDK timeout bounds the caller but does not abort a never-settling fetch. GrowthBook keeps the shared active-fetch promise until it settles, so later retries can reuse a stuck request. Evidence: browser/node adapter timeout options and pinned SDK `util.ts:400-422`, `feature-repository.ts:380-445`. | Supply an abortable fetch/deadline integration or qualify an SDK version with cancellation. Add a hung-request test proving later recovery. |
| FF-03 | **Major / high** | Initialization reduces GrowthBook's `success`, `source`, and `error` diagnostics to a boolean and generic warning. `getStatus().healthy` has no stable meaning across unconfigured, loading, cached, and degraded states. The React provider has no status or telemetry channel. Evidence: `packages/feature-flags/src/browserClient.ts:31-64`, `src/node.ts:47-114`, `src/react.tsx:24-58`; SDK `types/growthbook.ts:389-403`. | Define sanitized diagnostic states/reason codes and timestamps; document them as dependency diagnostics rather than application readiness. Add an optional provider status/telemetry hook without exposing keys, payloads, actor attributes, or raw errors. |
| FF-04 | **Major / high** | A failed initialization promise is memoized permanently. Browser recovery requires reload/remount; Node recovery depends on a separate refresh or restart. | Clear failed initialization after settlement while preserving concurrent single-flight behavior, and define bounded retry ownership for adopters. Add outage-to-recovery tests. |
| FF-05 | **Medium / high** | The default cache can serve an enabled payload for up to four hours during an outage. This is availability behavior, not an emergency kill switch. Evidence: pinned GrowthBook cache defaults and the adapter options. | Set and document an age suitable for rollout risk, or state explicitly that remote flag changes are not an immediate kill switch. Add fake-time expiry tests. |
| FF-06 | **Medium / high** | The runtime allowlist controls keys but accepts arbitrary strings for `id` and `role`; invalid `actorType` becomes `anonymous` while retaining those fields. Evidence: `packages/feature-flags/src/contracts.ts:46-62`. | Drop identity fields on invalid actor types and validate accepted stable-ID/role shapes before browser adoption. Keep tests for direct identifiers and malformed callers. |
| FF-07 | **Medium / high** | Browser GrowthBook caching persists the complete payload in local storage, including any future literal ID-targeting rules. This PR registers no active flag, so the impact is conditional on adoption. Evidence: browser adapter defaults and pinned SDK `feature-repository.ts:33-45,193-199`. | Prohibit literal browser ID allowlists; use server evaluation for named-user targeting and establish an approved cache policy for sensitive payloads. |
| FF-08 | **Medium / high** | The plans require explicit streaming decisions, but the adapters omit `backgroundSync`/`streaming` controls and therefore inherit SDK defaults. The Node wrapper also has no `destroy()` boundary. Evidence: `project/PLAN-growthbook-feature-flags.md:99-104,239-249`; adapter constructors; pinned SDK SSE and cleanup paths. | Disable streaming by default or make it an explicit opt-in with capacity evidence. Expose idempotent Node teardown and require it for replacement/shutdown. |
| FF-09 | **Medium / medium-high** | One shared SDK payload has no byte or feature-count budget. Every adopter downloads, parses, and retains the full response. | Measure compressed/uncompressed payload size and initialization latency in staging before first production adoption; split projects/connections if the budget is exceeded. |
| FF-10 | **Medium / high** | Missing or blank environment values intentionally normalize to `development`, while the high-level plan calls adapter configuration mandatory. A deployed consumer could therefore fetch the wrong environment unless the contract is made explicit. | Resolve the configuration contract before the first adopter: fail closed in deployed environments or explicitly scope the development fallback to local mode and test it. |
| FF-11 | **Medium / high** | React renders children immediately and has no loading/readiness state. A consumer can briefly render fallback behavior or retain the previous actor's evaluation while initialization/attribute updates settle. | Decide whether adopters need a loading boundary or keyed remount on actor changes; add browser lifecycle coverage before user-facing rollout. |
| FF-12 | **Minor / high** | Node-only consumers inherit React SDK dependencies and the React peer from the package manifest. | Accept and document the packaging cost or separate the Node dependency boundary before backend adoption. |
| FF-13 | **Minor / high** | Package tests are not a dedicated root CI gate; the package script is not included in the repository's standard check path. | Add a path-filtered package test gate or an explicit test workflow before relying on the foundation as a shared dependency. |
| FF-14 | **Minor / high** | The docs explain initialization and fallback but do not yet provide a rollback/incident runbook for the first adopter. | Add operator steps for cache/degraded behavior, rollback order, configuration diagnosis, and the non-emergency nature of remote flag disablement. |
| FF-15 | **Resolved / high** | The integrated review found that GrowthBook 1.6.5 enables payload-driven auto experiments by default. Commit `eb0aa446a` explicitly disables experiments-on-load, visual experiments, JavaScript injection, and URL redirects in the browser adapter; a regression payload test proves no experiment result or redirect is applied while ordinary feature evaluation remains active (`packages/feature-flags/src/browserClient.ts:21-31`, `test/browserClient.test.ts`). | Retain these options as part of the browser security boundary. Any future experiment support requires a separately reviewed contract and browser test. |

## Dimension coverage

| Readiness dimension | Result | Boundary |
| --- | --- | --- |
| Deploy and rollback | No current runtime change; package revert is reversible | No image, service, migration, or deployment was exercised. Future adopter rollback order remains required. |
| Failure modes and resilience | Major timeout, refresh-health, retry, and cache conditions | SDK source inspection and mocked tests only; no fault-injected service run. |
| Data safety | No current data operation; conditional browser identifier/cache risks | No real actor, payload, browser storage, or network capture. |
| Observability | Major diagnostic/status gaps | No adopter logs, metrics, readiness endpoint, dashboard, or alert path exists. |
| Configuration and secrets | Environment-contract ambiguity; GitGuardian gate unresolved | Values were not accessed; local gitleaks passed, remote GitGuardian did not. |
| User experience | Conditional React loading/actor-transition risk | No app imports the provider; no browser verification was possible. |
| Documentation and operability | Plans/docs updated for this slice; rollback/runbook still needed | No operator workflow exists until an adopter is selected. |
| Performance and capacity | Conditional timeout, streaming, lifecycle, and payload-budget risks | No load, payload-size, connection-count, or memory profile was run. |

## Handoffs and not checked

- Resolve the failed GitGuardian check and all pending GitHub checks before merge.
- Run the current-head code, security/privacy, and per-slice review gates; the
  earlier advisory review covered the old PR head only.
- Before the first consumer, settle the environment fallback, browser identifier,
  cache, streaming, abortable-timeout, teardown, and diagnostic-state contracts.
- Add an adopter-specific rollback and incident runbook, then verify it in a
  production-like environment with the appropriate browser/Node workflow.
- No cluster, deployment, live GrowthBook management action, secret retrieval,
  production data, or external message was performed by this review.

## Review-method note

The eight readiness dimensions were reviewed as separate read-only waves with
evidence from the immutable range and pinned SDK source. The native `explore`
route failed twice with encrypted payload errors; the approved fallback used
`gpt-5.6-sol` at `xhigh` effort. The integrated final review first covered the
pre-hardening head and found the two resolved items above; it was then re-run
against `1e377e32a` with the immutable base and path boundary.
