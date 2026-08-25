# PRD-to-STG database refresh hardening

## Goal

Make the draft PRD-to-STG refresh workflow fail closed against the exact Klicker
databases and STG cluster, serialize destructive runs, prove that the ArgoCD
migrator uses the restored target, and leave an unambiguous recoverable state
after every injected failure.

## Non-goals

- Run another live PRD-to-STG refresh during implementation.
- Change Prisma models, GraphQL, application UI, auth, gamification, Hatchet
  behavior, or deployment manifests.
- Process or inspect any production rows or PII.
- Turn the manual operator workflow into a scheduled service.

## Domain and layer footprint

- Source snapshot: the exact read-only Klicker PRD database.
- Replacement target: the exact disposable Klicker STG database.
- Refresh run: one receipt-bound, lease-owning execution with explicit phases.
- Migration operation: the existing `app-klicker` ArgoCD `PreSync` hook, bound
  to its exact Application, destination namespace, image revision, and database
  Secret.
- Files: `util/backup/refresh-stg-from-prd.sh`, its fake-tool and disposable
  PostgreSQL tests, `util/backup/README.md`, and `docs/data-and-migrations.md`.

There is no application auth, UI, i18n, fixture, gamification, or application
async-workflow impact. Operator authority remains Infisical access plus narrowly
scoped STG Kubernetes RBAC.

## Safety design

1. Require the normalized PRD/STG host, port, database name, TLS mode, live
   `current_database()`, and server identity to match the configured contract.
2. Bind both Kubernetes contexts to the expected API server, `kube-system` UID,
   Argo Application UID, Argo namespace, destination namespace, and exact
   workload namespace allowlist.
3. Acquire and renew one expiring Kubernetes Lease before the long dump. Every
   destructive/state-changing phase verifies lease ownership; cleanup releases
   only the lease revision still owned by this run.
4. Capture the exact sorted Deployment set and original replicas once. Reject
   drift before mutation, track each scale transition, and compensate a partial
   pre-mutation scale failure.
5. Install a receipt-bound, app-scoped AppProject deny window before reset so
   manual and automated Argo syncs are rejected throughout reset/restore. Submit
   the owned sync after restore with a resource-version compare-and-swap.
6. Record explicit run phases. Cleanup is idempotent, reinstalls the deny window,
   drains Argo, and forces workloads to zero whenever the target was mutated.
   Record `cleanupIncomplete` and do not release the Lease when those invariants
   cannot all be proven.
7. Treat the Argo timeout as a monitoring escalation, not a terminal failure:
   do not scale or return while the owned operation remains non-terminal.
8. Read the migrator Secret without logging it, connect through that URL, and
   prove it reaches the same database/server identity as the restore target.
9. Fingerprint ordered Prisma migration names/checksums and bind post-sync
   evidence to the exact Argo revision plus a new migrator Job/Pod and executed
   immutable image digest.
10. Keep all receipts/dumps gitignored and free of connection URLs, row data,
    and secret values. Live execution requires an environment-approval
    reference and explicit outbound-isolation acknowledgement, both bound to
    the metadata receipts and refresh Lease.

## Test level and evidence

- Extend the fake-tool suite first for wrong database, wrong cluster/namespace,
  write-RBAC denial, Lease contention/loss, target-Secret mismatch, Argo soft
  timeout, metadata-read failure, partial scale failure, policy-restore failure,
  migration-history divergence, and exact workload-set drift.
- Add a disposable PostgreSQL integration test for the owner-safe reset SQL;
  skip with a clear reason when Docker/PostgreSQL is unavailable.
- Run `bash -n`, ShellCheck when available, the focused test suite,
  `pnpm run check:all`, and `pnpm run build`.
- No browser or UI evidence is applicable.
- Do not execute the live destructive path.

## Slices

1. Confirm the current cluster/Application/namespace contract and official Lease
   and Argo operation semantics.
2. Add identity, TLS, namespace, RBAC, and workload-set preflight guards.
3. Add the expiring run Lease and phase receipts.
4. Refactor scale, Argo monitoring, cleanup, and terminal receipt handling.
5. Add migrator-target and migration-history proof.
6. Resolve GitGuardian synthetic-credential findings without weakening scans.
7. Expand fake and disposable-PostgreSQL tests.
8. Update the runbook/wiki and complete exact-head verification.

## Progress

- [x] Production-readiness review triaged against exact head `300f1b5ea`.
- [x] GitGuardian findings confirmed as five synthetic PostgreSQL test URLs.
- [x] Current infrastructure identity contract recorded without secret values.
- [x] Safety guards and failure-state refactor implemented.
- [x] AppProject maintenance fence, atomic sync submission, cleanup-incomplete
      state, immutable migrator evidence, and terminal post-policy health proof
      implemented.
- [x] Refresh script and fake harness split into focused sub-1k-line modules.
- [x] Expanded fake suite passes all 32 cases; disposable PostgreSQL integration
      is added and skips locally when Docker is unavailable.
- [x] Operator and engineering documentation updated.
- [x] Full repository verification and independent exact-working-tree review
      complete.
- [x] Follow-up readiness review added governance gates, immutable checked-in
      target identities, and the post-success application smoke-test boundary.
