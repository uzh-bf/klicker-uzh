# Audit stack: v3-audit integration review

Date: 2026-09-10. Base: `v3-audit` at
`352f47fd7443d93aa5720e863d6285b801cceebe`. All five local layers were rebased
with native `gh stack rebase`. No merge or deployment was performed.

## Verdict

Conflicts are resolved locally, but the full stack is **not review-ready yet**.
The findings and verification gaps below must not be represented as a green
production or merge gate. Publication has not been performed in this turn.

## Conflict resolutions and follow-up fixes

- Kept upstream KB design documents in their original locations; Git's inferred
  directory rename was restricted to the actual audit design document.
- Preserved KB workflow gates, terminal-result settlement, shared worker
  lifecycle/draining, generated-element support, and backend CI coverage.
- Integrated audit identity/role selection into the upstream workflow-selection
  module. Dedicated audit workers do not require unused KB configuration.
- Consolidated duplicate Azurite services/volumes. Blob uploads and audit Table
  conformance retain their distinct public emulator accounts in one service.
- Preserved both upstream Node runtime-mode tests and audit Vitest tests without
  running either suite through the wrong runner.
- Added the exact-client disposable PostgreSQL guard to audit outbox, monitor,
  submission-materialization, activation, and rollout fixtures, including
  destructive cleanup paths.
- Changed audit Helm probes to shared-runtime port 8001, readiness `/readyz`,
  liveness `/healthz`, and a 90-second termination grace period. Port 9464 remains
  the metrics endpoint. Staging values remain disabled and unchanged.

## Standards review

Two independent read-only review passes were used. The standards recheck
accepted the database-guard, worker-probe, and test-runner fixes. The main review
also found and fixed missing guards in the GraphQL activation/rollout suites.

One source finding remains: **P2 — unbounded media-reference accumulation**.
`packages/graphql/src/services/assessmentAudit.ts:activeAssessmentMediaReferences`
collects every unique reference in a Map before yielding. Pagination does not
bound the retained Map, contrary to the documented streaming claim; the
media-policy worker has a 256 MiB limit. Use bounded streaming/deduplication and
verify shared-media retention horizons and hash-conflict handling. This was not
changed as part of conflict resolution.

The following pre-existing history issue blocks the new CI identity gate:
three audit commits still use `CI fixture <ci@example.invalid>` as author:
`493c4c1dd` (finalize implementation), `7764ae830` (launch readiness), and
`576ebbf3d` (evidence coverage). Correct attribution needs confirmation; the
review did not silently assign these historical commits to another person.

## Spec review

The independent spec pass found no additional confirmed P1/P2 issue in the
inspected Stack 1 atomicity, delivery, idempotency, and role-selection paths.
This is not exhaustive proof. Deferred Stack 2 browser capture was not counted
as a missing Stack 1 requirement. Staging image selection, Azure identities,
endpoints, export verification, and pilot operations remain deployment gates.

## Verification

Commands ran in the existing `default-fe-00142-app-1` container unless noted.
No additional development runtime was started.

| Check | Result |
| --- | --- |
| Frozen dependency install | Passed, pnpm 11.5.0; container Git hook metadata unavailable |
| Scoped Turbo build: audit, GraphQL, general worker, response processor, Response API and dependencies | 12/12 tasks succeeded; GraphQL Rollup emitted Pothos type warnings |
| Scoped typechecks for those five packages | Passed; GraphQL required `NODE_OPTIONS=--max-old-space-size=4096` after default-heap OOM |
| Audit suite excluding outbox/monitor PostgreSQL integration | 92 passed, including two Azurite Table conformance tests |
| General worker selection | 22 passed, including 12 new identity/role cases |
| Response processor Node runtime-mode suite | 3 passed |
| Response processor helper and synthetic Redis aggregation suites | 26 passed |
| Response API | 11 passed |
| GraphQL baseline and producer snapshot suites | 10 passed |
| Syncpack | Passed after resolving script ordering |
| Scoped Biome, Prettier, conflict-marker and whitespace checks | Passed; existing banned-type warning remains |
| Compose config, host Helm rendering with synthetic enabled audit values | Passed; both deployments render shared-runtime probes and 90-second grace |
| GraphQL generated schema | No tracked diff |

Total: **164 distinct passing tests**. Repeated runs are not double-counted.

### Failed or incomplete gates

- `check:all` fails because this retained container cannot access host worktree
  Git metadata, and its host-Devrouter planner test cannot find an executable
  host Devrouter. It is not reported as passing.
- The existing PostgreSQL database fails the disposable identity guard. No
  reset, migration, or marker override was performed. PostgreSQL-backed audit
  suites require a freshly provisioned disposable environment.
- A mistakenly classified rollout spec was attempted before its missing guard
  was discovered. All three fixture inserts failed on the outdated schema
  (`User.aiFeaturesEnabled` missing). Its cleanup targeted its generated UUIDs.
  The spec is not counted as passing; guards were then added to setup/cleanup
  and further database-backed execution was stopped.
- No fresh remote CI, full production frontend build, full browser E2E, or live
  Azure identity/immutability/load test was completed. Existing remote checks
  describe the old heads, not this rebase.
- Trusted Playwright build control still comes from `v3`; its artifact list
  lacks `packages/audit/dist`. The separate prerequisite PR remains necessary.
- Verification above covers the integrated tip. Additional fixes are at the
  tip; independent intermediate-layer CI and reviews remain outstanding.

## Next steps

1. Confirm correct attribution for the three fixture-authored commits and
   repair the outgoing history without changing another person's authorship.
2. Address bounded media-policy enumeration with regression coverage.
3. Propagate applicable verification fixes to their owning layers; verify each
   layer, publish with safe leases, and inspect fresh CI.
4. Provision an explicitly approved disposable test environment and run the
   PostgreSQL suites, then complete staging and browser gates before release.
