# Synchronize integration branches and move staging to audit

## Approval summary

Synchronize `v3 → v3-ai → v3-audit` through normal merge ancestry, preserving each branch's additional features. Then select `v3-audit` as the staging source and promote one qualified audit commit through the existing `stg-release` controller. ArgoCD continues following `stg-release`.

Both stable and integration PRs must pass the full applicable CI baseline, including Playwright. Integration administrators may explicitly override a merge through a PR; stable `v3` has no bypass. A merge override never qualifies a commit for staging: the promotion controller must independently require successful candidate CI and image evidence.

This is more than changing a variable. Audit staging values enable auditing for all assessment live quizzes, introduce audit workers and carry audit migrations. The dedicated workers currently ignore the global SHA image override. Cutover requires immutable worker images, a verified database upgrade path, required identities/storage permissions, and a successful synthetic assessment evidence flow. Preserve existing data and production behavior; no database reset, historical audit replay, production rollout, release tag, or broad infrastructure change belongs to this plan.

Success means the final audit head contains the selected stable and AI heads, all candidate CI and publisher evidence passes, `STG_SOURCE_BRANCH=v3-audit`, `stg-release` equals the qualified candidate, and staging reports that revision with expected images, migrations, workers, and smoke results. Resume automatic audit promotion only after its CI gate and initial rollout pass.

The user approved implementation of the reviewed improvements with “make these improvements.” Earlier CI/protection approval also remains valid. Execute the bounded sequence below subject to its passing checks, human reviews, and migration/runtime prerequisites. Excluded infrastructure, IAM, destructive data operations, and production effects remain excluded. Git access restored on 12 September; source execution is active on rs/required-ci-rulesets from 9d258244535f855b96d9548262f57ac639f83124.

## Verified baseline and evidence limits

Snapshot: 12 September 2026; refresh before execution.

| Ref/control | Observed value | Relationship |
| --- | --- | --- |
| `v3` | `48403f59789dca35df106002d1b2ec4e31d70a81` | Stable and trusted controller source |
| `v3-ai` | `9cb4042334751fd80fde5b95319a6c41cdd4cdaa` | 5 commits behind, 191 ahead of stable |
| `v3-audit` | `3de12f7f1a68f4c78325e73f914c628be4ed1e4f` | 19 commits behind, 11 ahead of AI |
| `stg-release` | `9cb4042334751fd80fde5b95319a6c41cdd4cdaa` | Equals current AI head |
| `STG_SOURCE_BRANCH` | `v3-ai` | Live GitHub variable |
| `STG_RELEASE_PROMOTION_ENABLED` | `true` | Live GitHub variable |

GitHub compare endpoints verify divergence at the pinned SHAs. Branch names are not intended to become identical: audit retains audit-only history, AI retains AI-only history, and neither is merged backward into stable.


The local primary checkout is dirty and behind. Both `git fetch --prune` and task-worktree creation fail with `.git` write permission errors. GitHub and GitLab evidence was retrieved through host CLIs. This review copy is exported outside the primary checkout; once Git access is restored, place the accepted plan in the existing `project/2026-09-10-consistency-cleanup/` workstream inside its owning task worktree. It does not establish another repository artifacts root.

## Existing work and scope

Reuse and revalidate existing owners before creating any competing PR:

| Existing PR | Treatment |
| --- | --- |
| [#5881 — maintenance reconciliation](https://github.com/uzh-bf/klicker-uzh/pull/5881) | Reuse applicable integration work only after checking current parents and scope. Its production-control/value changes are not implicitly approved by this staging plan. |
| [#5882 — explicit staging selection](https://github.com/uzh-bf/klicker-uzh/pull/5882) | Reuse the narrow trusted-controller repair. Refresh CI and review; the preparatory production receipt helper is not production enforcement. |
| [#5883 — audit forward integration](https://github.com/uzh-bf/klicker-uzh/pull/5883) | Reconcile against today's audit head. Its historical claim of tree equality with maintenance must not remove the 11 current audit-only commits. |
| [#5905 — audit media capture](https://github.com/uzh-bf/klicker-uzh/pull/5905) | Treat as a conditional audit-acceptance prerequisite if copied/legacy media is part of the staging contract. It has failed general checks and unverified source-storage access; repair and verify before inclusion. |

Use existing merge/sync PRs if their ownership and final diff fit this scope; otherwise create narrowly scoped successor PRs with predecessor links. Do not automatically merge unrelated open feature PRs. Do not retarget or rewrite existing PRs without a specific, reviewed need. Preserve all original migration files/checksums; author no new migration merely to synchronize branches.

## Delivery sequence and ownership

Full-path package; execution owner and boundary owner: main session. The user has approved the reviewed executable batch; preserve its prerequisites and excluded effects. Main owns branch integration, conflict decisions, external writes, cluster work, and final proof. Specialists receive bounded source or review scopes and never deploy.

### Delegation map

| Workstream | Owner | Depends on | Acceptance |
| --- | --- | --- | --- |
| 1a: workflow reporting and required-check coverage | executor | Settled CI contract below | Real summary outcomes plus focused regression coverage |
| 1b: promotion CI and receipt preconditions | main | 1a evidence contract | Controller rejects unqualified or changed candidates; risk review |
| 1c: ruleset delivery and any stable-source merge | main | Source verification and staging hold in stage 2 | Exact rules readback and protected-source review |
| 2: staging hold and downstream synchronization | main | Source drafts may be prepared first | Writer quiescence, both parents retained, S → A → C0 |
| 3a: audit worker-image source repair | executor | Current audit branch scope | SHA override and fallback demonstrated in Helm renders |
| 3b: final candidate and staging qualification | main | 2 and 3a plus approved audit repair | One final C with full CI, images, ledger and configuration evidence |
| 4: selector change, promotion and rollout | main | 3b and activation approval | Exact receipt/ref and live acceptance |
| 5: closeout/recovery | main | 4, or an explicit activation blocker | Separate source and cutover verdicts |

Main retains 1b because it is the coupled trusted deployment decision, and 2–5 because they include external effects, migration decisions, and final proof. The two executors own disjoint source paths. Required independent reviews remain separate from implementation ownership.

### 1. Complete CI policy and cutover prerequisites

Route: executor for settled reporting changes; main for policy and trusted promotion logic. Acceptance: reviewed source changes, meaningful negative tests, and successful real CI reporting.

Finish the already-approved CI work. Require `check`, `check-gitleaks`, `test-graphql-status`, `test-playwright-status`, and stable summaries for unit, OLAT, translation, and affected-image builds. New summary names are `test-unit-status`, `test-olat-api-status`, `test-intl-production-status`, and `build-images-status`. All selected suites must succeed; failure, cancellation, missing selection data, or unexpected skipping must block. An explicit validated no-change selection may pass without executing an irrelevant suite. Ready PRs require the full eight Playwright shards. Verify draft-to-ready transitions and base retargeting cannot reuse a draft success or omit newly applicable checks.

Keep the established advisory distinction explicit: AI review, advisory Biome/Knip output, and the current Sonar analysis upload are not substitutes for test success. Inventory remaining emitted checks, including CodeQL, and disposition any currently advisory scanner before claiming that every emitted check is mandatory. The approved deterministic test/build matrix is the required baseline.

Apply full coverage to exact `v3` and `refs/heads/v3-*`. The integration CI ruleset grants only repository administrators a `pull_request` bypass; ordinary writers cannot bypass. Keep structural rules against direct updates, force pushes, and deletion without bypass. The stable ruleset has no bypass actor. No freshness, mandatory approval, conversation-resolution, or linear-history requirement is added to integration branches. Older integration branches without the workflows remain unqualified until bootstrapped; document that limitation rather than treating absent checks as passed. Verify matching/excluded refs and actual required-check reporting.

The staging promoter currently validates exact-source push image builds and digests, not separate CI. Extend its trusted decision to require the complete applicable CI result for the actual candidate tree/SHA and intended source. An administrator override, draft success, stale branch run, incomplete summary, cancelled job, or different merge tree must not qualify it. Ensure candidate push validation includes full Playwright and all relevant suites even when PR-only or path-filtered workflows previously omitted them. Preserve legitimate selectors for other suites. Observe both build and validation completions (or an equivalent supported bounded controller trigger) so tests finishing after builds can qualify the candidate without an empty commit. Reuse existing controller/reporting modules rather than introducing a generic orchestration service.

Prepare source drafts first. Establish the stage-2 hold and writer quiescence before any shared `v3*` merge or push, including stable controller changes. Then land the trusted controller changes on `v3` through its protected PR process before operational use; preserve required human review. Keep the staged source rollout safe: do not re-enable automatic promotion until every selected branch has the required reporting contract. A workflow-source merge on stable must have no unreviewed production chart/value delta.

#### Source paths and CI evidence contract

Workstream 1a extends `.github/workflows/check.yml`, `check-gitleaks.yml`, `test-graphql.yml`, `test-playwright.yml`, `public-pr-playwright-shards.yml`, `test-unit.yml`, `test-olat-api.yml`, `test-intl-production.yml`, and `v3_build-fallback.yml`. Replace the echo-only fallback with actual affected-build qualification. Update affected `v3_*-stg.yml` trigger/job mappings where required so declared dependencies really schedule their builds. Include the MCP workflows only on branches that contain those applications. Extend `.github/scripts/ci-event-gates.test.cjs` and existing Playwright contract tests for observable outcomes. A single new `.github/scripts/required-ci-status.cjs` may share the validated selection/result contract across unit, OLAT, translation and build reporters; no generic CI orchestration framework is planned.

Workstream 1b extends `.github/scripts/stg-release-promoter.js`, `.github/scripts/stg-release-promoter.test.js`, and `.github/workflows/deploy-stg-promote.yml`; update `docs/ci-and-deployment.md`. Candidate eligibility is defined by these workflow/job pairs:

| Workflow | Required terminal job |
| --- | --- |
| `check.yml` | `check` |
| `check-gitleaks.yml` | `check-gitleaks` |
| `test-graphql.yml` | `test-graphql-status` |
| `test-playwright.yml` | `test-playwright-status` |
| `test-unit.yml` | `test-unit-status` |
| `test-olat-api.yml` | `test-olat-api-status` |
| `test-intl-production.yml` | `test-intl-production-status` |
| `v3_build-fallback.yml` | `build-images-status` |

For deployment, accept only same-repository `push` validation runs whose workflow path, `head_branch` and `head_sha` exactly match the independently selected workflow, source branch, and candidate C. Filter by all those identities before selecting the newest run and attempt. A newer pending, failed, cancelled or skipped relevant attempt prevents fallback to an older success. Read all job pages; require the expected terminal job's successful conclusion and reject ambiguous duplicate terminal jobs. Required summaries report successful no-change decisions internally; GitHub-level skipped/neutral terminal jobs do not pass. Playwright must attest full eight-shard execution for staging-candidate pushes as well as ready PRs. Candidate CI receipt records workflow path, run ID/attempt, event, branch, SHA, terminal job ID/result, selection and selected-suite results; controller SHA and prior release SHA bind the overall receipt. Reject unknown or malformed selection evidence. No PR-head or administrator-override result substitutes for merged-candidate push evidence.

The trusted controller observes completion of each required validation workflow as well as image publishers. Failed/pending candidate evidence never writes the release. Bounded retries handle concurrent completions; a later valid completion causes a new independent evaluation, without creating commits or accepting a previous run's defaults. Extend the existing CAS controller rather than using an untrusted candidate script. Preserve wrong-source filtering and full-SHA publisher/digest validation.

Workstream 3a owns `deploy/charts/klicker-uzh-v3/templates/deployment-audit-workers.yaml`, `deployment-audit-media-policy-worker.yaml`, and `docs/assessment-audit-evidence.md`. No existing audit-image Helm test was found in the inspected tree. Use actual Helm renders for global-SHA override, explicit fallback, audit-disabled behavior, and missing-image rejection; do not claim an existing automated test protects these templates. No additional source module is planned for this repair.

### 2. Establish staging hold and synchronize downstream

Route: main; skip reason: tightly coupled source integration and external effects. Acceptance: paused/drained writer plus recorded merge-parent ancestry and successful source verification.

Before advancing watched shared branches, record the current staging release, source selector, controller revision, and live workload/migration baseline. Set `STG_RELEASE_PROMOTION_ENABLED=false` and wait for all queued/running promotion writers to finish using a supported watcher. Prevent concurrent manual apply dispatches during the cutover window. The flag does not stop an already-running writer and manual apply ignores it. Re-read the release afterward and adopt only an explained, verified baseline.

Resolve owners and refresh all relevant refs. Prepare a normal merge of selected stable head S into current AI head; inspect conflicts and preserve application changes. Merge its reviewed PR into `v3-ai` using a merge commit, then record resulting AI head A. Prepare/refresh a normal merge of A into current audit head, retaining all audit-specific commits. Merge its reviewed PR using a merge commit and record intermediate audit integration head C0. Final deployment candidate C is selected only after stage-3 source prerequisites land. Do not squash the synchronization PRs: preserved ancestry is their acceptance contract.

At this boundary prove S is an ancestor of A, A is an ancestor of C0, and the recorded prior staging release is an ancestor of C0. Check both merge parents and affected content; ancestry alone does not establish conflict-resolution correctness. Recompute full-CI results for changed merge trees. If a target advances before its merge, refresh that candidate and only invalidate affected evidence. Finish against one explicitly recorded source boundary; exclude unrelated PRs arriving afterward from this batch.

### 3. Qualify audit staging configuration and candidate

Route: executor for bounded worker-image template repair; main for configuration, migration, and operational validation. Acceptance: complete rendered workload inventory, qualified immutable artifacts, safe migration plan, and synthetic preflight.

Fix the two dedicated audit worker templates to consume the staging global SHA override, with explicit fallback behavior preserving other environments. They currently use mutable `v3-audit` tags. Render the exact candidate chart plus staging values and actual Argo parameters. Bind every enabled workload, including both audit workers and the PreSync migrator, to the approved candidate or separately recorded immutable digest; verify the publisher receipt covers each underlying image.

Staging audit values already specify `enabled=true` and `rollout=all`. Accept that explicit behavior only with audit identities/storage/retention dependencies proven. Record every new resource, effective configuration change, audit capability, and prune effect. Preserve existing retained evidence. The acceptance flow includes primary and copied/legacy-account images, including an explanation reference, and a verified owner export. Therefore refresh and qualify #5905 or an equivalent scoped repair before final C is selected; do not silently drop copied-media coverage to avoid its access prerequisite.


Compare source migration paths and hashes across both parents/result and obtain sanitized applied/pending migration ledgers for every affected staging database/client, including Analytics if independently connected. Rehearse the exact pending upgrade on an isolated representative schema with approved synthetic data and existing migration tooling. Record backup/restore readiness and forward-recovery compatibility. Do not reset shared staging, rewrite migrations, restore a production database into staging, or cancel an active migration. Missing ledgers or an unapproved destructive operation blocks deployment, not source preparation.

After image/media repairs land through reviewed PRs, select final C and repeat S → A → C ancestry, audit-only history retention, migration inventory and complete rendering against C. Verify all required candidate CI and the complete trusted publisher inventory on that final audit SHA, with successful selected-branch push runs and full-SHA registry digests. Build results from `v3-ai` do not substitute for audit-source evidence. Read live Argo Application ownership, target, values/parameters, hooks, current operation and autosync policy. Keep `targetRevision=stg-release`; unexpected live/source drift must be reconciled before promotion. No infrastructure apply is planned solely to change the source selector. Accept backup/restore readiness and the forward-recovery branch described in stage 5 before any apply. If activation qualification blocks, the source-delivery terminal is reviewed merged synchronization/fixes with recorded ancestry and CI, automatic promotion held, and an explicit unmet activation list; it must be reported as source complete and cutover blocked.

### 4. Switch selector and promote one exact candidate

Route: main; acceptance: verified controller receipt and release-ref readback, followed by rollout acceptance.

With automatic promotion still paused and no competing manual writer, set `STG_SOURCE_BRANCH=v3-audit`. Read back both variables. Dispatch `deploy-stg-promote.yml` from the verified trusted `v3` controller ref, specifying exact C and `dry_run=true`. Reuse the supported dispatch route; do not dispatch the candidate's workflow definition.

Require a dry-run receipt with source `v3-audit`, exact C, controller SHA T, complete CI/image evidence, old release R, an allowed fast-forward decision, and a valid receipt checksum. Workstream 1b adds mandatory manual-apply inputs `expected_release_sha` and `expected_controller_sha`; require the release still equals R before applying its CAS and `github.workflow_sha` equals T before any write. Automatic runs retain their current-release CAS. The existing lease alone does not bind an apply to a previous dry run. Recheck selected branch tips and the release immediately before apply. Changed candidate, controller, schema, image inventory, or unexplained release movement invalidates its dependent approval/evidence.

Under explicit execution approval, dispatch the same trusted workflow for C with `dry_run=false`, `confirm_ref_update=stg-release`, `expected_release_sha=R`, and `expected_controller_sha=T`. Read the actual workflow SHA for both dispatches; moving `v3` is not proof of controller identity. The controller's exact-old-SHA lease must perform a fast-forward. Require successful post-push readback: `stg-release == C`. A failed workflow may have pushed successfully; inspect the ref and receipt before any retry.

Follow the resulting Argo rollout using one supported watcher. Verify applied revision C, all expected image IDs/digests, successful PreSync migration, ready existing and audit workers, and scoped health. Use synthetic lecturer/student login, course/chat, ordinary assessment submission, and audit-enabled assessment flows. Audit acceptance includes submitted-answer evidence, image capture where applicable, and verified owner export; do not claim complete sealed-manifest evidence beyond the implementation's documented boundary.

Only after successful rollout and smoke evidence, set `STG_RELEASE_PROMOTION_ENABLED=true` with source still `v3-audit`. The new controller CI gate remains mandatory despite any future admin merge bypass. Re-enabling alone does not trigger deployment, which is why this sequence explicitly promotes C first.

### 5. Close out and establish recovery

Route: main; acceptance: recorded ancestry, settings, release, deployment, migration, and smoke evidence, with separate verdicts.

Read back the final variables and release, candidate ancestry, required checks and ruleset bypass scopes, Argo target/revision, image digests, migration outcome, and smoke results. Stop any task-local runtime started for verification under its lifecycle procedure. Update the existing CI/deployment guide and audit-image guidance when their contracts change; update the existing ADR only if its verified branch-routing policy differs. No new product primitive or application-domain ADR is introduced by this operational plan.

Before a release move, abort by retaining the old release and restoring the prior selector only after writer quiescence; leave automation paused until the old-source policy is again proven safe. After an audit release or migration, changing the selector back is not a rollback: the controller rejects backward/divergent release movement. Prefer a reviewed forward-fix descendant of C, built and qualified through the same gate. Restore old application images only with proven schema compatibility and separately approved deployment recovery. Never force-reset `stg-release` or roll back the database as an automatic branch of this plan.

## Verification and review contract

| Consequential behavior | Primary evidence/test obligation |
| --- | --- |
| Failed/cancelled/missing tests cannot qualify PRs or staging | `extend existing`: reporting/controller tests exercise actual status decisions; prove real failure, cancellation, irrelevant paths, draft-to-ready, retargeting, and administrator-bypass cases |
| Correct merge ancestry without losing downstream features | `none`: Git ancestry plus reviewed conflict diff; reuse passing checks only for unchanged tested trees |
| Every audit workload uses qualified immutable images | `none` for new maintained tests: run the actual Helm cases above and compare the complete rendered inventory to the publisher receipt; retain their commands and outputs |
| Migration safety and state preservation | `none`: existing migration tools, unchanged SQL hashes, actual ledgers, isolated upgrade rehearsal; no content-pinning tests |
| Safe selector switch and release advancement | `extend existing`: controller tests for new CI qualification and expected release/controller preconditions; reuse pause/manual/ancestry/CAS/readback coverage plus operational receipts |
| Staging actually serves the accepted audit candidate | `none` for additional maintained tests: Argo/workload/migration readbacks and existing synthetic browser/audit flows |

Required gates: frozen-plan planner challenge; simplifier after substantive source slices; one risk review covering CI trust, image identity, and migration/data effects; integrated final review before cutover readiness. Delegate settled separable source work; keep shared-ref mutations, schema conflict rulings, and live effects with main. Container-dependent checks run in the validated container; Playwright runs on the host. Planning starts no runtime.

## Progress and provenance

Plan review complete; native planner verdict APPROVED after two challenge rounds, followed by user implementation approval. Integration CI ruleset 23042613 now allows RepositoryRole 5 (administrator) bypass only through pull requests, verified by API readback. It still requires only check and check-gitleaks on v3-ai and v3-audit. Structural ruleset 23042595 and stable ruleset 23042571 remain active without bypass actors, verified by readback. Full CI/Playwright enforcement, workflow/controller fixes, synchronization, and cutover are incomplete. Retrying git fetch --prune still fails: cannot open .git/FETCH_HEAD: Operation not permitted; worktree creation previously failed on its ref lock. Restore Git metadata write capability before source delivery. No staging variable, release ref, cluster, or database was changed by this implementation step; do not pause the staging writer while source work is blocked.

The native planner inspected the pinned controller and identified manual-bypass/inflight behavior, exact-source publisher evidence, missing CI qualification, and forward-only recovery. Native planner round 1 returned REVISE. Accepted: hold before watched mutations; explicit source paths/evidence contract and ownership; final candidate after repairs; dry-run/apply binding; explicit audit activation, dependencies, and source-only terminal. Round 2 returned APPROVED on the corrected complete draft. This approval is an independent plan review, not authorization to execute. Optional AGY Gemini 3.8 Flash High review produced no output because headless read-file permission was denied. No permission bypass or client reconfiguration was attempted; the native review remains required. The complete scope includes private GitOps facts, so retain the trusted review boundary rather than submitting a partial public-only Browser review.


### Source references

- [Stable-to-AI comparison](https://github.com/uzh-bf/klicker-uzh/compare/48403f59789dca35df106002d1b2ec4e31d70a81...9cb4042334751fd80fde5b95319a6c41cdd4cdaa).
- [AI-to-audit comparison](https://github.com/uzh-bf/klicker-uzh/compare/9cb4042334751fd80fde5b95319a6c41cdd4cdaa...3de12f7f1a68f4c78325e73f914c628be4ed1e4f).
- [Trusted staging controller](https://github.com/uzh-bf/klicker-uzh/blob/48403f59789dca35df106002d1b2ec4e31d70a81/.github/scripts/stg-release-promoter.js) and [workflow](https://github.com/uzh-bf/klicker-uzh/blob/48403f59789dca35df106002d1b2ec4e31d70a81/.github/workflows/deploy-stg-promote.yml).
- [Audit deployment contract](https://github.com/uzh-bf/klicker-uzh/blob/3de12f7f1a68f4c78325e73f914c628be4ed1e4f/docs/assessment-audit-evidence.md).
