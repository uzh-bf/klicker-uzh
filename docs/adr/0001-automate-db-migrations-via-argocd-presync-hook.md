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

**Migrator image — dedicated vs reuse backend.** Chose a dedicated minimal image. The backend runtime image installs `pnpm i --prod --ignore-scripts` and copies only `packages/prisma/dist`, so it carries neither the Prisma CLI nor the migration engine and cannot run `migrate deploy`. A `--target migrator` stage off the backend build would inherit `--ignore-scripts` and still lack the engine binary. A standalone `node:alpine` + global `prisma@<pinned>` install (lifecycle scripts enabled) guarantees the engine is present.

## Consequences

- Migrations run while the **previous** app version is still live → every migration must be **backward-compatible (expand-contract)**; destructive/renaming changes are split across releases.
- The migrator image tag must be bumped in lockstep with the backend tag per release, and its pinned `prisma` version must track `packages/prisma`. Drift → engine/schema mismatch.
- A failed migration blocks the rollout by design; operators must watch the first releases.
- Adds one image (arm + amd) to build and push per release.
