# PR #5134 - Live Quiz Correlated Responses Plan

Goal: add opt-in standard live quiz mode that stores row-correlatable responses for export while keeping participant-facing UI clear and assessment separate.

Plan path: `project/2026-06-20-pr-5134-live-quiz-correlated-responses-plan.md`
Branch: `codex/live-quiz-correlated-responses`
Target: `v3`
PR: [#5134](https://github.com/uzh-bf/klicker-uzh/pull/5134)
Status: implementation in progress

## Non-Goals

- No assessment behavior change. Assessment remains identifiable and auditable by design.
- No backfill for old standard live quizzes. Future quizzes only.
- No research / DP export in this slice. Later admin workflow.
- Free-text answers are excluded from the correlated teaching export in this
  slice; broader PII handling for other research/export channels remains future
  work.
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
- Decision: all respondent types included in correlated mode: logged-in participants, temporary pseudonym users, anonymous correlated users.
- Decision: export never shows identifiable form. Only stable random respondent labels, one namespace: `respondent_001`, `respondent_002`, ...
- Decision: labels are stable across re-exports after the quiz ends. Order internal identities by `HMAC(exportSalt, internalId)` before assigning labels; raw ids, response time, and join order are never exposed.
- Decision: logged-in users may still use account internally for scoring/leaderboard, but export strips account identity.
- Decision: temporary pseudonym remains visible on leaderboard, but export strips pseudonym.
- Decision: free text is excluded from the correlated teaching export in this
  slice. The export still carries pseudonymized individual-level data and must
  not be described as anonymous or differential privacy.
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

Add a random `exportSalt` on `LiveQuiz`, created when correlated mode is first enabled. Use it only for stable export-label ordering.

Assessment: keep `isAssessmentEnabled` separate. If assessment true, disable this setting and explain that assessments always store identifiable responses.

The service layer rejects mode changes unless the quiz is `DRAFT` or `SCHEDULED`. The manage UI mirrors this lock and disables the setting for assessments with an explanation.

### Quiz-Scoped Respondent

Introduce unified non-account respondent model, working name `LiveQuizRespondent`.

Fields:

- `id`
- `liveQuizId`
- `type`: `TEMPORARY_PSEUDONYM` or `ANONYMOUS_CORRELATED`
- `username?`
- `avatar?`
- `score`
- `verificationSecretHash?` or signed-token equivalent for anonymous correlated respondents
- `createdAt`
- `updatedAt`

Purpose:

- Replace or align `TemporaryLeaderboardEntry`.
- Represent anonymous correlated browser identity without `Participant` row.
- Keep account users as `Participant`, not duplicated.

Migration strategy:

- Prefer staged path.
- First add `LiveQuizRespondent`.
- Either migrate `TemporaryLeaderboardEntry` usage immediately or add compatibility layer and migrate in follow-up if blast radius too high.
- Avoid adding new `UserRole` if possible; use quiz respondent token only in response-api / worker. GraphQL self/leaderboard may need compatibility for temporary pseudonym flow.
- Do not trust a browser-stored respondent id by itself. Anonymous correlated identity needs an opaque token or `id + random secret`; the server stores/verifies the secret, preferably hashed.
- Add a type-conditional database check: `ANONYMOUS_CORRELATED` rows require `verificationSecretHash`.
- Scope the token to one quiz and align browser and token expiry. Do not copy the current temporary-participant mismatch between a 30-day cookie and two-week JWT.
- Delete respondent rows and their responses with the quiz. Correlated responses otherwise follow the quiz retention lifecycle.

### Durable Responses

Adjust `LiveQuizResponse` so response can belong to one of:

- `participantId` for logged-in participant
- `respondentId` for quiz-scoped respondent

Constraint:

- exactly one identity field set.
- unique per `instanceId + elementBlockExecution + respondent identity`.

Migration note:

- Model two ordinary Prisma constraints:
  - `@@unique([instanceId, elementBlockExecution, participantId])`
  - `@@unique([instanceId, elementBlockExecution, respondentId])`
- PostgreSQL treats nulls as distinct, so those constraints work with the identity check.
- Append raw SQL before applying the generated migration:
  - `CHECK (num_nonnulls("participantId", "respondentId") = 1)`
  - `CHECK ("type" <> 'ANONYMOUS_CORRELATED' OR "verificationSecretHash" IS NOT NULL)` on `LiveQuizRespondent`
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

- keep current `participantId` required path or adapt minimally if Prisma relation needs nullable participant. Behavior remains participant-only.

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
- free-text answers are excluded from this teaching export; remaining scalar and structured values are formula-neutralized before download so spreadsheet software cannot execute participant input.
- RFC 4180-compatible quoting, CRLF rows, and UTF-8 with BOM so commas, quotes, line breaks, and German text open cleanly in spreadsheet tools.
- response includes a safe filename, CSV content, and the privacy warning shown by the UI.

The manage evaluation page shows the download action only for ended `CORRELATED_EXPORT` quizzes. Aggregate-only and old quizzes show no misleading export action. Existing response-level CLI export remains an admin tool and is not the lecturer delivery path.

Research export:

- later.
- aggregate/DP-safe by default.
- no raw row-wise matrix in research profile unless explicit external approval.

## Slices

### Slice 0 - Plan Review

Do:

- Independent review of this plan before implementation.
- Check schema naming, migration risk, export semantics, token/security risk.

Check:

- Reviewer findings integrated or explicitly deferred in this plan.

Commit:

- `docs(project): add live quiz correlated responses plan`

### Slice 1 - Schema + Mode Wiring

Do:

- Add Prisma enum + `LiveQuiz.responseCollectionMode` + `exportSalt`.
- Add `LiveQuizRespondent` or staged equivalent.
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

### Slice 2 - Manage UI Setting

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

### Slice 3 - Participant Notice

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

### Slice 4 - Respondent Token + Worker Persistence

Do:

- Create quiz-scoped anonymous correlated respondent when mode is `CORRELATED_EXPORT`.
- Persist the opaque token in an HttpOnly quiz-scoped cookie where possible. The
  first initialization response is cookie-only; if a correlated submission
  returns the missing-identity `401`, retry initialization with an explicit
  fallback request and return the signed anonymous respondent token for
  memory-only use by the current page. Never put it in local storage, URLs, or a
  non-HttpOnly cookie. Do not reuse it across quizzes.
- Forward respondent token through `response-api`.
- Add the synchronous correlated-mode Redis vote-hash gate in response-api so duplicates return recorded-before.
- Worker verifies token secret / signature and maps to `LiveQuizRespondent`; respondent id alone is not accepted.
- Persist `LiveQuizResponse` rows in correlated mode for logged-in and anonymous correlated respondents.
- Do not persist temporary pseudonym responses through the unified respondent model in this slice unless Slice 5 is moved before Slice 4.
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

### Slice 5 - Temporary Pseudonym Alignment

Do:

- Align `TemporaryLeaderboardEntry` with `LiveQuizRespondent`.
- Move this slice before Slice 4 if the first worker-persistence implementation must include temporary pseudonym respondents.
- Preserve current gamified UX and leaderboard display.
- Keep token compatibility or provide migration.
- Ensure temporary pseudonym responses export as anonymous respondent labels.

Files:

- Prisma schema/migration
- `packages/graphql/src/services/accounts.ts`
- `packages/graphql/src/services/participants.ts`
- leaderboard services/components if model changes
- response worker

Check:

- Existing gamified live quiz temporary pseudonym workflow.
- Leaderboard visible pseudonym remains.
- Export strips pseudonym.

Commit:

- `refactor(live-quiz): unify temporary quiz respondents`

### Slice 6 - Correlated Export Matrix

Do:

- Add the authenticated, authorized correlated matrix GraphQL operation.
- Add a CSV download action to the live quiz evaluation page for ended correlated quizzes.
- Generate the browser download from returned CSV content, matching existing client-generated download behavior.
- Use HMAC-sorted stable `respondent_N` labels.
- Strip all identifiers and respondent type.
- Use clean, deterministic headers, canonical structured values, formula-injection protection, and RFC 4180-compatible escaping.
- Exclude free-text answers from the teaching export.
- Keep the export explicitly pseudonymized individual-level data; do not call it
  anonymous or differential privacy.
- Show the export contents warning next to the download action and include it in
  export metadata where applicable.
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
- DB-backed export with fixture data across logged-in, temporary, anonymous respondents.
- Agent-browser download check: correct filename, headers, row shape, warning, and unavailable states.

Commit:

- `feat(export): add correlated live quiz response matrix`

### Slice 7 - End-to-End Verification + Security Review

Do:

- Full local flow: create correlated LQ, submit as logged-in, temporary pseudonym, anonymous correlated, export.
- Browser screenshots: manage setting; PWA notices in both modes.
- Add seed data for a correlated quiz and all respondent types.
- Add lecturer-facing docs for both modes, export contents, and the limits of the pseudonymized export boundary.
- Add mandatory E2E cases: enable correlated mode; anonymous reload continuity; correlated notice; aggregate quiz unchanged; successful CSV download.
- Manually test blocked respondent cookies/storage after the quiz is otherwise
  admitted. The current page must remain usable through the memory-only signed
  token; a reload may create another pseudonymous export row. PIN-protected
  admission still requires its quiz PIN cookie.
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
- Replacing `TemporaryLeaderboardEntry` in one slice may be too large. If risky, keep compatibility bridge and migrate later.
- Respondent cookies can be blocked. The current page retries initialization for
  a memory-only signed token only after the cookie-backed submission returns
  identity `401`; a reload may create another pseudonymous row.
- Memory-only respondent tokens are bearer credentials for one quiz. Use a signed token and verify it server-side before writing correlated responses.
- Free text is excluded from the v3.5 correlated teaching export. Other future
  research/export channels still need their own PII review.
- Row export can be mistaken for anonymity/DP. Avoid DP language.
- Live worker has Redis-first design; DB writes must not slow response path enough to harm live quiz UX.
- Returning CSV through GraphQL is intentionally simple for v1 but needs an explicit size limit; large-export streaming remains a later option.
- Labels are stable after quiz end. Account deletion can remove rows and change a later matrix; document exports as snapshots.

## Research

Current implementation does not need external research.

Later research:

- scite-backed privacy / DP design for research exports.
- DP aggregate thresholds, suppression, noise, free-text handling.
- Legal/privacy review language for research use.

## Review Plan

- Plan review before implementation. Preferred: independent agent/model.
- Per-slice review + simplification before each slice commit.
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
- 2026-08-12: The accepted privacy boundary is now reflected here: correlated teaching export excludes free-text answers, matching ADR 0001 and the export tests.
- 2026-08-12: Cookie-blocked correlated sessions retry identity initialization after the cookie-backed submission returns identity `401`; only that explicit fallback returns a quiz-scoped signed respondent token to current-page memory. Cookie identities retain precedence, and PIN admission remains cookie-based.
- 2026-08-12: B2 integrated review fix added explicit bearer fallback, `Authorization` CORS support, no-store initialization responses, identity-scope tests, and a focused Playwright journey that discards respondent cookies. Source checks are green; the local browser gate remains blocked by the shared DevPod's PWA font resolver failure and lifecycle lock.

## Goal Prompt Requirements

If handed to another agent:

- Use this file as current plan.
- Use branch `codex/live-quiz-correlated-responses`.
- Update `Progress` before and after each slice.
- Work one slice at a time.
- Run review + simplification subagents after each slice.
- Run final security review and final branch review before PR/MR.
- Use `$rs-mr-description-writer` for the PR body.

## Next Steps

1. Commit the accepted Slice 1 review fixes, run the separate simplification review, and finalize Slice 1.
2. Start Slice 2 with the manage UI setting and assessment-specific disabled state.
3. Keep temporary-pseudonym response persistence out of Slice 4 until Slice 5 completes the unified respondent path.
4. Deliver the self-service CSV and evaluation-page action together in Slice 6.
