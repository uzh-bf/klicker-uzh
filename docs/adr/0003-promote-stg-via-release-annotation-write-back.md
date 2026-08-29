# 3. Promote to staging by writing the built commit into a release annotation

- **Status:** Accepted — 2026-08-04
- **Deciders:** @rschlaefli
- **Context:** [PR #5183](https://github.com/uzh-bf/klicker-uzh/pull/5183), [PR #5303](https://github.com/uzh-bf/klicker-uzh/pull/5303)

## Context

Staging pulls the floating image tag selected by the `STG_SOURCE_BRANCH` repository variable (the committed values currently use `v3-ai`; unset defaults to `v3`). A rebuild therefore leaves the rendered manifest byte-identical, ArgoCD detects no drift, and the new image sits in the registry until somebody restarts the pods by hand. Staging is the canary for everything merged since the prd-pinned tag, so "merged but not running" is the failure mode that matters most: [PR #5303](https://github.com/uzh-bf/klicker-uzh/pull/5303) was a regression that only production's tag pin had shielded, and it stayed unrolled on stg after merge with nothing signalling that.

The deployment values and promotion pull request must remain on the branch selected by `STG_SOURCE_BRANCH`. The external ArgoCD application currently tracks `v3-ai`, so writing the promotion to `v3` is invisible to staging even when the image builds and pull request succeed.

The same blind spot already bit the PreSync migration hook of [ADR-0001](./0001-automate-db-migrations-via-argocd-presync-hook.md): ArgoCD excludes hook manifests from the OutOfSync comparison, so the hook only ran after a manual sync.

`deploy/env-uzh-stg/values.yaml` already carried `rollout.klicker.uzh.ch/release` pod annotations with no automation and a value (`v3.4.0-alpha.64`) that had drifted far behind the code actually running. The annotation is absent from prd, which needs no trigger because its pinned tags change on every release.

## Decision

Automate that annotation. `.github/workflows/deploy-stg-promote.yml` writes the built commit's short SHA into every discovered occurrence on the selected source branch, which changes the pod template and so produces a genuine ArgoCD sync: PreSync migration hook first, then the pods roll.

Promotion is gated on **every** `v3_*-stg.yml` image build succeeding for the selected source commit, with the required set derived from the workflow files present in the checkout rather than a hardcoded list. `skipped` is not treated as success. A rollout therefore cannot start against a half-published or stale source tag, and cannot run migrations from a stale migrator image.

The workflow publishes through a **workflow-owned pull request** to the selected source branch, not a direct push. It requires both image-tag and rollout-annotation inventories to be non-empty, replaces every discovered entry, and proves the independent before/after counts. Promotion control is fetched from the trusted workflow SHA, while the source checkout persists no write credential. The workflow retires every older promotion pull request without suppressing errors, waits for the exact generated-promotion verification status, binds that status to the unchanged pull-request head, and uses the synchronous merge endpoint after a final live pause check. It never requests queueing; a repository-policy rejection fails closed instead of leaving an asynchronous merge armed.

The repository variable `STG_PROMOTION_PAUSED` is an explicit release-window
interlock. The promoter checks it before its gates and reads it again through
the repository API immediately before every external write. It never leaves
auto-merge armed on a generated pull request. Values are strict: lowercase
`true` pauses, while lowercase `false` or an unset variable permits promotion;
any other value or an unreadable API response fails closed. Because a variable
change cannot retract an API request that GitHub has already accepted, the
operator also cancels active promoter runs, disables auto-merge if armed, and
closes every open promotion pull request before declaring the pause effective.

## Considered options

**Publish mechanism — direct push vs pull request.** The pull request route preserves review and generated-content verification across both protected and unprotected source branches. The cost is a bot pull request per merge and a dependency on `secrets.STG_PROMOTE_TOKEN`, because a pull request opened with the default `GITHUB_TOKEN` does not trigger workflows and would never receive its generated-promotion status.

**Trigger — `workflow_run` fan-in vs restructuring the builds into one workflow.** Chose `workflow_run` with a gate that re-evaluates on every declared build completion, so the last build to finish is the one that proceeds. The verification inventory is derived from `v3_*-stg.yml`; the trigger names remain explicit because GitHub Actions requires workflow names in the event declaration. Adding a staging build therefore requires adding its workflow name to the trigger list, but no workload-count assertion.

**Write mechanism — `sed` vs `yq`.** Chose `sed` with a before/after count assertion. The values file carries comments and hand-chosen quote styles that a `yq` round-trip reflows. The annotation values were pre-quoted in the same change: an unquoted all-digit short SHA parses as a YAML integer and Kubernetes rejects a non-string annotation value.

**Rejected — ArgoCD Image Updater.** Purpose-built and digest-aware, so it would solve provenance too, but it adds a cluster component plus repository write credentials for a single environment whose trigger mechanism already existed.

**Rejected — CI calling the ArgoCD API directly.** Not GitOps, and it would require cluster credentials in CI plus network reachability the cluster does not offer.

## Consequences

Each promoted source commit produces a **second** commit on the selected source branch. When that branch uses strict required status checks, every other open pull request is knocked out of date again by the promotion commit. A promotion pull request that is itself overtaken becomes unmergeable and self-heals only when the next promotion supersedes it.

The required set is derived from the `v3_*-stg.yml` files, which includes `v3_analytics-stg.yml` — and `analytics` has **no** Deployment in the chart. A failed analytics image build therefore blocks the staging rollout of components that do not depend on it. Accepted deliberately: a hardcoded exception would rot when the staging build inventory changes, and the failure is visible in the promoter's run log.

The selected source branch must require current heads rather than a merge queue. The synchronous merge request supplies its exact verified head SHA and `[skip ci]` commit title, so `squash_merge_commit_title` is not load-bearing. The guard additionally refuses any commit whose subject starts with `chore(deploy): promote `, so an unexpected title-policy change still degrades to wasted rebuilds rather than an unbounded promotion loop.

Every workload carrying the rollout annotation rolls on each promoted commit from the selected source branch, including the Hatchet workers. The workers' SDK drains in-flight tasks on `SIGTERM` and their tasks declare retries, but the chart sets no `terminationGracePeriodSeconds` and no `preStop`, and both worker Dockerfiles use shell-form `CMD`, so signal delivery is not guaranteed. This is pre-existing and applies equally to every manual sync today; automation only changes how often it happens. Hardening it is tracked separately.

GitHub loads `workflow_run` from the default branch, and the promoter rejects a manual dispatch whose workflow ref is not that default branch. A correction merged only to a non-default selected source is therefore not executable. Existing build runs keep the promoter definition they started with and need a separately authorized post-build promotion after the correction is active on `v3`.

A failed migration now blocks the entire staging rollout automatically rather than only when someone syncs by hand. That is the intended behaviour from ADR-0001, but it makes a bad migration a stop-the-world event on stg.

The annotation records which commit **triggered** the rollout, not which bits are in the image. Two merges minutes apart cancel the first build and the selected source tag then holds the later images. Immutable per-commit image tags would close that gap and are the natural successor to this decision.

Turning it off is `gh workflow disable "Promote to stg"`: no commit, effective immediately, and the failure mode is the status quo ante — staging simply stops updating itself.
