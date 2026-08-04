# 3. Promote to staging by writing the built commit into a release annotation

- **Status:** Accepted — 2026-08-04
- **Deciders:** @rschlaefli
- **Context:** [PR #5183](https://github.com/uzh-bf/klicker-uzh/pull/5183), [PR #5303](https://github.com/uzh-bf/klicker-uzh/pull/5303)

## Context

Staging pulls the floating `v3` image tag. A rebuild therefore leaves the rendered manifest byte-identical, ArgoCD detects no drift, and the new image sits in the registry until somebody restarts the pods by hand. Staging is the canary for everything merged since the prd-pinned tag, so "merged but not running" is the failure mode that matters most: [PR #5303](https://github.com/uzh-bf/klicker-uzh/pull/5303) was a regression that only production's tag pin had shielded, and it stayed unrolled on stg after merge with nothing signalling that.

The same blind spot already bit the PreSync migration hook of [ADR-0001](./0001-automate-db-migrations-via-argocd-presync-hook.md): ArgoCD excludes hook manifests from the OutOfSync comparison, so the hook only ran after a manual sync.

`deploy/env-uzh-stg/values.yaml` already carried a `rollout.klicker.uzh.ch/release` pod annotation, 15 times, with no automation and a value (`v3.4.0-alpha.64`) that had drifted far behind the code actually running. It is absent from prd, which needs no trigger because its pinned tags change on every release.

## Decision

Automate that annotation. `.github/workflows/deploy-stg-promote.yml` writes the built commit's short SHA into all 15 occurrences, which changes the pod template and so produces a genuine ArgoCD sync: PreSync migration hook first, then the pods roll.

Promotion is gated on **every** `v3_*-stg.yml` image build succeeding for that commit, with the required set derived from the workflow files present in the checkout rather than a hardcoded list. `skipped` is not treated as success. A rollout therefore cannot start against a half-published or stale `:v3`, and cannot run migrations from a stale migrator image.

The workflow publishes as an **auto-merging pull request**, not a direct push.

## Considered options

**Publish mechanism — direct push vs pull request.** `v3` restricts pushes (an empty user/team/app allowlist) and requires 8 status checks, and the repository has no ruleset bypass actor. Granting the Actions bot a bypass would weaken the branch's protection for every workflow holding `contents: write`, not just this one. The PR route works within the existing protection: the promotion touches only `deploy/**`, so `Build Fallback` reports `build-amd`/`build-arm` in seconds and the remaining checks are the fast unconditional ones. The cost is a bot PR per merge and a dependency on `secrets.STG_PROMOTE_TOKEN`, because a PR opened with the default `GITHUB_TOKEN` does not trigger workflows and would never satisfy its own required checks.

**Trigger — `workflow_run` fan-in vs restructuring the 13 builds into one workflow.** Chose `workflow_run` with a gate that re-evaluates on every build completion, so the last build to finish is the one that proceeds. Idempotent, and it leaves the 13 existing workflows untouched.

**Write mechanism — `sed` vs `yq`.** Chose `sed` with a before/after count assertion. The values file carries comments and hand-chosen quote styles that a `yq` round-trip reflows. The annotation values were pre-quoted in the same change: an unquoted all-digit short SHA parses as a YAML integer and Kubernetes rejects a non-string annotation value.

**Rejected — ArgoCD Image Updater.** Purpose-built and digest-aware, so it would solve provenance too, but it adds a cluster component plus repository write credentials to watch 15 images for a single environment whose trigger mechanism already existed.

**Rejected — CI calling the ArgoCD API directly.** Not GitOps, and it would require cluster credentials in CI plus network reachability the cluster does not offer.

## Consequences

All 15 components roll on every merge to `v3`, including the Hatchet workers. The workers' SDK drains in-flight tasks on `SIGTERM` and their tasks declare retries, but the chart sets no `terminationGracePeriodSeconds` and no `preStop`, and both worker Dockerfiles use shell-form `CMD`, so signal delivery is not guaranteed. This is pre-existing and applies equally to every manual sync today; automation only changes how often it happens. Hardening it is tracked separately.

A failed migration now blocks the entire staging rollout automatically rather than only when someone syncs by hand. That is the intended behaviour from ADR-0001, but it makes a bad migration a stop-the-world event on stg.

The annotation records which commit **triggered** the rollout, not which bits are in the image. Two merges minutes apart cancel the first build and `:v3` then holds the later images. Immutable per-commit image tags would close that gap and are the natural successor to this decision.

Turning it off is `gh workflow disable "Promote to stg"`: no commit, effective immediately, and the failure mode is the status quo ante — staging simply stops updating itself.
