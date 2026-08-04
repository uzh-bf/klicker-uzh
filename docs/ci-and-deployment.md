---
type: Operations
title: CI & Deployment
description: PR gates, image builds, the standard-version release flow, Helm deployment reality, and what is NOT in this repo.
timestamp: '2026-08-03'
tags:
  - ci
  - deployment
---

# CI & Deployment

**The deploy driver is ArgoCD** (confirmed with maintainers; the ArgoCD `Application`/sync trigger itself lives outside this repo). What IS in-repo: the chart (`deploy/charts/klicker-uzh-v3/` — internally still named `klicker-uzh-v2`, chart version drifted behind the repo version), per-env values (`deploy/env-uzh-stg`, `deploy/env-uzh-prd`), Stakater **Reloader** annotations (`reloader.stakater.com/auto: "true"`) so config/secret changes restart pods, and an ArgoCD **PreSync migration hook** that runs `prisma migrate deploy` before each rollout — enabled on stg, still disabled on prd (see [Deployment migrations](#deployment-migrations)).

## PR gates

Per-commit workflows: `check-format`, `check-lint`, `check-syncpack`, `check-types` (which change-scopes package checking via Turbo), plus `check-knip` and `check-gitleaks`. The Node/pnpm workflows use pnpm 11.5.0, pin Node 24 via the root Volta configuration (`package.json`), and utilize the Turbo remote cache; `check-gitleaks` is a standalone secret scan that installs the Gitleaks binary directly and needs neither.

- **Path filtering**: A custom composite action `.github/actions/changed-paths` executes on PR events. Heavy test suites (e.g. `test-graphql` and `test-playwright`) run path-scoped filters to only build and spawn backing services (Postgres, Redis, Hatchet) when relevant files are changed. The action fetches the base ref shallowly **only when the clone is already shallow** — on a full clone a `--depth=1` fetch writes a shallow graft at the base ref, and for a stacked PR (whose base is an ancestor of HEAD) that truncates HEAD's own history, breaking `check-types`' `turbo --filter="...[origin/v3...HEAD]"` with `fatal: no merge base found`.
- **Required status contexts**: To safely mark path-filtered workflows as required in branch protection, they include dedicated status checkers (e.g. `test-graphql-status`, `test-playwright-status`) that always execute and fail-open.
- **Prisma Schema Drift**: A custom `check:prisma-sync` smoke check compares schema structures in the monorepo against mirrored schemas in `apps/analytics` to enforce database integrity.
- **Markdown Linter**: `check:agents-md` validates links and command script correctness inside the codebase guide.
- **Format + lint**: `check-format` runs Biome (code) + Prettier (Markdown/YAML and `playwright/`/`cypress/`) and is **blocking**. `check-lint` runs an **advisory** Biome lint step (non-blocking during the migration) before the blocking Turbo/ESLint pass (the Next.js safety net), plus `check:prisma-sync` and `check:agents-md`.
- **Unused code**: `check-knip` runs Knip **advisory** (non-blocking); ratchets to blocking once the per-workspace entry config is tuned.
- **Secret scanning**: `check-gitleaks` runs a **blocking** full-tree Gitleaks scan (`.gitleaks.toml`, default ruleset + false-positive allowlist); a local husky pre-commit hook scans staged changes when the binary is present.
- **Automation**: `claude-code-review.yml` auto-reviews every PR; `claude.yml` responds to @claude mentions; CodeQL (JS, weekly + PR) and SonarCloud run alongside — note that `sonar-project.properties` puts `packages/i18n/messages/**` in `sonar.cpd.exclusions`, because locale catalogs are parallel translations of one key structure and copy-paste detection reads that as duplication by construction, failing the new-code duplication gate on any string-heavy PR; the files stay in scope for every other rule, so do not remove the exclusion. Conventional commits per `.versionrc.js` (feat/enhance/fix/docs/refactor/…); PRs are squash-merged, so the PR title must be a valid conventional commit.

## Image builds

13 apps × stg + prd workflows (`v3_<app>-{stg,prd}.yml`), pushing to ghcr.io with separate `-arm`/`-amd` jobs:

- **stg**: push to `v3`/`v3*` or PR touching the app's paths (PRs build but don't push).
- **prd**: tags `v*.*.*` only.

Build context is the repo root with `file: apps/<app>/Dockerfile` — Dockerfile changes must keep monorepo-root context assumptions.

The five Next images (auth, chat, control, manage, PWA) consume Next's `.next/standalone` output. Auth and chat production builds use Turbopack. Control, manage, and PWA production builds explicitly use Webpack while `@ducanh2912/next-pwa` remains responsible for `sw.js`, Workbox chunks, and the custom worker bundle copied by their Dockerfiles. Before publishing a framework upgrade, run the mixed production build, inspect those artifacts, smoke the standalone server paths, and require both AMD and ARM image jobs. These are **config-derived** contracts until the corresponding command and CI check are recorded for the release SHA.

## Release flow

Version bumps are **local and manual** via standard-version: `pnpm run release[:alpha|:beta|:rc]` bumps the root plus ~20 package.jsons (`.versionrc.js`), writes the changelog, commits, and tags. Pushing the tag triggers the prd image builds; strict `vX.Y.Z` tags additionally create a GitHub Release (`release.yml`) — alpha tags build prd images without a Release. The Helm `Chart.yaml` auto-bump is commented out in `.versionrc.js`, which is why the chart version drifts.

**When bumping prd image tags** in `deploy/env-uzh-prd/values.yaml`: if the new tag is the first release whose CI built `backend-docker-migrator-arm`, set `migrator.enabled: true` in the same commit — that is what switches prd from manual migrations to the automatic hook. Conversely, rolling prd back to a tag from before this feature requires setting it to `false` again, or the hook fails on a missing image and blocks the sync.

## Deployment values (facts, not procedures)

- **stg** (`*.klicker.stg.df-app.ch`): workers ride the floating `v3` tag; releases tracked via a `rollout.klicker.uzh.ch/release` pod annotation.
- **prd** (`*.klicker.uzh.ch`): pinned version tags, `replicaCount: 2` for web/API services.
- **Secrets are external**: deployments reference `envFrom.secretRef` names, but the chart defines no `Secret` manifests — provision them out-of-band with matching names.
- **Rollout strategy**: use `RollingUpdate` in prd values; `Recreate` can leave a service with zero endpoints during slow image pulls (PDBs don't protect against Deployment-driven scale-downs). `maxUnavailable: 0` only for singletons.
- `deploy/compose*` are v2-era self-hoster examples; `deploy/scripts/rollout.sh` is a legacy manual `kubectl rollout restart`.

## Deployment migrations

`prisma migrate deploy` runs automatically as an ArgoCD **`PreSync` hook Job** (`deploy/charts/klicker-uzh-v3/templates/job-migrate.yaml`) before each stg rollout. **On prd the hook currently ships disabled** (`migrator.enabled: false`): no migrator image was built for the release tags prd is pinned to, so an enabled hook would fail on ImagePullBackOff and abort every prd sync. Until prd's tags reach the first migrator-bearing release, prd migrations are still applied by hand with `prisma:deploy:prod` — see [Release flow](#release-flow) and [Data & Migrations → Deployment migrations](./data-and-migrations.md#deployment-migrations). It runs a dedicated `backend-docker-migrator` image (`packages/prisma/Dockerfile`), CI-built in lockstep with `backend-docker` (`v3_backend-docker-{stg,prd}.yml`); its tag auto-tracks the backend tag (the chart defaults `migrator.image.tag` to `backendGraphql.image.tag`), so it always matches the app release with no separate per-env pin. A failed hook aborts the whole sync, so app Deployments in the main wave never start against an unmigrated DB. The hook uses **ArgoCD-native** annotations (`argocd.argoproj.io/hook: PreSync`), not Helm chart hooks — the two must not be mixed, because a single ArgoCD hook annotation makes ArgoCD ignore _all_ Helm-native hooks on the chart. Full details: [Data & Migrations → Deployment migrations](./data-and-migrations.md#deployment-migrations). Manual `pnpm --filter @klicker-uzh/prisma prisma:deploy:prod` remains a break-glass fallback only.

Why this shape (ArgoCD-native hook, dedicated migrator image, manual demoted to break-glass): [ADR-0001](./adr/0001-automate-db-migrations-via-argocd-presync-hook.md).

## Open questions (verify before documenting further)

Whether ArgoCD auto-syncs on git change or is synced manually, and the exact per-release image-tag bump/promotion trigger (the tag values in `deploy/env-uzh-{stg,prd}/values.yaml` are edited by hand today).
