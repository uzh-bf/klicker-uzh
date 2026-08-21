# Phase 0 — chatbot lecturer HITL foundations (implementation plan)

Roadmap: [`project/2026-08-20-chatbot-hitl-lecturer-configuration-roadmap.md`](2026-08-20-chatbot-hitl-lecturer-configuration-roadmap.md)
(roadmap source; implementation PR #5460). ADRs
[0019](../docs/adr/0019-chatbot-config-postgresql-authoritative.md),
[0020](../docs/adr/0020-two-tier-chatbot-approval.md),
[0021](../docs/adr/0021-templated-standard-modes-reviewed-custom-modes.md),
[0022](../docs/adr/0022-no-student-text-in-manage.md).

Planner pass complete (2026-08-20): verdict "ready with named edits"; F1–F7
folded in below. D3 resolved from code.

## Goal

Backend foundations that make lecturer self-service chatbots real and safe:
a per-chatbot lifecycle status machine, an account-level AI publishing
capability, chatbot create/update/publication-request/approve/reject mutations
with three-layer auth enforced in the services, a participant-access gate that
only serves `PUBLISHED` chatbots, and a behavior-preserving prompt-compile seam
that later phases layer persona fields onto.

## Non-goals

- No manage UI (Phase 1) beyond what GraphQL exposes. Verified via GraphQL
  service-seam tests + typecheck + a single participant browser smoke.
- No persona-field editing, examples, knowledge self-service, custom modes,
  admin queue UI (Phases 1–6).
- No account-wide base/advanced usage counters, usage lanes, or class-aware
  charging in this Phase 0 PR. The approved pragmatic usage-funding MVP is
  recorded in ADR 0020 and the roadmap for its implementation follow-up;
  existing participant usage credits remain a separate legacy allowance.
- No behavior change to existing chatbots' prompts — the compile seam is
  extracted behavior-preserving; persona layering lands in Phase 1.
- **No team email on publication request in Phase 0 code** (F6 ruling, veto-able):
  ops watch the `PENDING_APPROVAL` state via query/Prisma Studio in the
  first-cut ops flow; the notification lands with Phase 1's in-app request form.
  Roadmap Phase 0 listed it under ops-shaped approvals; deferring the send is
  ops-convenience, not correctness.

## Execution contract

- **Owner**: main session, autonomous through Phase 0's terminal condition per
  the user's "begin the implementation" go-ahead.
- **Authority granted**: worktree (done), local commits on
  `feat/chatbot-lecturer-config-phase0`, bring up the worktree devcontainer
  stack for verification, author the migration incl. backfill. **Withheld**:
  merge, deploy, deletion.
- **Terminal**: all slices committed and verified in-container; PR #5460 against
  `v3` with the plan as first commit; runtime stopped per
  `$rs-local-runtime-lifecycle`.
- **Pause** (needs user): a GraphQL-contract change beyond this plan; the
  compile refactor proving not behavior-preserving; admin-auth ambiguity risking
  privilege escalation (mitigated — D3 resolved).

## Plan identity

- Plan: `project/2026-08-20-chatbot-hitl-phase0-pr-5460-plan.md`
- Branch: `feat/chatbot-lecturer-config-phase0`, target `v3`, worktree
  `trees/feat-chatbot-lecturer-config-phase0`. PR: [#5460](https://github.com/uzh-bf/klicker-uzh/pull/5460).

## Grounding facts (verified 2026-08-20)

- `Chatbot` has required `owner` (`ownerId`) + `course`. Sole mutation
  `updateChatbotModelSettings` authorizes via `t.withAuth(asUser)` +
  `where: { id, ownerId: ctx.user.sub }` (services/chatbots.ts:416-419).
- `UserRole { ADMIN, USER }`; `User.role @default(USER)`; Catalyst flags exist
  (user.prisma:106-108). Admin scope `asAdmin = { authenticated: true, role:
  ADMIN }` at mutation.ts:110, spent via `t.withAuth(asAdmin)` (mutation.ts:1638,
  query.ts:250). Role resolver builder.ts:66-79 — an ADMIN also passes `asUser`.
- Catalyst scope `asUserWithCatalyst` (mutation.ts:111) used on ~23 mutations.
- Chat is participant-facing (`participant_token`, apiGuards.ts:10); no User
  auth path. Shared guard `getChatbotOr404`/`withChatbotAuth`
  (apiGuards.ts:52-113) fronts all 9 participant API routes; server shell fetch
  at `app/[chatbotId]/layout.tsx:23`; participant listing
  `getParticipantCourseChatbots` (services/chatbots.ts:215-231) powers the PWA
  course-page link.
- Prompt resolution inline in route.ts:710-724 (resolve) + :809-811 (contracts);
  `systemPrompt` unused between → extractable as one call. Only `tutor` has a
  `DEFAULT_PROMPT` (prompts.ts:3-17). Seed prompts are already-full text
  (`prisma-data/src/data/data/tutorMode.txt`, `explainerMode.txt`).
- GraphQL tests call **service functions with a forged ctx**, bypassing Pothos
  (test/courseChatbots.test.ts:61-77), and `testCleanup` deleteMany's core
  tables against the dev `DATABASE_URL` (test/helpers.ts:341-369) — the run
  wipes the dev DB; reseed after.

## Resolved decisions (was D1–D4)

- **D1 Account AI capability**: two `User` columns
  `aiChatbotPublishingEnabled Boolean @default(false)` + `aiChatbotCostCenter
  String?`, separate from Catalyst. The capability check reads the **`User` DB
  row inside the service**, never a JWT claim (ops flips the flag after token
  issuance); no new token claim in Phase 0.
- **D2 Publication-request fields**: columns on `Chatbot`
  (`publicationUseCase String?`, `expectedStudentCount Int?`,
  `reviewComment String?`, `publishedAt DateTime?`). `proposedCredits` writes the
  existing `creditInitial/ResetPeriod/ResetAmount/MaxCredits` columns
  (chat.prisma:115-118) at request time — student-inert until PUBLISHED once S4
  lands.
- **D3 Admin authz**: use `t.withAuth(asAdmin)` at the schema layer **and** a
  service-level `ctx.user.role !== UserRole.ADMIN → reject` (tests bypass Pothos,
  so the service check is what the "admin authz" test can actually fail).
- **D4 Compile seam**: behavior-preserving extraction of
  `compileSystemPrompt(chatbot, mode, toolNames)`; acceptance is
  **characterization tests** (no pre-refactor function to snapshot), matrix:
  (a) `systemPrompts[mode]` present, (b) absent → `DEFAULT_PROMPT` (tutor only),
  (c) unknown mode → `''`; each × {doc_query tool present / absent}. Preserve
  quirks (empty-prompt fallback, unconditional language contract, conditional
  citation contract); do not fix them here.

## F6 rulings (veto-able, made to avoid blocking)

- `createChatbot`/`updateChatbot` use `t.withAuth(asUserWithCatalyst)` (ADR 0020
  "Catalyst reveals creation"; repo precedent). `updateChatbotModelSettings`
  stays `asUser` (grandfathered).
- Team email deferred (see Non-goals).

## Primitive impact

| Primitive | Disposition | Contract delta |
| --- | --- | --- |
| Chatbot | Extend | Lifecycle status, ownership-gated CRUD, publication fields |
| Account AI capability | Create | Account-level publish gate (DB-row check) |
| Publication (go-live) | Create | Approved transition; participant access gated on it |
| System-prompt compilation | Extend (seam) | Behavior-preserving extraction; Phase-1 layering seam |

## ADR gate

Decisions recorded in ADRs 0019–0022 (docs PR #5453). No new Phase 0 ADR.

## Test portfolio (feature-wide) — seam = service functions (Pothos bypassed)

| Risk / behavior | Obligation | Seam | Distinct failure | Slice |
| --- | --- | --- | --- | --- |
| Lifecycle transitions legal + illegal (incl. REJECTED→PENDING) | add new | GraphQL service test (live DB) | PUBLISHED without approval; illegal transition allowed | S3 |
| Ownership authz | add new | service test | non-owner mutates another lecturer's bot | S2/S3 |
| Admin authz (service-level role check) | add new | service test | lecturer self-approves | S3 |
| Account capability gate (DB-row) | add new | service test | ungated account publishes | S3 |
| Participant access gate | add new | `getChatbotOr404` unit/route test + Y-chat e2e | draft bot answers/leaks to students | S4 |
| Compile seam behavior-preserving | add new | unit test on `compileSystemPrompt` | scaffolding dropped / prompt changed | S5 |

Every test run reseeds afterward (`prisma-data seed:raw`) before any
route/browser verification (F4).

## Delegation Map

| Item | Assignee | Depends on | Acceptance |
| --- | --- | --- | --- |
| S1 schema+migration+backfill+seed status | main | — | migration applies; existing rows backfilled PUBLISHED; prisma:sync + typecheck green |
| S2 create/update mutations + owner-type exposure | main | S1 | service tests: happy path, non-owner rejected; codegen green |
| S3 publication workflow (capability gate, asAdmin+service role check, DRAFT/REJECTED→PENDING) | main | S1, S2 | service tests: each legal/illegal transition, non-admin rejected, ungated rejected |
| S4 participant gate (getChatbotOr404 + layout + getParticipantCourseChatbots + playwright fixtures) | main | S1 | non-PUBLISHED 404 test; Y-chat green; browser smoke on seeded bot |
| S5 compile-seam extraction + characterization tests | main | none (merge last) | characterization matrix green; diff shows moved-not-changed |
| planner (done); per-slice simplifier + slice-reviewer (S1 data-integrity, S2/S3 contract+authz, S4 security, S5 architecture); final-reviewer pre-PR | native subagent roles | per workflow | reports; advice verified by main |

No separate tasks; nothing crosses a boundary warranting one.

## Slices (tracer bullets)

- **S1 — Schema + migration + backfill.** `ChatbotStatus` enum
  (DRAFT, PENDING_APPROVAL, PUBLISHED, PAUSED, REJECTED); Chatbot columns
  `status @default(DRAFT)`, `publicationUseCase`, `expectedStudentCount`,
  `reviewComment`, `publishedAt`; User columns `aiChatbotPublishingEnabled`,
  `aiChatbotCostCenter`. **Migration backfills existing rows
  `UPDATE "Chatbot" SET status='PUBLISHED'`** (F1 — prevents prod outage);
  `seedChatbots.ts` sets `status: PUBLISHED` in **both** create and update
  branches. `prisma:sync` (analytics mirror), regenerate client. `PAUSED` has no
  Phase 0 transition (ops-flip only) — intentional, not dead code.
  Acceptance: migration applies on worktree DB; existing-row backfill verified;
  `prisma generate` clean; typecheck green.
  Commit: `feat(prisma): chatbot lifecycle status and account AI capability`.
  Risk: data-integrity → slice-reviewer.

- **S2 — createChatbot + updateChatbot + owner-type exposure.** Pothos: expose
  `status` + publication fields on the **owner-facing** Chatbot type only
  (getChatbotsInfo shape), never the participant course-chatbot type (F7).
  `createChatbot(name, description?, avatar?, courseId)` — `asUserWithCatalyst`,
  service verifies the course is owned by ctx user, sets owner=ctx user,
  status=DRAFT, tutor-only default (no `initialModes` in Phase 0, F7).
  `updateChatbot(id, free knobs)` — `asUserWithCatalyst` + service ownership
  filter. Codegen. Acceptance: service tests (create/update happy-path +
  non-owner rejection); codegen + typecheck green.
  Commit: `feat(graphql): lecturer chatbot create and update`.
  Risk: public contract + authz → slice-reviewer.

- **S3 — Publication workflow.** `requestChatbotPublication(id, useCase,
  expectedStudentCount, proposedCredits)` — `asUserWithCatalyst` + service
  ownership + **DB-row capability check** (`aiChatbotPublishingEnabled`); source
  states **DRAFT and REJECTED** → PENDING_APPROVAL, clearing `reviewComment`,
  writing publication + credit columns (F5, D2). Admin
  `approveChatbotPublication(id)` (PENDING→PUBLISHED, set publishedAt) and
  `rejectChatbotPublication(id, comment)` (PENDING→REJECTED) — `asAdmin` +
  service `role !== ADMIN → reject` (D3). Acceptance: service tests for each
  legal/illegal transition, capability gate, admin gate.
  Commit: `feat(graphql): chatbot publication workflow`.
  Risk: authz/state machine → slice-reviewer.

- **S4 — Participant access gate.** Gate once in `getChatbotOr404` (select
  `status`, **404** for non-PUBLISHED to avoid confirming existence) — covers all
  9 participant routes; add `status: PUBLISHED` to `layout.tsx:23` fetch and the
  `getParticipantCourseChatbots` where-clause (F2). No owner bypass (chat auth is
  participant-only; lecturer test chat is Phase 1). Update Playwright
  `ensureChatbotSeeded` + `resetChatState` to `PUBLISHED` (F3). Acceptance:
  non-PUBLISHED 404 test; Y-chat green (local or CI); one `agent-browser` smoke
  that a seeded PUBLISHED bot still chats (mandatory browser rule; reseeded DB).
  Commit: `feat(chat): gate participant access on published chatbots`.
  Risk: security boundary → slice-reviewer.

- **S5 — Compile seam.** Extract `compileSystemPrompt(chatbot, mode, toolNames)`
  capturing today's exact resolution + contract composition (route.ts:710-724 +
  :809-811), behavior-preserving; single call after `toolNames` exist replaces
  both blocks. Characterization unit tests per D4. Acceptance: matrix green; diff
  shows moved-not-changed composition.
  Commit: `refactor(chat): extract layered system-prompt compile seam`.
  Risk: architecture → slice-reviewer.

## Progress

- Active follow-up slice: make publication approval and rejection conditional
  lifecycle transitions, with a deterministic concurrent-approval regression
  test. The implementation, correction review, and local commit are complete;
  the remaining work is the final package review and delivery-boundary check.
- Status: S1–S5 code-complete. S4 slice-reviewer PASS + real-route browser
  smoke DONE (F7 confirmed at HTTP layer). S5 compile-seam extraction and its
  simplifier/slice-review gates are DONE. The GraphQL selection fix, migration
  backfill guard, and synthetic-fixture cleanup are committed and pushed in
  [PR #5460](https://github.com/uzh-bf/klicker-uzh/pull/5460). At the reviewed
  head `ab8d1424d`, CI is terminal with 42 successful checks, 3 failures, and
  1 skipped check: historical GitGuardian content plus the unrelated
  `P-pagination-show-all.spec.ts:47` Playwright shard and aggregate status.
  The integrated final-reviewer pass was DONE_WITH_CONCERNS with one medium
  approval-boundary finding: the approval transition was not an atomic
  conditional write. That finding is addressed in commits `3640a3abe`,
  `7154564f2`, and the follow-up barrier simplification `45e3281ff`; the
  former model-cost re-review finding is superseded by the approved
  shared-authorization policy. No merge, readiness change, issue closure, or
  history rewrite was performed.
- Follow-up code correction: approval and rejection now use conditional
  `updateMany` transitions keyed by the expected lifecycle state; approval
  also rechecks the account publishing capability in the same write. The
  concurrency regression test now gates both initial reads before releasing
  the writes, so exactly one caller must win the conditional transition. The
  focused publication file passed **12/12** tests before the barrier-only test
  correction, and the GraphQL package typecheck passes after it
  (`CHECK_RC:0`). The repository pre-commit hook passed for the correction,
  including secret scan, staged formatting, all 25 package checks, lint,
  syncpack, agent checks, and Prisma sync. The full GraphQL suite passed
  **562/564** tests across 33 files; the two failures are the existing
  `activitySharing` audit-message ID collisions, in an untouched file. The
  runtime's internal Redis services were reached through a temporary local
  verification proxy because the repository test helpers intentionally use
  loopback ports; the proxy was removed after the run.
- Correction review: the configured native simplifier and slice-reviewer
  routes were unavailable because their `combo/gemini-3.7-flash` dispatch
  rejected the inherited reasoning configuration. A planner-role fallback
  reviewed the immutable two-file correction range and found one medium test
  determinism gap; the read barrier above fixed it. The fallback found no
  implementation defect. This route limitation remains an evidence caveat
  for the final package review.
- Final-review correction: the native final reviewer found one medium
  data-integrity issue in the lifecycle migration: the schema changes and
  existing-row backfill were not explicitly transactional despite the plan's
  one-transaction claim. Commit `ffd447811` adds `BEGIN`/`COMMIT` around the
  complete PostgreSQL migration. The planner fallback reviewed the immutable
  migration and PASSed; the Prisma package check and repository pre-commit
  hook also pass. The native final-reviewer rerun then PASSed over current
  `ffd447811`; no actionable code, authorization, data-integrity, policy,
  documentation, test-portfolio, or plan-compliance findings remain.
- S1 (schema + capability + backfill): DONE + slice-reviewer PASS (no findings;
  backfill guarantee confirmed — report in `_local/reviews/`). Benibot=PUBLISHED.
- S2 (create/update mutations + owner-type exposure): DONE.
  `ChatbotStatus` GraphQL enum + owner-facing `Chatbot` fields (status +
  publication) exposed; `ChatbotPublic` left clean (F7). `createChatbot`
  (asUserWithCatalyst, course-ownership check, DRAFT, tutor-only via null
  systemPrompts) + `updateChatbot` (ownership filter, free knobs name/desc/
  avatar). Shared `chatbotOwnerSelect` prevents projection drift. Codegen +
  typecheck green; 4 service tests pass (create/update happy-path + non-owner
  rejection). Reviews DONE: slice-reviewer (contract+authz) CHANGES-REQUIRED
  -> fixed (added asUserFullAccess scope to both mutations, matching the 23
  sibling catalyst mutations); simplifier #2/#3 applied, #1 (defer pub fields)
  rejected as plan-directed. Re-verified: codegen/typecheck/4 tests green.
- S3 (publication workflow): DONE. `requestChatbotPublication`
  (catalyst+full-access, ownership -> DB-row capability gate -> DRAFT/REJECTED
  ->PENDING, clears reviewComment, writes useCase/count + flat credit budget),
  admin `approveChatbotPublication` (PENDING->PUBLISHED, stamps publishedAt once)
  + `rejectChatbotPublication` (PENDING->REJECTED + comment) — both asAdmin with
  a service-level role check (D3). Codegen+typecheck green; 10 service tests
  pass (legal/illegal transitions, capability gate, admin gate, non-owner).
  Reviews DONE: slice-reviewer (authz/state-machine) CHANGES-REQUIRED -> fixed
  in `f57cf865c` (re-check owner capability at approval time + regression test;
  11 tests green, typecheck green). Simplifier terminated without a flushed
  verdict; adopted disposition recorded in `_local/reviews/2026-08-20-chatbot-s3-slice.md`.
- Deferred cleanup (from S3 simplifier): extract shared `toChatbotInfo(row)`
  mapper for the repeated return-tail across ~7 owner-facing functions. Deferred
  (not folded into phase 0) because it edits already-reviewed S2 code for a
  behavior-preserving DRY win — own micro-refactor or follow-up.
- Carry to S4 (S3 LOW findings): gate participant access on `status ===
  'PUBLISHED'`, never `publishedAt != null` (TOCTOU); credit path must not
  assume `proposedCredits > 0` (no validation in phase 0).
- Dependency: ADR 0020 and ADRs 0019–0022 were folded into this branch by merge
  commit `1fd19330f`, so the former [PR #5453](https://github.com/uzh-bf/klicker-uzh/pull/5453)
  merge-order dependency is resolved. Closing #5453 remains a separate,
  explicitly authorized repository action.
- Base drift (checked 2026-08-20, session resume): branch is 4 behind / 8 ahead
  of `origin/v3` (the resume hook's "62 behind origin/dev" is a false alarm —
  `dev` is an unrelated long-lived line, not this branch's base). The 4 new v3
  commits are GrowthBook feature-flags (#5444) + manage pagination (#5451) +
  two deploy promotes. They touch NONE of my hand-written source (apiGuards,
  chatbots.ts, chat.prisma, the migration, resolvers all clean). The only real
  overlap is 3 generated GraphQL codegen artifacts — `packages/graphql/src/
  ops.ts`, `ops.schema.json`, `public/schema.graphql` — which both branches
  regenerated. Rebase resolution = accept both, re-run
  `pnpm --filter @klicker-uzh/graphql generate`, not a hand-merge. Rebase at
  PR-open time (one rebase after S5), not mid-slice. Note in the PR body.
- S4 (participant access gate): DONE (`c3ca4cd9b`). Single guard
  `getChatbotOr404` always selects `status` and 404s any non-PUBLISHED bot
  (existence never confirmed); guard-only `status` stripped from the returned
  row unless the caller selected it, so the one wholesale-serializing route
  (`GET /api/chatbots/[id]` -> `NextResponse.json`) never leaks owner-only
  lifecycle metadata (F7). `layout.tsx` mirrors the check at page render;
  `getParticipantCourseChatbots` filters the course overview to PUBLISHED.
  Honored S3 carry-forwards: gate on `status`, not `publishedAt` (no TOCTOU on
  the gate); no `proposedCredits > 0` assumption added. Tests: chat gate unit
  (7 — PUBLISHED renders + status stripped; each non-PUBLISHED state + missing +
  malformed 404) + graphql `courseChatbots` DRAFT-hidden participant test; chat
  `tsc` clean; full graphql suite 560 pass (1 unrelated pre-existing
  `assessmentRestrictions` flake, fails in isolation, no assessment code touched
  by phase-0). Reviews DONE: slice-reviewer (security) PASS — all 6 properties
  CONFIRMED (no-bypass audit of all 9 `[chatbotId]` routes; `chat/route.ts:695`
  refetch is post-auth + field-by-field, no leak; F7 strip sound, no
  shared-object/cache risk; 404-not-403 ordering). Sub-threshold, no action: the
  "caller selects status" strip branch is untested (no caller selects it — YAGNI).
  Data-hygiene gate false-positive on the documented local test password (a
  fixture value, not a real credential) bypassed once with user approval.
- S4 browser smoke: DONE. Real-route HTTP verification against the worktree
  stack — `GET /api/chatbots/8f9c2e1d-…` (the wholesale-serializing route,
  auth-exempt per middleware) returned HTTP 200 for the seeded PUBLISHED Benibot
  with the full participant projection and **zero `status` tokens** in the body
  (F7 strip confirmed at the live wire layer, not just in unit mocks). The
  negative path (missing/malformed id, every non-PUBLISHED state) is covered by
  the 7 gate unit tests + the graphql DRAFT-hidden integration test; the
  host→Traefik loop for the linked-worktree hostname stayed 404 the whole run
  (route never re-registered after the recompile restart — known environmental
  flake, not the app), so the app-level negative case is unit/integration
  evidence, not live. Authenticated participant chat page covered by Y-chat e2e
  in CI on the draft-PR push.
- S5 (compile seam): DONE (this commit). Extracted `compileSystemPrompt` into
  `apps/chat/src/lib/server/systemPromptCompiler.ts`, capturing both original
  seam blocks — base resolution from stored `systemPrompts`/`DEFAULT_PROMPT`
  plus the layered `withLanguageStyleContract(withCitationContract(...))`.
  `chat/route.ts` now calls it once after `toolNames` is known, dropping the
  mid-function `let systemPrompt` mutation (the two blocks were separated only
  because `toolNames` is resolved late; `systemPrompt` is never read between
  them, verified). Behaviour-preserving — every quirk kept: empty stored prompt
  falls back to the mode default then '', unknown mode yields '', citation
  contract conditional on a doc_query tool, language contract unconditional.
  6 characterization tests (D4 matrix) + the existing contract/gate suites green
  (26/26 across 4 files); chat `tsc` clean; `biome format` clean. Diff is
  minimal (13+/29-, imports swapped in place) after reverting an accidental
  whole-file `organizeImports` churn from `biome check --write` (patch
  discipline; CI gate is `biome format`, which does not reorder imports).
- S5 gates: DONE. Simplifier → NO-CHANGE (two-function split proportionate,
  single call site still nets a testability win, `DEFAULT_PROMPT` import live at
  route.ts:174, `systemPrompts: unknown` param fine). Slice-reviewer
  (architecture) → PASS with one low finding, **refuted with evidence**: it
  claimed a `{ tutor: null }` per-mode entry now 500s uncaught (was swallowed by
  the findUnique `try`), but the `.prompt` access is truthy-guarded in BOTH the
  original (`if (systemPrompts && systemPrompts[selectedMode])`) and the
  refactor (`if (stored?.[selectedMode])`) — the null value is falsy, so the
  guard fails and both fall through to the mode default without dereferencing.
  No behaviour delta, no latent 500. Residual valid point (the shape was
  untested) closed with one **test-only** characterization case
  (`{ tutor: null }` → default); production files unchanged. S5 commit amended
  `babe4a87f` → `520afeabd`; 7/7 compiler tests, chat tsc + biome format clean.
  Reports: `project/_local/reviews/2026-08-20-chatbot-s5-slice.md`.
- Integrated verification: DONE and clean. chat 346/346; graphql + chat tsc
  clean; my 3 graphql files pass in isolation, in the 3-file batch, and inside
  the full CI-faithful suite. The only full-suite failures are pre-existing,
  local-only, and in files I never touched: `assessmentRestrictions` (helpers.ts
  hardcodes Redis to 127.0.0.1:6379/6380 — the CI port-map convention,
  unreachable in the local devcontainer where Redis is at
  `redis_exec`/`redis_assessment`) and, once Redis is bridged,
  `activitySharing` (shared-live-DB collision). Proven not mine by an
  exclude-my-3-files bridged run reproducing the identical `activitySharing`
  failure with my files never loaded. CI resets a dedicated Postgres once, runs
  a deterministic order, and is green on v3. Report:
  `project/_local/reviews/2026-08-20-chatbot-phase0-integrated-verify.md`.
- Substantive size = **1195 added / 80 deleted** (`git diff --numstat`, excl.
  codegen ops.ts/ops.schema.json/public schema, pnpm-lock, plan/ADR docs) —
  full-path package, well above the floor.
- Final-reviewer (integrated `9f38b4e9a..520afeabd`): **CHANGES-REQUESTED,
  mechanical only** — no correctness/authz/data-integrity defect. It positively
  verified the three-layer auth on create/update, the admin gate on
  approve/reject, the approval-time `aiChatbotPublishingEnabled` re-read, the
  participant published-gate across all 11 apps/chat route handlers + layout +
  `getParticipantCourseChatbots`, the migration ordering (CREATE TYPE → ADD
  COLUMN DEFAULT DRAFT → UPDATE existing to PUBLISHED, one txn), and the
  compile-seam extraction. Four findings, all dispositioned:
  - #1 [med] 4 files failed `biome format` (repo-wide `format:check` CI gate) →
    FIXED. `biome format --write` on exactly those files;
    `format:check` now green ("Checked 1674 files. No fixes applied."). `git
    diff -w` confirmed line-reflow only. Commit `672c9e292`.
  - #2 [med] `docs/chat-platform.md` contradicted the code ("no visibility
    field"; auth-guard section omitted the gate) → FIXED. Commit `9ee8e635b`.
  - #3 [low] `apps/chat/src/services/chatbots.ts` `getChatbotById` (unused, no
    callers) had no status filter → FIXED with a `findFirst` + PUBLISHED filter
    so the seam can't leak a draft if wired up later. Commit `bdc597192`.
  - #4 [low] schema/service comments cite `docs/adr/0020`/`0021`, which live on
    branch `docs/chatbot-hitl-config-roadmap` (draft PR #5453), not an ancestor
    → known merge-order dependency; state it in the PR description (merge #5453
    first, or cherry-pick ADRs 0019-0022). No code change.
  Corrections were mechanical (format, dead-code one-liner, docs); verified
  directly (format:check green, chat tsc green, reformatted tests 14/14 + 11/11
  + 5/5) rather than re-running the heavy final-reviewer. Report:
  `project/_local/reviews/` (final-review captured in the integrated-verify doc
  context).
- Base drift: the resume hook flagged `origin/dev`, but `dev` is a stale
  divergent branch (3559 commits apart), NOT the base. Branch targets `v3`
  (`origin/HEAD`): 4 behind, 13 ahead, and none of v3's 4 new commits touch my
  changed files (overlap empty excl. codegen) — a rebase would be a clean
  codegen-only re-run.
- Forge snapshot (2026-08-21, read-only `gh`): current `v3` is at
  `f58986faa8cfa4ff78d20a1ebeb1666473343d38`; the remote PR head remains
  `ab8d1424d`, and PR #5460 is open, non-draft, mergeable, but **BEHIND**.
  GitHub compare reports the remote PR branch 23 commits ahead and 6 behind
  `v3`; the local reviewed head `ffd447811` adds 7 unpushed commits, for 30
  local commits ahead and 6 behind. The remote PR checks are 42 successful,
  3 failed (GitGuardian and the Playwright shard/status pair), and 1 skipped;
  they do not cover the unpushed local commits. The SSH `git ls-remote`
  freshness path was unavailable during this readback (connection closed), so
  the GitHub API is the authoritative ref source for this snapshot. No rebase
  or push was performed.
- Remaining: handle GitGuardian incident 36437584, reconcile the branch with
  current `v3`, publish the reviewed local commits, and obtain fresh CI before
  merge. The approved usage-funding policy is documented for its
  implementation follow-up. The PR is already non-draft; merging it and
  closing #5453 remain outside this task's authority.
- Runtime: worktree devcontainer stack stopped after verification. Start it
  again only for an authorized runtime check. NOTE: graphql tests wipe the dev
  DB — reseed (`prisma-data seed:raw`) before S4 browser smoke.

## MR/PR evidence expected

- GraphQL service-test output (transitions + authz + capability).
- Migration diff + existing-row backfill proof; `prisma generate` clean.
- Y-chat e2e result + one participant browser smoke.
- Compile-seam characterization matrix.
- Substantive size stated at the pre-open gate.
