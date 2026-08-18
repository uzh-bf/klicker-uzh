# PR #5134 - Live Quiz Correlated Responses Plan

Goal: adapt the existing A1-A5/B1-B2 draft implementation in place to the
accepted correlated-response contract, preserving row-correlatable export,
clear participant-facing UI, and the separate assessment boundary.

Plan path: `project/2026-06-20-pr-5134-live-quiz-correlated-responses-plan.md`
Branch: `rs/pr5134-a1-domain` for this ADR/domain update; implementation continues through the stack below.
Target: `v3`
Original PR: [#5134](https://github.com/uzh-bf/klicker-uzh/pull/5134), preserved while the replacement stack validates.
Status: the full A1-A5/B1-B2 slices already exist in the replacement draft
stack. The A1-A5 ADR adaptation, B1 export-source adaptation, and B2 cascade
are now applied locally; the remaining work is to clear the retention,
participant-runtime, integrated-review, and delivery gates. This is an in-place
adaptation of existing slices, not a new feature build or a new topology.

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
settlement. The remaining work is the retention/runtime follow-up, integrated
checks, and browser/delivery gates.

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
- The accepted B2 delivery slice has been cascaded onto the adapted A5/B1
  identity and finalization contract. The finite-retention policy is now
  recorded and implemented locally; the remaining gates are runtime worker
  proof and the integrated final review.
- Source checks are recorded as green. Manage EN/DE mode-selection verification
  is green. A clean generated PWA dev cache and managed DevPod restart restored
  the dynamic `/session/:id` route; mandatory agent-browser verification then
  rendered the correlated notice and question, and `AddCorrelatedResponse`
  returned HTTP 200. The synthetic response was admitted and settled by the
  existing processor path, leaving one respondent, one binding, one durable
  response, and no unsettled receipt. The managed response-processor worker
  still crashes on the known Hatchet SDK logger error, so automatic Hatchet
  delivery is not claimed; the isolated Playwright runtime remains unavailable.

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

## Resolved Export-Discoverability Decisions (2026-08-17)

These close the design frontier for the follow-up Manage/evaluation UI slice and
supersede the full-width evaluation download banner.

- Decision: the correlated-mode tag reads `Zuordenbar` (de) / `Attributable`
  (en). It follows the existing assessment-badge pattern next to the activity
  name and distinguishes correlated live quizzes from the default aggregated
  response-collection mode.
- Decision: the activity-overflow download item resolves its server-side export
  readiness lazily when the overflow menu opens, not eagerly per list row. The
  evaluation-page readiness flag costs five parallel count queries, so computing
  it for every activity row would add an N+1 cost to the activity list and the
  course overview. Eligibility alone (ended, correlated, non-assessment, and
  OWNER/ADMIN/WRITE access) decides whether the item is rendered; the lazy
  readiness answer decides whether it is enabled.
- Decision: the item sits immediately before `Duplicate live quiz` in the ended
  live-quiz overflow menu. Every other quiz keeps the existing action order.
- Decision: the evaluation-footer overflow offers font size as an explicit
  four-choice radio group (`sm`, `md`, `lg`, `xl`) instead of the previous
  increment and decrement buttons.
- Decision: the privacy explanation moves from the removed full-width banner to
  a tooltip on the download item itself, in both the activity overflow and the
  evaluation-footer overflow.

Implementation shape forced by the `@uzh-bf/design-system` v4.1.6 dropdown API,
which has no `open`/`onOpenChange` prop and treats `items` and `radioGroups` as
mutually exclusive:

- The footer overflow is rendered as a `radioGroups` dropdown. The first group
  carries the download action as a standard item, and the following groups carry
  the language choice and the font-size choice as real radio groups. Any item
  type renders inside a group, so this keeps one menu without a design-system
  change.
- Lazy readiness is triggered from the dropdown trigger itself, on both pointer
  and keyboard interaction, because keyboard menu opening emits no pointer
  event.
- Item tooltips use the dropdown's own `tooltip` field on standard items rather
  than a wrapping `Tooltip` component.
- Readiness is served by a dedicated `liveQuizCorrelatedExportReadiness` query
  rather than by widening `ActivityInfo`, so the expensive settlement checks run
  only for the one quiz whose menu was opened.

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

## Primitive impact

| Primitive | Decision | Owner and lifecycle | Consumers | Partial failure behavior |
| --- | --- | --- | --- | --- |
| `LiveQuiz.responseCollectionMode` | Reuse the existing enum with `CORRELATED_EXPORT` | LiveQuiz publication lifecycle; mode is locked while responses exist and carries through publication generations | Publication gating, response-api routing, evaluation UI | Mode changes are rejected under an exclusive lock once a generation admitted responses |
| `LiveQuizRespondent` | New pseudonymous identity, one per participant per publication generation | Created at correlated admission; finalized when the ended generation settles (immutable `exportLabel`, transient fields nulled); deleted 90 days after `finalizedAt` | Correlated responses, correlated export | Unsettled receipts block finalization; expired rows are denied export even before cleanup deletes them |
| `LiveQuizRespondentBinding` | New temporary account/token binding | Created or refreshed at admission; deleted at generation finalization; never exported | Correlated admission only | A lost uniqueness race retries against the winning binding; the binding never outlives settlement |
| `TemporaryLeaderboardEntry` | Keep separate from `LiveQuizRespondent` (ADR-0005) | Gamification lifecycle, unchanged | Anonymous gamification leaderboard | Correlated quizzes create no leaderboard entries and temporary identities cannot enter correlated mode |
| `LiveQuizPendingResponse` | Reuse the outbox with a generation-scoped response key | Reserved at admission; settled durably; settled receipts deleted at finalization | Correlated response processor, finalization | Pending or retryable receipts block finalization; transient errors stay pending without a timeout |
| `LiveQuizResponse` | Reuse the shared response table through `respondentId` | Created by the settlement worker with sentinel timestamps; cascade-deleted with its respondent | Correlated export, evaluations | Response rows outside the finalized generation fail the export preflight closed |
| Assessment responses and participation | Unchanged and explicitly out of scope (ADR-0006) | Assessment lifecycle with intact participant association and correction history | Assessment grading and appeals | Assessment quizzes never enter correlated mode and never cross the identity-finalization boundary |
| Correlated CSV export | New read-only consumer of one finalized generation | Manage evaluation gates readiness; service enforces size and retention boundaries | Lecturer teaching export | Not-ready, invalid, and expired generations return distinct errors; `canExportCorrelatedResponses` mirrors the same predicate |

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
- 2026-08-15: B1 follow-up aligned the evaluation capability with the export
  preflight's quiz-scoped join, so foreign-quiz respondents fail closed and
  retained older-generation rows remain ignored consistently. The DB-backed
  regression now proves readiness for current plus retained rows and rejection
  for a foreign respondent; GraphQL typecheck and the regression pass.
- 2026-08-15: B2 was rebased onto the corrected B1 export/readiness contract.
  Existing cookie and memory-only bearer fixtures now carry the required
  publication generation. The response-api (28), response-processor (36), and
  util (76) test suites pass, and the response-api, response-processor,
  Manage, PWA, and Playwright typechecks pass in the isolated DevPod. Browser
  runtime verification and the final integrated review remain pending.
- 2026-08-15: Manage browser verification passed for the correlated response
  storage selector in both English and German: aggregate-only is the default,
  correlated export can be selected, and the settings wizard remains usable.
  The PWA runtime journey is still blocked by the running DevPod returning 404
  for the dynamic `/session/:id` route even though the API returns the started
  correlated quiz; the isolated Playwright journey also could not launch because
  its Chromium runtime is missing the headless shell and required system
  libraries. No browser-run result is claimed for the participant notice or
  response submission until that environment issue is resolved.
- 2026-08-15: Integrated review identified and the follow-up commit fixed three
  bounded defects: a stale respondent cookie could shadow a current-generation
  bearer fallback, finalized generations remained reconciliation candidates, and
  aggregate-mode EN/DE notices omitted the non-linkage disclosure. Focused util,
  response-api, and finalization regressions pass; the full precommit is green.
- 2026-08-15: Recreating the isolated DevPod confirmed it is mounted at B2
  HEAD. The Turbopack dev manifest still omits the existing `/session/[id]`
  page and returns 404, while a webpack production build compiled successfully
  and emitted that route before being killed with exit 137 during page-data
  collection. This narrows the participant gate to the dev-runtime/resource
  environment; no participant browser result is claimed.
- 2026-08-15: The follow-up slice review concerns are repaired locally. Anonymous
  identity selection now keeps the higher publication generation when cookie and
  bearer identities disagree, and reconciliation still selects current-
  generation incomplete rows when the export salt is unexpectedly missing so
  finalization can surface the anomaly. Inverse identity and null-salt
  regression coverage pass; util identity (11), GraphQL finalization (5), and
  response-api handler (9) tests pass, followed by the full precommit (24/24
  tasks). Redis connection-refused warnings and the host Node 26 versus the
  repository Node 24 warning remain environment-only.
- 2026-08-15: Follow-up slice review passed after adding explicit same-generation
  cookie-first, temporary-participant precedence, and null-salt pending-receipt
  coverage. The simplifier removed incidental aggregate-error cardinality
  assertions from the respondent anomaly test. The expanded util identity
  suite (13) and GraphQL finalization suite (6) pass, and the latest full
  precommit remains green (24/24 tasks); the integrated final review and the
  retention and participant-browser gates are still outstanding.
- 2026-08-16: Recreated generated PWA dev state and restarted the managed B2
  DevPod, which restored the dynamic participant route. Mandatory
  agent-browser verification rendered the correlated notice and question, and
  a participant submission returned HTTP 200 from `AddCorrelatedResponse`.
  The existing correlated processor then settled the receipt and persisted one
  synthetic respondent response; the managed response worker itself remains
  unavailable after the Hatchet SDK `this.logger[message.type]` crash, and the
  isolated Playwright runtime is still unavailable. Retention policy and the
  integrated final review remain open.
- 2026-08-16: The retention ruling is recorded in ADR-0006: finalized
  correlated datasets are retained for 90 days after `finalizedAt`.
  The existing minute-level general-worker reconciliation task now deletes
  expired generation-scoped respondents in bounded batches, cascading durable
  responses and corrections while preserving rows blocked by an active binding
  or pending receipt. Correlated admission and worker defense-in-depth reject
  free-text responses before durable persistence; correlated rows use epoch and
  `-1` sentinels for the shared legacy timestamp/time-spent columns. Focused
  retention, response-api, and worker tests are added locally; runtime and
  integrated-review gates remain open.
- 2026-08-16: The integrated final review returned DONE_WITH_CONCERNS
  (93/100); every finding was verified against the code and corrected in its
  owning layer. A3 now retries identity-creation uniqueness races and derives
  duplicate status from the response-key receipt instead of treating every
  constraint violation as a duplicate response. A4 drops a redundant worker
  test. A5 finalizes soft-deleted ended correlated quizzes (lock and
  reconciliation no longer exclude `isDeleted`) and removes the obsolete
  temporary-pseudonym test that contradicted the ADR-0005 login rejection.
  B1 denies export and clears `canExportCorrelatedResponses` at the retention
  cutoff even while physical cleanup is still progressing. B2 refreshes the
  memory-only bearer after any correlated 401 so a cookie-blocked tab survives
  a publication-generation rollover. ADR-0006 records the access and
  soft-delete boundaries, and a primitive-impact table was added above.
  Fresh focused evidence: response-api 26/26 (A3), worker 34 pass plus one
  environment skip (A4), correlated export unit tests 14/14 (B1); DB-backed
  suites, cookie-blocked rollover verification, and remote CI remain open.
- 2026-08-17: Implemented the export-discoverability slice on B2. The
  evaluation banner is gone; download, language, and a four-choice font-size
  radio group now live in one bottom-right evaluation-footer overflow, with the
  privacy text as the download item's own tooltip. A new
  `liveQuizCorrelatedExportReadiness` query serves lazy readiness, the five
  settlement counts were extracted into a shared `isCorrelatedExportSettled`
  helper, and `ActivityInfo` exposes `responseCollectionMode`. Browser
  verification against the running B2 instance confirmed the overflow contents
  and radio state, that selecting Extra large applies and persists, that the
  privacy tooltip renders on hover, that the download runs without an error
  toast, and that the readiness query returns true for the settled review quiz.
  The `UserActivities` SQL view unions four activity types and carries no
  response mode, so `getUserActivities` now resolves the modes of the live
  quizzes on the current page in one additional batched query rather than
  requiring a drop-and-recreate view migration; the course-overview path keeps
  reading the column directly. Browser verification then confirmed the
  Attributable badge on the activity list, the download entry rendered
  immediately before Duplicate Live Quiz with its privacy tooltip, exactly one
  readiness request fired when that overflow opened, and neither the entry nor
  the request appeared for an ineligible assessment quiz.
  Repo `check:all` is green. The `graphql` suite is 614 passed with two
  pre-existing failures in `assessmentRestrictions.test.ts`, reproduced
  identically on the unmodified baseline. That DB-backed run wiped the shared
  dev database, so the manually created correlated review quiz and its
  anonymous sessions are gone from the running B2 instance and need reseeding
  plus recreation before further manual testing.
- 2026-08-17 (follow-up): Review caught that the readiness trigger was mounted
  inside the dropdown's `trigger` prop, where a keyboard activation on the
  trigger button can never reach it and a pointer press on the button's padding
  misses it too; the handlers now sit on a wrapper around the whole dropdown,
  which is where those events actually bubble. The footer overflow's icon-only
  trigger gained an accessible name from the previously unused `moreOptions`
  key. `docs/frontend-conventions.md` and `docs/graphql-api-layer.md` record the
  two-surface export entry points, the lazy readiness query, the view-gap
  workaround, and both design-system constraints. Formatting and the typechecks
  for `graphql` and `frontend-manage` are green. With the user's approval the
  dev database was reset, pushed, and reseeded, and the seeded ended
  non-assessment quiz `Test Live Quiz (Wordcloud)` was switched to correlated
  collection so both surfaces have data to render. Browser verification on the
  German locale then confirmed the badge reads Zuordenbar and appears on exactly
  that one quiz, that focusing the activity overflow trigger and pressing Enter
  opens the menu and fires exactly one readiness request — the path that could
  not work before the wrapper fix — that the download entry sits directly before
  Live Quiz duplizieren and is enabled, that the footer trigger announces itself
  as Weitere Optionen, and that the footer overflow opens upward carrying Klein,
  Mittel, Gross, and Sehr gross with the correct checked radio states.
- Because the open menu is rendered into a portal while React still routes its
  events through the component tree, an activated menu entry reaches the same
  wrapper as the trigger. The wrapper therefore ignores events whose target is
  not inside it, and the browser confirmed that opening the menu by mouse or by
  keyboard costs exactly one readiness request while activating an entry
  afterwards adds none. The guard was also measured against its absence: with
  the containment check neutralised, opening the menu and then activating
  Aktivitätsinformationen produced two readiness requests instead of one, so the
  extra condition earns its place rather than describing a hypothetical.
- `packages/graphql/test/correlatedExportReadiness.test.ts` covers
  `getCorrelatedExportReadiness` with a mocked Prisma context: the settled quiz
  is ready, an unknown quiz, a quiz that has not ended, an assessment quiz, and
  an aggregate-anonymous quiz all refuse before any counting, and each of the
  five settlement blockers refuses on its own. Ten tests pass without touching
  the database. The browser fixture could not prove those false branches,
  because a quiz with no correlated responses satisfies every count trivially.
- `docs/architecture-overview.md` still pointed at the deleted
  `CorrelatedResponseExport.tsx`; it now names the footer overflow and the
  readiness query. Repo-wide formatting and the graphql and manage typechecks
  are green, and manage lint reports only the pre-existing hook warnings.

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

1. Restore a healthy managed response-worker runtime and, if the browser
   runtime becomes available, execute the existing participant Playwright
   journey. The mandatory agent-browser notice and response-admission checks
   are now green; Manage EN/DE mode-selection verification is already green.
2. Complete the single correction pass of the integrated final review on the
   corrected range, then execute the user-approved force-with-lease push of
   all seven branches and update the PR bodies. Merge, ready status, and
   rebasing onto the newer `v3` remain separate user decisions.
