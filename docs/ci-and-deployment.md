---
type: Operations
title: CI & Deployment
description: PR gates, image builds, the standard-version release flow, Helm deployment reality, and what is NOT in this repo.
timestamp: '2026-08-24'
tags:
  - ci
  - deployment
---

# CI & Deployment

**The deploy driver is ArgoCD** (confirmed with maintainers; the ArgoCD `Application`/sync trigger itself lives outside this repo). What IS in-repo: the chart (`deploy/charts/klicker-uzh-v3/` — internally still named `klicker-uzh-v2`, chart version drifted behind the repo version), per-env values (`deploy/env-uzh-stg`, `deploy/env-uzh-prd`), Stakater **Reloader** annotations (`reloader.stakater.com/auto: "true"`) so config/secret changes restart pods, and an ArgoCD **PreSync migration hook** that runs `prisma migrate deploy` before each rollout — enabled on stg, still disabled on prd (see [Deployment migrations](#deployment-migrations)).

## PR gates

Per-commit workflows: `check` (consolidated check job combining format, lint, syncpack, types, knip) and `check-gitleaks`. During transition, the original five check workflows (`check-format`, `check-lint`, `check-syncpack`, `check-types`, `check-knip`) land alongside `check` until branch protection required checks swap to `check`. The Node/pnpm workflows use pnpm 11.5.0, pin Node 24 via the root Volta configuration (`package.json`), and utilize the Turbo remote cache; `check-gitleaks` is a standalone secret scan that installs the Gitleaks binary directly and needs neither.

- **Path filtering**: A custom composite action `.github/actions/changed-paths` executes on PR events. Heavy test suites (e.g. `test-graphql` and `test-playwright`) run path-scoped filters to only build and spawn backing services (Postgres, Redis, Hatchet) when relevant files are changed. The action fetches the base ref shallowly **only when the clone is already shallow** — on a full clone a `--depth=1` fetch writes a shallow graft at the base ref, and for a stacked PR (whose base is an ancestor of HEAD) that truncates HEAD's own history, breaking `check-types`' `turbo --filter="...[origin/v3...HEAD]"` with `fatal: no merge base found`.
- **Required status contexts**: To safely mark path-filtered workflows as required in branch protection, they include dedicated status checkers (e.g. `test-graphql-status`, `test-playwright-status`) that always execute and fail-open. They fail open for two distinct cases: a dependency **skipped** by the path filter, and a dependency **cancelled** by `cancel-in-progress`. The second matters because a push that produces two `pull_request` events seconds apart (an atomic multi-branch push, or a quick re-push) starts two runs of the same workflow; the older is cancelled, and without the explicit `cancelled` guard its gate concluded `failure` and left a red check on the PR that only a manual re-run cleared.
- **Prisma Schema Drift**: A custom `check:prisma-sync` smoke check compares schema structures in the monorepo against mirrored schemas in `apps/analytics` to enforce database integrity.
- **Markdown Linter**: `check:agents-md` validates links and command script correctness inside the codebase guide.
- **Format + lint**: `check-format` runs Biome (code) + Prettier (Markdown/YAML and `playwright/`) and is **blocking**. `check-lint` runs an **advisory** Biome lint step (non-blocking during the migration) before the blocking Turbo/ESLint pass (the Next.js safety net), plus `check:prisma-sync` and `check:agents-md`.
- **Unused code**: `check-knip` runs Knip **advisory** (non-blocking); ratchets to blocking once the per-workspace entry config is tuned.
- **Secret scanning**: `check-gitleaks` runs a **blocking** Gitleaks scan of commits introduced by the push or pull request (`.gitleaks.toml`, default ruleset + false-positive allowlist). For a branch-creation push, where GitHub supplies an all-zero `before` SHA, it fetches the repository default branch and scans from its merge base to the new tip; it fails closed when the default branch or merge base cannot be resolved. The configured push trigger covers `v3` and `v3*`; other branch names are covered when a pull request is opened or updated. A local husky pre-commit hook scans staged changes when the binary is present.
- **Automation**: `claude-code-review.yml` auto-reviews every PR; `claude.yml` responds to @claude mentions; CodeQL (JS, weekly + PR) and SonarCloud run alongside — note that `sonar-project.properties` puts `packages/i18n/messages/**` in `sonar.cpd.exclusions`, because locale catalogs are parallel translations of one key structure and copy-paste detection reads that as duplication by construction, failing the new-code duplication gate on any string-heavy PR; the files stay in scope for every other rule, so do not remove the exclusion. Conventional commits per `.versionrc.js` (feat/enhance/fix/docs/refactor/…); PRs are squash-merged, so the PR title must be a valid conventional commit.

## Image builds

13 apps × stg + prd workflows (`v3_<app>-{stg,prd}.yml`), pushing to ghcr.io with separate `-arm`/`-amd` jobs:

- **stg**: push to `v3`/`v3*` or PR touching the app's paths (PRs build but don't push).
- **prd**: tags `v*.*.*` only.

Build context is the repo root with `file: apps/<app>/Dockerfile` — Dockerfile changes must keep monorepo-root context assumptions.

The five Next images (auth, chat, control, manage, PWA) consume Next's `.next/standalone` output. Auth and chat production builds use Turbopack. Control, manage, and PWA production builds explicitly use Webpack while `@ducanh2912/next-pwa` remains responsible for `sw.js`, Workbox chunks, and the custom worker bundle copied by their Dockerfiles. Before publishing a framework upgrade, run the mixed production build, inspect those artifacts, smoke the standalone server paths, and require both AMD and ARM image jobs. These are **config-derived** contracts until the corresponding command and CI check are recorded for the release SHA.

The same five images receive browser GrowthBook configuration at build time.
Staging workflows use the repository variables
`NEXT_PUBLIC_GROWTHBOOK_API_HOST_STG` and
`NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY_STG`; production workflows use the matching
`_PRD` names. These values are deliberately GitHub Actions variables rather than
secrets because every `NEXT_PUBLIC_*` value is embedded in public browser
assets. The Dockerfiles declare and export matching build arguments before the
Next build. See [Feature Flags](./feature-flags.md) for the complete runtime and
operator contract.

## Release flow

Version bumps are **local and manual** via standard-version: `pnpm run release[:alpha|:beta|:rc]` bumps the root plus ~20 package.jsons (`.versionrc.js`), writes the changelog, commits, and tags. Pushing the tag triggers the prd image builds; strict `vX.Y.Z` tags additionally create a GitHub Release (`release.yml`) — alpha tags build prd images without a Release. The Helm `Chart.yaml` auto-bump is commented out in `.versionrc.js`, which is why the chart version drifts.

**When bumping prd image tags** in `deploy/env-uzh-prd/values.yaml`: if the new tag is the first release whose CI built `backend-docker-migrator-arm`, set `migrator.enabled: true` in the same commit — that is what switches prd from manual migrations to the automatic hook. Conversely, rolling prd back to a tag from before this feature requires setting it to `false` again, or the hook fails on a missing image and blocks the sync.

## Deployment values (facts, not procedures)

- **stg** (`*.klicker.stg.df-app.ch`): everything rides the floating image tag selected by the `STG_SOURCE_BRANCH` repository variable (currently `v3-ai`), so the rendered manifest never changes on a rebuild and ArgoCD would never sync on its own. The in-repo staging values and promotion PR remain on `v3`; the promotion workflow aligns the image tags with the selected branch. The `rollout.klicker.uzh.ch/release` pod annotation is what makes it move — see [Staging promotion](#staging-promotion) below.
- **prd** (`*.klicker.uzh.ch`): pinned version tags, `replicaCount: 2` for web/API services.
- **Secrets are external**: deployments reference `envFrom.secretRef` names, but the chart defines no `Secret` manifests — provision them out-of-band with matching names. GrowthBook-ready Node workloads also reference the optional shared `<rendered-chart-fullname>-secret-growthbook`, which supplies only `GROWTHBOOK_API_HOST` and the server SDK `GROWTHBOOK_CLIENT_KEY`; `GROWTHBOOK_ENV` comes from the global ConfigMap. Separately, only the primary GraphQL backend references optional `<rendered-chart-fullname>-secret-growthbook-management`, containing `GROWTHBOOK_MANAGEMENT_API_URL` and `GROWTHBOOK_MANAGEMENT_API_KEY` for a future authenticated control-plane integration. The optional references preserve startup before provisioning. Do not place the write-capable management key in the shared evaluator Secret.
- **Hatchet endpoint pair**: `hatchet.client.apiUrl` in the environment values renders `HATCHET_API_URL`, while the external secret supplies `HATCHET_CLIENT_HOST_PORT`. They must resolve to the same Hatchet installation; worker health alone does not validate programmatic schedule creation over the HTTP API. Staging uses `app-hatchet-svc-api.stg-hatchet-svc.svc.cluster.local:8080`, and production uses `app-hatchet-svc-api.prd-hatchet-svc.svc.cluster.local:8080` (see [Async & Workers](./async-and-workers.md)).
- **Rollout strategy**: use `RollingUpdate` in prd values; `Recreate` can leave a service with zero endpoints during slow image pulls (PDBs don't protect against Deployment-driven scale-downs). `maxUnavailable: 0` only for singletons.
- `deploy/compose*` are v2-era self-hoster examples; `deploy/scripts/rollout.sh` is a legacy manual `kubectl rollout restart`.

## Deployment migrations

`prisma migrate deploy` runs automatically as an ArgoCD **`PreSync` hook Job** (`deploy/charts/klicker-uzh-v3/templates/job-migrate.yaml`) before each stg rollout. **On prd the hook currently ships disabled** (`migrator.enabled: false`): no migrator image was built for the release tags prd is pinned to, so an enabled hook would fail on ImagePullBackOff and abort every prd sync. Until prd's tags reach the first migrator-bearing release, prd migrations are still applied by hand with `prisma:deploy:prod` — see [Release flow](#release-flow) and [Data & Migrations → Deployment migrations](./data-and-migrations.md#deployment-migrations). It runs a dedicated `backend-docker-migrator` image (`packages/prisma/Dockerfile`), CI-built in lockstep with `backend-docker` (`v3_backend-docker-{stg,prd}.yml`); its tag auto-tracks the backend tag (the chart defaults `migrator.image.tag` to `backendGraphql.image.tag`), so it always matches the app release with no separate per-env pin. A failed hook aborts the whole sync, so app Deployments in the main wave never start against an unmigrated DB. The hook uses **ArgoCD-native** annotations (`argocd.argoproj.io/hook: PreSync`), not Helm chart hooks — the two must not be mixed, because a single ArgoCD hook annotation makes ArgoCD ignore _all_ Helm-native hooks on the chart. Full details: [Data & Migrations → Deployment migrations](./data-and-migrations.md#deployment-migrations). Manual `pnpm --filter @klicker-uzh/prisma prisma:deploy:prod` remains a break-glass fallback only.

Why this shape (ArgoCD-native hook, dedicated migrator image, manual demoted to break-glass): [ADR-0001](./adr/0001-automate-db-migrations-via-argocd-presync-hook.md).

## Staging promotion

**ArgoCD auto-syncs on git change** (prune + selfHeal, app `app-klicker`), but only when the _rendered manifest_ differs. Two things therefore do **not** trigger a sync, and both have bitten us:

- **A rebuilt floating tag.** stg pulls the selected source tag (currently `:v3-ai`), so a new image leaves the Deployment spec byte-identical. `pullPolicy: Always` means a restart _would_ pick it up, but nothing asks for a restart.
- **A hook-only change.** ArgoCD excludes hook manifests from the OutOfSync comparison, so a commit touching only the PreSync migration Job shows as "Synced" at the new revision with the hook never executed (this is why the hook in [ADR-0001](./adr/0001-automate-db-migrations-via-argocd-presync-hook.md) needed one manual sync to fire the first time).

The `rollout.klicker.uzh.ch/release` annotation exists to break that tie: it lands in the **pod template**, so changing it is a real manifest change. It appears 15 times in `deploy/env-uzh-stg/values.yaml` and zero times in prd, which needs no such trigger because its pinned tags change on every release.

`.github/workflows/deploy-stg-promote.yml` reads `STG_SOURCE_BRANCH`, aligns all 15 image tags with that branch, and writes the built commit's short SHA once **every** `v3_*-stg.yml` image build for the selected commit has succeeded — so a rollout can never start against a half-published source tag, and the PreSync migration hook always runs before the new pods. It publishes as an auto-merging PR rather than a direct push, because `v3` restricts pushes and requires 8 status checks with no bypass actor; the PR touches only `deploy/**`, so `Build Fallback` supplies `build-amd`/`build-arm` in seconds. `[skip ci]` in the PR title keeps the squash-merge from re-running the 13 builds and re-firing the promoter.

Operational notes.

- Set the repository variable `STG_SOURCE_BRANCH` to select the active supported `v3*` branch; it currently falls back to `v3-ai` when unset. A new successful image build on that branch triggers reconciliation. If the selected commit is already built and no new push will occur, also dispatch this promoter with that commit SHA and `dry_run=false`. The branch name must be a Docker-safe image tag because the build workflows publish branch-name tags.
- It needs `secrets.STG_PROMOTE_TOKEN`, an **admin-owned PAT** with `contents: write` + `pull-requests: write`. Two independent reasons it cannot be the default `GITHUB_TOKEN` or a plain App token: a PR opened with `GITHUB_TOKEN` does not trigger workflows, so its required checks never report and auto-merge never fires; and `v3`'s push restrictions carry an _empty_ user/team/app allowlist, which only repository admins bypass.
- Two settings outside this repo are load-bearing. `squash_merge_commit_title` must stay `PR_TITLE`, or the `[skip ci]` marker never reaches the squash commit and every promotion rebuilds all 13 images. The workflow does not rely on it alone — the guard also refuses to promote any commit whose subject starts with `chore(deploy): promote ` — but the belt is worth keeping. Auto-merge must be enabled on the repository.
- The annotation records which commit _triggered_ the rollout, not which bits are in the image: two merges minutes apart cancel the first build (`cancel-in-progress: true`) and the selected source tag then holds the later images. Immutable per-commit tags are the fix if that ever matters.

Rationale and rejected alternatives: [ADR-0003](./adr/0003-promote-stg-via-release-annotation-write-back.md).

Prd is unaffected — it promotes by hand-editing pinned tags in `deploy/env-uzh-prd/values.yaml`.
