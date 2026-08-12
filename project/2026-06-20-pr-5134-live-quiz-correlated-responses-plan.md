# PR #5134 - Live Quiz Correlated Responses Plan

Goal: add opt-in standard live quiz mode that stores row-correlatable responses for export while keeping participant-facing UI clear and assessment separate.

Plan path: `project/2026-06-20-pr-5134-live-quiz-correlated-responses-plan.md`
Branch: `rs/pr5134-a1-domain` for this ADR/domain update; implementation continues through the stack below.
Target: `v3`
Original PR: [#5134](https://github.com/uzh-bf/klicker-uzh/pull/5134), preserved while the replacement stack validates.
Status: implementation exists in draft stacks; ADR-driven identity and finalization redesign is not yet implemented.

## Current Stack Topology

This is the only execution topology. The capability sections below are owned by these layers and do not create additional branches.

| Layer | Branch / PR | Responsibility for the accepted ADRs |
| --- | --- | --- |
| A1 | `rs/pr5134-a1-domain` / #5370 | Domain schema and expand-contract migrations: generation-scoped respondent, active binding, immutable label field, finalization state, receipt generation, and ADR/wiki contract. |
| A2 | `rs/pr5134-a2-contracts` / #5371 | Shared token, event, cache, and validation contracts carry `publicationGeneration` and use respondent ownership only for correlated responses. |
| A3 | `rs/pr5134-a3-admission` / #5372 | Resolve logged-in or anonymous credentials to one generation-scoped respondent, reject temporary-pseudonym admission, hold the shared quiz lock through receipt insertion, and persist receipt generation. |
| A4 | `rs/pr5134-a4-settlement` / #5373 | Persist correlated responses under `respondentId`; mark receipts settled only after durable apply or durable non-retryable rejection; leave transient failures pending. |
| A5 | `rs/pr5134-a5-lifecycle` / #5374 | End under the exclusive quiz lock; check the generation settlement predicate; allocate labels; delete bindings, settled receipts, and salt; finalize irreversibly; increment generation for a later run. |
| B1 | `rs/pr5134-b1-export` / #5376 | Render CSV only from finalized respondent labels and retained response fields; never lazily assign labels or require the deleted salt. |
| B2 | `rs/pr5134-b2-ui` / #5368 | Manage/PWA notices, mode selection, response routing, export action, i18n, and browser verification. |

The stack is implemented and reviewed bottom-up. Updating A1 requires a cascading local rebase through A5 and then B1-B2 before publication. No layer is authorized for merge or ready status by this plan.

## Non-Goals

- No assessment behavior change. Assessment remains identifiable and auditable by design.
- No backfill for old standard live quizzes. Future quizzes only.
- No research / DP export in this slice. Later admin workflow.
- Free-text answers are excluded from the correlated teaching export.
- No per-respondent live UI. Live/evaluation UI stays aggregate-only.

## Current Evidence

- `LiveQuiz` already has mode-like booleans: `isGamificationEnabled`, `isAssessmentEnabled`, pin protection derived from `pinCode`.
- Standard live quiz response path goes through `apps/response-api/src/index.ts`, then Hatchet events `response-received:anonymous` or `response-received:authenticated`.
- Standard worker aggregates into Redis and later `ElementInstance.anonymousResults`; it does not write durable `LiveQuizResponse`.
- Assessment worker already writes durable `LiveQuizResponse` rows and rejects duplicates as first-response-wins.
- `LiveQuizResponse` is currently hard-linked to `Participant`, so it cannot store anonymous / temporary leaderboard respondents without schema change.
- `TemporaryLeaderboardEntry` already models quiz-scoped non-account identity for gamified temporary pseudonyms. The row identity is `TemporaryLeaderboardEntry.id`; browser continuity is carried by the signed `temporary_participant_token` cookie/JWT created in `accounts.ts`.
- Current export package reads `LiveQuizResponse` and emits one row per response, not one row per respondent.

## Resolved Grill Decisions

- Decision: use quiz-level setting, default off.
- Decision: setting enum, not boolean.
  - `AGGREGATED_ANONYMOUS`: current behavior; no durable standard LQ response rows.
  - `CORRELATED_EXPORT`: durable responses for all respondents in that quiz.
- Decision: setting editable only while draft/scheduled. Lock once published/running/ended.
- Decision: assessment excluded. No assessment without identifiable tracing.
- Decision: participant notice persistent and compact before + during quiz.
- Decision: correlated mode wording avoids strict "anonymous" promise.
- Decision: correlated mode uses one quiz-generation-scoped respondent namespace for logged-in and anonymous browsers. Assessment retains participant ownership; temporary pseudonyms remain a gamification-only concept.
- Decision: export never shows identifiable form. Only stable random respondent labels, one namespace: `respondent_001`, `respondent_002`, ...
- Decision: labels are stable across re-exports after the quiz ends. Order internal identities by `HMAC(exportSalt, internalId)` before assigning labels; raw ids, response time, and join order are never exposed.
- Decision: a logged-in browser is mapped to a generation-scoped respondent only while the correlated quiz is active; durable correlated responses never store `participantId`.
- Decision: after the quiz ends and all admitted responses settle, destroy account/token bindings and retain only the minimal pseudonymous respondent, immutable export label, and approved response fields for a finite retention period.
- Decision: free text is excluded from the correlated teaching export.
- Decision: duplicate submissions follow assessment semantics: first response counts; duplicate returns recorded-before.
- Decision: anonymous correlated id persists per quiz if possible, survives reload/browser close; no cross-quiz reuse.
- Decision: normal quiz editors can enable mode. No special permission.
- Decision: lecturers download a clean CSV themselves from the live quiz evaluation page after the quiz ends.
- Decision: follow existing browser-generated download behavior. An authenticated, authorized GraphQL operation returns export-ready CSV content and filename; the manage app creates the browser download. Do not add a new file-streaming service for v1.
- Decision: CSV has one respondent per row, a `respondent` header first, then stable question column groups with human-readable headers.
- Decision: research / DP-safe export later. Correlated row export is pseudonymized individual-level data, not differential privacy.

## Participant Notice Copy

Aggregated mode:

> Responses are counted only in aggregate. Answers are not linked across questions.

German:

> Antworten werden nur aggregiert ausgewertet und nicht über Fragen hinweg verknüpft.

Correlated mode:

> Answers in this quiz are stored per participant and can be exported with random labels (e.g. respondent_001) instead of names.

German:

> Antworten in diesem Quiz werden pro Person gespeichert und können mit zufälligen Bezeichnungen (z. B. respondent_001) statt Namen exportiert werden.

Export warning:

> Export uses random respondent labels and does not include names, emails, account ids, usernames, temporary pseudonyms, or free-text answers.

## Target Architecture

### Live Quiz Response Mode

Add enum on `LiveQuiz`, likely `responseCollectionMode`:

- `AGGREGATED_ANONYMOUS`
- `CORRELATED_EXPORT`

Default: `AGGREGATED_ANONYMOUS`.

Add a random `exportSalt` on `LiveQuiz`, created for each correlated publication generation. Use it only to allocate stable export-label ordering during finalization, then delete it.

Assessment: keep `isAssessmentEnabled` separate. If assessment true, disable this setting and explain that assessments always store identifiable responses.

The service layer rejects mode changes unless the quiz is `DRAFT` or `SCHEDULED`. The manage UI mirrors this lock and disables the setting for assessments with an explanation.

### Quiz-Scoped Respondent

Introduce a minimal pseudonymous response owner, `LiveQuizRespondent`, for one publication generation of a standard correlated quiz.

Fields:

- `id`
- `liveQuizId`
- `publicationGeneration`
- `exportLabel?`, allocated only during finalization
- `finalizedAt?`
- `createdAt`
- `updatedAt`

Purpose:

- Own durable correlated responses for logged-in and anonymous browsers alike.
- Preserve answer grouping after the re-identification binding is destroyed.
- Remain separate from `TemporaryLeaderboardEntry`, which owns visible gamification state.

Add an active-only respondent binding:

- `respondentId`
- exactly one of `participantId` or `verificationSecretHash`
- `liveQuizId` and `publicationGeneration` for enforceable inverse uniqueness
- expiry and creation timestamps

The database enforces one binding per respondent and at most one respondent for each participant or anonymous credential within a quiz generation. Admission uses those unique constraints for concurrent create-or-resolve behavior. Anonymous tokens carry `liveQuizId` and `publicationGeneration`.

Migration strategy:

- Use an expand-contract migration: A1 adds the binding, generation, nullable label, finalization, and receipt-generation fields plus new owner invariants; later layers switch writers/readers; remove the compatibility shape only after old writers are gone.
- Keep `TemporaryLeaderboardEntry` and its token flow unchanged for gamification.
- Do not trust a browser-stored respondent id by itself. Anonymous correlated identity needs an opaque token or `id + random secret`; the server stores/verifies the secret, preferably hashed.
- Scope the token to one quiz generation and align browser and token expiry. Do not copy the current temporary-participant mismatch between a 30-day cookie and two-week JWT.
- Delete active bindings after an ended quiz has no unsettled receipts. Delete the respondent, label, and responses together only when the correlated dataset reaches its retention deadline.

### Durable Responses

Adjust `LiveQuizResponse` so response can belong to one of:

- `participantId` for assessment evidence
- `respondentId` for standard correlated collection, including logged-in browsers

The correlated response inherits `liveQuizId` and `publicationGeneration` through its respondent. A pending receipt stores the generation directly so admission and finalization can fence one execution.

Constraint:

- exactly one identity field set.
- unique per `instanceId + elementBlockExecution + respondent identity`.

Migration note:

- Model two ordinary Prisma constraints:
  - `@@unique([instanceId, elementBlockExecution, participantId])`
  - `@@unique([instanceId, elementBlockExecution, respondentId])`
- PostgreSQL treats nulls as distinct, so those constraints work with the identity check.
- Append raw SQL before applying the generated migration so exactly one response owner is set and the owner matches the quiz identity policy.
- Run `pnpm run prisma:sync` after migration to mirror the schema into `apps/analytics`.

In `CORRELATED_EXPORT`:

- standard response worker persists `LiveQuizResponse` for all respondents.
- still updates Redis aggregate path for live/evaluation UI.
- response-api uses a correlated-mode Redis vote-hash gate so duplicate submissions synchronously return recorded-before.
- worker-side lookup remains the authoritative first-response-wins gate before insert.

In `AGGREGATED_ANONYMOUS`:

- keep current no-durable-response behavior for standard LQ.
- continue aggregate results only.

Assessment:

- keep the current `participantId` path and correction/audit relations. Assessment rows never undergo correlated identity finalization.

Correlated finalization:

- lock the ended quiz and require every admitted response receipt to be settled;
- require `settledAt IS NOT NULL`, `eventPayload IS NULL`, and `nextDeliveryAt IS NULL` for every receipt in that generation; transient failures remain pending;
- allocate immutable `exportLabel` values on respondents by HMAC-sorting their ids with `exportSalt`;
- delete participant-account and credential-hash bindings;
- delete settled receipt metadata and remove `exportSalt`;
- mark the pseudonymous dataset finalized and reject attempts to reopen it under the same publication generation.

Admission takes a shared lock on the quiz row from the status-and-generation check through receipt insertion. Ending/finalization takes an exclusive lock on that row, which waits for in-flight admissions and prevents new ones before the settlement predicate is evaluated.

### Export

Add an authenticated self-service CSV export for correlated standard LQs. The operation must verify that the current user can manage the live quiz and that the quiz has ended.

Output shape:

- one row per respondent per live quiz execution scope.
- first header: `respondent`; values: stable `respondent_N` labels only.
- one human-readable column group per `ElementInstance` and `elementBlockExecution`, preserving quiz/block/question order.
- headers use stable, self-describing keys: `block_01_question_02_execution_01_response`, `..._correct`, and `..._points`.
- no email, participant id, username, temporary pseudonym, account type.
- no submission or join timestamps.
- unanswered cells are empty; scalar answers are plain text; structured answers use canonical compact JSON in one cell.
- free-text answers are excluded from the correlated teaching export. Whether correlated mode should reject or omit their durable response payloads remains a data-minimization gate before publication is enabled.
- RFC 4180-compatible quoting, CRLF rows, and UTF-8 with BOM so commas, quotes, line breaks, and German text open cleanly in spreadsheet tools.
- response includes a safe filename, CSV content, and the privacy warning shown by the UI.

The manage evaluation page shows the download action only for ended `CORRELATED_EXPORT` quizzes. Aggregate-only and old quizzes show no misleading export action. Existing response-level CLI export remains an admin tool and is not the lecturer delivery path.

Research export:

- later.
- aggregate/DP-safe by default.
- no raw row-wise matrix in research profile unless explicit external approval.

## Stack-owned capability work

### Planning gate

Do:

- Independent review of this plan before implementation.
- Check schema naming, migration risk, export semantics, token/security risk.

Check:

- Reviewer findings integrated or explicitly deferred in this plan.

Commit:

- `docs(project): add live quiz correlated responses plan`

### A1 - Domain schema and mode wiring

Do:

- Add Prisma enum + `LiveQuiz.responseCollectionMode` + `exportSalt`.
- Add generation-scoped `LiveQuizRespondent` and active-only respondent binding models, nullable immutable export label, finalization state, and receipt generation.
- Add `LiveQuizResponse.respondentId`, make `participantId` nullable, model both ordinary Prisma unique constraints, and append the two raw SQL checks before applying the migration.
- Patch existing response-level export in the same slice so nullable `participant` cannot break compile/runtime. At minimum, guard `row.participant`, remove participant-email-only ordering assumptions, and keep assessment rows unchanged.
- Update generated schema flow.
- Expose mode through GraphQL `LiveQuiz`.
- Add create/update inputs and service writes.
- Create `exportSalt` when correlated mode is enabled; never expose it through GraphQL.
- Enforce the mode lock in the service layer after draft/scheduled state, not only in the UI.

Files:

- `packages/prisma/src/prisma/schema/*.prisma`
- `packages/prisma/src/prisma/schema/migrations/*/migration.sql`
- `packages/graphql/src/schema/liveQuiz.ts`
- `packages/graphql/src/services/liveQuizzes.ts`
- `packages/graphql/src/graphql/ops/*.graphql`
- `packages/export/src/liveQuizResponses.ts`
- generated GraphQL outputs

Check:

- Prisma migrate/generate, `pnpm run prisma:sync`, and GraphQL generate.
- Focused GraphQL tests or service unit tests for default, salt creation, assessment behavior, and rejected mode changes on running/ended quizzes.
- Export package typecheck/test or focused compile check for existing `LiveQuizResponse` export.

Commit:

- `feat(live-quiz): add response collection mode`

### B2 - Manage UI setting

Do:

- Add setting in live quiz wizard near gamification / pin protection.
- Default `AGGREGATED_ANONYMOUS`.
- Disable with an explanation for assessment.
- Lock in edit mode when quiz is no longer draft/scheduled, with a tooltip.
- Show a compact inline consequence summary when correlated mode is selected.
- Add `data-cy="set-quiz-response-collection-mode"`.
- Add EN/DE i18n.

Files:

- `apps/frontend-manage/src/components/activities/creation/liveQuiz/*`
- `packages/i18n/messages/en.ts`
- `packages/i18n/messages/de.ts`
- GraphQL ops generated imports as needed

Check:

- Typecheck affected app/package.
- Mandatory agent-browser check with the manage wizard in EN/DE, including assessment and locked states.

Commit:

- `feat(manage): add live quiz response export mode setting`

### B2 - Participant notice

Do:

- Add persistent compact notice to PWA live quiz question area.
- Show before first block and during active blocks.
- Use mode-specific text.
- Keep assessment messaging separate.
- Reuse the existing notification treatment; keep aggregate mode visually quiet.
- Put optional detail in an expandable popover so active-question space stays usable.

Files:

- `apps/frontend-pwa/src/pages/session/[id].tsx`
- `apps/frontend-pwa/src/components/liveQuiz/LiveQuizQuestionColumn.tsx`
- `packages/graphql/src/graphql/ops/QGetRunningLiveQuiz.graphql`
- `packages/i18n/messages/en.ts`
- `packages/i18n/messages/de.ts`

Check:

- Typecheck PWA.
- Agent-browser screenshots on desktop and 375px mobile for both modes and EN/DE.
- Verify the notice does not push answer options below the fold on mobile.

Commit:

- `feat(pwa): show live quiz response privacy notice`

### A2-A4 - Respondent contract, admission, and persistence

Do:

- Create or resolve a generation-scoped correlated respondent for logged-in and anonymous credentials when mode is `CORRELATED_EXPORT`.
- Persist an opaque anonymous token in an HttpOnly quiz-generation-scoped cookie where possible; no cross-quiz or cross-generation reuse.
- Forward respondent token through `response-api`.
- Add the synchronous correlated-mode Redis vote-hash gate in response-api so duplicates return recorded-before.
- Admission verifies the account or anonymous token and maps both to `LiveQuizRespondent`; respondent id alone is not accepted.
- Persist `LiveQuizResponse` rows in correlated mode for logged-in and anonymous correlated respondents.
- Do not admit temporary-pseudonym identity to the correlated path. Temporary pseudonyms remain bound to gamification and continue through `TemporaryLeaderboardEntry` only.
- Keep aggregate Redis updates unchanged.
- Keep an authoritative worker-side duplicate lookup before insert.
- Keep worker changes additive; do not refactor the legacy processor in this feature.

Files:

- `apps/response-api/src/index.ts`
- `apps/hatchet-worker-response-processor/src/processors/processor.ts`
- `apps/hatchet-worker-response-processor/src/processors/helpers.ts`
- `apps/frontend-pwa/src/pages/session/[id].tsx`

Check:

- Unit/focused tests for token parsing, duplicate handling, persistence branch.
- Negative test: forged respondent id without valid secret/signature is rejected.
- Test aligned token/browser expiry and quiz scoping.
- Manual or browser E2E: anonymous correlated reload keeps same respondent row.

Commit:

- `feat(live-quiz): persist correlated respondent responses`

### A5 - Correlated identity finalization

Do:

- Route logged-in and anonymous correlated browsers through `LiveQuizRespondent` and an active-only binding.
- Keep `TemporaryLeaderboardEntry` unchanged and reject any correlated/gamified combination.
- Finalize identity after the quiz is ended and every admitted response has settled.
- Delete all account and credential bindings and settled receipt metadata, allocate immutable respondent labels, remove `exportSalt`, and mark the generation finalized.
- Reject reopening under the same publication generation.

Files:

- Prisma schema/migration
- response API admission and identity resolution
- response worker
- live-quiz end/reset lifecycle
- correlated export service

Check:

- Assessment response attribution and point-correction audit remain unchanged.
- Logged-in and anonymous correlated responses retain grouping but no binding after finalization.
- Pending receipts block finalization; repeated finalization is idempotent.
- Existing gamified temporary-pseudonym workflows remain unchanged.

Commit:

- `feat(live-quiz): finalize correlated identities`

### B1 - Correlated export matrix

Do:

- Add the authenticated, authorized correlated matrix GraphQL operation.
- Add a CSV download action to the live quiz evaluation page for ended correlated quizzes.
- Generate the browser download from returned CSV content, matching existing client-generated download behavior.
- Consume finalized stable `respondent_N` labels; do not lazily assign labels or require `exportSalt`.
- Strip all identifiers and respondent type.
- Use clean, deterministic headers, canonical structured values, formula-injection protection, and RFC 4180-compatible escaping.
- Exclude free-text questions and answers.
- Export unavailable/empty for old or aggregate-only quizzes with clear message.
- Apply a documented response-size guard and return a clear error rather than truncating.

Files:

- `packages/export/src/*`
- `packages/export/test/*`
- `packages/graphql/src/schema/liveQuiz.ts`
- `packages/graphql/src/services/liveQuizzes.ts`
- `packages/graphql/src/graphql/ops/*.graphql`
- `apps/frontend-manage/src/pages/quizzes/[id]/evaluation.tsx`
- evaluation download component/hook
- `packages/i18n/messages/en.ts`
- `packages/i18n/messages/de.ts`

Check:

- Unit tests for label stability, header order, CSV escaping, structured values, formula-injection protection, no identifiers/timestamps, free-text exclusion, authorization, status/mode gating, and size-limit failure.
- DB-backed export with fixture data across logged-in and anonymous respondents before and after binding finalization.
- Agent-browser download check: correct filename, headers, row shape, warning, and unavailable states.

Commit:

- `feat(export): add correlated live quiz response matrix`

### Integrated end-to-end verification and security review

Do:

- Full local flow: create a correlated LQ, submit as logged-in and anonymous correlated respondents, settle and finalize it, then export. Verify assessment ownership and gamified temporary-pseudonym behavior as regressions.
- Browser screenshots: manage setting; PWA notices in both modes.
- Add seed data for a correlated quiz and all respondent types.
- Add lecturer-facing docs for both modes, export contents, finalization, retention, and field-minimization responsibilities.
- Add mandatory E2E cases: enable correlated mode; anonymous reload continuity; correlated notice; aggregate quiz unchanged; successful CSV download.
- Manually test blocked cookies/storage. Expected degradation: quiz remains usable, but anonymous responses may split into multiple export rows.
- Security review: token scope, cookie expiry, identifier leakage, export PII warnings.
- Final branch review.
- PR/MR body with screenshots and manual verification list.

Check:

- `pnpm --filter @klicker-uzh/graphql check`
- `pnpm --filter @klicker-uzh/export test`
- app checks where touched
- Cypress/Playwright where appropriate plus mandatory agent-browser verification

Commit:

- final fixes only if needed.

## Risks

- Schema change to `LiveQuizResponse` can disturb assessment corrections. Keep assessment tests focused.
- Mode-specific response ownership and binding cleanup require expand-contract deployment; old and new writers must not disagree during rollout.
- Token stored in browser can split respondents when cookies/storage blocked. Notice/export should tolerate multiple rows.
- Browser-stored respondent ids are bearer identifiers. Use a signed token or separate secret and verify it server-side before writing correlated responses.
- The retained answer matrix remains pseudonymous and may be identifying through response patterns; define and enforce a finite retention period.
- Row export can be mistaken for anonymity/DP. Avoid DP language.
- Live worker has Redis-first design; DB writes must not slow response path enough to harm live quiz UX.
- Returning CSV through GraphQL is intentionally simple for v1 but needs an explicit size limit; large-export streaming remains a later option.
- Identity finalization is irreversible. A later quiz run needs a new publication generation and respondent namespace.

## Research

Current implementation does not need external research.

Later research:

- scite-backed privacy / DP design for research exports.
- DP aggregate thresholds, suppression, noise, free-text handling.
- Legal/privacy review language for research use.

## Review Plan

- Plan review before implementation. Preferred: independent agent/model.
- Per-layer risk review and simplification where required before each stack-layer commit.
- Final security review before PR/MR.
- Final branch review before PR/MR.

## Progress

- 2026-06-20: Codebase mapped: standard responses aggregate only; assessment persists `LiveQuizResponse`; temp leaderboard uses quiz-scoped token + `TemporaryLeaderboardEntry`.
- 2026-06-20: Grill decisions resolved with user. Summary captured above.
- 2026-06-20: Plan file created and published as draft PR before implementation.
- 2026-06-20: Greptile plan review integrated: export compatibility moved into Slice 1, raw SQL constraints called out, respondent token verification added, temporary-pseudonym persistence deferred to alignment slice, and temporary token wording corrected.
- 2026-07-06: Independent plan review confirmed the approach and identified export delivery, simpler Prisma uniqueness, synchronous duplicate feedback, server-side mode locking, label ordering, token checks, retention, UI detail, and E2E gaps.
- 2026-07-23: User selected self-service CSV delivery with clean headers. Review findings integrated. The existing draft PR now continues into implementation; it must not merge as a plan-only PR.
- 2026-07-23: Branch rebased onto current `v3` and force-pushed with lease. Slice 1 started: schema constraints, GraphQL mode wiring, service lock/default behavior, and existing export compatibility.
- 2026-07-23: Slice 1 implementation completed locally. Added the response mode, export salt, quiz-scoped respondent model, dual response identity constraints, GraphQL create/edit/query wiring, server-side mode locking, assessment-only response narrowing, and nullable-participant export compatibility.
- 2026-07-23: Slice 1 verification passed: fresh Prisma migration reset; 6 focused GraphQL integration tests; 23 export tests; Prisma schema sync; GraphQL code generation; all 24 monorepo typecheck tasks; and touched-file Prettier checks.
- 2026-07-23: Independent Slice 1 review found a publish/edit race, an assessment export ordering regression, and avoidable migration lock duration. All three findings were accepted and fixed with a transaction row lock and recheck, legacy email-first ordering plus respondent fallback, and `NOT VALID` followed by explicit constraint validation.
- 2026-07-23: Review-fix verification passed: fresh migration reset; 7 focused GraphQL integration tests including the race; 24 export tests; GraphQL typecheck; Prisma schema sync; and touched-file Prettier checks. Simplification review remains before Slice 1 is finalized.
- 2026-08-12: The replacement A1-A5 and B1-B2 stack is published as drafts. ADR review replaced the compatibility identity with generation-scoped respondents and active-only bindings, moved immutable label persistence into A1/A5, defined receipt settlement and locking, and kept B1 as rendering only. These changes are documented but not yet implemented or pushed.

## Goal Prompt Requirements

If handed to another agent:

- Use this file as current plan.
- Resume the existing `rs/pr5134-a1-domain` -> `a5-lifecycle` and `b1-export` -> `b2-ui` stacks; do not recreate the obsolete source branch or another topology.
- Update `Progress` before and after each layer.
- Work one layer at a time, bottom-up, and cascade lower-layer changes before continuing.
- Run risk-selected review and simplification after each substantive layer.
- Run final security review and final branch review before PR/MR.
- Use `$rs-mr-description-writer` for the PR body.

## Next Steps

1. Treat ADR 0005 and ADR 0006 as the identity and lifecycle contract for the existing A1-A5 stack.
2. Amend A1 schema ownership, A3 admission, A4 settlement, and A5 lifecycle behavior to use active respondent bindings and settlement-gated finalization while the feature remains disabled.
3. Keep gamified temporary pseudonyms on `TemporaryLeaderboardEntry`; verify that assessment responses retain participant ownership.
4. Resolve the finite retention period and field-level necessity of timestamps, time spent, and free-text payloads before correlated publication is enabled.
5. Re-run integrated stack verification and review before updating or marking any draft PR ready.
