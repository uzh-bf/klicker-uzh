# PRD-to-STG refresh readiness reconciliation

## Goal

Reconcile the hardened PRD-to-STG database refresh with current `v3` and the
useful governance requirements from stacked PR #5472, without regressing the
stronger modular safety implementation in PR #5465.

## Non-goals

- Execute another live PRD-to-STG refresh during implementation.
- Merge or retain the obsolete monolithic implementation from PR #5472.
- Copy, inspect, or sanitize production rows or personal data.
- Change Prisma, GraphQL, application auth, UI, i18n, gamification, Hatchet
  workflows, seeds, or deployment manifests.

## Domain and layer footprint

- **Refresh run:** one destructive, receipt-bound replacement of the exact
  Klicker STG PostgreSQL database from the exact Klicker PRD database.
- **Environment approval:** the recorded owner-approved ticket or ADR that
  authorizes raw PRD data in STG for this run.
- **Outbound isolation:** the operator's explicit acknowledgement that STG
  integrations are disabled, synthetic-only, or routed to approved sinks.
- **Target contract:** checked-in database, Infisical, Azure, Kubernetes, and
  ArgoCD identities that ambient environment variables cannot redefine.
- **Files:** `util/backup/refresh-stg-from-prd.sh`, its Kubernetes module and
  fake tests, the backup runbook, and `docs/data-and-migrations.md`.

Operator authority remains Infisical, Azure, and narrowly scoped Kubernetes
access. There is no application auth, UI, i18n, fixture, gamification, or new
async-workflow impact; the existing ArgoCD `PreSync` operation remains the only
asynchronous boundary.

## Safety design

1. Keep read-only preflight available without approval variables.
2. Require a bounded approval reference and explicit outbound-isolation
   acknowledgement before any live command or credential lookup.
3. Bind those values to `state.json`, `before.json`, `after.json`, and the
   refresh Lease; Lease ownership assertions also verify the binding.
4. Make production target identities checked-in read-only constants. Only
   mutable kubectl context aliases remain configurable, and live cluster UIDs,
   API server identity, namespaces, Application, AppProject, repository, and
   database metadata still prove the target.
5. Keep fresh Azure capacity metrics from PR #5465; do not port the weaker
   manually supplied free-storage value from PR #5472.
6. Treat script success as control-plane/database success. Require a separate
   operator check of the migrator logs, backend behavior, outbound isolation,
   and one isolated synthetic STG request before declaring STG usable.

## Test level and evidence

- Extend the fake Bash suite for missing approval, missing isolation, ambient
  target-override resistance, receipt/Lease governance binding, and the
  post-success operator reminder.
- Run `bash -n`, ShellCheck when available, the fake suite, the disposable
  PostgreSQL reset integration, `pnpm run check:all`, and `pnpm run build`.
- No browser evidence is applicable. Do not execute the destructive live path.

## Slices

1. Rebase #5465 onto current `v3` and preserve both migration documentation
   intents.
2. Add governance gates, immutable target constants, evidence binding, and
   regression coverage.
3. Update the operator runbook and engineering wiki with the post-refresh
   application verification boundary.
4. Run exact-head verification and a strict maintainability review.
5. Publish #5465, update its whole-branch PR description, and close #5472 as
   superseded with the selectively ported requirements recorded.

## Progress

- [x] Rebased both feature commits onto current `v3`.
- [x] Resolved migration documentation conflict without dropping either intent.
- [x] Governance and immutable-target changes implemented.
- [x] Focused verification completed with 36 fake cases; the disposable
      PostgreSQL test was skipped because Docker was unavailable.
- [x] Repository-wide `check:all` and build completed successfully.
- [x] Strict maintainability and public-history hygiene review completed.
- [x] PR #5465 prepared as the single reconciled change; PR #5472 is superseded.
