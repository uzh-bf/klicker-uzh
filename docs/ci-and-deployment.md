---
type: Operations
title: CI & Deployment
description: PR gates, image builds, the standard-version release flow, Helm deployment reality, and what is NOT in this repo.
timestamp: '2026-07-07'
tags:
  - ci
  - deployment
---

# CI & Deployment

**What is NOT in this repo: the deploy trigger.** There are no ArgoCD/Flux manifests; deployment is `helm upgrade` driven from outside the repository (mechanism undocumented here — ask a maintainer before making deploy claims). What IS in-repo: the chart (`deploy/charts/klicker-uzh-v3/` — internally still named `klicker-uzh-v2`, chart version drifted behind the repo version), per-env values (`deploy/env-uzh-stg`, `deploy/env-uzh-prd`), and Stakater **Reloader** annotations (`reloader.stakater.com/auto: "true"`) so config/secret changes restart pods.

## PR gates

Per-commit workflows: `check-format`, `check-lint`, `check-syncpack`, `check-types` (the last builds packages in dependency order before `pnpm run check`). All use pnpm 11.5.0 and the Turbo remote cache. Test workflows: see [Testing](./testing.md). Extra automation: `claude-code-review.yml` auto-reviews every PR; `claude.yml` responds to @claude mentions; CodeQL (JS, weekly + PR) and SonarCloud run alongside. `knip` exists as a manual script only — dead-code drift is not CI-enforced. Conventional commits per `.versionrc.js` (feat/enhance/fix/docs/refactor/…); PRs are squash-merged, so the PR title must be a valid conventional commit.

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
- **Rollout strategy**: use `RollingUpdate` in prd values; `Recreate` can leave a service with zero endpoints during slow image pulls (PDBs don't protect against Deployment-driven scale-downs). `maxUnavailable: 0` only for singletons.
- `deploy/compose*` are v2-era self-hoster examples; `deploy/scripts/rollout.sh` is a legacy manual `kubectl rollout restart`.

## Open questions (verify before documenting further)

Who/what runs `helm upgrade` on tag push, and where `prisma migrate deploy` is invoked during deployment — neither is discoverable in-repo.
