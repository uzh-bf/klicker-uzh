# 1. Automate database migrations via an ArgoCD PreSync hook

- **Status:** Accepted — 2026-07-18
- **Deciders:** @rschlaefli
- **Context:** [PR #5183](https://github.com/uzh-bf/klicker-uzh/pull/5183)

## Context

Prisma schema migrations were applied by hand before each release (`prisma:deploy:prod` from a workstation). That is easy to forget and races the rollout: a new backend image can boot against a database that has not been migrated. The careers/elearning projects on the same DF-cloud ArgoCD already solve this with a PreSync migration Job.

## Decision

Run `prisma migrate deploy` as an **ArgoCD-native `PreSync` hook Job** (`deploy/charts/klicker-uzh-v3/templates/job-migrate.yaml`), from a **dedicated migrator image** (`packages/prisma/Dockerfile`) built in CI in lockstep with `backend-docker`. A failed hook aborts the whole sync, so app Deployments never start against an unmigrated database. The chart accepts an optional release-wide `global.imageTag`; when present, it takes precedence for the migrator and every first-party application image. The manual `prisma:deploy:prod` path is kept as documented break-glass.

## Considered options

**Hook flavor — ArgoCD-native vs Helm-native.** Chose ArgoCD-native (`argocd.argoproj.io/hook: PreSync`). A single ArgoCD hook annotation makes ArgoCD ignore _all_ Helm-native (`helm.sh/hook`) hooks on the chart; ArgoCD-native also gives explicit `sync-wave` ordering and avoids Helm's pre-install+pre-upgrade double-run semantics. Mirrors the reference projects on the same ArgoCD.

**Migrator image — dedicated vs reuse backend.** Chose a dedicated minimal image. The backend runtime image installs `pnpm i --prod --ignore-scripts` and copies only `packages/prisma/dist`, so it carries neither the Prisma CLI nor the migration engine and cannot run `migrate deploy`. A `--target migrator` stage off the backend build would inherit `--ignore-scripts` and still lack the engine binary. A standalone `node:alpine` + local `prisma@<pinned>` install (lifecycle scripts enabled) guarantees the engine is present; the install must be local, not global, because `prisma.config.ts` imports `prisma/config`, which only resolves from the image's own `node_modules`.

## Consequences

- Migrations run while the **previous** app version is still live → every migration must be **backward-compatible (expand-contract)**; destructive/renaming changes are split across releases.
- Without `global.imageTag`, the migrator image **tag** resolves from `migrator.image.tag`, then `.Values.backendGraphql.image.tag`, then the chart app version, so each environment pins only the migrator **repository** (`…-migrator-arm`) and never a separate tag. Phase 1 staging requires ArgoCD to resolve `stg-release` and pass `$ARGOCD_APP_REVISION` as a forced string in `global.imageTag`; the migration hook and all application images therefore use the same exact source revision. Production receives no global override and keeps the hand-edited release tags in `deploy/env-uzh-prd/values.yaml`.
- A full-SHA tag is still mutable registry metadata. The trusted staging controller records the canonical registry digest for every required image before advancing `stg-release`; after sync, the migration pod's deployed `imageID` digest must match that receipt. The ArgoCD resolved revision proves the tag source, while the receipt proves image content.
- The migrator's pinned `prisma` version must still track the `packages/prisma` devDependency. Drift → engine/schema mismatch. This materialised once before merge: the Prisma 7 upgrade (#5185) landed on `v3` while this branch still pinned `prisma@6.16.1` and shipped no `prisma.config.ts` — the image would have had no datasource URL at all, and every CI/image/review gate passed it anyway because only a real `migrate deploy` run exercises the connection. Consequence: any Prisma major on `v3` must re-verify the migrator by actually running it, not by building it.
- A failed migration blocks the rollout by design; operators must watch the first releases. Nothing alerts on hook failure today — detection is whoever is looking at ArgoCD. Recovery is not automatic either: a failed migration leaves partial DDL plus a `P3009` marker, and `migrate resolve` fixes only the bookkeeping. Runbook: [Data & Migrations → Recovering a failed migration hook](../data-and-migrations.md#recovering-a-failed-migration-hook).
- Hook Job cleanup uses `BeforeHookCreation` only: successful Jobs persist until the next sync instead of being deleted immediately on success, because deleting a succeeded Job whose status/finalizer update was still in flight deadlocked the running sync (upstream argoproj/argo-cd #24187 / #27507; stg incident 2026-08-22). Completed Jobs therefore linger in the namespace until the following sync.
- Tag coupling has a bootstrap and rollback edge: a release tag predating this feature has no migrator image, so the hook renders an unpullable image and fails the sync. Production kept `migrator.enabled: false` until its pinned tags reached the first release built with the migrator, and a rollback to a pre-hook tag must disable it again. Staging may select only an exact revision with a complete migrator digest receipt and a schema-compatible rollback path.
- Originally added one image for both ARM and AMD to build and push per release. As of 2026-08-25, CI publishes only the ARM migrator image; the retained AMD job is skipped to preserve its required status context.
