# Phase 0 — chatbot lecturer HITL foundations (implementation plan)

Roadmap: [`project/2026-08-20-chatbot-hitl-lecturer-configuration-roadmap.md`](2026-08-20-chatbot-hitl-lecturer-configuration-roadmap.md)
(docs PR #5453). ADRs
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
  push/PR until slices are green (then draft PR), merge, deploy, deletion.
- **Terminal**: all slices committed and verified in-container; draft PR against
  `v3` with the plan as first commit; runtime stopped per
  `$rs-local-runtime-lifecycle`.
- **Pause** (needs user): a GraphQL-contract change beyond this plan; the
  compile refactor proving not behavior-preserving; admin-auth ambiguity risking
  privilege escalation (mitigated — D3 resolved).

## Plan identity

- Plan: `project/2026-08-20-chatbot-hitl-phase0-plan.md`
- Branch: `feat/chatbot-lecturer-config-phase0`, target `v3`, worktree
  `trees/feat-chatbot-lecturer-config-phase0`. PR: none yet.

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

- Status: S2 committed. Worktree from `origin/v3`, devcontainer up.
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
  Per-slice reviewers pending.
- Remaining: S4–S5.
- Runtime: worktree devcontainer stack running. NOTE: graphql tests wipe the
  dev DB — reseed (`prisma-data seed:raw`) before S4 browser smoke.

## MR/PR evidence expected

- GraphQL service-test output (transitions + authz + capability).
- Migration diff + existing-row backfill proof; `prisma generate` clean.
- Y-chat e2e result + one participant browser smoke.
- Compile-seam characterization matrix.
- Substantive size stated at the pre-open gate.
