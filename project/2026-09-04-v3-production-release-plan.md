# V3 release preparation

## Research and scope

- Goal: prepare current v3 for tagging and release creation. The user explicitly removed backup/restore exercises, a scheduled freeze, and production cutover preparation from this package on September 4.
- Branch: rs/v3-production-release, tracking origin/v3. Baseline: 468f05b91503b133670dda235be9a4b38bba2155. Remote refreshed September 4; zero ahead/behind. Preserve unrelated changes in the primary checkout.
- General production baseline: v3.4.0-alpha.73. Compare Chat-only hotfixes separately against v3.4.0-alpha.73.3; that maintenance tag does not change the database baseline.
- Database evidence: 179 successful production migrations match alpha.73 names and checksums. Candidate adds four SQL files, reaching 183; no historical SQL changed. Regular and assessment backend database identity matches. Analytics schema mirrors match. Generated migration provenance remains unverified.
- Independent standards and specification reviews are complete. No new high-severity defect was identified in the prioritized database-related source. These were source reviews, not exhaustive application audits or runtime proof.
- Existing blockers: current v3 has a failing live-citation overflow assertion; Next.js and next-auth need patch updates; the production Chat disclaimer fix must not be lost when replacing its maintenance image.

## Execution contract

- Authority: the user's instruction to make everything ready authorizes the narrowed local preparation package, checks, reviews and local commits. Main owns integration and verification.
- Terminal: reviewed local release-hardening commits, verified release tooling and concise release notes/checklist. Report the exact remaining merge/publication actions; do not claim the changed branch is already v3.
- Withheld: pushes, PR publication, upstream integration, merges, release tag/publication, production changes, GrowthBook changes, infrastructure actions and deletion. No new cluster connectivity.
- Non-goals: backup/restore rehearsal, maintenance/drain exercises, a calendar freeze, production deployment approval, v3-ai integration, new feature stacks, architecture redesign, new migrations or blanket AI gates.
- Pause only for missing authority or required capability, a failed check requiring a materially different change, or a new product/data-integrity decision. Do not stop at routine slice or review boundaries.
- Plan review: the previous broader plan completed three native planner rounds, ending with two mechanical ownership corrections that were applied. It was not labeled APPROVED. The user's narrowed instruction supersedes its operational gates. Reuse its source findings; no new design or migration strategy is introduced by this scope reduction.
- Packaging: one cohesive release-hardening package on this worktree, plus the existing disclaimer PR. No stack restructuring. No new product primitive or ADR decision.

## Work and ownership

| Work | Owner | Acceptance |
| --- | --- | --- |
| Stabilize the citation layout assertion and correct the credit comment | Main; small edits cost less than delegation | Same paused-stream contract; focused Chromium repetitions without retry masking; formatting/type checks |
| Patch Next.js and next-auth consistently | Native executor for mechanical updates; main owns security disposition | Exact versions and lockfile agree; frozen install, package checks, supported builds and relevant tests |
| Verify database release payload | Main; coupled data-integrity evidence | Four unchanged additive migrations; valid matching schemas; synthetic migration smoke where available; no production mutations |
| Reconcile hotfixes, open PRs and release tooling | Main | Explicit required/deferred PR list; release dry-run; release notes distinguish features, flags and database changes |
| Review complete preparation package | Native final reviewer | Exact committed range; correctness, security, maintainability and plan compliance; honest CI-only gaps |

## Test portfolio

| Risk | Obligation | Evidence |
| --- | --- | --- |
| Live citation layout timing | Extend existing observation, no new test | Existing paused stream, sources hidden while running, viewport overflow and follow-scroll assertions |
| Framework/auth patch regression | Reuse existing tests | Frozen install; check:all; production and test build paths; Chat tests; focused auth/browser checks |
| Migration payload inconsistency | No new permanent test by default | SQL delta/checksums, Prisma validation, Analytics mirror check, disposable migration smoke if supported |
| Lost Chat maintenance behavior | Reuse existing PR evidence plus interaction check | Disclaimer patch is retained before Chat release; no import of the larger conflicting Doc Query stack |
| Release command changes files or selects wrong version | No new test | Repository-native release dry-run only; inspect resulting proposed version and changelog without tag creation |

## Source preparation

- Patch Next.js 16.2.10 to 16.2.11 in direct application dependencies, keeping related framework package resolution and workspace peer ranges consistent. Patch next-auth 4.24.14 to 4.24.15 in Auth and backend. Regenerate the lockfile with the configured pnpm version; no major upgrades or unrelated refresh.
- Change the immediate viewport overflow measurement to bounded retrying observation. Preserve the paused stream and all source-card and scrolling expectations. The timing diagnosis remains provisional until the focused test passes.
- Correct the credit-decrement comment: the implementation clamps the balance at zero, not an insufficient-funds exception. No behavior change.
- Keep the unused nullable aiChatbotCostCenter field for this release. Do not rewrite a merged migration or add a consumer just to justify it.
- Preserve [PR #5696, Chat disclaimer dark-mode fix](https://github.com/uzh-bf/klicker-uzh/pull/5696). Reuse that existing PR; merge remains separately authorized.
- Do not import [PR #5709, scoped Doc Query activation stack](https://github.com/uzh-bf/klicker-uzh/pull/5709): relevant runtime work is already merged and the broader branch conflicts.
- Defer [PR #5694, topology spreading](https://github.com/uzh-bf/klicker-uzh/pull/5694), optional [PR #5725, nanoid update](https://github.com/uzh-bf/klicker-uzh/pull/5725), and new features. Assess [PR #5724, Tornado update](https://github.com/uzh-bf/klicker-uzh/pull/5724) only if Analytics is included in the release artifacts.
- Commit the plan, dependency patch and assertion/comment fixes separately after applicable checks. Mechanical dependency edits and assertion-only edits do not need a simplifier; dependencies arm a bounded security slice review. Complete integrated final review after all authorized local checks.

## Database and flags in release notes

| Migration | Released effect |
| --- | --- |
| 20260820151622_chatbot_lifecycle_and_ai_capability | Adds publication states and owner capability fields; existing bots become PUBLISHED and new bots default to DRAFT |
| 20260822075407_chat_account_usage | Adds initially empty monthly owner usage accounting |
| 20260826012006_chat_turn_lifecycle_claim | Adds COMPLETED default and nullable attempt ID; SQL is not explicitly wrapped in a transaction |
| 20260902100000_course_deletion_request | Adds nullable asynchronous deletion request marker |

- Usage UI and protected query use ai-beta. beta-signup governs new enrollment and discovery while preserving opt-out when closed. Do not activate or broaden either remotely.
- Catalyst/full-access chatbot authoring is not universally gated by ai-beta. Publishing has separate entitlement and approval checks.
- Participation existence is the access boundary regardless of isActive; isActive controls leaderboard inclusion only. Preserve Luna fallback and prompt privacy.
- Record known recovery limitations, not release-preparation gates: abandoned IN_PROGRESS claims and a crash between deletion marker persistence and event publication need guarded operator recovery. Attempt tracking off still permits lifecycle rows. Old publication/status-unaware readers are not a safe blanket application rollback.
- Tagging and release creation do not deploy the database or approve production operations. No deployment-readiness claim will be made.

## Progress

- Completed: remote refresh, live production baseline comparison, four-migration inventory, independent standards/specification reviews and main disposition.
- Active: local source preparation on the unchanged v3 baseline.
- Remaining: dependency patch, assertion fix, native verification, source review and release dry-run/notes.
- Review reports: project/_local/reviews/2026-09-04-v3-unreleased-code-quality.md and the earlier plan-hardening report. Both are ignored local evidence.
- Runtime: exact worktree startup requested with devrouter 0.0.51 and the chat profile. Stop and verify the exact runtime after the last check.
