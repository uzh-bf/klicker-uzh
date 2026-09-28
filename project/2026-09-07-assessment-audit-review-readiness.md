# Assessment audit stack — local review-readiness verification

Date: 2026-09-07. Verified code: `93e4bee81c4d063efcabf73ea24b4a527ed942cd`
on `feat/assessment-audit-submissions`, rebased onto `origin/v3` at `27f247454`.

## Status

The fixes below are committed and all five layers have been restacked using the
native stack workflow. Publication is authorized; fresh CI and independent
per-layer reviews remain required. All PRs remain draft. No PR was merged and
no cluster was changed.

An independent source review found no remaining confirmed P1/P2 issues in the
repaired paths. This is not a guarantee that the entire feature is defect-free,
nor production approval. A separate read-only rebase review found no confirmed
regression in the workflow, dependency, or course-transaction conflict resolutions.
The upstream course-deletion guard and feature-flags dependency are preserved.

## Repaired paths

- Owner exports cross-check retention and locator inventories, distinguish
  missing entities from provider errors, and enforce exact participant scope.
- Coverage requires matching activation/baseline IDs and lifecycle epochs.
  Duplicate-root conflicts and other verification failures cannot become a
  successful coverage claim.
- Activation reservations satisfy database baseline constraints. Media renewal
  pagination uses only the fields in its composite cursor.
- Submission persistence requires active participation and the signed block
  execution. PostgreSQL, not only Redis, enforces start/closure boundaries.
- Hatchet retries remain in their original accepted lifecycle. Completed old
  commands do not recreate reset responses; pending old commands get terminal
  rejection. Post-commit failures receive idempotent recovery evidence.
- Reset captures deleted responses inside the transaction after taking the
  quiz lock shared with response persistence. Redis aggregation atomically
  rejects commands for stale executions.
- Monitoring requires a terminal outcome per Hatchet command, not just per
  submission UUID.
- Type/format errors and invalid integration fixtures were corrected. The
  Playwright artifact list now includes `packages/audit/dist` locally.

## Verification

Executed against the isolated local PostgreSQL, Redis, and pinned Azurite
services; no production data or credentials were used.

| Check | Result |
| --- | --- |
| `pnpm --filter @klicker-uzh/audit test` | 104 passed, 22 files |
| `pnpm --filter @klicker-uzh/hatchet-worker-response-processor test` | 52 passed, 3 files |
| `pnpm --filter @klicker-uzh/response-api test` | 11 passed, 1 file |
| GraphQL audit activation, baseline, rollout, and producer specs | 19 passed, 4 files |
| GraphQL `assessmentRestrictions.test.ts` | 4 passed, 1 file |
| Audit, processor, Response API checks; GraphQL `check:ts` | Passed |
| Scoped Turbo build: audit, GraphQL, general worker, response processor, Response API and dependencies | Passed after rebase |
| Biome checks on 20 changed TypeScript files | No errors; existing warnings remain |
| Prettier checks and `git diff --check` | Passed |

Total: **190 passing tests**. Database-constraint error logs in negative tests
are expected. The legacy assessment-restrictions suite initially failed because
it hardcodes loopback Redis ports; temporary in-container proxies to the same
isolated Redis services resolved this without changing the tests. Its media
renewal scheduling warnings mean live Hatchet scheduling was not demonstrated.

The full `check:all` run was blocked by inaccessible container Git metadata.
The full production build was blocked by host dependency symlinks pointing
outside the container filesystem root. These runs are not reported as passing.
No full browser E2E or live Azure RBAC/conformance run was completed here.

## Required delivery follow-up

1. Inspect fresh CI for all five rebased layers. Local results above verify the
   integrated stack tip, not each intermediate layer independently. The final
   review-hardening fixes remain in layer 5; earlier-layer historical results
   are not substituted for current CI.
2. Land the Playwright artifact prerequisite through a reviewed change to
   trusted `v3`. PR workflows consume trusted CI control; changing the candidate
   artifact list alone cannot repair the running PR workflow.
3. Complete independent per-layer reviews; retain draft status until the recorded
   review and verification gates are satisfied.
4. Before launch, deploy matching Response API/processor contracts, drain legacy
   queued commands without execution bindings, and complete the documented
   staging owner-export, Azure identity/immutability, full browser, and load gates.
