# Assessment audit stack — local review-readiness verification

Date: 2026-09-07. Base: `b40bda462546a47faeefafadf14a34cdf2d32a32`
on `feat/assessment-audit-submissions`.

## Status

The fixes below are local and uncommitted. The published five-layer stack is
not yet cleared for review: restacking, publication, and fresh CI remain pending.
No PR was merged and no cluster was changed.

An independent source review found no remaining confirmed P1/P2 issues in the
repaired paths. This is not a guarantee that the entire feature is defect-free,
nor production approval.

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
| Audit and shared types builds | Passed |
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

1. Obtain approval to commit, restack, and push. Keep fixes with their owning
   layers and resolve the lower-layer conflicts against current `v3` using the
   native stack workflow. Re-run checks after conflict resolution.
2. Land the Playwright artifact prerequisite through a reviewed change to
   trusted `v3`. PR workflows consume trusted CI control; changing the candidate
   artifact list alone cannot repair the running PR workflow.
3. Publish the stack, update PR verification summaries, and inspect fresh CI.
4. Before launch, deploy matching Response API/processor contracts, drain legacy
   queued commands without execution bindings, and complete the documented
   staging owner-export, Azure identity/immutability, full browser, and load gates.
