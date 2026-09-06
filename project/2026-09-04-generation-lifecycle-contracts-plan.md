# Generation lifecycle contracts and business-regression protection

Historical planning artifact, retained for device transfer. Execution and later
approvals moved to PR #5777 and its
`project/2026-09-04-pr-5777-generation-lifecycle-contracts-plan.md` on
`rs/generation-lifecycle-contracts`. Do not execute this superseded proposal.

## Research

- Problem: v3-ai integrates working feature branches. Normalization must reuse that code and preserve existing business behavior before 3.4.0 RC can qualify for stable v3.
- Baseline: fetched 2026-09-04. Published AI 1765a2d6394fc9a3f18bddd330dda70438510e23; stable 468f05b91503b133670dda235be9a4b38bba2155. Owned sync has local 208e97d38e6abfd13d997d48200077febc8c1445, not yet published. The two generation service files match the published baseline at this local sync. Never integrate it ourselves.
- Evidence: questionGeneration.ts:384-417,851-887,1029-1079 and flashcardGeneration.ts:335-373,795-835 repeat 15-second owner-scoped synchronization lease acquisition and token-fenced release. Preparing/review claims require a status predicate; ordinary polling claims currently do not. These are not interchangeable generic state transitions.
- Existing behavior: elementGenerationDispatch.ts and elementGenerationAccounting.ts already own reserve/claim/settle/release. knowledgeGraphAccounting.ts:32-36,73-122 deliberately separates ordinary releasable reservations from human-review holds. Reuse them, do not introduce terminal-status-wide release.
- Existing test gap: questionGenerationLifecycle.test.ts mocks provider/storage/Prisma; it covers retry/poll contention and review dispatch but cannot establish PostgreSQL atomicity. elementGenerationDraftPersistence.test.ts mocks manipulateElement and therefore cannot prove generated content respects the real Element persistence boundary.
- Ownership: multilingual processed-document plan in trees/question-generation-english-e2e, owned by task Klicker KB KG, explicitly owns the ingestion webhook/polling reducer, active serving tuple, knowledge.ts, graph dispatch/readiness, shared schema/types and UI. Consume its delivered results; do not implement a competing reducer. [PR #5756 — resource replacement](https://github.com/uzh-bf/klicker-uzh/pull/5756) replacement owns knowledge.ts and cleanup. [PR #5771 — cost controls](https://github.com/uzh-bf/klicker-uzh/pull/5771) cost controls owns chatbot policy; [PR #5764 — response-example capture](https://github.com/uzh-bf/klicker-uzh/pull/5764) capture owns response examples. Do not redirect or edit other tasks.
- Research routing: public-source lifecycle/test mapping via explore failed pre-work HTTP400; generic native Luna max continuity used. Main retains architecture, ownership and regression interpretation. External documentation is unnecessary for behavior-preserving extraction using existing APIs; consult current primary docs if an API uncertainty arises.
- Advisor and rival review: Claude advisor and final-reviewer failed OAuth authentication before work. Record absence; no opposing-provider result is claimed.

## Identity and execution contract

- Plan: `project/2026-09-04-generation-lifecycle-contracts-plan.md`. No PR exists for this package yet.
- Parent: [v3-ai pre-release improvement roadmap](./2026-09-03-v3-ai-pre-release-improvement-roadmap.md); this is a bounded first portion of W4 — lifecycle normalization, not completion of lifecycle normalization or data-model normalization.
- Tier/topology: full-path, one cohesive ordinary PR eventually targeting v3-ai. Backend lease reuse and its real database boundary tests are one independently useful concern. No new stack or changes to feature stacks. Subsequent data-model packages remain in parent roadmap order.
- Planning custody: existing trees/v3-ai-production-readiness; keep plan uncommitted here for approval. At execution, use/reuse trees/rs/generation-lifecycle-contracts and branch rs/generation-lifecycle-contracts based on the published, owned-sync result; transfer only this plan, not custody branch history. Record actual base and file equality before first edit. Check no existing owner branch/PR duplicates this package.
- Owner: current main task is execution orchestrator and integration/review owner; no hidden supervisory task.
- Authority now: read-only research, local plan/roadmap edits and independent planning review only.
- Approval requested: local worktree setup from the published sync, applying the existing schema to the newly created test-only database, in-scope edits, isolated synthetic test-runtime use, repository-native checks, required child reviews, Progress and local commits through source-reviewed terminal. This includes synthetic rows and their own scoped fixture cleanup in a dedicated local test database; existing repository cleanup/seed hooks are permitted only against the database created for this package and proven to contain solely disposable synthetic fixtures; no reset or broad cleanup of any pre-existing or shared database.
- Withheld: push, PR publication, ready status, branch integration/rebase/cherry-pick, any merge, stack alteration, shared runtime changes, secrets, real data, paid model/provider calls, staging/production, shared feature flags, new or changed migration files, staging/production migration execution, deployments, branch/worktree deletion.
- Terminal: complete locally committed package with focused and integrated checks, applicable reviews, exact-head evidence and updated parent Progress; publication marked delivery_pending, not pr_ready/release-ready.
- Pause: actual owner/path overlap; unpublished sync; missing safe test database; behavior changes beyond preservation; schema/public API/dependency change; an acceptance failure showing a pre-existing rule defect needing a separate decision. Routine slice/review corrections stay autonomous.

## Goal and non-goals

- Normalize the existing generation synchronization lease primitive once, preserving all caller-specific rules; prove it with real database contention and existing lifecycle tests. Add missing real Element integration evidence so AI-produced content does not bypass ordinary content rules.
- Zero Prisma schema, enum, relation, migration, Analytics model or public SDL changes. No identifier rewrite, state collapse, accounting redesign, retry-policy change, lease-duration change, renewal/heartbeat feature, provider contract change, UI change, generic workflow engine or new package/dependency.
- Graph/resource lifecycle implementation remains with current owners. Expiry/cancellation additions, ledger choice, response-example digest transition, resource revisions and migration-tail rewrite are later explicitly reviewed packages. Unknown invariants needing future storage are recorded there, never stubbed.

## Primitive impact and invariant boundaries

- ElementGenerationBuild: reuse identity/owner/state; share its existing lease acquisition and release. Public behavior unchanged.
- GeneratedElementDraft and ordinary Element: reuse canonical normalize/validate/manipulate path and atomic link; test only, no new persistence owner.
- KBGraphQuota and ElementGenerationSpend: reuse existing ledger and exception handling, no changes.
- User versus Participant; Participation.isActive remains leaderboard opt-in, not access. AI entitlement is additional to resource permission, never a replacement. No modifications to these primitives.
- ADR gate: no new durable product or architecture tradeoff; no new ADR. If extraction needs a new dependency direction, public contract, lifecycle behavior or schema, stop and amend plan before implementation.
- Documentation: update docs/async-and-workers.md only with the accepted internal lease owner and direct source link; preserve domain semantics. Parent roadmap gets package and residual ownership status. No new glossary or broad wiki cleanup.

## Delegation map

- Baseline and contract inventory: main (architecture/ownership coupling); acceptance exact sync, owner exclusions and five caller contracts below.
- Lease consolidation: main owns interface and integration; executor may implement the settled local module/callsite change with finite paths, returning uncommitted diff; acceptance existing lifecycle suite plus lease database tests.
- Real Element regression evidence: executor on the new integration test only, serial after lease changes; acceptance real persistence/concurrency/rollback evidence and reused permissions/snapshot checks without bypassing auth/validation.
- Finish: main with simplifier and slice-reviewer on substantive committed scope, then final-reviewer on integrated scope. Children cannot integrate upstream or publish. All substantive slices serial in one worktree.

## Frozen caller contract

Preserve the current five claim sites:

1. Question preparation: owner+build+PREPARING_INPUT and null/expired lease; loser rereads owned build; failure handler remains caller-owned.
2. Question polling: owner+build and null/expired lease; retain outer terminal/runtime/accounting checks, without adding a status predicate.
3. Question review dispatch: owner+build+expected review status and null/expired lease; preserve durable review claim and exact replay semantics.
4. Flashcard preparation/retry: owner+build+PREPARING_INPUT and null/expired lease; retain independent retry spend and incomplete-publication recovery.
5. Flashcard polling/publication: owner+build and null/expired lease; preserve its distinct NON_SYNCHRONIZING statuses and runtime capability check.
   All retain fresh token, 15-second duration, strict expiration comparison (equal is not expired), token-conditional release and caller finally semantics. No provider call inside a new database transaction; no transaction shared with unrelated activities. Lease expiry may allow a replacement worker; existing durable dispatch claim remains the external-effect fence. Do not claim lease alone ensures exactly-once execution.

## Test portfolio

- Lease ownership and races: extend questionGenerationLifecycle.test.ts only for uncovered caller wiring; add elementGenerationLease.test.ts real PostgreSQL two-client race, foreign owner, required-status mismatch, exact expiry boundary, stale-token release after takeover. Callback-error cleanup belongs in the caller-level lifecycle tests because the shared primitive does not own callbacks. Row assertions, not only mock call counts. Prove an old release cannot clear a successor claim. Do not infer universal state-write fencing from this acquisition/release primitive; characterize existing caller writes and stop on a reproduced unfenced business mutation. Preserve no-status poll variant.
- Existing spend safety: reuse elementGenerationAccounting.test.ts, elementGenerationDispatch.test.ts, knowledgeGraphAccounting.test.ts unchanged. Confirm duplicate reserve/settle, hold on uncertain claim, stale recovery and no provider dispatch after failed spend claim. Add no duplicate accounting suite.
- Ordinary Element boundary: retain elementGenerationDraftPersistence.test.ts for payload variants and Y-question-generation-review.spec.ts for real editor/save behavior. Add only missing database risks in elementGenerationPersistence.integration.test.ts: simultaneous identical keep requests produce one Element/link; conflicting requests cannot create an orphan or overwrite the winner; a controlled failure at the final link-write boundary rolls back the real Element and associated writes. Use real keepGeneratedElementDraft, manipulateElement, ownership/entitlement validation and PostgreSQL transaction. Allow a narrowly scoped test-only fault at the final link write, not a fake transaction or mocked Element service; document what the injected failure proves. Cover foreign-owner and disabled-entitlement no-write assertions here only if not already protected at an equivalent real boundary. Reuse existing element permissions/manual authoring and elementBatchOperations suites for non-AI behavior and explicit versus absent instance updates; add at most the missing non-AI entitlement case, not a second SC/MC/KPRIM/flashcard matrix. Do not change production behavior to make the tests pass.
- Stable sentinel suites: elementPermissions.test.ts, elementSharing.test.ts, coursePermissions.test.ts, courseChatbots.test.ts (leaderboard-inactive access), courseDeletion.test.ts/courseDeletionRequest.test.ts, elementBatchOperations.test.ts, manageAiFeatureGate.test.ts and packages/grading existing suite. Reuse existing tests, no new broad app suite. These are representative regression checks, not proof of every business rule.
- Unchanged structure: exact diff excludes Prisma/Analytics models and migration paths, SDL, package/lock manifests, types, worker configuration, request validation/Element services. Generated SDL equality and schema-sync check must pass. Unexpected changes block acceptance; never bless as formatting.

## Slices

### Contract baseline and test foundation

- Route main, reason architecture/ownership coupling. Record published synced base, current open PR overlap, versioned schema/migration file inventory, five callsites, their predicates and exception paths. No schema edit.
- Check known tests once against baseline in isolated runtime. Record baseline failures before editing; no pass by weakening tests. Add only absent contract fixtures/tests, sharing existing synthetic helpers when safe.
- Commit approved plan first (docs(project)); next test commit only if independently meaningful evidence. No plan-only PR.

### Shared generation lease, preserving both workflows

- Route executor for finite implementation after main freezes contract above. Paths packages/graphql/src/services/elementGenerationLease.ts (new), questionGeneration.ts, flashcardGeneration.ts; test/questionGenerationLifecycle.test.ts and test/elementGenerationLease.test.ts. Main accepts diff.
- Extract only acquisition/release primitives, not business transitions or arbitrary update-data API. Use explicit owner/build/optional expected-status selection matching caller table. Preserve type safety, transaction-client compatibility where existing code requires it, error propagation and finally ownership.
- Caller-specific failure resets stay where they are; do not deduplicate recordBuildFailure/recordStartFailure or merge question/flashcard state sets. Inventory remaining direct writes and label their existing domain owner; no empty grep milestone.
- Check lease database matrix and existing lifecycle, dispatch/accounting suites, package check/lint/format. Commit refactor(graphql), then simplifier and one architecture/concurrency slice review. No generic auth/lock helper.

### Prove generated content respects existing Element rules

- Route executor for finite test path; main owns fixture/auth interpretation. Paths packages/graphql/test/elementGenerationPersistence.integration.test.ts only, reuse existing synthetic setup; prefer local helpers in test over touching global helpers.
- Implement only absent integration obligations in portfolio. If behavior fails on baseline, preserve repro and ask before source fix; do not silently turn regression qualification into a new business rule.
- Check real database integration plus stable sentinel suites serially. Commit test(graphql); risk reviewer covers data-integrity evidence, simplifier required for substantive new regression-test logic; skip only documentation, mechanical or assertion-only edits that preserve the tested contract.

### Integrated local qualification and reconciliation

- Route main, critical-path integration. Update docs/async-and-workers.md and this plan. Re-run affected tests and repo check:all/build inside isolated worktree container. Restore no unrelated edits.
- No UI behavior changes intended. Because lifecycle extraction touches the backend path serving generation UI, verify the existing Y-question-generation-review flow with its seeded completed-build fixtures (no provider call) through host Playwright and capture its relevant review state with agent-browser; no real model calls. This is UI/persistence regression evidence, not proof of provider dispatch or lease contention. If this flow cannot run without provider spend, record the boundary and stop delivery_pending rather than claim UI proof.
- Exact committed scope final review: correctness, existing contract preservation, data integrity/concurrency, bounded security and architecture; not a broad security audit.
- Stop and verify exact task runtime unless user keeps it. Record source-reviewed/local evidence and publication not authorized. Parent W4 — lifecycle normalization remains partial; ingestion/graph owner work and broader transition normalization not declared done.

## Verification execution

All package commands run inside task container via devrouter exec <exact-checkout> --; host only Git/gh and pnpm playwright:host -- playwright/tests/Y-question-generation-review.spec.ts --project=chromium. Inspect current test script first: GraphQL test:local starts/stops shared compose volumes and prints token prefixes; do not use it in this parallel workflow. Use test (vitest run) directly in isolated configured runtime, serialized and with synthetic DB guard before mutations. Existing GraphQL testCleanup and Playwright global setup use unfiltered deleteMany; never run them on a reused worktree database. Create one dedicated empty database for this package, explicitly inject DATABASE_URL before Prisma import and never use the helper fallback URL. Run GraphQL and browser phases serially, keep the app connected to the database used by host Playwright, and allow native cleanup/seed only after proving all rows belong to this disposable fixture environment. Do not change global helpers or weaken cleanup guards.
Focused: pnpm --filter @klicker-uzh/graphql test -- test/questionGenerationLifecycle.test.ts test/elementGenerationLease.test.ts test/elementGenerationDispatch.test.ts test/elementGenerationAccounting.test.ts test/knowledgeGraphAccounting.test.ts test/elementGenerationDraftPersistence.test.ts test/elementGenerationPersistence.integration.test.ts.
Sentinels: same test command with named stable files above; pnpm --filter @klicker-uzh/grading test. Finish pnpm run check:all and pnpm run build. No new tooling. Reuse evidence on unchanged source/environment.
Before tests prove isolated local DB identity via values-free host/db class and synthetic fixture counts, correct worktree and absence of concurrent users; use no production URL or external service. Runtime skill at startup/finalization. If missing, block runtime checks without establishing shared/production connectivity.

## Data-model acceptance inherited by subsequent roadmap packages

This package leaves schema definitions and migration files byte-identical; synthetic test rows are temporary. Later model changes each require an exact before/after ownership map: one authoritative state owner, independently required identities, cardinality/uniqueness, nullable lifecycle semantics, immutable provenance and public consumer projections. Retain justified serving snapshots/audit ledgers; normalization does not mean eliminating every duplicate field.
Require generated migration provenance and minimum count, supported-data backfill without orphaned links, Prisma/Analytics equality, tracked SDL/codegen, custom indexes/checks/defaults preserved, production-applied and stable-branch migrations immutable, old-app/new-schema rolling compatibility and forward recovery. Any approved AI-only history rewrite needs its own allowlist, staging pause and production inventory. A feature flag never excuses malformed schema.
Trace effects on manual Elements/instances, derived permissions, activities, course deletion, invitations/assessment, points versus XP, chat budgets and participant ownership. Reuse existing business services instead of parallel AI-only implementations. Tests run against approved baseline and candidate; existing regressions and new ones are reported separately. This is a roadmap gate, not permission to edit those domains now.

## Planning review

- Native planner: round 1 REVISE; round 2 APPROVED on 2026-09-04. All three findings accepted and verified: retain explicit instance updates, reuse terminal-fixture UI evidence without claiming lease proof, and isolate destructive test hooks in one new synthetic database. No blocking findings remain.
- Research mapping found no confirmed source defect. Generation belongs to the GraphQL services; there is no Hatchet elementGeneration.ts at this baseline. Existing provider-correlation, accounting and maintenance paths remain owners of their effects. Processed-document source-identity compatibility remains an acceptance obligation for the active owner and later model normalization, not a competing implementation here.
- Review evidence is retained locally under project/\_local/reviews/2026-09-04-generation-lifecycle-contracts-plan-hardening.md. Native review approval does not grant implementation authority.

## Progress

Planning/research only; no application/runtime/forge changes. Plan review passed. No implementation authority yet. Boundary owner: self (the main consolidation task). Next after approval: verify published sync/ownership, establish dedicated worktree and focused baseline, then execute through local source-reviewed terminal. If sync not published, readiness gate remains open; do not duplicate integration.
