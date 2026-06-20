# Live Quiz Correlated Responses Plan

Goal: add opt-in standard live quiz mode that stores row-correlatable responses for export while keeping participant-facing UI clear and assessment separate.

Plan path: `project/2026-06-20-live-quiz-correlated-responses-plan.md`
Branch: `codex/live-quiz-correlated-responses` planned
Target: `v3`
MR/PR: unknown
Status: planning

## Non-Goals

- No assessment behavior change. Assessment remains identifiable and auditable by design.
- No backfill for old standard live quizzes. Future quizzes only.
- No research / DP export in this slice. Later admin workflow.
- No PII removal from free-text responses yet.
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
- Decision: labels stable per quiz/export as far as deterministic internal ordering allows; raw ids never exposed.
- Decision: logged-in users may still use account internally for scoring/leaderboard, but export strips account identity.
- Decision: temporary pseudonym remains visible on leaderboard, but export strips pseudonym.
- Decision: free text included verbatim in teaching export for now; warn that free text can contain personal data.
- Decision: duplicate submissions follow assessment semantics: first response counts; duplicate returns recorded-before.
- Decision: anonymous correlated id persists per quiz if possible, survives reload/browser close; no cross-quiz reuse.
- Decision: normal quiz editors can enable mode. No special permission.
- Decision: research / DP-safe export later. Correlated row export is pseudonymized individual-level data, not differential privacy.

## Participant Notice Copy

Aggregated mode:

> Responses are counted only in aggregate. Answers are not linked across questions.

Correlated mode:

> Responses in this quiz may be linked for export using random respondent labels. Login is only used for scoring and leaderboard features.

Export warning:

> Export uses random respondent labels and does not include names, emails, account ids, usernames, or temporary pseudonyms. Free-text answers may still contain personal data entered by participants.

## Target Architecture

### Live Quiz Response Mode

Add enum on `LiveQuiz`, likely `responseCollectionMode`:

- `AGGREGATED_ANONYMOUS`
- `CORRELATED_EXPORT`

Default: `AGGREGATED_ANONYMOUS`.

Assessment: keep `isAssessmentEnabled` separate. If assessment true, ignore / hide this setting.

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

### Durable Responses

Adjust `LiveQuizResponse` so response can belong to one of:

- `participantId` for logged-in participant
- `respondentId` for quiz-scoped respondent

Constraint:

- exactly one identity field set.
- unique per `instanceId + elementBlockExecution + respondent identity`.

Migration note:

- Prisma cannot express the full constraint set with `@@unique` once `participantId` is nullable.
- Add raw SQL in the migration for `CHECK (num_nonnulls("participantId", "respondentId") = 1)`.
- Replace the current single unique constraint with two partial unique indexes:
  - `("instanceId", "elementBlockExecution", "participantId") WHERE "participantId" IS NOT NULL`
  - `("instanceId", "elementBlockExecution", "respondentId") WHERE "respondentId" IS NOT NULL`

In `CORRELATED_EXPORT`:

- standard response worker persists `LiveQuizResponse` for all respondents.
- still updates Redis aggregate path for live/evaluation UI.
- duplicate uses first-response-wins.

In `AGGREGATED_ANONYMOUS`:

- keep current no-durable-response behavior for standard LQ.
- continue aggregate results only.

Assessment:

- keep current `participantId` required path or adapt minimally if Prisma relation needs nullable participant. Behavior remains participant-only.

### Export

Add row-per-respondent export for correlated standard LQs.

Output shape:

- one row per respondent per live quiz execution scope.
- stable `respondent_N` label only.
- columns for each question/instance response, correctness, points as needed.
- no email, participant id, username, temporary pseudonym, account type.
- free text verbatim for teaching export.

Existing response-level export can remain or become supporting sheet. Main requested artifact = respondent matrix.

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

- Add Prisma enum + `LiveQuiz.responseCollectionMode`.
- Add `LiveQuizRespondent` or staged equivalent.
- Add `LiveQuizResponse.respondentId` and make `participantId` nullable only together with raw SQL constraints / partial unique indexes.
- Patch existing response-level export in the same slice so nullable `participant` cannot break compile/runtime. At minimum, guard `row.participant`, remove participant-email-only ordering assumptions, and keep assessment rows unchanged.
- Update generated schema flow.
- Expose mode through GraphQL `LiveQuiz`.
- Add create/update inputs and service writes.
- Lock mode after publish/start.

Files:

- `packages/prisma/src/prisma/schema/*.prisma`
- raw SQL migration file
- `packages/graphql/src/schema/liveQuiz.ts`
- `packages/graphql/src/services/liveQuizzes.ts`
- `packages/graphql/src/graphql/ops/*.graphql`
- `packages/export/src/liveQuizResponses.ts`
- generated GraphQL outputs

Check:

- Prisma generate / GraphQL generate.
- Focused GraphQL tests or service unit tests for default + lock.
- Export package typecheck/test or focused compile check for existing `LiveQuizResponse` export.

Commit:

- `feat(live-quiz): add response collection mode`

### Slice 2 - Manage UI Setting

Do:

- Add setting in live quiz wizard near gamification / pin protection.
- Default `AGGREGATED_ANONYMOUS`.
- Hide/disable for assessment.
- Lock in edit mode when quiz no longer draft/scheduled.
- Add EN/DE i18n.

Files:

- `apps/frontend-manage/src/components/activities/creation/liveQuiz/*`
- `packages/i18n/messages/en.ts`
- `packages/i18n/messages/de.ts`
- GraphQL ops generated imports as needed

Check:

- Typecheck affected app/package.
- Browser check with manage wizard if dev env available.

Commit:

- `feat(manage): add live quiz response export mode setting`

### Slice 3 - Participant Notice

Do:

- Add persistent compact notice to PWA live quiz question area.
- Show before first block and during active blocks.
- Use mode-specific text.
- Keep assessment messaging separate.

Files:

- `apps/frontend-pwa/src/pages/session/[id].tsx`
- `apps/frontend-pwa/src/components/liveQuiz/LiveQuizQuestionColumn.tsx`
- `packages/graphql/src/graphql/ops/QGetRunningLiveQuiz.graphql`
- `packages/i18n/messages/en.ts`
- `packages/i18n/messages/de.ts`

Check:

- Typecheck PWA.
- Browser screenshots desktop/mobile for both modes.

Commit:

- `feat(pwa): show live quiz response privacy notice`

### Slice 4 - Respondent Token + Worker Persistence

Do:

- Create quiz-scoped anonymous correlated respondent when mode is `CORRELATED_EXPORT`.
- Persist opaque token or `id + secret` in browser/cookie where possible; no cross-quiz reuse.
- Forward respondent token through `response-api`.
- Worker verifies token secret / signature and maps to `LiveQuizRespondent`; respondent id alone is not accepted.
- Persist `LiveQuizResponse` rows in correlated mode for logged-in and anonymous correlated respondents.
- Do not persist temporary pseudonym responses through the unified respondent model in this slice unless Slice 5 is moved before Slice 4.
- Keep aggregate Redis updates unchanged.
- Duplicate response handling mirrors assessment.

Files:

- `apps/response-api/src/index.ts`
- `apps/hatchet-worker-response-processor/src/processors/processor.ts`
- `apps/hatchet-worker-response-processor/src/processors/helpers.ts`
- `apps/frontend-pwa/src/pages/session/[id].tsx`

Check:

- Unit/focused tests for token parsing, duplicate handling, persistence branch.
- Negative test: forged respondent id without valid secret/signature is rejected.
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

- Add respondent matrix export for correlated standard live quizzes.
- Use stable `respondent_N` labels.
- Strip all identifiers and respondent type.
- Include free-text verbatim.
- Add warning/manifest notes.
- Export unavailable/empty for old or aggregate-only quizzes with clear message.

Files:

- `packages/export/src/*`
- `packages/export/test/*`
- export CLI/manifest if needed

Check:

- Unit tests for label stability, no identifiers, free-text inclusion.
- DB-backed export with fixture data across logged-in, temporary, anonymous respondents.

Commit:

- `feat(export): add correlated live quiz response matrix`

### Slice 7 - End-to-End Verification + Security Review

Do:

- Full local flow: create correlated LQ, submit as logged-in, temporary pseudonym, anonymous correlated, export.
- Browser screenshots: manage setting; PWA notices in both modes.
- Security review: token scope, cookie expiry, identifier leakage, export PII warnings.
- Final branch review.
- PR/MR body with screenshots and manual verification list.

Check:

- `pnpm --filter @klicker-uzh/graphql check`
- `pnpm --filter @klicker-uzh/export test`
- app checks where touched
- Cypress/agent-browser if dev env available

Commit:

- final fixes only if needed.

## Risks

- Schema change to `LiveQuizResponse` can disturb assessment corrections. Keep assessment tests focused.
- Replacing `TemporaryLeaderboardEntry` in one slice may be too large. If risky, keep compatibility bridge and migrate later.
- Token stored in browser can split respondents when cookies/storage blocked. Notice/export should tolerate multiple rows.
- Browser-stored respondent ids are bearer identifiers. Use a signed token or separate secret and verify it server-side before writing correlated responses.
- Free text can identify participants despite export pseudonyms. Warning required.
- Row export can be mistaken for anonymity/DP. Avoid DP language.
- Live worker has Redis-first design; DB writes must not slow response path enough to harm live quiz UX.

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

## Goal Prompt Requirements

If handed to another agent:

- Use this file as current plan.
- Create/switch to branch `codex/live-quiz-correlated-responses` unless user chooses another branch.
- Update `Progress` before and after each slice.
- Work one slice at a time.
- Commit plan alone before implementation.
- Run review + simplification subagents after each slice.
- Run final security review and final branch review before PR/MR.
- Use `$df-mr-description-writer` for PR/MR body.

## Next Steps

1. Start Slice 1 with schema, raw SQL migration constraints, and existing export compatibility in the same commit.
2. Keep temporary-pseudonym response persistence out of Slice 4 unless Slice 5 is moved earlier.
3. Re-run plan review before implementation if the slice order changes.
