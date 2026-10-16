# V3 release qualification and gated production cutover

## Approval summary

Qualify one immutable v3 candidate containing [the beta and AI-approval changes](https://github.com/uzh-bf/klicker-uzh/pull/5799) and [the merged disclaimer fix](https://github.com/uzh-bf/klicker-uzh/pull/5696). Reconcile already-merged changes without adding optional features or merging all of v3-ai. A frozen candidate means a recorded SHA, not a calendar freeze on other development.

Approval permits local qualification only: create the dedicated repo-local worktree from the selected merged candidate, write the manifest and operational approval packets, run isolated synthetic checks and repository release dry-run, make minimal local release-tooling corrections if verified necessary, perform scoped reviews, and commit locally. Existing PR monitoring continues under its existing limits. It does not authorize merging, pushing, tagging, publication, new live connectivity or data access, production-derived cloning, token provisioning, approval or GrowthBook writes, infrastructure changes, or deployment.

The main risks are incompatible clients after the approval-column drop, interruption of existing Chat by default-false AI approval, incomplete database coverage, and accidental rollout expansion. Existing beta, Catalyst, publication and participant rules remain unchanged. No automatic owner approval is allowed.

Local completion requires an exact-candidate manifest, passing applicable synthetic verification, a successful release dry-run, and a reviewed preparation package. Unknown operational facts remain explicit gates. Source publication, immutable production artifacts and PRD activation are later, separately approved outcomes.

## Evidence and working context

Main owns the goal and final evidence. The beta worktree is trees/rs/v3-production-release on rs/v3-release-verification at 3b019cb2023c431faf69abceeb81ca1135f1fb8d. Fresh forge read on September 7 still shows PR5799 open; shard7 is running, final-ai-review pending, GitGuardian failed. The preceding hosted review exhausted its budget; no retry or waiver is inferred. Current v3 reference b8a3e9f04d02b90165c4647c52a179c1ab7c632a contains the disclaimer. Refresh facts before candidate selection, not by repeatedly integrating upstream.

Existing qualification evidence and approved policy live in project/2026-09-05-v3-beta-authoring-gate-plan.md and project/2026-09-06-v3-release-readiness.md. Their older status receipts are historical. Do not edit those merged-package plans to represent this new package. Preserve the user's untracked readiness assessment and unrelated screenshots.

This reviewed plan may be held uncommitted in the existing task worktree before merge. After candidate selection, transfer the plan without overwriting into trees/rs/v3-release-qualification, branch rs/v3-release-qualification, and commit only there. No new plan is published in the old PR. New package artifacts use the same project/ root: this plan, 2026-09-07-v3-release-qualification-manifest.md (including evidence), and 2026-09-07-v3-release-cutover-packets.md. Reviews stay ignored under project/\_local/reviews/.

No new product primitive, data schema or architectural policy is approved. Preserve ADR0008 feature-flag ownership, ADR0020 publication approval, ADR0041 trusted pilot boundary, and ADR0001 migration-hook behavior. A changed authorization, migration, public contract, live data flow or infrastructure ownership requires a plan amendment and explicit ruling.

## Execution contract and ownership

Authority: user approved the local execution plan on September 7, 2026. Boundary owner: self.
Terminal: reviewed, committed local qualification package; not released or deployed.
Pause: missing authority, an unavailable required independent route, unresolved material scope/risk choice, or a failed required check that cannot be fixed within the approved local scope. Continue independent local work while external gates wait.

### Delegation Map

| Workstream          | Slices and owner                                                      | Acceptance                                                                                         |
| ------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Candidate and QA    | Candidate selection S1, verification S4, integration S5: main         | Exact SHA/evidence mapping, successful dry-run, applicable synthetic checks and local final review |
| Database/deployment | Source compatibility map S2: native explore role; main owns decisions | Ordered migration and client map; exact missing live/rehearsal proof                               |
| AI approval/rollout | Dependency map S3: native explore role; main owns policy              | Narrow token/approval path and known-finding disposition; no inferred approval or widening         |

The configured explore route failed before work; this initial source mapping uses the trusted native executor continuity fallback, with its role difference recorded. Future mapping dispatches target explore under the routing continuity rules. S2 and S3 depend on provisional baseline reads followed by mandatory reconciliation against S1. S4 remains owned by main; any delegated checks are subordinate to that ownership.

Use configured routes and bounded clean contexts. Public source can use explore; secret-bearing or personal material never leaves main/operator boundary. S2 and S3 have disjoint reads and can proceed provisionally while merge waits, then reconcile against S1. Main is the sole artifact writer. S1/S5 remain main because candidate and safety decisions are coupled; S4 may delegate independent synthetic checks under the runtime contract.

## S1 — Select the candidate and establish provenance

Confirm PR5799 merge and actual required-check disposition through host gh; do not merge or retrigger it. Verify disclaimer inclusion and inspect all already-merged changes beyond the reviewed beta baseline, including staging-promotion changes. Record the precise selected v3 SHA and why the combined source is eligible. A material unexplained delta blocks candidate acceptance, not independent preparation.

Create the dedicated worktree at that SHA after auditing existing worktrees and ignore rules. Do not reuse the primary checkout for implementation or rebase the old PR. Record candidate SHA, exact executable qualification SHA, qualification-document HEAD and eventual versioned release SHA separately. Any tooling or test correction records its exact executable delta from the candidate and becomes a prerequisite to later source publication. Rerun affected checks against the corrected qualification tree; do not claim the original candidate passed unchanged. The eventual release SHA must contain every accepted correction. Any later candidate change requires explicit selection and affected-check reconciliation.

Manifest fields: general production reference alpha.73, Chat-only alpha.73.3, source provenance, proposed version/channel, release-SHA relationship, component repositories/architectures/workflow receipts/tags/digests, migrator, chart/values revision, non-secret PRD build arguments and runtime references, migration names/checksums/effects and evidence status. Digests and live facts unavailable before publication stay pending, never invented.

Commit the approved plan first; then manifest updates with their qualifying slice.

## S2 — Map migration and client compatibility

Recalculate candidate migration delta from v3.4.0-alpha.73. The beta source currently adds seven: chatbot lifecycle; account usage; sole AI approval; turn lifecycle claim; course-deletion request; standard-mode config; beta preference and redundant-approval-column removal. Preserve shared v3-ai migration identity and checksums; flag modified historical SQL or unexpected schema deltas. This is source inventory, not the live pending count.

Map all backend, assessment, Chat, worker, Analytics and independent clients to configuration references and generated schema. Account for every running/rollback image selecting aiChatbotPublishingEnabled; no compatible rollback claim from a tag alone. Verify the migrator's primary-backend Secret reference does not establish separate assessment coverage. Record source-derived topology separately from live receipts.

Acceptance: complete source inventory and client map, with concrete operational evidence requests. No live reads or migration execution here. Main integrates the result into the manifest and cutover packets.

## S3 — Resolve narrow approval and known-finding dependencies

Map v3-ai's approval writer and valid-token provisioning/validation behavior without importing the branch. Distinguish implementation, exercised synthetic behavior and unproven live credentials. A serving/published chatbot, betaEnabled or a token merely being present never substitutes for policy-approved valid provisioning.

Prepare requirements for a private named approval set: authorized policy owner, target accounts identified by the operator, validity evidence, continuity or explicitly accepted interruption, conditional post-migration operation, expected changes and audit/verification. No owner IDs, tokens, rosters or chat content enter public artifacts.

Map only previously recorded material Chat-history findings associated with [PR5676 — server-authoritative history](https://github.com/uzh-bf/klicker-uzh/pull/5676). No broad assessment or vulnerability reproduction. For each, main records fixed evidence, proven non-applicability, approved containment or a blocking unresolved issue. The full feature is not an automatic dependency; an accepted security blocker is not silently deferred.

Use the existing GrowthBook transition: deploy first, verify trusted betaEnabled, canary a precise rule change, preserve actor/Catalyst/environment/role/narrow cohort and DB opt-out. No management provisioning for beta enrollment; general backend management wiring remains. Cohort expansion and saved-group deletion need separate rulings.

Acceptance: narrow source dependency and known findings have evidence and explicit gates. Missing live provisioning or findings may block activation, but local preparation can finish honestly with those gates open.

## S4 — Verify the frozen source with synthetic data

Use repository Node/pnpm/Python versions and existing suites. Run container toolchains in an isolated task runtime; Git and Playwright launcher stay on the host. Read applicable runtime/testing/database skills before runtime work. Fresh marked restricted disposable databases are the only reset/seed targets. Stop and verify the exact runtime afterward; no retained resource deletion is implied.

Test obligation: reuse or extend existing consequential seams, no new suite by default. Verify default-on beta persistence, opt-out defeating permissive rollout, intended eligible authoring without AI approval, unapproved model denial before provider work under both budget settings, synthetic approved-owner admission, and permitted participant access with approved owner beta-off. Retain login, Live Quiz, assessment, worker and dark-mode disclaimer smoke. Synthetic provider fixtures do not prove real token validity or provider service.

Map earlier tests/builds/browser evidence by unchanged source/config/toolchain/acceptance; run affected combined-candidate checks and inspect actual non-skipped outcomes. Root check:all, schema/Analytics parity, production build and relevant browser behavior need either applicable recorded proof or new runs.

Verify the repo script before release:alpha:dry (or selected channel). Check before/after versions, changelog, Git HEAD and tags to prove dry-run did not mutate them. Historical alpha.74 is tentative. .versionrc.js currently references absent packages/lti and packages/hatchet-tasks; verify dry-run behavior before calling this a defect. Minimal confirmed local release-tooling corrections preserving versioning intent are in scope; no dependency upgrade, authorization/migration change or release action is.

Acceptance: qualified synthetic matrix and successful dry-run with honest warnings and no model/live-data access. Any local fixes get focused checks and risk-appropriate reviews before evidence commits.

## S5 — Integrate the local package and prepare approval requests

Review migration/approval/cutover documents for data-integrity and control boundaries. Documentation-only work skips simplification; substantive code fixes arm applicable roles. Commit scoped content after formatting/links and secret/personal-data inspection. One integrated final reviewer checks the complete local package and evidence, reusing unchanged prior reviews. Apply the same-child correction budget to material findings.

Record local qualification status separately from source publication, artifact completion and PRD activation. Later gates do not count as passed. A generic proceed never crosses an external boundary omitted from the granted approval.

## Later operational approval packets

Each packet names an approver/operator, exact targets, reviewed commands or diff, limited data scope, evidence, abort/recovery criteria and terminal. Unknown targets make it non-executable.

| Packet                   | Required evidence and separately authorized effect                                                                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Live preflight           | Named connectivity route; database identities and migration ledger/checksums; assessment sharing; all clients and rollback images; actual Argo/automation ownership; backups/recovery. Values-free receipts where possible. No clone/write.                                                                        |
| Isolated rehearsal       | Approved production-derived source and destination, minimization, encryption, operator-only access, retention and verified cleanup; full pending-range migrate deploy and exact compatible-app validation, locks/defaults/backfills/Analytics/recovery. Never relabel as test-disposable or run reset/seed suites. |
| Source and artifacts     | Confirm version/channel, exact version commit and authorized remote/tag. Verify release-SHA checks and every required production image digest, matching migrator and PRD configuration before choosing deployment values.                                                                                          |
| Approval and maintenance | Private approved-owner set with valid provisioning; explicit phased traffic/producer fence, drain/reconcile, stop/prove incompatible clients absent, migrate, validate, apply conditional approvals, start compatible apps, smoke and reopen. Automation cannot restore clients between phases.                    |
| GrowthBook canary        | New application and trusted attributes proven; approved exact cohort/rule diff, observable acceptance and restoration of prior targeting while retaining DB opt-out. No force-on bypass or group deletion.                                                                                                         |

Maintenance must account for Argo/ApplicationSet auto-sync/self-heal, autoscalers, Reloader, workers/retries/schedules and independent administrative/Analytics/assessment clients. Set concrete stop/drain/lock/recovery thresholds before execution. Same-sync zero replicas and migration is insufficient: PreSync precedes normal manifests. Selective sync omits hooks. Use separately completed controlled phases, not a guessed command sequence. A failed phase holds traffic fenced; application rollback alone cannot undo a column drop. See [Argo sync phases](https://argo-cd.readthedocs.io/en/latest/user-guide/sync-waves/) and [resource hooks](https://argo-cd.readthedocs.io/en/latest/user-guide/resource_hooks/).

Production-derived clone and owner records are purpose-limited to rehearsal/approval, minimized and kept out of Git, screenshots, logs and external model prompts. Controller/data steward must approve processing basis, destination/access and retention before collection. Revalidate approval accuracy at cutover; record a sanitized operator receipt, not identities or token values. No new personal-data collection occurs in local qualification.

## Progress

User approved local execution on September 7, 2026. Selected candidate: `7c73ed231ce89885f634d37fece86c621424f617`, the merged beta PR plus disclaimer. Dedicated branch `rs/v3-release-qualification` has no upstream and starts exactly at that candidate. The primary `v3` checkout remains untouched, 16 commits behind `origin/v3`. The beta PR monitor is paused after merge.

Candidate selection, migration/client mapping and approval dependency mapping are reconciled against the frozen candidate. The manifest records seven migration checksums, all production image repositories and unresolved live evidence. The cutover packets preserve separate approval gates; they are not executable commands.

Synthetic qualification passed: exact-candidate CI, 80 local workflow tests, a focused two-migration default/separation SQL probe, and 29 Chat admission tests including the new beta-off owner regression. Candidate Playwright passed with one retried Live Quiz test and five explicitly recorded wizard skips. The corrected release dry-run processes all 21 configured package targets without changing files, HEAD or tags. Application source and migrations are unchanged by this package.

Local correction commits: `07e99dd2` restores configured version targets; `83ed4ca3` adds participant admission regression coverage. The regression's simplifier and slice reviewer found no actionable changes. Mapping used the existing trusted executor fallback after the original explore route failed. Native planner hardening approved in round 2; the optional external planning rival failed before providing a review. Required AGY advisor consultation later completed, with its control-boundary concerns incorporated.

Local terminal reached: native integrated final review of `7c73ed23..28a38fe2` found one documentation correction, now verified and applied: PRD workflows produce ARM artifacts; AMD jobs are disabled. No actionable code/test finding remains. Subsequent documentation-only lesson and status updates passed parent diff, formatting and link checks. No roadmap item is being added or advanced to a published/live state. Next authority boundary is pushing this local package for source review; operational access, rehearsal, activation and release remain separate.

The fresh isolated PostgreSQL container is stopped; no managed runtime was started. No production connection, production-derived clone, account/flag write, tag, push or deployment occurred. Source publication and all operational packets remain separately gated.
