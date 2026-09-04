# Promote immutable staging revisions without deployment commits

## Goal

Reuse the images built for each selected staging-source commit, make ArgoCD
deploy that exact commit without a deployment commit or pull request, and keep
production on its existing release-tag flow.

## Research

- `Current staging source:` The repository variable `STG_SOURCE_BRANCH`
  selects `v3-ai`. The normal source is `v3`.
- `Current promotion:` The default-branch workflow waits for staging builds,
  updates 16 rollout annotations, creates a pull request, and triggers another
  round of CI.
- `Image builds:` The selected source contains 15 staging workflow files with
  32 Docker metadata/build pairs. They already produce the images needed by
  the chart, so deployment must not build them again.
- `Chart:` The chart contains 18 first-party image expressions, including the
  PreSync migrator. Staging pulls images with `Always`; production values use
  release tags.
- `Argo value origin:` Staging ArgoCD will track `stg-release`, resolve that
  ref to a Git commit revision, substitute `$ARGOCD_APP_REVISION` into the
  forced-string Helm parameter `global.imageTag`, and render all first-party
  images with that commit SHA.
- `External dependency:` The platform's Argo Application helper does not yet
  pass Helm parameters through. Its compatibility fix and parameter support
  must be delivered before the private platform adoption can be finalized.
- `Branch policy:` The current release-candidate ADR still describes the old
  two-sided branch switch and promoter bypass. It needs a narrow amendment that
  preserves the release-candidate, clean-schema, merge-hold, and forward-only
  migration decisions.

## Decision

1. Every selected-source staging build keeps its branch and pull-request tags
   and adds the full source commit SHA in the same existing build/push action.
2. Active push builds treat the SHA tag as publish-once. If it already exists,
   the workflow records its digest and skips that image's build/push path.
3. A trusted default-branch controller waits for every required exact-SHA image,
   records a canonical registry-digest receipt, and advances
   `refs/heads/stg-release` without a commit or pull request.
4. Automatic promotion permits initial creation or fast-forward only. Equal and
   stale candidates are no-ops; divergence and concurrent compare-and-swap
   races fail without force.
5. Staging ArgoCD tracks `stg-release` and injects its resolved commit as
   `global.imageTag`. Production remains on `v3`, receives no global image
   parameter, and keeps release tags.
6. The rollout annotations and old promotion credential remain available for a
   stability window. Their cleanup is a separate task.

## Authority

- `Granted after approval:` Create or reuse phase-1 task worktrees, edit the
  named paths, run repository-native checks and independent reviews, and make
  local conventional commits.
- `Withheld:` Push, pull/merge request creation or updates, merge, upstream
  integration, source freeze, repository setting or secret changes,
  `stg-release` creation or movement, registry inspection, platform preview or
  apply, ArgoCD or cluster access, deployment, live verification, cleanup, and
  branch or worktree deletion.
- `External boundary:` Private platform adoption starts only after the helper
  is delivered and its exact reachable merged revision is known. It gets a
  separate private plan and separate delivery/operations authority.

## Delegation map

| Slice | Owner and exclusive write set | Dependency | Acceptance |
| --- | --- | --- | --- |
| Platform helper compatibility and Helm parameters | Helper executor in a separate private worktree; helper Argo types/builders/tests and its branch-local plan only | Parameter support follows baseline reconciliation | The current helper baseline retains the existing compatibility fix, passes Helm parameters for single and multi-source Applications, and passes its full build/test suite |
| Default controller and default-branch docs | Controller executor in a `v3` worktree; promoter workflow/script/tests, final-review policy/tests/workflow, affected ADRs, CI guide, and branch-local plan | Current `origin/v3` | Trusted-code-only promotion, digest receipt, remote-race protection, ordinary final-review policy, and amended ADR contracts pass focused tests |
| Selected-source images, chart, runtime mirror, and docs | Selected-source executor in the `v3-ai` worktree; mirrored controller/final-review files, 15 staging workflows, chart/tests, affected ADRs and guides, and branch-local plan | Reviewed default runtime contract and helper parameter shape | Runtime files match the default candidate, SHA tags are publish-once, all 18 images consume the override, and no-override staging/production renders stay identical |
| Integration and review | Main session; review reports and evidence only | All local commits | Every finding is dispositioned, each branch passes required reviews, and the cross-repository contract matrix passes |

Executors preserve unrelated work, write only inside their assigned physical
worktree, and do not publish or mutate remote state.

## Phase 1 implementation

### S0 — Reconcile the platform helper baseline

- Start from the current authoritative helper branch.
- Retain the existing two-line ClickHouse chart-type compatibility correction
  while preserving the accepted current helper baseline.
- Classify the complete old-pin-to-candidate delta and reject any additional
  task-introduced change.
- Run helper build/tests, inspect the exact diff, and commit the compatibility
  result locally before parameter work.

### S1 — Pass Helm parameters through the helper

- Extend the Helm source type with parameter objects containing `name`, `value`,
  and optional `forceString`.
- Pass parameters through both single-source and multi-source Application
  builders.
- Test omitted parameters for exact backward compatibility and full object
  pass-through for both source shapes.
- Run the full helper build/test suite, inspect the diff, and commit locally.

### S2 — Replace the default-branch promoter

- Replace the generated commit/pull-request path with a repository script and
  deterministic fixtures/tests.
- The privileged `workflow_run` job checks out only its trusted default-branch
  workflow revision and executes only that script. Candidate Git objects and
  API metadata are input data; candidate actions, scripts, caches, and artifacts
  are never executed or consumed.
- Grant only `actions: read` and `contents: write`.
- Use candidate-SHA-scoped concurrency. Different candidates may race; source
  ancestry plus remote compare-and-swap makes older candidates stale no-ops and
  prevents an unsafe overwrite.
- Validate the selected source and candidate ancestry. At runtime, validate the
  candidate's approved push triggers and required active ARM publication jobs,
  including the migrator. Explicitly exclude intentionally disabled AMD jobs.
- Require successful exact-SHA push runs and jobs. Retry only missing or
  in-progress API evidence for a bounded indexing window.
- Resolve each runtime image's full-SHA registry digest. Produce sorted canonical
  JSON with source revision, workflow/run/job, repository, tag, and digest.
  Record the receipt checksum and run ID in the job summary and artifact. Do not
  move the ref if the receipt is incomplete or changes during collection.
- Exercise the actual remote update path for first creation, fast-forward,
  equality, stale candidate, divergence, concurrent movement, and out-of-order
  candidates. Never force.
- Automatic entry requires `STG_RELEASE_PROMOTION_ENABLED=true`. Manual entry
  defaults to dry-run and additionally requires exact confirmation of
  `stg-release` before any write.
- Record the previous and candidate revisions, selected source, matched
  workflows/runs/jobs, retries, receipt checksum, decision, and update result
  without secret values.
- Remove the generated-promotion pull-request exemption from the final-review
  code, tests, exports, and workflow inputs. Prove a legacy-named promotion pull
  request now follows ordinary final-review policy.
- Supersede the annotation-write-back ADR. Amend the release-candidate ADR only
  where it requires the replaced branch switch and bypass. Update the CI guide.
- Run focused script tests, shellcheck, workflow checks, diff hygiene, reviews,
  and local conventional commits.

### S3 — Publish selected-source SHA images once

- Mirror the reviewed controller and final-review runtime policy into the
  selected-source worktree. Only inventory fixtures may differ. Prove runtime
  policy files are byte-identical between branch candidates.
- In all 32 metadata blocks, explicitly retain branch and pull-request tags and
  add the raw full commit SHA. Keep each metadata result connected to exactly
  one existing build/push action and preserve backend/migrator ordering.
- Before each active push build, check the full-SHA tag. If absent, run the
  existing build/push once with all tags. If present, record its digest and skip
  that image's build/push. Pull-request builds continue to build without push.
- Test that reruns cannot overwrite the SHA tag or move the floating branch tag
  backward.
- Derive all 15 selected-source workflow paths and names. Validate all 32
  metadata/build pairs, approved push conditions, publish-once guards, promoter
  trigger equality, and the runtime image/job map.
- Run static workflow checks, diff hygiene, reviews, and local commits. No local
  or remote container build is part of phase 1.

### S4 — Add the staging chart override

- Add optional `global.imageTag` and make all 18 first-party image expressions,
  including the PreSync migrator, prefer it.
- Do not edit staging or production values and do not remove rollout
  annotations.
- Capture frozen baseline renders. An all-enabled render must apply a sentinel
  tag to all 18 first-party images. Staging and production renders without the
  override must remain byte-identical to their frozen outputs.
- Update the migrator ADR, supersede the staging-promotion ADR on this branch,
  and update CI and migration guides. State that the registry digest receipt,
  not mutable tag text alone, is deployment provenance.
- Run Helm lint/render comparisons, documentation checks, diff hygiene,
  reviews, and local conventional commits.

## Phase 1 finish

- Run a simplifier and applicable cross-system or security slice review for
  each substantive committed slice.
- Run an exact-range final review for the helper, `v3`, and `v3-ai` deliverable
  branches.
- Verify the controller runtime matches across branches; its job/repository map
  matches the selected workflows; helper parameters match the future platform
  consumer; chart image inventory matches the digest receipt inventory;
  production receives no parameter or values edit; and `stg-release` does not
  match image-build branch filters.
- Review staged content for secrets and personal data.
- Stop with three reviewed local branches and local commits. Phase 1 changes no
  external state.

## Phase 2 cutover

Phase 2 is a separate task with explicit delivery and operations authority.

1. Freeze selected-source pushes. Drain legacy promoter runs and resolve every
   generated promotion pull request before retiring the old controller and
   final-review exemption.
2. Deliver the helper and record its exact merged revision. Deliver the disabled
   default controller, its byte-matched selected-source runtime, and the
   selected-source SHA publication/chart changes.
3. Wait for the exact selected-source build set. Prove every required SHA image
   manifest and retain the canonical digest receipt.
4. Use the manually confirmed promoter to create `stg-release`; keep automatic
   promotion disabled.
5. In the private platform repository, pin the exact merged helper, change only
   staging to `targetRevision: stg-release`, and pass
   `global.imageTag=$ARGOCD_APP_REVISION` with `forceString: true`. Keep
   production on `v3` with no parameter.
6. Preview and apply remain separate approvals. After apply, prove the
   Application source and resolved revision, successful PreSync migration, and
   every deployed first-party workload `imageID` digest against the receipt.
   Runtime health and acceptance remain separate evidence.
7. Define a stability window no longer than receipt retention. At each
   checkpoint, compare registry tags and deployed image IDs with the receipt.
   Any mismatch disables promotion and blocks activation.
8. Only after those checks, separately authorize
   `STG_RELEASE_PROMOTION_ENABLED=true`.

## Rollback

### Release rollback

- Disable automatic promotion.
- Select a prior source-ancestor revision with a complete exact-build digest
  receipt.
- Prove compatibility with the already-applied database schema. If a rollback
  is incompatible or uncertain, stop and roll forward.
- Dry-run the same gate. With separate authority, use force-with-lease against
  the recorded current `stg-release` revision, then reconcile and verify.

### Mechanism rollback

- Restore private staging to its previous source without the global image
  parameter.
- Restore the legacy controller and final-review policy before re-enabling the
  old promotion path.
- Keep annotations and the old token through the stability window. Their
  deletion is later, separately authorized cleanup.

### Future source switch

- Change `STG_SOURCE_BRANCH` alone only when current `stg-release` is an
  ancestor of the new source and its workflow inventory matches the controller.
- Divergent histories require a separately approved, exact-build-gated,
  force-with-lease realignment before changing the variable.

## Planning review

- Round 1 found the early-rollout hazard, tag-rule replacement risk, divergent
  helper baseline, branch-inventory mismatch, weak remote tests, hidden manual
  write path, and missing rollback receipts. The draft accepted all findings.
- Round 2 required trusted default-branch execution, candidate-scoped
  concurrency, runtime job validation, legacy quiescence, ordinary final-review
  policy, compatibility-aware rollback, and branch-local documentation. The
  draft accepted all findings.
- Round 3 observed that `v3` advanced with the release-candidate ADR, corrected
  overlapping write ownership, and identified mutable SHA tags. This plan
  re-froze the baseline, assigns each physical worktree once, adds publish-once
  guards, and requires registry/deployed digest receipts.
- The native loop reached its three-round cap with `REVISE`, so its formal
  outcome is `review_deadlock` even though this revision incorporates every
  finding. The required rival review was unavailable because the independent
  CLI authentication had expired. Plan approval must explicitly accept this
  documented review state.

## Progress

- `Current:` The approved plan is the first local commit (`7e7f8e9fb1`). The
  selected-source CI slice now covers all 32 metadata/build pairs with explicit
  branch, pull-request, and full-SHA tags. Its 18 active push images use a
  fail-closed publish-once guard that records an existing registry digest;
  disabled AMD jobs remain explicit.
- `Next:` Add the derived workflow and Helm render contract tests, then add the
  chart override and the separate documentation/ADR/solution commit. Exact
  controller and final-review runtime blobs remain deferred until the main
  session supplies the completed default-controller commits or runtime files.
- `External state:` Unchanged.
