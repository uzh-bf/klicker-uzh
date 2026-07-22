---
type: Operations
title: CI & Deployment
description: PR gates, image builds, the standard-version release flow, Helm deployment reality, and what is NOT in this repo.
timestamp: '2026-07-22'
tags:
  - ci
  - deployment
---

# CI & Deployment

**What is NOT in this repo: the deploy trigger.** There are no ArgoCD/Flux manifests; deployment is `helm upgrade` driven from outside the repository (mechanism undocumented here — ask a maintainer before making deploy claims). What IS in-repo: the chart (`deploy/charts/klicker-uzh-v3/` — internally still named `klicker-uzh-v2`, chart version drifted behind the repo version), per-env values (`deploy/env-uzh-stg`, `deploy/env-uzh-prd`), and Stakater **Reloader** annotations (`reloader.stakater.com/auto: "true"`) so config/secret changes restart pods.

## PR gates

Per-commit workflows: `check-format`, `check-lint`, `check-syncpack`, `check-types` (which change-scopes package checking via Turbo). All use pnpm 11.5.0, pin Node 24 via the root Volta configuration (`package.json`), and utilize the Turbo remote cache.

- **Path filtering**: A custom composite action `.github/actions/changed-paths` executes on PR events. Heavy test suites (e.g. `test-graphql` and `test-playwright`) run path-scoped filters to only build and spawn backing services (Postgres, Redis, Hatchet) when relevant files are changed.
- **Required status contexts**: To safely mark path-filtered workflows as required in branch protection, they include dedicated status checkers (e.g. `test-graphql-status`, `test-playwright-status`) that always execute and fail-open.
- **Worker readiness**: Import/export CI treats the general worker's `http://127.0.0.1:8081/ready` endpoint as the registration boundary. GraphQL uses a bounded retry before Vitest, and Playwright includes it in `SERVICE_ENDPOINTS`; process existence alone does not prove Hatchet workflows are registered.
- **Prisma Schema Drift**: A custom `check:prisma-sync` smoke check compares schema structures in the monorepo against mirrored schemas in `apps/analytics` to enforce database integrity.
- **Markdown Linter**: `check:agents-md` validates links and command script correctness inside the codebase guide.
- **Automation**: `claude-code-review.yml` auto-reviews every PR; `claude.yml` responds to @claude mentions; CodeQL (JS, weekly + PR) and SonarCloud run alongside. `knip` is manual only. Conventional commits per `.versionrc.js` (feat/enhance/fix/docs/refactor/…); PRs are squash-merged, so the PR title must be a valid conventional commit.

## Image builds

13 apps × stg + prd workflows (`v3_<app>-{stg,prd}.yml`), pushing to ghcr.io with separate `-arm`/`-amd` jobs:

- **stg**: push to `v3`/`v3*` or PR touching the app's paths (PRs build but don't push).
- **prd**: tags `v*.*.*` only.

Build context is the repo root with `file: apps/<app>/Dockerfile` — Dockerfile changes must keep monorepo-root context assumptions.

## Release flow

Version bumps are **local and manual** via standard-version: `pnpm run release[:alpha|:beta|:rc]` bumps the root plus ~20 package.jsons (`.versionrc.js`), writes the changelog, commits, and tags. Pushing the tag triggers the prd image builds; strict `vX.Y.Z` tags additionally create a GitHub Release (`release.yml`) — alpha tags build prd images without a Release. The Helm `Chart.yaml` auto-bump is commented out in `.versionrc.js`, which is why the chart version drifts.

## Deployment values (facts, not procedures)

- **stg** (`*.klicker.stg.df-app.ch`): workers ride the floating `v3` tag; releases tracked via a `rollout.klicker.uzh.ch/release` pod annotation.
- **prd** (`*.klicker.uzh.ch`): pinned version tags, `replicaCount: 2` for web/API services.
- **Secrets are external**: deployments reference `envFrom.secretRef` names, but the chart defines no `Secret` manifests — provision them out-of-band with matching names.
- **Import/export is fail-closed**: absent `IMPORT_EXPORT_ENABLED=true`, user operations and Manage entry points stay disabled. Keep the gate dark throughout deployment. Backend/Manage compatibility is directional: the new backend accepts both legacy and finalization-aware media-upload operations, but the previous backend cannot execute the new Manage upload/finalization operations. A single Helm upgrade that changes both images is therefore prohibited for this release. Roll the new backend completely while pinning the previous Manage image, verify every backend pod and the legacy upload path, then roll Manage while keeping the new backend pinned. Rollback uses the reverse order: previous Manage first, then previous backend. Legacy media-upload operations remain unmarked and authorable only while dark, new Manage explicitly requests server finalization, and an enabled backend rejects a legacy upload client before creating storage state. Pending/cleanup lifecycle markers are hidden and forbidden in authoring in either state. Assessment mode hard-disables the feature. The normal general-worker `HATCHET_WORKFLOWS` value must include `refreshImportExportFingerprints`, `repairImportExportFingerprints`, and `cleanupImportExportPackages`; startup rejects a production allowlist missing any required maintenance key. The v3 chart default includes all three, while assessment workers reject them. Target chart values, external secrets, worker allowlists, scheduled-repair health, and staged enablement still require operator review and evidence under the production runbook; do not infer readiness from the application gate alone.
- **Rollout strategy**: use `RollingUpdate` in prd values; `Recreate` can leave a service with zero endpoints during slow image pulls (PDBs don't protect against Deployment-driven scale-downs). `maxUnavailable: 0` only for singletons.
- `deploy/compose*` are v2-era self-hoster examples; `deploy/scripts/rollout.sh` is a legacy manual `kubectl rollout restart`.

## Database migrations

Deployment images and Helm charts do not run Prisma migrations. The repository exposes production-only import/export aliases and a local media → didactic → invariant backfill wrapper for one environment `DATABASE_URL`, but no workflow approves or orchestrates inspect/deploy/reinspect. Assessment mode remains disabled and is not an import/export operations target. A named DBA/release owner, approved runner and reviewer boundary, backup/PITR proof, previous-image smoke, and the external Helm executor remain required. The backend boot-time `Migration` runner is a separate data-fix mechanism and does not apply Prisma migrations.

Import/export must remain gated off while its additive migration, backfills, deferred-constraint validation, and infrastructure preflight execute. [Data & Migrations](./data-and-migrations.md#importexport-additive-migration) contains the target audit and large-table paths; the [Import/Export Production Runbook](./import-export-production-runbook.md) contains the operator-controlled sequence, exact operation aliases, evidence schema, and rollback posture. Every owner/evidence field left `TBD` remains a release blocker.

## Open questions (verify before documenting further)

Who owns and invokes the existing manual Prisma deployment aliases and `helm upgrade`, in what order, and where their evidence is stored remains undiscoverable in-repo.
