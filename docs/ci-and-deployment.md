---
type: Operations
title: CI & Deployment
description: PR gates, image builds, the standard-version release flow, Helm deployment reality, and what is NOT in this repo.
timestamp: '2026-08-31'
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
- **Prisma Schema Drift**: A custom `check:prisma-sync` smoke check compares schema structures in the monorepo against mirrored schemas in `apps/analytics` to enforce database integrity.
- **Markdown Linter**: `check:agents-md` validates links and command script correctness inside the codebase guide.
- **Automation**: `claude-code-review.yml` auto-reviews every PR; `claude.yml` responds to @claude mentions; CodeQL (JS, weekly + PR) and SonarCloud run alongside. `knip` is manual only. Conventional commits per `.versionrc.js` (feat/enhance/fix/docs/refactor/…); PRs are squash-merged, so the PR title must be a valid conventional commit.

## Image builds

13 apps × stg + prd workflows (`v3_<app>-{stg,prd}.yml`), pushing to ghcr.io with separate `-arm`/`-amd` jobs:

- **stg**: push to `v3`/`v3*` or PR touching the app's paths (PRs build but don't push).
- **prd**: tags `v*.*.*` only.

Build context is the repo root with `file: apps/<app>/Dockerfile` — Dockerfile changes must keep monorepo-root context assumptions.

The five Next images (auth, chat, control, manage, PWA) consume Next's `.next/standalone` output. Auth and chat production builds use Turbopack. Control, manage, and PWA production builds explicitly use Webpack while `@ducanh2912/next-pwa` remains responsible for `sw.js`, Workbox chunks, and the custom worker bundle copied by their Dockerfiles. Before publishing a framework upgrade, run the mixed production build, inspect those artifacts, smoke the standalone server paths, and require both AMD and ARM image jobs. These are **config-derived** contracts until the corresponding command and CI check are recorded for the release SHA.

## Release flow

Version bumps are **local and manual** via standard-version: `pnpm run release[:alpha|:beta|:rc]` bumps the root plus ~20 package.jsons (`.versionrc.js`), writes the changelog, commits, and tags. Pushing the tag triggers the prd image builds; strict `vX.Y.Z` tags additionally create a GitHub Release (`release.yml`) — alpha tags build prd images without a Release. The Helm `Chart.yaml` auto-bump is commented out in `.versionrc.js`, which is why the chart version drifts.

## Deployment values (facts, not procedures)

- **stg** (`*.klicker.stg.df-app.ch`): workers ride the floating `v3` tag; releases tracked via a `rollout.klicker.uzh.ch/release` pod annotation.
- **prd** (`*.klicker.uzh.ch`): pinned version tags, `replicaCount: 2` for web/API services.
- **Secrets are external**: deployments reference `envFrom.secretRef` names, but the chart defines no `Secret` manifests — provision them out-of-band with matching names.
- **CodeAPI integration**: the staging values target `http://codeapi-api-klicker-test.codeapi.svc.cluster.local:3112` and enable the narrowly scoped Kubernetes-service HTTP exception. The v2 chart emits the five `CODEAPI_JWT_*` signing settings into the backend and worker Secrets; the v3 chart keeps those keys in its existing externally managed backend/worker Secrets. Provision the same issuer, audience, tenant, private key, and key ID that correspond to the CodeAPI verifier JWKS. No CodeAPI or Klicker cluster resource is changed by this repository configuration alone.
- **Rollout strategy**: use `RollingUpdate` in prd values; `Recreate` can leave a service with zero endpoints during slow image pulls (PDBs don't protect against Deployment-driven scale-downs). `maxUnavailable: 0` only for singletons.
- `deploy/compose*` are v2-era self-hoster examples; `deploy/scripts/rollout.sh` is a legacy manual `kubectl rollout restart`.

## Open questions (verify before documenting further)

Who/what runs `helm upgrade` on tag push, and where `prisma migrate deploy` is invoked during deployment — neither is discoverable in-repo.
