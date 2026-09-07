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
- Use synthetic render inputs to verify all 18 first-party images retain their
  individual tags without an override and prefer the global tag when supplied.
  Check empty-tag fallback to the chart version and the migrator's backend-tag
  fallback. Do not pin whole environment files or Helm-version-dependent output.
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

### Current delivery and local correction, 2026-09-07

The package is published, but not merge-ready or activated.
[The staging source PR](https://github.com/uzh-bf/klicker-uzh/pull/5782)
contains `026852ee11b0e2cebcce8a8995f73d95de71793b`, including the approved
one-time integration of `v3-ai@168f66f0693700b751dcd7365addf4801941ffe5`.
At resume, the branch matched `origin/rs/stg-release-ref-promotion`.
The local corrections below have not been pushed.
The refreshed default `origin/v3@fddc5b38b9` is four commits ahead of this
branch's default-branch ancestry; this is not new integration authority.
The live PR base remains `v3-ai`.

The published head passes codebase, staging image-build, GraphQL, Gitleaks,
CodeQL, and Sonar checks. The lightweight unit job fails because Chat imports
unbuilt GraphQL, Markdown, and feature-flags package outputs. Its five failing
suites pass locally with built dependencies (53 tests). Playwright remains
running; no completed final AI review is available. Image-build success on a
PR does not establish registry publication or deployment provenance.

The updated user instructions authorize diagnosis, source fixes, checks,
reviews, local commits, ordinary task-branch pushes, and routine draft PR
updates. Required verification and review still block delivery. Upstream
integration, remote retry, merge, deployment, credential changes, and
release-ref movement remain separately gated.
The build-dependency correction is assigned to the native executor, limited
to `test-unit.yml`; acceptance is the dependency build graph and affected tests.
The publish-guard correction stays with the main session because its
fail-closed publication decision is tightly coupled to acceptance.
Local commit `4195843984` adds the three missing package build filters.
Its exact build command passes nine dependency tasks without an application
build. The five previously failing Chat suites pass 53 tests. The executor's
noted transitive path-trigger omissions predate this correction; no unrelated
trigger redesign is included. Slice review is not required for this mechanical
build-list correction; main-session diff and focused checks cover it.

Local commit `7181c674cc` contains the publish-guard correction.
An exact synthetic Buildx missing-image diagnostic failed before the fix and
passes afterward. The existing regression test now accepts both exact known
diagnostics and rejects generic or wrong-image errors. The focused container
test and host Bash syntax/ShellCheck checks pass. No registry call was made.
Three non-render contract checks pass. The unchanged Helm render check cannot
run inside this container because `helm` is absent; previous passing render
evidence is retained, not represented as a fresh run. Repository `check:all`
passes, including 40 type-check tasks; it ran in the container, with secret
and Git identity checks on the host before committing. No dedicated simplifier
is required for the small exact-match and existing test-table extension.
The guard's configured slice reviewer failed before useful work because its
model was at capacity. A trusted read-only continuity reviewer is evaluating
the same committed two-file scope. Integrated final review waits for the
unresolved package gates.

Playwright has now finished. Shard eight reproduces both feature-access
fixture failures and a separate horizontal-overflow assertion in
`W4-activity-wizard-safety.spec.ts`. Shard four exits 127 before tests because
the moving `playwright-shard@refs/heads/v3` action calls
`.ci-control/.github/scripts/install-devrouter.sh`, while its trusted checkout
is frozen to `1fb8b852684c4155f5d375f7c211c5d0be1f923d`, before that script
arrived. This shared CI revision mismatch is not a browser assertion failure.
The local fixture corrections have not yet
received browser acceptance, and these failures prevent merge readiness.

The two Playwright fixture corrections are restored and remain unstaged, not
only stashed. Their recovery stashes remain intact. Browser acceptance is
still missing: canonical Devrouter repair fails with
`Preparation for 'klicker-dev' left running children; a synchronous foreground command is required.`
Container execution remained available for source tests. No global runtime
configuration was changed to bypass the failure. After verification, the
exact checkout `trees/stg-release-ref-promotion`, provider workspace
`rs-stg-release-ref-promotion`, was stopped. The validated application
container reports `exited`, and the checkout has zero routes. Worktree and
runtime data are retained.

### Historical implementation evidence

The entries below describe their recorded checkpoints, not current delivery
status. In particular, the earlier local-only terminal condition was followed
by separately approved publication and integration.

- `Local v3 integration, 2026-09-06:` The user explicitly approved integrating
  `v3` into this existing worktree. The merge uses fetched source
  `27f2474547df045cc11302c7d9e195798ec66870` and preserves the staging release
  changes. Publication, remote merges, release-ref movement, and deployment
  remain outside this approval. The previous local edits remain recoverable in
  stash `be6567dfbf1c7eb42d395b9914017fe4b9c33fac`; six runtime fixes already
  arrived through v3, while the two Playwright fixture fixes remain stashed.
  Conflict resolution retains both CI contract checks, the AI package build
  filters, and multi-KB scope validation. The new `QManageChatbots` operation
  combines standard-mode fields with the existing enabled-KB link and preserves
  both older operation documents. Owner preview now passes standard-mode
  settings and the array-shaped MCP scope. Two AI-only peer ranges match the
  incoming Next.js patch version. No task-authored migration was added.
  Promoter and final-review policy tests pass 133/133; affected MCP and mode
  tests pass 104/104; owner-preview tests pass 8/8. GraphQL schema and type checks
  pass. The broader type-check run passed 38/40 tasks; its Prisma generation
  race and stale preview caller were then resolved and both package checks pass
  sequentially. All seven lint tasks pass, as do dependency consistency,
  staged-file formatting, runtime helper tests, frozen-lockfile validation,
  staged Gitleaks, and host identity/diff checks. In-container lint-staged Git
  bookkeeping failed during the merge; its exact formatting commands were run
  separately from host Git checks. The broad check terminated the development
  backend watcher with exit 137. Canonical Manage startup had passed with no
  drift. The recovered runtime and authenticated Overview, Advanced, and
  Learning modes browser views passed using the synthetic lecturer and an
  isolated browser feature-flag fixture. The full Chat suite passed 927 tests
  with 22 skipped on merge commit `b7de509d74`. Independent review found one
  multi-KB preview regression: the query still limited enabled bindings to one.
  Correction `e0446eab72` removes that limit. The existing preview fixture now
  honors query cardinality and requires both KB IDs; it failed before the fix
  and passes 8/8 afterward, together with Chat types and focused Biome checks.
  A later runtime resume failed its managed preparation child-process check;
  canonical container execution remained available for correction verification.
  No provider configuration or runtime data was reset to bypass that error.
  The incoming shared final-review policy supersedes the historical exact
  controller mirror claim below. The same independent reviewer cleared the
  corrected range through `e0446eab72` with no remaining findings. Final runtime
  readback reports provider `Stopped` and zero routes for this exact checkout.
  No push, remote merge, release-ref update, or deployment occurred.
- `Source follow-up, 2026-09-05:` The user approved repairing the failing
  contract test and preparing private platform source wiring, with merges and
  activation still gated. The published test failed under CI's Helm 3.21.4
  with digest `5921e61ac4bb` instead of the Helm 4.2.4 baseline `07bebd9e0801`.
  Reproducing the committed test locally with Helm 3.21.4 yields the exact CI
  failure. The replacement uses synthetic image inputs, preserves the explicit
  image/workflow inventory, and passes 4/4 with both Helm versions on Node
  24.20.0. It checks omitted and empty overrides, all 18 per-image tags, global
  precedence including a leading-zero revision, and migrator/chart fallbacks.
  No environment values, chart templates, or runtime workflows change. Earlier
  frozen-render evidence below is historical, not the ongoing test contract.
  Route: main session because diagnosis and acceptance are tightly coupled.
  Test obligation: replace existing coverage; no additional test cases.
  The simplifier removed the temporary values file in favor of explicit Helm
  flags. All four tests pass with both Helm versions after that correction.
  Independent slice and integrated source-only final reviews passed with no
  findings on `b74bac96e0b1530fa0901faca88558a8e28162e6`. The repair is committed
  locally; publishing the updated PR head remains a separate approval boundary.
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
