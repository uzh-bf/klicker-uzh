# PR #5134 - Live Quiz Correlated Responses Plan

Goal: adapt the existing A1-A5/B1-B2 draft implementation in place to the
accepted correlated-response contract, preserving row-correlatable export,
clear participant-facing UI, and the separate assessment boundary.

Plan path: `project/2026-06-20-pr-5134-live-quiz-correlated-responses-plan.md`
Branch: `rs/pr5134-a1-domain` for this ADR/domain update; implementation continues through the stack below.
Target: `v3`
Original PR: [#5134](https://github.com/uzh-bf/klicker-uzh/pull/5134), preserved while the replacement stack validates.
Status: the full A1-A5/B1-B2 slices already exist in the replacement draft
stack. The A1-A5 ADR adaptation and B1 export-source adaptation are now applied
locally; the remaining work is to cascade the existing B2 slice, verify the
integrated stack, and clear the retention, browser, and delivery gates. This is
an in-place adaptation of existing slices, not a new feature build or a new
topology.

## Current Stack Topology

This is the only execution topology. The capability sections below are owned by
these existing layers and do not create additional branches. The work is
already represented by two stack objects:

- Stack A: `v3 -> A1 -> A2 -> A3 -> A4 -> A5`
- Stack B: `A5 -> B1 -> B2`

Cascade each existing stack object in order. This is not a new seven-layer
stack, and it does not create replacement feature slices.

| Layer | Branch / PR | Responsibility for the accepted ADRs |
| --- | --- | --- |
| A1 | `rs/pr5134-a1-domain` / #5370 | Domain schema and expand-contract migrations: generation-scoped respondent, active binding, immutable label field, finalization state, receipt generation, and ADR/wiki contract. |
| A2 | `rs/pr5134-a2-contracts` / #5371 | Shared token, event, cache, and validation contracts carry `publicationGeneration` and use respondent ownership only for correlated responses. |
| A3 | `rs/pr5134-a3-admission` / #5372 | Resolve logged-in or anonymous credentials to one generation-scoped respondent, reject temporary-pseudonym admission, hold the shared quiz lock through receipt insertion, and persist receipt generation. |
| A4 | `rs/pr5134-a4-settlement` / #5373 | Persist correlated responses under `respondentId`; mark receipts settled only after durable apply or durable non-retryable rejection; leave transient failures pending. |
| A5 | `rs/pr5134-a5-lifecycle` / #5374 | End under the exclusive quiz lock; check the generation settlement predicate; allocate labels; delete bindings, settled receipts, and salt; finalize irreversibly; expire finalized generations after the approved retention window; increment generation for a later run. |
| B1 | `rs/pr5134-b1-export` / #5376 | Render CSV only from finalized respondent labels and retained response fields; never lazily assign labels or require the deleted salt. |
| B2 | `rs/pr5134-b2-ui` / #5368 | Manage/PWA notices, mode selection, response routing, export action, i18n, and browser verification. |

The full slices are implemented and reviewed bottom-up. Adapt A1 in place,
then cascade the resulting contract through the existing A2-A5 and B1-B2
branches with local rebases and focused repairs. Preserve this topology,
existing commits, authorship, PR attribution, and recovery refs. Before each
cascade, require clean worktrees and record the current SHA and PR URL; stop on
topology divergence or changed PR attribution. An unchanged layer requires
verification, not a synthetic repair commit. No layer is authorized for merge
or ready status by this plan.

Current adaptation gap: B1 now reads only generation-scoped finalized
respondent labels, rejects incomplete settlement and invalid owners, and has no
interim export-label table or lazy HMAC assignment. A1-A5 persist
generation-scoped respondents and active bindings, settle under the
shared/exclusive quiz locks, and allocate labels transactionally only after
settlement. The remaining work is B2, finite retention, integrated checks, and
browser/delivery gates.

## Non-Goals

- No assessment behavior change. Assessment remains identifiable and auditable by design.
- No backfill for old standard live quizzes. Future quizzes only.
- No research / DP export in this slice. Later admin workflow.
- Free-text answers are excluded from the correlated teaching export.
- No per-respondent live UI. Live/evaluation UI stays aggregate-only.

## Historical baseline and current interim evidence

The following baseline records why the existing slices were needed; it is
historical context, not a description of the current stack.

- `LiveQuiz` already has mode-like booleans: `isGamificationEnabled`, `isAssessmentEnabled`, pin protection derived from `pinCode`.
- Standard live quiz response path goes through `apps/response-api/src/index.ts`, then Hatchet events `response-received:anonymous` or `response-received:authenticated`.
- Standard worker aggregates into Redis and later `ElementInstance.anonymousResults`; it does not write durable `LiveQuizResponse`.
- Assessment worker already writes durable `LiveQuizResponse` rows and rejects duplicates as first-response-wins.
- `LiveQuizResponse` is currently hard-linked to `Participant`, so it cannot store anonymous / temporary leaderboard respondents without schema change.
- `TemporaryLeaderboardEntry` already models quiz-scoped non-account identity for gamified temporary pseudonyms. The row identity is `TemporaryLeaderboardEntry.id`; browser continuity is carried by the signed `temporary_participant_token` cookie/JWT created in `accounts.ts`.
- Current export package reads `LiveQuizResponse` and emits one row per response, not one row per respondent.

Current interim-stack evidence:

- The existing A1-A5/B1-B2 slices contain mode wiring, respondent routing,
  transactional response admission, worker processing, lifecycle generation,
  CSV delivery, notices, and cookie-blocked fallback behavior.
- The remaining implementation gap is the accepted delivery delta: B2 and the
  finite-retention policy still need to converge with the adapted A1-A5/B1
  identity and finalization contract.
- Source checks are recorded as green; browser proof remains blocked by the
  shared DevPod PWA font resolver failure and lifecycle lock.

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

## Accepted adaptation contract

The following is the accepted target contract for adapting the existing slices.
It is not a request to recreate the feature or add another topology.

### Existing Live Quiz Response Mode

Preserve the existing `LiveQuiz.responseCollectionMode` enum and its wiring:

- `AGGREGATED_ANONYMOUS`
- `CORRELATED_EXPORT`

Default: `AGGREGATED_ANONYMOUS`.

Retain the existing random `exportSalt` for each correlated publication
generation. Use it only to allocate stable export-label ordering during
finalization, then delete it.

Assessment: keep `isAssessmentEnabled` separate. If assessment true, disable this setting and explain that assessments always store identifiable responses.

The service layer rejects mode changes unless the quiz is `DRAFT` or `SCHEDULED`. The manage UI mirrors this lock and disables the setting for assessments with an explanation.

### Replace the interim Quiz-Scoped Respondent shape

Replace the interim compatibility shape with a minimal pseudonymous response
owner, `LiveQuizRespondent`, for one publication generation of a standard
correlated quiz.

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

Adapt the existing identity path to use an active-only respondent binding:

- `respondentId`
- exactly one of `participantId` or `verificationSecretHash`
- `liveQuizId` and `publicationGeneration` for enforceable inverse uniqueness
- expiry and creation timestamps

The database enforces one binding per respondent and at most one respondent for each participant or anonymous credential within a quiz generation. Admission uses those unique constraints for concurrent create-or-resolve behavior. Anonymous tokens carry `liveQuizId` and `publicationGeneration`.

Migration strategy:

- Use an expand-contract migration: A1 adapts the existing schema to carry the
  binding, generation, nullable label, finalization, and receipt-generation
  fields plus new owner invariants; later existing layers switch writers and
  readers; remove the compatibility shape only after old writers are gone.
- Keep `TemporaryLeaderboardEntry` and its token flow unchanged for gamification.
- Do not trust a browser-stored respondent id by itself. Anonymous correlated identity needs an opaque token or `id + random secret`; the server stores/verifies the secret, preferably hashed.
- Scope the token to one quiz generation and align browser and token expiry. Do not copy the current temporary-participant mismatch between a 30-day cookie and two-week JWT.
- Delete active bindings after an ended quiz has no unsettled receipts. Delete the respondent, label, and responses together only when the correlated dataset reaches its retention deadline.

### Adapt Existing Durable Responses

Adapt the existing `LiveQuizResponse` ownership so a response can belong to one
of:

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

### Preserve Existing Export Delivery

Preserve the existing authenticated self-service CSV export for correlated
standard live quizzes. The operation must verify that the current user can
manage the live quiz and that the quiz has ended; the adaptation changes only
the finalized-label source and the lifecycle gating.

Output shape:

- one row per respondent per live quiz execution scope.
- first header: `respondent`; values: stable `respondent_N` labels only.
- one human-readable column group per `ElementInstance` and `elementBlockExecution`, preserving quiz/block/question order.
- headers use stable, self-describing keys: `block_01_question_02_execution_01_response`, `..._correct`, and `..._points`.
- no email, participant id, username, temporary pseudonym, account type.
- no submission or join timestamps.
- unanswered cells are empty; scalar answers are plain text; structured answers use canonical compact JSON in one cell.
- free-text answers are excluded from the correlated teaching export. Correlated admission rejects those questions before identity admission or outbox creation, with worker-side rejection retained as defense in depth for already-admitted events.
- RFC 4180-compatible quoting, CRLF rows, and UTF-8 with BOM so commas, quotes, line breaks, and German text open cleanly in spreadsheet tools.
- response includes a safe filename, CSV content, and the privacy warning shown by the UI.

The manage evaluation page shows the download action only for ended `CORRELATED_EXPORT` quizzes. Aggregate-only and old quizzes show no misleading export action. Existing response-level CLI export remains an admin tool and is not the lecturer delivery path.

Research export:

- later.
- aggregate/DP-safe by default.
- no raw row-wise matrix in research profile unless explicit external approval.

## Stack-owned capability work

The sections below describe adaptation work on the already-existing slices.
They are not instructions to create new feature slices. Work bottom-up on the
named branches, preserve the existing implementation where it already matches
the ADRs, and cascade only the contract changes and the repairs they require.

### Planning gate for the adaptation

Do:

- Independent review of this adaptation plan before ADR repair work.
- Check schema naming, migration risk, export semantics, token/security risk.

Check:

- Reviewer findings integrated or explicitly deferred in this plan.

Commit:

- `docs(project): align existing correlated response plan with accepted ADRs`

### A1 - Adapt existing domain slice to the accepted contract

Do:

- Adapt the existing Prisma mode/schema work to carry the generation-scoped
  respondent, active-only binding, nullable immutable export label,
  finalization state, and receipt-generation fields required by ADR-0005/0006.
- Adapt the existing `LiveQuizResponse.respondentId` compatibility path so
  correlated responses use respondent ownership while assessment rows retain
  `participantId`; preserve the existing dual uniqueness and owner checks.
- Keep the existing GraphQL mode wiring, salt creation, generated contracts,
  and service-level mode lock where they already satisfy the contract; repair
  only the affected readers/writers.
- Patch existing response-level export compatibility so nullable
  `participant` cannot break compile/runtime, while leaving assessment
  ordering and ownership unchanged.
- Keep the migration expand-contract compatible with old writers until the
  next cascaded slices replace them.

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

- `fix(live-quiz): align domain slice with correlated identity contract`

### A2 - Existing contract slice: adapt generation-bearing contracts

Do:

- Preserve the existing token, event, cache, and validation contracts where
  they already carry the accepted response mode.
- Adapt the remaining contract fields and generated types so every correlated
  token, event, cache entry, and validation path carries
  `publicationGeneration` and respondent ownership.

Files:

- `packages/util/src/liveQuizResponseIdentity.ts`
- `packages/util/src/liveQuizResponseMetadata.ts`
- `packages/types/src/hatchet.ts`
- existing A2 contract tests and generated outputs

Check:

- Generated contracts have no diff after regeneration.
- Stale-generation and forged-token contract cases remain rejected.

Commit:

- `fix(live-quiz): align generation-bearing response contracts`

### A3 - Existing admission slice: adapt locked respondent bindings

Do:

- Adapt the existing admission flow to resolve one generation-scoped respondent
  from a participant account or anonymous credential through the active
  binding.
- Preserve the existing cookie-first fallback, token verification, duplicate
  response-key reservation, and temporary-pseudonym exclusion.
- Hold the shared quiz lock through receipt insertion and persist the receipt
  generation.

Files:

- `apps/response-api/src/correlatedResponseAdmission.ts`
- `apps/response-api/src/correlatedResponseHandler.ts`
- `apps/response-api/src/correlatedResponseOutbox.ts`
- existing A3 admission tests

Check:

- Concurrent inverse uniqueness resolves to one respondent per credential.
- Stale-generation and forged-token credentials are rejected.
- Shared-lock coverage extends through receipt insertion.

Commit:

- `fix(live-quiz): align locked respondent admission`

### A4 - Existing settlement slice: adapt respondent persistence and receipts

Do:

- Preserve the existing correlated worker and transactional outbox flow.
- Adapt durable response writes to use `respondentId` and settle receipts only
  after durable apply or durable non-retryable rejection.
- Leave transient failures pending with their payload and retry schedule.

Files:

- `apps/hatchet-worker-response-processor/src/processors/correlatedProcessor.ts`
- `apps/hatchet-worker-response-processor/src/processors/correlatedResponse.ts`
- existing A4 settlement tests

Check:

- Retryable failures do not set `settledAt` or clear `eventPayload`.
- Durable non-retryable outcomes settle and clear receipt delivery metadata.
- Assessment and aggregate processor paths remain unchanged.

Commit:

- `fix(live-quiz): align respondent settlement semantics`

### A5 - Adapt existing lifecycle slice for correlated finalization

Do:

- Adapt the existing lifecycle and publication implementation so logged-in and
  anonymous correlated browsers use `LiveQuizRespondent` plus an active-only
  binding.
- Preserve the existing gamification exclusion and temporary-pseudonym path.
- Adapt existing A5 lifecycle behavior to perform the settlement-gated
  finalization and cleanup required by ADR-0006:
  delete account/credential bindings and settled receipt metadata, allocate
  immutable labels, remove `exportSalt`, mark the generation finalized, and
  reject reopening under the same generation.
- Apply the approved finite retention rule: retain finalized respondent rows
  for 90 days after `finalizedAt`; let the existing minute-level
  `reconcile-live-quiz-publications` general-worker task delete expired
  respondents in bounded batches, cascading responses and corrections while
  leaving rows with active bindings or pending receipts in place.
- Enforce the approved field boundary at admission and settlement: reject
  free-text correlated responses before identity/outbox creation, and persist
  only the response and grading fields with non-information sentinels in the
  shared timestamp/time-spent columns.

Files:

- `packages/graphql/src/services/liveQuizzes.ts`
- `packages/graphql/src/services/liveQuizPublication.ts`
- existing A5 lifecycle/finalization tests

Check:

- Assessment response attribution and point-correction audit remain unchanged.
- Logged-in and anonymous correlated responses retain grouping but no binding
  after finalization.
- Pending receipts block finalization; repeated finalization is idempotent.
- Bindings, settled receipts, and salt are absent after finalization while
  persisted respondent labels remain stable.
- Expired finalized respondent rows and their cascaded responses/corrections
  are deleted, while newer rows and rows blocked by bindings or pending
  receipts remain.
- Existing gamified temporary-pseudonym workflows remain unchanged.

Commit:

- `fix(live-quiz): adapt lifecycle to settlement-gated finalization`

### B1 - Adapt existing correlated export matrix

Do:

- Preserve the existing authenticated matrix operation, evaluation-page
  download, browser-generated file behavior, and settled CSV formatting.
- Adapt the exporter to consume finalized stable `respondent_N` labels from
  the respondent rows; remove the interim HMAC identity table, lazy label
  creation, and `exportSalt` dependency.
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
- DB-backed export is rejected before finalization and succeeds afterward using
  persisted labels, with bindings, settled receipts, and salt absent.
- Agent-browser download check: correct filename, headers, row shape, warning, and unavailable states.

Commit:

- `fix(export): consume finalized correlated respondent labels`

### B2 - Existing Manage UI setting: preserve, then repair only regressions

Do:

- Preserve the existing setting, default, assessment explanation, lifecycle
  lock, consequence summary, selector, and EN/DE copy.
- After the A1-A5/B1 cascade, repair generated-contract or form-shape
  regressions only where the accepted identity contract requires it.

Files:

- `apps/frontend-manage/src/components/activities/creation/liveQuiz/*`
- `packages/i18n/messages/en.ts`
- `packages/i18n/messages/de.ts`
- GraphQL ops generated imports as needed

Check:

- Typecheck affected app/package.
- Mandatory agent-browser check with the manage wizard in EN/DE, including
  assessment and locked states.

Commit:

- Only if a contract regression requires a focused repair; otherwise record
  verification without a synthetic commit.

### B2 - Existing participant notice: preserve, then repair only regressions

Do:

- Preserve the existing persistent notice, mode-specific text, assessment
  separation, notification treatment, and responsive layout.
- After the A1-A5/B1 cascade, repair only response-routing or generated-op
  regressions; do not redesign settled participant copy.

Files:

- `apps/frontend-pwa/src/pages/session/[id].tsx`
- `apps/frontend-pwa/src/components/liveQuiz/LiveQuizQuestionColumn.tsx`
- `packages/graphql/src/graphql/ops/QGetRunningLiveQuiz.graphql`
- `packages/i18n/messages/en.ts`
- `packages/i18n/messages/de.ts`

Check:

- Typecheck PWA.
- Agent-browser screenshots on desktop and 375px mobile for both modes and
  EN/DE.
- Verify the notice does not push answer options below the fold on mobile.

Commit:

- Only if a contract regression requires a focused repair; otherwise record
  verification without a synthetic commit.

### Integrated verification and delivery gates for the adapted stack

Do:

- Re-run the existing full local flow against the adapted stack: create a
  correlated LQ, submit as logged-in and anonymous respondents, settle and
  finalize it, then export. Verify assessment ownership and gamified
  temporary-pseudonym behavior as regressions.
- Browser screenshots: manage setting; PWA notices in both modes.
- Reuse existing fixtures/seed data where possible; add only the fixture
  delta needed to exercise finalization, retention expiry, and all respondent
  types.
- Update existing lecturer-facing docs only where the accepted contract changes
  mode behavior, export contents, finalization, retention, or
  field-minimization responsibilities.
- Re-run the existing mandatory E2E cases: enable correlated mode; anonymous
  reload continuity; correlated notice; aggregate quiz unchanged; successful
  CSV download.
- Manually test blocked respondent cookies/storage after the quiz is otherwise
  admitted. The current page must remain usable through the memory-only signed
  token; a reload may create another pseudonymous export row. PIN-protected
  admission still requires its quiz PIN cookie.
- One integrated final review covering correctness, plan compliance,
  maintainability, security, data integrity, and architecture as applicable.
- PR/MR body with screenshots and manual verification list.

Check:

- `pnpm --filter @klicker-uzh/graphql check`
- `pnpm --filter @klicker-uzh/export test`
- app checks where touched
- Playwright plus mandatory agent-browser verification

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

- Review this adaptation plan before ADR repair work.
- Run per-layer risk review and simplification where required before each
  focused repair commit.
- Run one integrated final review before PR/MR, covering correctness, plan
  compliance, maintainability, security, data integrity, and architecture as
  applicable.

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
- 2026-08-12: The existing A1-A5 and B1-B2 slices are published as drafts. ADR review identified the deltas from the interim compatibility identity to generation-scoped respondents and active-only bindings, moved immutable label persistence into A1/A5, defined receipt settlement and locking, and kept B1 as rendering only. The slices already contain the feature implementation; only these ADR deltas remain to be repaired and cascaded, and no push has occurred.
- 2026-08-12: The correlated teaching-export boundary excludes free-text answers, matching [ADR-0007](../docs/adr/0007-correlated-live-quiz-response-boundary.md). The interim B1 export-label migration does not yet satisfy ADR-0006 and is assigned to A1, A5, and B1 above.
- 2026-08-12: Cookie-blocked correlated sessions retry identity initialization after the cookie-backed submission returns identity `401`; only that explicit fallback returns a quiz-scoped signed respondent token to current-page memory. Cookie identities retain precedence, and PIN admission remains cookie-based.
- 2026-08-12: B2 integrated review fix added explicit bearer fallback, `Authorization` CORS support, no-store initialization responses, identity-scope tests, and a focused Playwright journey that discards respondent cookies. Source checks are green; the local browser gate remains blocked by the shared DevPod's PWA font resolver failure and lifecycle lock.
- 2026-08-12: Final review found and fixed a legacy temporary-participant continuity gap. Correlated identity resolution now confirms a temporary leaderboard entry for the target quiz before reusing a legacy unscoped temporary cookie; stale cookies fall through to the quiz-scoped anonymous respondent or explicit bearer fallback.
- 2026-08-12: Final review also required this plan refresh. The stack topology, current B2 status, browser-runtime blocker, and draft-publication next steps are now recorded here.
- 2026-08-12: Final review found that `test-graphql` did not run the response-api or response-processor integrity suites. The workflow now includes both app paths in its filter and runs their existing `test:run` scripts beside the GraphQL tests; browser runtime verification remains the separate pre-merge blocker.
- 2026-08-12: Final review follow-up aligned the plan with the implemented responseKey uniqueness and transactional outbox admission, and recorded the intentional processor extraction that preserves aggregate and assessment behavior. The workflow now also builds the response-api and response-processor production bundles before running their source-level suites.
- 2026-08-12: User clarified that A1-A5/B1-B2 are already complete sliced PRs. The plan now treats the remaining work as in-place ADR adaptation and a two-stack cascade, preserving existing implementation, authorship, attribution, and unchanged-layer verification. The Sol planning challenge tightened layer ownership, stop conditions, and no-op B2 handling.
- 2026-08-15: A1 adaptation resumed on the existing `rs/pr5134-a1-domain`
  worktree after propagating the approved adaptation plan. The current slice is
  the schema/domain contract only; retention expiry remains gated on a recorded
  finite policy, and correlated publication stays disabled.
- 2026-08-15: A1 schema adaptation now carries the authoritative
  `LiveQuiz.publicationGeneration`, generation-scoped respondent labels, active
  bindings with an exclusive owner check, and composite respondent/quiz-
  generation integrity. Temporary participant admission remains
  gamification-only. Prisma validation, generation, schema sync, Prisma and
  GraphQL typechecks, and touched-file formatting pass; DB-backed migration and
  integration execution remain pending because no database runtime is available.
- 2026-08-15: A1 slice review found that the temporary-participant endpoint
  still accepted correlated admission; the repair now rejects temporary
  pseudonyms unless the quiz is gamified and not correlated. A follow-up review
  also required the quiz-owned generation source before A2/A3 contract and
  admission work; A1 now owns that field and migration, while A5 retains the
  lifecycle transition and publication metadata work. The negative admission
  coverage now separates correlated and non-gamified rejection. Ordinary
  index-DDL safety remains a DB-backed follow-up because the local database
  runtime is unavailable.
- 2026-08-15: A3 and A4 were cascaded onto the adapted A1/A2 contracts. Admission
  now resolves only generation-scoped active bindings, and settlement persists
  only through `respondentId` while rejecting temporary or finalized identities.
  Focused admission and worker checks pass on the adapted stack.
- 2026-08-15: A5 was cascaded onto the adapted A4 branch. Publication rotates a
  per-generation salt; ending takes the exclusive quiz lock; finalization waits
  for fully settled receipts, assigns immutable HMAC-ordered labels, clears
  transitional identity fields, deletes bindings and settled receipt metadata,
  and removes the salt. New finalization tests and the affected publication and
  abort suites pass locally; B1 still needs the export-source adaptation.
- 2026-08-15: B1 was rebased onto A5 and adapted in place. The exporter now
  reads only persisted finalized respondent labels, filters the current
  publication generation, rejects incomplete receipts and invalid owners before
  row materialization, and no longer stores HMAC identity hashes or assigns
  labels lazily. The interim export-label schema and migration were removed.
  Focused export tests (14), export-package tests (36), GraphQL typecheck, and
  the A5 finalization/publication regressions (14) pass. The combined abort
  suite remains environment-blocked because the seeded DevPod contains 11 users
  while its existing fixture asserts exactly 6; the abort behavior itself was
  already covered on A5 before this source-only B1 adaptation.
- 2026-08-15: B1 review found that retained responses from an older publication
  generation were being counted as invalid during export sizing. The preflight
  now ignores known older-generation respondents while still rejecting unknown
  respondents and malformed current-generation rows; the evaluation capability
  also includes the invalid-owner check. A DB-backed generation-isolation
  regression passes, along with the A5 finalization/publication regressions
  (14) and GraphQL typecheck.

## Goal Prompt Requirements

If handed to another agent:

- Use this file as current plan.
- Resume the existing `rs/pr5134-a1-domain` -> `a5-lifecycle` and `b1-export` -> `b2-ui` stacks; do not recreate the obsolete source branch or another topology.
- Update `Progress` before and after each layer.
- Work one layer at a time, bottom-up, and cascade lower-layer changes before continuing.
- Run risk-selected review and simplification after each substantive layer.
- Run one integrated final review covering applicable correctness, plan,
  maintainability, security, data-integrity, and architecture lenses before
  PR/MR.
- Use `$rs-mr-description-writer` for the PR body.

## Next Steps

1. Record the finite retention period, deletion trigger, and enforcement owner;
   until then, keep correlated publication disabled.
2. Cascade the adapted A5/B1 contract through the existing B2 Manage/PWA
   branch; verify unchanged layers instead of creating synthetic commits.
3. Run response-api/worker builds and source checks, execute the existing
   Playwright journey and mandatory Manage/PWA browser checks, then run the
   integrated final review.
