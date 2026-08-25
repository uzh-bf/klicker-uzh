# Alpha.71 production rollout plan

## Goal

Promote every Klicker production workload from `v3.4.0-alpha.70` to
`v3.4.0-alpha.71` through the repository's existing GitOps path, run the two
pending expand-only Prisma migrations through the ArgoCD PreSync hook, and
prove the exact deployed revision without exposing production data or secrets.

## Research

- `origin/v3` is `5ffc6a6d2bc4b12f6f38b5119718a7545e039256` after the
  2026-08-25 freshness check. The primary checkout has unrelated work, so this
  package uses `trees/rs/deploy-roll-prd-alpha71` on
  `rs/deploy-roll-prd-alpha71`.
- The latest matching release is the annotated tag `v3.4.0-alpha.71`, resolving
  to `09257efb71027d478ed2c418fd007a60900b34ea`. It is an ancestor of
  `origin/v3`; `origin/v3` is 16 commits ahead.
- All 13 production image workflows for the tag succeeded. Backend workflow
  run `32778022445` successfully built the ARM and AMD application and migrator
  images.
- Production values contain 15 `v3.4.0-alpha.70` image pins, no mixed release,
  and `migrator.enabled: true`.
- The release adds two generated migrations: three nullable text columns on
  `Participation`, and one non-unique concurrent index on
  `ParticipantInvitation`. Both are expand-only and compatible with the
  currently running application. Application rollback leaves this schema
  safely ahead; it does not reverse either migration.
- `docs/ci-and-deployment.md` and `docs/data-and-migrations.md` still describe
  the production migration hook as disabled. Production enabled it with the
  first migrator-bearing release, so the rollout package must correct both
  pages.
- The task worktree's authoritative `origin/v3` content already contains the
  corrected wiki-maintenance skill and explicitly forbids recreating the retired
  `docs/index.md`, `docs/log.md`, and `docs/log/` paths. The dirty primary
  checkout has an older copy; it is outside this package and remains untouched.
- The read-only planner returned `DONE_WITH_CONCERNS`. The plan accepts its
  corrections: separate local, publication, and production gates; remove the
  stale authority claim; and add clean-Argo, backup/recovery,
  registry-manifest, rollback, and exact live-proof gates.

## Decision

- Use one production-rollout PR based on fresh `origin/v3`.
- Replace exactly the 15 production image pins with
  `v3.4.0-alpha.71`. Keep `migrator.enabled: true` and every unrelated value
  unchanged.
- Correct only the stale production-migrator statements in the two deployment
  wiki pages. No skill, ADR, chart, schema, migration, dependency, application
  code, index, log, archive, or navigation-structure changes belong in this
  package.
- Treat the package as full path because merging it executes production
  database migrations. The implementation stays in the main session because
  production GitOps state, publication, and live proof are tightly coupled.

## Authority

- Approved by the user on 2026-08-25: commit the plan and scoped changes in the
  isolated worktree; push `rs/deploy-roll-prd-alpha71`; open a non-draft PR to
  `v3`; wait for required CI; perform values-free read-only registry and
  managed-backup preflight; squash-merge after every gate passes; allow the
  existing ArgoCD auto-sync; and use already-configured, read-only production
  ArgoCD and Kubernetes access for migration-job, workload-image, revision,
  readiness, and public-health proof.
- Withheld: secret values, production data, manual database migration, manual
  ArgoCD sync, retry or replay, rollback, force push, branch/worktree cleanup,
  establishing new cluster connectivity or a tunnel, and any unrelated
  production mutation.

## Terminal

Complete only when the PR is merged, ArgoCD reports the merged `v3` revision
synced and healthy, the alpha.71 migration hook completed successfully, all
production workloads report the alpha.71 images ready, and public status-only
probes match the healthy baseline. Desired-state merge alone is not live
completion.

## Pause

Stop without retrying, syncing manually, or rolling back if the release target
changes, an image or backup/recovery gate fails, required CI or review fails,
ArgoCD is not clean before merge, existing production connectivity is
unavailable, auto-sync does not start, the migration hook fails, a workload
does not become ready, or a public probe regresses. Present the exact sanitized
failure and request the smallest next authority.

## Delegation map

| Slice | Owner | Dependency | Acceptance |
| --- | --- | --- | --- |
| Prepare the rollout package and correct operator guidance | main | Corrected plan approved for local work | Only the plan, 15 production pins, and two operator docs; retired wiki paths remain absent; scoped formatting, Helm, diff, and review checks pass |
| Publish and qualify the PR | main | Prepared committed package and approved publication | Release, migrations, registry manifests, final review, required PR CI, and PR scope pass; stop before merge if production gates are not green |
| Preflight, merge, and prove production | main | Qualified PR and approved production action | Backup/recovery and clean-Argo gates pass; exact revision, migration hook, images, readiness, and public probes are proven |

Execution-tier skip reason: critical-path coupling across production GitOps
state, migration safety, publication, and live verification.

## Slice 1: Prepare the rollout package and correct operator guidance

Problem:

- Production remains pinned to alpha.70 although alpha.71 images are built and
  the matching release is the latest alpha.71 tag.

Risk:

- Merge triggers the ArgoCD PreSync migration hook before application rollout.
  A hook failure blocks the sync and requires diagnosis; no automatic rollback
  or schema reversal is safe.

Do:

- Replace exactly 15 alpha.70 image pins in
  `deploy/env-uzh-prd/values.yaml` with alpha.71.
- Preserve `migrator.enabled: true` and every unrelated production value.
- Correct the stale production-migrator descriptions in
  `docs/ci-and-deployment.md` and `docs/data-and-migrations.md`.

Check:

- Require 15 alpha.71 pins, zero alpha.70 pins, unchanged migrator enablement,
  only the planned files, `git diff --check`, repository formatting for the
  touched YAML/Markdown, successful Helm lint/template for production, and no
  retired wiki paths.
- Test obligation: no new automated test. Existing chart rendering, release CI,
  PR CI, migration inspection, and live status checks cover this configuration
  promotion.
- Commit the plan first after approval. Commit the rollout as
  `chore(deploy): roll production apps to alpha.71`.
- Skip the simplifier because the implementation is a mechanical pin and prose
  correction. Run one slice reviewer over the committed rollout for migration,
  rollback, backup, GitOps, and wiki-contract risks. Resolve or block on every
  finding before publication.

Commit:

- Plan: `docs(project): plan alpha.71 production rollout`
- Rollout: `chore(deploy): roll production apps to alpha.71`

## Slice 2: Publish and qualify the PR

Do:

- Revalidate the target tag and ancestry, all 13 production image workflows,
  all four backend/migrator jobs, both migration files, and the required
  registry manifests and immutable digests.
- Run fresh scoped verification and one integrated final reviewer over the
  complete committed range. Resolve or explicitly block on every finding.
- Push the branch, open a non-draft PR to `v3`, name the isolated production
  rollout floor exemption and substantive size, and wait for all required CI.

Check:

- Confirm the PR contains only the approved package, targets `v3`, and remains
  independently reviewable and safe to land.
- Require all applicable required checks and reviews to pass. Stop before merge
  if any production preflight gate remains unresolved.

## Slice 3: Preflight, merge, and prove production

Do:

- Record a current values-free public-health baseline. Confirm managed
  PostgreSQL backup/recovery readiness without reading secret values or database
  content.
- Confirm ArgoCD is synced and healthy at the pre-merge revision with no
  operation in progress. Use only already-configured connectivity.
- Squash-merge only after the review, CI, image, migration, and backup gates are
  green. Merge is the trigger for existing ArgoCD auto-sync; do not invoke a
  manual sync.
- Read back the merged `origin/v3`, ArgoCD revision and health, migration Job,
  ready workload image tags, and the public ingress probes.

Check:

- Require the exact merged revision to be synced and healthy, the alpha.71
  migration hook to have completed successfully, all production workloads to
  report alpha.71 images ready, and post-rollout public probes to match the
  baseline.

## Rollback contract

If post-merge health regresses, stop and request fresh authority for a new PR
that restores all 15 image pins to alpha.70. Keep the migrator enabled because
alpha.70 has matching migrator images. Do not attempt to reverse the additive
schema changes; diagnose or roll forward separately.

## Progress

- [x] Resolve exact target release and current desired state.
- [x] Verify production image build evidence and inspect migrations.
- [x] Complete planner review and integrate its accepted findings.
- [x] Obtain plan and named external-action approval.
- [ ] Record baseline public health.
- [x] Commit the plan and implement the scoped rollout.
- [ ] Verify, review, publish, and pass PR CI.
- [ ] Confirm backup/recovery readiness and merge.
- [ ] Prove ArgoCD, migration, workload image, and public health state.
