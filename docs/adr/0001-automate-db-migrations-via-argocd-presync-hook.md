# 1. Automate database migrations via an ArgoCD PreSync hook

- **Status:** Accepted — 2026-07-18
- **Deciders:** @rschlaefli
- **Context:** [PR #5183](https://github.com/uzh-bf/klicker-uzh/pull/5183)

## Context

Prisma schema migrations were applied by hand before each release (`prisma:deploy:prod` from a workstation). That is easy to forget and races the rollout: a new backend image can boot against a database that has not been migrated. The careers/elearning projects on the same DF-cloud ArgoCD already solve this with a PreSync migration Job.

## Decision

Run `prisma migrate deploy` as an **ArgoCD-native `PreSync` hook Job** (`deploy/charts/klicker-uzh-v3/templates/job-migrate.yaml`), from a **dedicated migrator image** (`packages/prisma/Dockerfile`) built in CI in lockstep with `backend-docker`. A failed hook aborts the whole sync, so app Deployments never start against an unmigrated database. The manual `prisma:deploy:prod` path is kept as documented break-glass.

## Considered options

**Hook flavor — ArgoCD-native vs Helm-native.** Chose ArgoCD-native (`argocd.argoproj.io/hook: PreSync`). A single ArgoCD hook annotation makes ArgoCD ignore _all_ Helm-native (`helm.sh/hook`) hooks on the chart; ArgoCD-native also gives explicit `sync-wave` ordering and avoids Helm's pre-install+pre-upgrade double-run semantics. Mirrors the reference projects on the same ArgoCD.

**Migrator image — dedicated vs reuse backend.** Chose a dedicated minimal image. The backend runtime image installs `pnpm i --prod --ignore-scripts` and copies only `packages/prisma/dist`, so it carries neither the Prisma CLI nor the migration engine and cannot run `migrate deploy`. A `--target migrator` stage off the backend build would inherit `--ignore-scripts` and still lack the engine binary. A standalone `node:alpine` + local `prisma@<pinned>` install (lifecycle scripts enabled) guarantees the engine is present; the install must be local, not global, because `prisma.config.ts` imports `prisma/config`, which only resolves from the image's own `node_modules`.

## Consequences

- Migrations run while the **previous** app version is still live → every migration must be **backward-compatible (expand-contract)**; destructive/renaming changes are split across releases.
- The migrator image **tag** auto-tracks the backend tag: `job-migrate.yaml` defaults `migrator.image.tag` to `.Values.backendGraphql.image.tag`, so each env pins only the migrator **repository** (`…-migrator-arm`) and never a separate tag. Nothing in the release procedure auto-bumps image tags in `deploy/env-uzh-*/values.yaml` (they are hand-edited), so coupling removes a manual step and the drift it invites.
- The migrator's pinned `prisma` version must still track the `packages/prisma` devDependency. Drift → engine/schema mismatch. This materialised once before merge: the Prisma 7 upgrade (#5185) landed on `v3` while this branch still pinned `prisma@6.16.1` and shipped no `prisma.config.ts` — the image would have had no datasource URL at all, and every CI/image/review gate passed it anyway because only a real `migrate deploy` run exercises the connection. Consequence: any Prisma major on `v3` must re-verify the migrator by actually running it, not by building it.
- A failed migration blocks the rollout by design; operators must watch the first releases. Nothing alerts on hook failure today — detection is whoever is looking at ArgoCD. Recovery is not automatic either: a failed migration leaves partial DDL plus a `P3009` marker, and `migrate resolve` fixes only the bookkeeping. Runbook: [Data & Migrations → Recovering a failed migration hook](../data-and-migrations.md#recovering-a-failed-migration-hook).
- Tag coupling has a bootstrap and rollback edge: a release tag predating this feature has no migrator image, so the hook renders an unpullable image and fails the sync. prd therefore ships with `migrator.enabled: false` until its pinned tags reach the first release built with the migrator, and a rollback to a pre-hook tag must disable it again. Stg's floating `v3` tag is rebuilt on every merge and is unaffected.
- Adds one image (arm + amd) to build and push per release.
