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

- `Current:` Commits `ed3b236bfa` and `43e84ba3a5` implement and harden
  selected-source SHA tags and publish-once guards. Commit `b7b381812d` adds
  optional `global.imageTag` precedence across all 18 first-party images and
  the independent contract anchors for the 15 workflows, 32 metadata/build
  pairs, 18 active image jobs, and frozen-parent staging and production render
  digests (`a6ee9ad6b235` and `0ec440b0e11d`). The environment values remain
  unchanged, including all 16 staging rollout annotations. Commit `999da1473e`
  mirrors the seven trusted promotion and final-review runtime/policy files
  from reviewed controller head
  `4a81e8e10bb5f1b8b8c3b7af275e7b14425767dc`.
- `Mirror verification:` direct byte comparison and Git blob-ID comparison
  both report 7/7 exact matches against the controller head. Selected-source
  tests pass 4/4, mirrored promoter tests pass 20/20, and final-review tests
  pass 56/56. Node syntax, workflow YAML parsing, 24 extracted Bash `bash -n`
  and ShellCheck checks, the publish guard's Bash checks, Biome and Prettier
  formatting, both Helm lints, frozen render hashes, the 18/18 sentinel render,
  Git diff checks, staged Gitleaks, and focused personal-data review pass.
- `Review dispositions:` the selected-source simplifier's suggestions to derive
  render digests and remove the explicit image/job inventory were rejected:
  those values are deliberately independent expected-state anchors that detect
  coordinated drift. Its risk finding about overly broad registry absence
  detection was accepted and fixed in `43e84ba3a5`; only an exact missing-tag
  response now permits first publication, while generic 404, not-found, and
  manifest-unknown responses fail closed.
- `Final reviews:` the helper range through `1ea4c2ea43`, the trusted
  controller range through `4a81e8e10b`, and this selected-source range through
  `2785c85ea6` each passed their exact-range final review with no findings. The
  selected-source review remains valid after this progress-only commit because
  no runtime, workflow, chart, test, ADR, or operational contract changed.
- `Cross-repository matrix:` helper Helm parameters preserve the omitted shape
  and pass `forceString`; the seven controller blobs match 7/7 across branches;
  the controller's 16-repository digest receipt covers every one of the 15
  unique repositories used by the chart's 18 image expressions. The sole
  receipt-only entry is the deliberately release-gating `analytics-arm` image,
  which this chart does not render. Production values and workflows receive no
  override, staging and production environment values remain unchanged, and
  `stg-release` does not match the `v3` or `v3*` image-build filters.
- `Upstream integration:` the approved one-time rebases completed onto
  `origin/v3@468f05b91503b133670dda235be9a4b38bba2155` and
  `origin/v3-ai@208e97d38e6abfd13d997d48200077febc8c1445`. The controller replayed
  cleanly. The selected-source branch resolved its sole conflict in
  `docs/ci-and-deployment.md` by preserving both the immutable staging-release
  contract and the target branch's newer GrowthBook beta-enrollment wording.
  Both branches are now zero commits behind their targets.
- `Integration verification:` `git range-diff` confirms every executable
  commit replayed unchanged. The seven mirrored runtime and policy blobs still
  match 7/7. Promoter tests pass 20/20 on both branches, final-review tests pass
  56/56 on both branches, both Helm lints pass, and the selected-source contract
  passes 4/4 after moving its frozen baseline to the integrated target. The new
  independent no-override render digests are `78f21724a35e` for staging and
  `07bebd9e0801` for production; sentinel coverage remains 18/18.
- `Review reuse:` the approved rebase changes no executable behavior or
  operational contract. The only manual resolution is documentation-only, and
  the frozen-baseline update is assertion-only while preserving the reviewed
  test contract. The three completed final reviews therefore remain valid.
- `Terminal condition:` Phase 1 is complete with three clean, reviewed and
  target-integrated local branches and no external state change. Push, pull
  requests, ref creation or movement, repository variables, private platform
  changes, registry/live Argo inspection, and deployment remain separately
  permission-gated.
- `External state:` Unchanged.
