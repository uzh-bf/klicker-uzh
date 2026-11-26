# Staging image consolidation (B3) — execution plan

Approved for execution 2026-09-18. The slices below are the approved sequence.
Rationale, measurement provenance and the original spec stay in
`project/2026-09-13-ci-efficiency-roadmap.md` ("2026-09-13 B3 execution spec"
at ~line 665, the 2026-09-14 pre-flight at ~line 890, and the 09-16
re-ranking at ~line 940). This file is the executable form of that spec: the
seams, the inventory, the acceptance checks and the transition order.

## Objective

The 13 per-image staging workflows on `v3` (plus the 2 MCP ones on
`v3-audit`) and `v3_build-fallback.yml` are the single largest structural
class in the queue: ~237 push/PR runs per day, one workflow run and one
runner allocation per affected image, and one promotion-controller wakeup per
producer completion (100 records / 94 skipped / 1 success measured on 09-16,
44 controller runs for the single `v3` commit `0c2a7a6a33`).

Replace them with one workflow — `v3_images-stg.yml` — that plans a changed-image
selection, builds it as a matrix, and reports the unchanged required context
`build-images-status` from its own terminal job. Fold the two MCP images into
the same matrix on `v3-audit`. Delete `v3_build-fallback.yml` and the 13
per-image files on `v3`, then the 2 MCP files on `v3-audit`.

Success is not "fewer files". It is: identical required context, identical
evidence artifact, identical fail-closed semantics, identical promoted image
set per event, with one run per event instead of one run per affected image
and one controller wakeup per producer event instead of per image.

## Contracts that must not change

1. The required status context stays the job name `build-images-status`
   (rulesets `v3 quality and merge protection` 23042571 and
   `v3 integration baseline CI` 23042613).
2. The evidence artifact keeps its name `required-ci-evidence` and its file
   `required-ci-evidence.json`; `stg-release-promoter.js`
   (`readCiEvidence`, `validateCiSelection`) and
   `sonar-coverage-inputs.cjs` keep reading the shapes they read today.
3. Selection states stay `run`, `no-change`, `draft`, `unavailable`; a
   validated no-change selection passes with evidence, a plan failure, a
   selected build failure or a cancellation fails the context.
4. Draft pull requests defer builds exactly as today (build jobs gate on
   `github.event_name != 'pull_request' || github.event.pull_request.draft == false`);
   `ready_for_review` restores them on the unchanged head and the context
   recomputes against the restored builds.
5. Image identity, dockerfile, build context, ARM64 platform, full-SHA tag
   requirement, registry cache triple and publish guard per target are
   preserved. The MCP images keep their live native AMD64 leg and their
   `stg-image-publish-guard.sh` step.
6. The promoter's complete exact-SHA candidate matrix is unchanged: the same
   images, the same digests, the same admission rules.

## Verified topology (measured 2026-09-18)

The staging publication contract has **two different trees**, and the first
draft of this plan conflated them. Measured facts, all re-verified:

- `origin/v3` = `71f09eef0d` is the **default branch** and owns 13
  `v3_*-stg.yml` plus `v3_build-fallback.yml`. Every `build-amd` job there
  is `if: false`. Its image workflows carry **no** `tags:` block and no
  full-SHA tag, and it has **no** `.github/scripts/stg-image-publish-guard.sh`.
- `origin/v3-audit` = `a0dd1decbb` is the **promotion candidate**. It carries
  the same 13 files plus `v3_mcp-lecturer-stg.yml` and
  `v3_mcp-student-stg.yml`, and its image workflows are strictly **newer**:
  a full-SHA `tags:` block, the `stg-image-publish-guard.sh` step, build
  steps gated on `steps.publish_guard.outputs.publish`, and extended path
  globs (`packages/audit/**`, `packages/doc-query-client/**`,
  `packages/knowledge-graph/**`, `packages/logging/**`). It lags `v3` by
  2 commits and leads it by 432.
- The MCP apps and the four newer packages exist on `v3-ai` **and**
  `v3-audit`; `v3` has neither.
- `deploy-stg-promote.yml` is byte-identical on both branches and lists 24
  watched workflow names: 9 non-image producers and 15 image producers
  (13 + 2 MCP).
- `vars.STG_SOURCE_BRANCH` is `v3-audit`, and the controller is evaluated
  from the workflow-definition commit on the default branch. So the **trusted
  controller is read from `v3`** while the **candidate tree it validates is
  `v3-audit`**. This is why the consolidation needs both branches and why the
  promoter rewrite must land on `v3` to take effect at all.
- The guard script and the full-SHA tag are required of the *candidate*, which
  is `v3-audit`; `v3`'s own legacy workflows never satisfied them.
- `required-build-status.cjs` holds the target inventory with the per-image
  path globs (13 on `v3`, 15 on `v3-audit`); `stg-release-promoter.js`
  holds a second inventory keyed by workflow path (15 on both). Both become
  one branch-shared module, which is the design `staging-image-targets.cjs`
  already implements: a fixed sixteen-target list with availability resolved
  from the tree at plan time.

### Consequences the first draft missed

1. **The consolidated workflow must also work on `v3`.** Its build legs run
   `.github/scripts/stg-image-publish-guard.sh`, which does not exist on
   `v3`. S1 therefore also ports that script to `v3`, otherwise every `v3`
   push and pull-request build fails at the guard step. Porting it is safe and
   consistent: it is the same file `v3-ai`/`v3-audit` already run.
2. **The inventory is branch-shared, not branch-specific.** One sixteen-target
   list with runtime availability is what lets the `v3` controller validate a
   `v3-audit` candidate and vice versa. A branch-specific list would have
   failed the promoter's exact-set comparison on one of the two trees.
3. **`analytics-arm` does have a publish guard** on `v3-audit` (measured at
   `v3_analytics-stg.yml` line 68). The first draft's claim that it does not
   was wrong; the inventory is right.

## Target inventory

Thirteen targets exist on `v3`; the last two only on `v3-audit`. Every entry
carries its image suffix, dockerfile, path globs, and the extra legs it needs.

| target id | dockerfile | extras |
| --- | --- | --- |
| `analytics-arm` | `apps/analytics/Dockerfile` | `util/sync-schema.sh` before build |
| `auth-arm` | `apps/auth/Dockerfile` | registry cache |
| `backend-docker-arm` | `apps/backend-docker/Dockerfile` | Trivy scan + admission receipt |
| `backend-docker-migrator-arm` | `packages/prisma/Dockerfile` | Trivy scan + admission receipt |
| `chat-arm` | `apps/chat/Dockerfile` | registry cache |
| `frontend-assessment-arm` | `apps/frontend-pwa/Dockerfile` | registry cache |
| `frontend-control-arm` | `apps/frontend-control/Dockerfile` | registry cache |
| `frontend-manage-arm` | `apps/frontend-manage/Dockerfile` | registry cache |
| `frontend-pwa-arm` | `apps/frontend-pwa/Dockerfile` | registry cache |
| `hatchet-worker-general-arm` | `apps/hatchet-worker-general/Dockerfile` | registry cache |
| `hatchet-worker-response-processor-arm` | `apps/hatchet-worker-response-processor/Dockerfile` | registry cache |
| `lti-arm` | `apps/lti/Dockerfile` | registry cache |
| `olat-api-arm` | `apps/olat-api/Dockerfile` | registry cache |
| `response-api-arm` | `apps/response-api/Dockerfile` | registry cache |
| `mcp-lecturer-arm` (v3-audit) | `apps/mcp-lecturer/Dockerfile` | publish guard, live AMD64 leg |
| `mcp-student-arm` (v3-audit) | `apps/mcp-student/Dockerfile` | publish guard, live AMD64 leg |

## Consolidated workflow design

``.github/workflows/v3_images-stg.yml`, name `Build staging images`:

- `on`: `push` on `v3`, `v3*`; `pull_request` on `v3`, `v3*` with
  `types: [opened, synchronize, reopened, edited, ready_for_review]` and **no
  path filter** (the selection happens inside, which is what makes the required
  context always reportable).
- one concurrency group, `Build staging images-<pr number || ref_name>`,
  `cancel-in-progress: true` — replacing 14 groups.
- `plan` job: changed-file resolution (PR merge-base fetch/diff exactly as
  `v3_build-fallback.yml` does today; push selects every target), then
  `node .github/scripts/staging-image-plan.cjs` merging the selection with the
  target inventory and emitting `matrix`, `scan-matrix`, `selected` and
  `state` plus the selection evidence.
- `build` job: `needs: plan`, matrix from `needs.plan.outputs.matrix`,
  `fail-fast: false`, `runs-on: ubuntu-24.04-arm`, `name: ${{ matrix.jobName }}`
  so each target keeps a deterministic check-run name
  (`build-arm-<target>`), draft deferral gate, per-target dockerfile, image,
  cache triple, and a digest artifact `build-digest-<target>` for the scan leg.
- `scan` job: `needs: [plan, build]`, matrix from `needs.plan.outputs.scan-matrix`,
  push-only, downloads the target's digest artifact, then runs the existing
  Trivy, receipt, artifact-upload and policy steps unchanged.
- `build-images-status` job: `needs: [plan, build, scan]`, `if: always()`,
  `runs-on: ubuntu-latest`, evaluates the plan state, the aggregate matrix
  results and the draft/no-change cases, then fails or passes and uploads the
  `required-ci-evidence` artifact. It is the only reporter of that context.

`SCAN_ADMISSION_INVENTORY` re-keys from `workflowPath` + `buildJob`/`scanJob`
to target id + the deterministic matrix job names; digest resolution, receipt
binding and the fail-closed reading are unchanged.

### Why a runtime matrix, and not one static job per target

The obvious alternative - one consolidated file with sixteen static build jobs -
cannot work, and the reason is a hard constraint rather than a preference: the
available target set **differs per branch**. The two MCP apps and the four newer
packages exist on `v3-ai`/`v3-audit` but not on `v3`, so a static job list would
have to differ between the two branches, and the same workflow text could not
serve both. A matrix resolved at plan time from
`availableTargets(rootDirectory)` (dockerfile presence in the checked-out tree)
keeps **one identical workflow and one identical inventory** on every branch
while still building exactly the targets that branch can build. It also keeps
the property that matters for runner cost: an unselected or unavailable target
allocates no runner at all, which per-job `if:` gating on sixteen static jobs
could not achieve without starting sixteen jobs.

### Trust model for the promotion controller

The controller must not execute candidate code, so a runtime matrix cannot be
validated the way the per-image job blocks were validated today. The guarantees
are therefore re-established explicitly, and two of them already hold:

1. **The trusted image list stays in controller code.** `STAGING_WORKFLOWS`
   keeps the sixteen (job name -> image) pairs, derived from the trusted
   inventory rather than from candidate YAML. A candidate cannot add, drop or
   retarget a promoted image.
2. **Digest resolution already enforces the promoted set.** The promoter
   resolves every expected image digest at the candidate SHA from the registry.
   A target that was not built has no full-SHA tag, so resolution fails and
   nothing is promoted. This is independent of the workflow shape and is why a
   skipped or missing leg fails closed.
3. **Availability is read from the candidate tree, not from candidate output.**
   The controller lists the candidate tree once and checks each target dockerfile,
   so the expected job set is the trusted inventory intersected with the candidate
   tree. The plan output is evidence, never authority.
4. **Per-target build success is required by job name.** For every expected
   target the controller requires exactly one completed, successful job named
   `build-arm-<jobBase>` in the candidate push run, plus `scan-arm-<jobBase>` for
   the two scanned targets and `build-amd-<jobBase>` for the two AMD64 targets.
   The names are deterministic functions of the trusted inventory, so this is
   checked against the GitHub job list rather than against candidate evidence.
5. **The workflow shape is still validated structurally.** One file at the
   trusted path with the trusted name, the approved push branches, the ARM
   runner, the full-SHA tag, the publish guard, and - for the scan leg - one
   full-SHA-pinned Trivy revision and the `image-scan-receipt.cjs check` policy
   step, exactly as the per-image files were checked.

What is genuinely weaker than today is the static per-target dockerfile and image
comparison inside the candidate YAML, because the matrix is a runtime expression.
That is compensated by (1) and (2): a candidate that mislabels a job still cannot
promote an image outside the trusted list, and a candidate that omits a build
fails digest resolution. The residual risk is a candidate that builds a different
dockerfile under a trusted job name, which is a maintainer-level action on the
integration branch and not a boundary this controller defends against today
either.

## Slices

**S0 — integration.** Merge current `v3` into `v3-audit` (integration only, no
source change) so the audit line carries #6132 and #6136 and the S3 branch
starts from a current base. Acceptance:
`git rev-list --count origin/v3-audit..origin/v3` is 0 after the merge.

**S1 — consolidated workflow on `v3`.** Add
`.github/workflows/v3_images-stg.yml`; add `.github/scripts/staging-image-targets.cjs`
(single inventory + pure selection), `staging-image-plan.cjs` (plan CLI) and
`staging-image-status.cjs` (terminal reporter derived from
`required-build-status.cjs`), with their tests; delete the 13 `v3_*-stg.yml`
files and `v3_build-fallback.yml`; move the check.yml test list from
`required-build-status.test.cjs` to the new test files. Acceptance: the
inventory matches every deleted file's dockerfile, globs and jobs; `node --test`
on the CI contract list passes.

**S2 — consumers on `v3`.** Rewrite `stg-release-promoter.js` against one
workflow: `WORKFLOW_PATH_PATTERN` (single path), `STAGING_WORKFLOWS`
(target-based, sourced from the shared inventory), `validateStagingWorkflow`
(name, push branches, matrix include list compared with the trusted inventory,
per-target build inputs, digest output, scan and publish-guard legs, migrator
ordering expressed as "scan needs build"), `collectBuildEvidence` (one run per
event, jobs resolved per target), `REQUIRED_CI_WORKFLOWS`
(`v3_images-stg.yml` / `build-images-status`) and the `SCAN_ADMISSION_INVENTORY`
consumption; update `stg-release-promoter-fixtures.js` and the promoter tests;
collapse `deploy-stg-promote.yml`'s watch list to the 9 non-image producers plus
`Build staging images`; collapse `cancel-closed-pr-checks.yml` to the single new
concurrency group; update `ci-event-gates.test.cjs` (its 13-file and MCP
enumeration becomes one workflow); update `docs/ci-and-deployment.md`.

**S3 — MCP integration on `v3-audit`.** Branch from `v3-audit` with `v3`
merged in (standing integration), extend the matrix with `mcp-lecturer-arm` and
`mcp-student-arm` including their publish guard and live AMD64 legs, delete
`v3_mcp-lecturer-stg.yml` and `v3_mcp-student-stg.yml`, and update the working-rule
inventory entries. Acceptance: the audit line's required contexts and promotion
evidence still resolve; no watched workflow name lacks a producer once the two
dead names are removed.

**S4 — verification.** Draft PR on `v3` and, after S0/S1, a draft PR on
`v3-audit`; canary on a branch touching shared packages; a local promoter
dry-run pass against the new workflow text and matrix-run fixtures.

## Verification

Local, no merge needed:

- `NODE_PATH=<primary>/node_modules node --test` on the check.yml CI contract
  list, including the new plan/status tests and the rewritten promoter suite.
- Inventory equivalence test: every deleted workflow's dockerfile, globs and job
  ids appear in the new inventory, and no target exists that the old files did
  not build.
- Promoter fixture suite covering: the consolidated candidate validates; a
  candidate that drops a target from the matrix fails; a candidate that changes
  a dockerfile or platform fails; matrix-run evidence with one failed target
  fails; scan admission binds to the matrix build job's digest.
- Diff review of the deleted files against the new inventory: no target lost, no
  required context renamed.
- Prettier and Biome on every touched file.

Canary, draft PR and pull-request event:

- Exactly one `Build staging images` run per event, no per-image runs.
- The `plan` job publishes the expected selected targets for a diff that touches
  a shared package; N matrix builds appear with deterministic names; the
  terminal job reports `build-images-status` with `selection.state = 'run'` and
  uploads `required-ci-evidence`.
- A metadata-only `edited` event passes with a validated no-change selection.
- A draft PR passes with `state = 'draft'` and no build allocation.

Post-merge, separate gate, reported not assumed:

- One promotion dry run for the newest `v3-audit` push candidate: the complete
  exact-SHA candidate matrix (15 images) is unchanged and admission still
  resolves digests and scan receipts.

## Transition window

The trusted controller is read from `v3` and validates the `v3-audit` candidate
tree. Between the `v3` merge (S1+S2, consolidated inventory) and the `v3-audit`
merge (S3, consolidated tree) a `v3-audit` candidate still carries the 15 legacy
files, so validation fails closed and staging promotion pauses for that window.
No incorrect promotion is possible; the cost is a stall.

Mitigation: run S0 first, while both sides still agree, then land the `v3` merge
and the `v3-audit` merge in the same session, minutes apart. The two dead MCP
names may stay in the controller watch list afterwards — a watch entry for a
deleted workflow never fires — so removing them is cosmetics, not correctness.

## Risks and rollback

- A lost target would silently shrink the promoted image set. Guard: the
  inventory equivalence test plus the promoter's per-target evidence
  requirement, which fails a candidate whose matrix omits a target.
- A renamed context would block merges until the rulesets change. Guard: the
  terminal job keeps the exact job name; the canary reads it from the PR checks.
- A broken digest handoff would fail scans. Guard: the digest artifact plus the
  unchanged receipt schema, covered by the promoter fixture suite.
- Rollback is a plain revert of the merge commit on each branch: the deleted
  workflow files return and the promoter's inventory reverts with them.

## Authority

Standing: implementation, local commits, ordinary task-branch pushes, draft PR
creation and updates, and roadmap/plan updates.

Named gates: merging any PR into `v3` or `v3-audit`; deleting branches or
worktrees; repository or runner settings.

## Out of scope

- The public-PR ARM64 pool, the runner group policy and the runner allowlist.
- Playwright shard routing and the hosted required test contexts.
- The MCP AMD64 leg's platform or its publish guard, which stay as-is.
- The optional follow-up that removes the two dead MCP names from the watch list.

## Progress

Updated 2026-09-18.

- **S0 done.** Current `v3` is merged into `v3-audit`, so the audit branch
  starts from a current base.
- **S1 done on the `v3` branch.** `v3_images-stg.yml` and the shared plan,
  status, target and workflow modules are in place; the thirteen per-image
  workflows and `v3_build-fallback.yml` are deleted.
- **S2 done on the `v3` branch.** The promoter, the derived scan-admission
  inventory, the controller watch list, the closed-PR sweeper, the event-gate
  tests, the `check.yml` contract list and `docs/ci-and-deployment.md` all read
  the one workflow. The superseded `required-build-status` module and its
  fifteen-file fixture suite are removed.
- **S3 done on this branch.** The consolidated tree is merged in, the two MCP
  staging workflows are deleted, and `mcp-lecturer-arm` and
  `mcp-student-arm` build through the shared matrix. The audit-only
  `stg-release-ref-promotion.test.cjs` is rebound to the trusted inventory.
- **S4 done for the canary path.** Both draft PRs are open (#6141 on `v3`,
  #6147 on `v3-audit`). The consolidated staging workflow ran to success on
  both draft heads: run `35360584817` for `2be208ee30` on `v3-audit`
  (plan success, `build-images-status` success, six `matrix.jobName` legs
  skipped with no runner allocated) and run `35361628890` for `eb6abcd255`
  on `v3` with the same shape. Queue depth fell from roughly 153 to 14. This
  proves the draft-deferral contract and the required `build-images-status`
  context; it does not yet exercise a real build or publish, which only a
  ready-for-review or push run triggers.
- **Format regression fixed.** The plan and status helpers created in earlier
  sessions carried Biome format errors that failed `check-suite` on both PRs.
  `biome format --write` and the Prettier check now pass on the full changed
  file set; the fix is committed on both branches (`d36ecf4c93` here,
  `17d6795d15` on `v3`).
- **Vitest spec drift fixed on this line.** Merging `v3` brought in the exact
  `3.2.4` pin from #6137, but ten audit-only packages still floated on
  `~3.2.4`, so `syncpack lint` failed the codebase check here while `v3`
  passed. The manifests now carry the exact pin (`95b9020a0d`); the lockfile
  already recorded `specifier: 3.2.4` for all ten, so no dependency
  re-resolution was needed. `check-suite` is green on both heads again.

Local verification on both trees: `node --test` over the CI contract list
passes (293 tests on `v3`, 301 on `v3-audit`), Biome and Prettier are clean,
and a local promoter dry run resolves 14 targets on `v3` and 16 on
`v3-audit` with no required CI workflow absent from either tree.
