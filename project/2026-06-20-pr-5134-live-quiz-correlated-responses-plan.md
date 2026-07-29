# PR #5134 - Live Quiz Correlated Responses Plan

Goal: add opt-in standard live quiz mode that stores row-correlatable responses for export while keeping participant-facing UI clear and assessment separate.

Plan path: `project/2026-06-20-pr-5134-live-quiz-correlated-responses-plan.md`
Branch: `codex/live-quiz-correlated-responses`
Target: `v3`
PR: [#5134](https://github.com/uzh-bf/klicker-uzh/pull/5134)
Status: third release-blocker remediation implemented; verification and exact-commit reviews pending

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
- Decision: correlated export and gamification are mutually exclusive. A leaderboard score can otherwise be matched to response-derived points and reidentify a pseudonymous export row.
- Decision: participant notice persistent and compact before + during quiz.
- Decision: correlated mode wording avoids strict "anonymous" promise.
- Decision: all respondent types included in correlated mode: logged-in participants, temporary pseudonym users, anonymous correlated users.
- Decision: export never shows identifiable form. Only stable random respondent labels, one namespace: `respondent_001`, `respondent_002`, ...
- Decision: labels are stable across re-exports after the quiz ends. Order internal identities by `HMAC(exportSalt, internalId)` before assigning labels; raw ids, response time, and join order are never exposed.
- Decision: logged-in users may still use account internally for scoring/leaderboard, but export strips account identity.
- Decision: temporary pseudonym remains visible on leaderboard, but export strips pseudonym.
- Decision: free text included verbatim in teaching export for now; warn that free text can contain personal data.
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

> Export uses random respondent labels and does not include names, emails, account ids, usernames, or temporary pseudonyms. Free-text answers may still contain personal data entered by participants.

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
- `verificationSecretHash?` or signed-token equivalent for anonymous correlated respondents
- `createdAt`
- `updatedAt`

Purpose:

- Represent correlated identity only; leaderboard profile and score remain owned by `TemporaryLeaderboardEntry`.
- Represent anonymous correlated browser identity without `Participant` row.
- Keep account users as `Participant`, not duplicated.

Migration strategy:

- Prefer staged path.
- First add `LiveQuizRespondent`.
- Keep `TemporaryLeaderboardEntry` as the leaderboard source and create a same-id respondent for new temporary logins; lazily bridge valid historical temporary entries during correlated response processing.
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
- response-api checks durable duplicates and uses a five-minute, per-identity Redis lease so duplicate submissions synchronously return recorded-before without permanently blocking a retry after an abandoned enqueue.
- worker-side lookup remains the authoritative first-response-wins gate before insert.
- worker applies preflighted Redis aggregate mutations and the processed marker in one Lua operation, so ambiguous delivery retries cannot double-count a committed response.

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
- free text remains verbatim as data, but CSV formula-leading values are neutralized before download so spreadsheet software cannot execute participant input.
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
- Persist opaque token or `id + secret` in browser/cookie where possible; no cross-quiz reuse.
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
- Include free-text verbatim.
- Give this export an explicit teaching-matrix privacy mode; do not overload the existing pseudonymized export mode that redacts free text.
- Show the free-text privacy warning next to the download action and include it in export metadata where applicable.
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

- Unit tests for label stability, header order, CSV escaping, structured values, formula-injection protection, no identifiers/timestamps, free-text inclusion, authorization, status/mode gating, and size-limit failure.
- DB-backed export with fixture data across logged-in, temporary, anonymous respondents.
- Agent-browser download check: correct filename, headers, row shape, warning, and unavailable states.

Commit:

- `feat(export): add correlated live quiz response matrix`

### Slice 7 - End-to-End Verification + Security Review

Do:

- Full local flow: create correlated LQ, submit as logged-in, temporary pseudonym, anonymous correlated, export.
- Browser screenshots: manage setting; PWA notices in both modes.
- Add lecturer-facing docs for both modes, export contents, and free-text responsibility.
- Exercise the mandatory flows in the real browser: enable correlated mode; anonymous continuity; correlated notice; aggregate quiz unchanged; successful CSV download.
- Manually test cookie rejection. Expected degradation: initialization cannot preserve anonymous continuity, so the response is rejected rather than exposing the bearer token to JavaScript.
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
- Public anonymous participation has no Sybil resistance. Clearing or rejecting the quiz cookie can create another respondent row; document this limitation and rely on deployment-level abuse controls rather than a spoofable application IP heuristic.
- Quiz-scoped respondent cookies are bearer credentials. Keep them `HttpOnly`, signed, quiz-scoped, and verified server-side before writing correlated responses.
- Free text can identify participants despite export pseudonyms. Warning required.
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
- 2026-07-23: Separate Slice 1 simplification review found no worthwhile simplifications at confidence 75 or higher. Slice 1 is finalized. Slice 2 started with the manage wizard setting, assessment/lock states, bilingual copy, mutation wiring, and browser verification.
- 2026-07-23: Slice 2 implementation completed locally. The live quiz wizard now defaults to aggregate-only response storage, exposes the correlated-export option, submits the selected mode on create/edit, disables the control for assessments, and locks it after draft/scheduled status. EN/DE labels and concise consequence text are included.
- 2026-07-23: Slice 2 static verification passed: GraphQL code generation, GraphQL typecheck, frontend-manage route generation/typecheck, and touched-file Prettier checks.
- 2026-07-23: Mandatory browser verification was attempted through the real namespaced devrouter stack but remains blocked by the local DevPod runtime. Cross-platform `dist/tsconfig.tsbuildinfo` caches first broke Linux Rollup builds; after clean rebuild, the 11-service cold start exceeded route readiness and silently lost the manage process. An isolated manage restart then reported a 140940 ms slow-filesystem benchmark for the mounted `.next` directory and never compiled the route before the DevPod became unhealthy. No browser rendering or screenshots are claimed for Slice 2; this gap must be closed before final PR readiness.
- 2026-07-23: Independent Slice 2 review found three issues: assessment-course reassignment could indirectly change a locked mode and trigger a server rejection, the previous fixed desktop wizard height could not safely fit the new control, and the lock message hid the selected mode's privacy consequence. All three findings were accepted and fixed. Separate simplification review found no worthwhile reduction at confidence 75 or higher.
- 2026-07-23: Slice 2 review fixes passed the frontend-manage typecheck and full pre-commit gate; Slice 2 is finalized. Slice 3 started with the participant query field and a compact, mode-specific notice in the existing question column. Assessment quizzes remain on their separate participant flow.
- 2026-07-23: Slice 3 implementation completed locally. Standard live quizzes show the approved aggregate or correlated copy in a compact persistent notification before and during blocks; correlated mode uses the existing information treatment, aggregate mode uses the quieter default treatment, and assessment quizzes show neither standard-mode notice.
- 2026-07-23: Slice 3 static verification passed: GraphQL code generation/build/typecheck, frontend-pwa route generation/typecheck, and touched-file Prettier checks. The known GraphQL Rollup TypeScript warnings remain non-fatal and unchanged.
- 2026-07-23: Slice 3 browser verification remains blocked by the same DevPod runtime. The seeded participant URL was opened through the real namespaced PWA route but returned `Gateway Timeout` after more than a minute; therefore desktop/mobile layout and EN/DE rendering are not claimed.
- 2026-07-23: Independent Slice 3 correctness review found no qualifying defect. Separate simplification review found no worthwhile reduction at confidence 75 or higher. Both reviews retain the blocked desktop/mobile EN/DE browser matrix as a final PR-readiness gap.
- 2026-07-23: Slice 3 is finalized. Slice 5 now runs before Slice 4, as allowed by the approved plan, so the first durable worker path covers existing temporary-pseudonym respondents as well as logged-in and anonymous respondents.
- 2026-07-23: Slice 5 implementation completed locally through the staged compatibility path. New temporary logins create the existing leaderboard row and a same-ID `LiveQuizRespondent` atomically, retain the existing leaderboard UX, add quiz scope to the existing JWT, and align its cookie lifetime with the two-week token expiry. Historical rows are not backfilled because correlated collection applies only to future quizzes and the legacy table also contains account-backed leaderboard rows.
- 2026-07-23: Slice 5 verification passed: fresh Prisma migration reset, Prisma and GraphQL typechecks, and 8 focused database integration tests. The focused test helper emitted non-fatal Redis loopback warnings inside the DevPod; the tested code does not use those clients and all assertions passed.
- 2026-07-23: Independent Slice 5 review found that a blanket historical backfill would misclassify logged-in account IDs also stored in `TemporaryLeaderboardEntry`; the backfill was removed under the approved future-quiz-only scope. The simplification review removed an unnecessary transaction result dependency. Focused typecheck and all 8 integration tests passed again. Slice 4 will validate the legacy temporary row and lazily create a missing same-ID respondent during rolling deployment.
- 2026-07-23: Slice 5 is finalized. Slice 4 is split into two reviewable tracers without changing approved behavior: 4A adds the shared signed identity contract, quiz-scoped anonymous cookie, and synchronous correlated duplicate gate; 4B adds worker-side identity verification, rolling temporary-row bridging, authoritative duplicate lookup, and durable response persistence.
- 2026-07-23: Slice 4A implementation completed locally. Active instance metadata now carries the response collection mode. Correlated requests resolve signed identities in account, temporary, then anonymous order; mint a two-week quiz-scoped anonymous cookie only when needed; claim the first response per identity, instance, and block execution with Redis `HSETNX`; and atomically release only the failed event's claim. Aggregate-mode routing and storage behavior remain unchanged.
- 2026-07-23: Slice 4A verification passed: 52 utility tests, including quiz scope, signature rejection, legacy temporary-token compatibility, and identity priority; 3 response API tests covering first-response claims, atomic owner-only release, and cookie lifetime; utility, response API, and GraphQL package builds/typechecks; and the full repository pre-commit gate. Independent correctness and simplification review remain before Slice 4A is finalized.
- 2026-07-23: Independent Slice 4A correctness review found four lifecycle gaps: active blocks were published before unawaited Redis metadata initialization, missing mode metadata silently fell back to aggregate during rolling deployment, one global anonymous cookie could split a returning respondent across quizzes, and concurrent first submissions could mint separate identities. It also found that terminal worker rejection retained the synchronous claim. All findings were accepted.
- 2026-07-23: Slice 4A review fixes now await metadata before publishing, use a database mode fallback when old metadata lacks the field, initialize identity through the response API before browser submission, serialize initialization with one per-quiz client promise, use a separate HttpOnly cookie per quiz, pass the owned claim to the worker, and release it on terminal missing, late, invalid, duplicate, or pre-Redis processing paths. The PWA endpoint builder remains compatible with both configured base URLs and existing `/AddResponse` URLs.
- 2026-07-23: Independent simplification review found duplicate correlated cookie parsing and two token-lifetime literals. Correlated requests now use only the shared resolver, aggregate parsing stays in the legacy branch, and JWT plus cookie expiry derive from the same numeric constant with an explicit duration assertion.
- 2026-07-23: Slice 4A review-fix verification passed: 53 utility tests, 5 response API tests, focused utility/response API/worker/GraphQL/PWA checks and builds, and the full repository `check:all` gate. Mandatory browser verification was retried after recreating the DevPod: devrouter and all routes reported healthy, but the PWA process did not bind port 3001, its in-container probe failed, and the routed page returned HTTP 502 `Bad Gateway`. No browser behavior is claimed; the runtime gap remains a final PR-readiness requirement.
- 2026-07-23: Slice 4A is finalized. Slice 4B starts with worker-side identity validation, rolling temporary-row bridging, authoritative database duplicate handling, retry-safe aggregate updates, and durable response persistence for every correlated respondent type.
- 2026-07-23: Slice 4B implementation completed locally. The standard response worker now resolves correlated mode from active metadata with a database fallback, requires the response API's owned execution-scoped claim, validates signed account/temporary/anonymous identities, lazily bridges valid legacy temporary leaderboard rows, and rejects logged-out, wrong-quiz, wrong-type, or token-hash-mismatched respondents. It writes one `LiveQuizResponse` before aggregation and uses a Redis transaction with an execution-scoped processed marker so a retry after the database write aggregates once and a retry after Redis commit exits without changing counts.
- 2026-07-23: Slice 4B verification passed: 10 focused worker tests cover all respondent types, token scope/hash rejection, legacy temporary logout, identity-safe persistence data, retry ownership, and execution scoping; the worker build passed; and the full repository `check:all` gate passed. The previously passing schema-backed collection-mode test was also retried, but the current DevPod command environment does not expose `HATCHET_CLIENT_TOKEN`, so that database suite could not initialize; Slice 4B does not change the schema.
- 2026-07-23: Independent Slice 4B correctness and simplification reviews found that operational failures before persistence were acknowledged instead of retried, overlapping delivery of the same event could increment Redis aggregates twice, Redis command errors were not inspected, identified respondents were graded twice, and the response API's identity endpoint did not enforce the live quiz PIN. The findings were accepted. A five-minute owner-token processing lock now serializes one identity and execution, operational correlated failures rethrow for Hatchet retry without releasing the first-response claim, aggregate key types and transaction results are checked, one grading result feeds persistence and leaderboards, and both correlated identity initialization and submission enforce the quiz-scoped PIN cookie.
- 2026-07-23: Slice 4B review-fix verification passed: 15 focused worker tests now include lock contention, post-persistence retry, different-event duplicate handling, processed-marker completion, and Redis key-type rejection; response API PIN tests passed; both applications built; and the full repository `check:all` gate passed. Slice 4B is finalized. Slice 6 starts with the deterministic respondent-row CSV generator, authorized GraphQL download, and ended-quiz evaluation action.
- 2026-07-23: Slice 6 implementation completed locally. The export package now creates a deterministic UTF-8 BOM / CRLF CSV with one HMAC-ordered random respondent label per row, ordered response/correctness/points columns, canonical structured values, formula-injection protection, empty unanswered cells, a 5 MiB fail-closed size guard, and no source identifiers or timestamps. A WRITE-authorized GraphQL query exposes the CSV only for ended, non-assessment `CORRELATED_EXPORT` quizzes, and the manage evaluation page shows a compact bilingual warning and browser download action only in that state.
- 2026-07-23: Slice 6 static verification passed: 7 focused CSV tests, 5 focused GraphQL export-service tests, export/GraphQL/manage typechecks, and the complete repository `check:all` gate. The full gate required Turbo loose environment mode, a temporary uv cache, and disabling pnpm's automatic pre-run dependency relink because this worktree was installed with an explicit supply-chain age-policy exclusion; no repository configuration was changed. DB-backed fixture export and mandatory agent-browser download verification remain part of the final runtime pass.
- 2026-07-23: Independent Slice 6 correctness review found that recomputing sequential HMAC ranks could rename respondents when a delayed worker response arrived after quiz end, active-block responses were omitted, the download action was visible to users without WRITE permission, and the export package root no longer loaded its Prisma type contract. All findings were accepted. Separate simplification review removed test-only size configuration, unused return metadata, a redundant label map, and a mocked-query fixture dependency.
- 2026-07-23: Slice 6 review fixes add a quiz-scoped `LiveQuizResponseExportLabel` mapping with row-locked assignment, HMAC-only stored identities, monotonic positive labels, and uniqueness constraints. Existing labels therefore remain stable while delayed respondents receive the next label. The query includes ACTIVE and EXECUTED blocks, the evaluation schema exposes a WRITE-level capability flag, the export package root contract is restored, and the CSV generator consumes explicit persisted labels through a dedicated package subpath.
- 2026-07-23: Review-fix verification passed on a recreated DevPod with all 178 migrations: Prisma validation, 7 focused CSV tests, 6 focused GraphQL export-service tests including delayed-response stability and active-block coverage, export and GraphQL builds/typechecks, and the manage typecheck. A clean migration run applied the new label table successfully.
- 2026-07-23: Runtime export verification passed with a seeded ended correlated quiz containing 30 durable responses. The owner-only evaluation action downloaded a clean CSV named `live-quiz-correlated-response-export-demo-responses.csv` with one respondent per row, stable ordered headers, and no source identifiers. A delayed 31st response exposed Apollo's cached-query behavior; the download now uses `no-cache`, and a second real browser download returned respondents `001` through `031` without renaming the first 30.
- 2026-07-23: Mandatory participant browser verification passed through a clean PWA Webpack runtime after the managed Turbopack process served a stale route manifest. Aggregate and correlated notices rendered with the approved distinct treatments in English and German at desktop and 390x844 mobile sizes without text overflow. The manage wizard rendered aggregate-only as the draft default, switched to correlated export with the concise consequence text, and fit at desktop and mobile sizes. The runtime workaround affects only local verification; no repository runtime configuration changed.
- 2026-07-23: Follow-up correctness review of exact fix commit `3816135311` found no qualifying defect and independently passed the export tests/build, GraphQL export tests/check, manage check, Prisma validation, schema sync, and package root/subpath import probes. Follow-up simplification review removed unused label-table identity/timestamp/index fields in favor of the natural composite primary key, moved persisted labels directly onto export responses instead of parallel respondent/response arrays, and made the backend capability flag own the complete export-availability rule.
- 2026-07-23: Simplification verification passed: 7 focused CSV tests, 6 focused GraphQL export tests, export build, Prisma generation/typecheck, analytics schema sync, and a fresh disposable PostgreSQL migration run through all 178 migrations. The disposable database was removed after the successful run.
- 2026-07-23: Final security, maintainability, branch, and independent crosscheck reviews agreed on four release blockers: non-expiring pre-enqueue claims, submission-time identity rotation, silent response loss during mixed-version rollout, and Redis `MULTI` runtime errors that could leave partial aggregates marked for retry. They also identified skipped worker tests, redundant respondent profile fields, an oversized mixed processor, inline export orchestration, and missing wiki updates.
- 2026-07-23: The accepted remediation replaces the vote hash with a five-minute per-identity ingress lease and a database duplicate check; only the initialization route may mint anonymous identities. The PWA keeps the returned quiz token in memory as a cookie fallback, and correlated submissions require JSON plus an allowlisted browser origin.
- 2026-07-23: Correlated worker processing now buffers typed Redis hash mutations and runs one preflight/apply Lua operation that writes the processed marker only after every target type and integer is validated. Claim and processing leases are released on success, and abandoned pre-persistence claims recover automatically. Feature-specific identity, grading, persistence, retry, and atomic-commit logic is isolated in `correlatedResponse.ts`; the legacy processor is below 1,000 lines.
- 2026-07-23: `LiveQuizRespondent` is identity-only; temporary username/avatar/score remain in `TemporaryLeaderboardEntry`. All response paths and export use one typed identity-key builder. Correlated CSV orchestration moved to `services/correlatedLiveQuizResponseExport.ts`, and the worker now exposes the standard `test:run` script used by the root test task.
- 2026-07-23: Engineering wiki pages, the testing skill, and lecturer/student Live Quiz guides now cover the mode distinction, pseudonymous identity, free-text caveat, stable row export, retry/deployment contract, and verification path. Focused utility, response API, worker, export, and GraphQL tests pass; package typechecks for util, response API, response worker, PWA, GraphQL, and Prisma pass in the existing dev container.
- 2026-07-23: Existing browser evidence covers the settings control, EN/DE participant notices at desktop/mobile sizes, aggregate behavior, and real CSV download with stable late-response labels. A committed seed fixture and new monolithic Playwright scenario were not added: the existing live-quiz suite remains the aggregate regression path, while the correlated flow is covered by focused service tests plus the verified real-browser tracer. This avoids coupling the feature to the already-large serial live-quiz workflow.
- 2026-07-23: Remediation commit `81d0eb20e` passed a real-Redis atomicity and retry smoke, focused utility/response API/worker/export/GraphQL tests, a fresh PostgreSQL migration through all 178 migrations, and the final full repository `check:all` gate. A fresh-database temporary-pseudonym test also confirmed that `LiveQuizRespondent` stays identity-only while leaderboard profile data remains in `TemporaryLeaderboardEntry`.
- 2026-07-23: The fresh final review found two additional delivery blockers. Correlated events still shared the legacy authenticated event name during rolling deployment, and the five-minute admission claim could expire before a queued worker ran. Correlated submissions now use the versioned `response-received:correlated-v1` event and dedicated durable task.
- 2026-07-23: The strict maintainability review rejected the remaining duplicate question-type grading dispatch. Live Quiz response effects now pass through one typed exhaustive planner that produces aggregate mutations, stored participant response values, grading details, and first-response timing. `processor.ts` retains identity, persistence, and transaction orchestration; the five obsolete scoring wrappers were removed. Focused worker tests increased from 17 to 21, response API tests pass 13/13, both package typechecks pass, and the full repository `check:all` gate passes.
- 2026-07-23: The security review also found that a gamified correlated export can be reidentified by matching response-derived scores to the visible named or pseudonymous leaderboard. The recommended resolution is to make `CORRELATED_EXPORT` incompatible with gamification. This is a product behavior change beyond the approved implementation details and awaits explicit confirmation before enforcement.
- 2026-07-24: Exact-commit review found that post-enqueue claim promotion raced fast worker completion, Hatchet-listener polling depended on internal SDK fields, mixed response API replicas could still accept a new PWA submission on the legacy endpoint, and content views could create zero-score leaderboard rows. Claim promotion and the readiness heartbeat were removed: the five-minute Redis claim is now only an ingress duplicate lease, while an accepted versioned Hatchet event remains processable after the lease expires. Correlated PWA submissions use `/AddCorrelatedResponse`, which old replicas cannot silently accept, and new replicas reject a mode/endpoint mismatch. Content responses again update only the instance participant count. Focused verification passes 12 response API tests, 22 worker tests, and response API, worker, and PWA typechecks.
- 2026-07-29: User approved the privacy-safe product rule from the security review: correlated response export and gamification are mutually exclusive. The implementation now rejects the combination for direct create/edit, batch course assignment, and course-level gamification changes; enforces it with a database constraint; surfaces actionable errors outside the wizard; and keeps the wizard in a valid state by switching the other option off or disabling incompatible locked choices.
- 2026-07-29: Final review identified three additional release blockers: the legacy course export could expose correlated rows with participant identity, accepted queued responses could be missing from an immediate export, and enabling course assessment could violate the correlated-mode database constraint. The legacy export now excludes `CORRELATED_EXPORT`; accepted correlated events create a durable transactional outbox entry that is cleared only on terminal worker settlement; the dedicated export locks the quiz and fails clearly while entries remain; and assessment transitions atomically convert draft/scheduled correlated quizzes to aggregate assessment quizzes with unique PINs while rejecting published conflicts.
- 2026-07-29: The anonymous respondent credential is now cookie-only. Initialization sets a signed, quiz-scoped `HttpOnly` cookie; initialization JSON and submission headers no longer expose a bearer token to JavaScript. Public anonymous participation still has no Sybil resistance because clearing or rejecting the cookie can create another row. This limitation, the pseudonymized-not-DP boundary, and the free-text reidentification risk are documented for operators and lecturers.
- 2026-07-29: Final maintainability remediation centralized response-mode compatibility, moved generic Redis mutation buffering out of the correlated processor, and made wizard mode/gamification/course transitions atomic through pure state helpers. Focused tests cover outbox registration and settlement, pending-export rejection, legacy export exclusion, course assessment conversion/conflict behavior, and the refactored worker paths.
- 2026-07-29: Final verification passed: a fresh migration reset through the outbox migration; complete `check:all`; 15 response API tests; 23 response-worker tests; 31 export tests; 22 focused GraphQL tests; affected package typechecks; Prisma schema sync; and a 13-package scoped production build. Delegated-login routing was revalidated after devrouter recreated the environment. The earlier successful wizard screenshot remains the visual evidence because the automation driver's creation portal repeatedly closed while typing the second wizard step during the final rerun.
- 2026-07-29: Exact branch reviews found that correlated responses still wrote identity-keyed leaderboard and XP state, accepted event payloads were represented only by non-recoverable receipts, publication and course-setting transitions had time-of-check/time-of-use gaps, direct gamification mutation could bypass the compatibility guard, standard response-api lacked an explicit database deployment contract, and a header fallback weakened the cookie-only anonymous identity boundary.
- 2026-07-29: The accepted remediation keeps correlated processing aggregate-only outside its durable response rows; replaces receipts with an AES-256-GCM encrypted, database-backed transactional outbox with stable event ids, `SKIP LOCKED` reservation, retry scheduling, and worker settlement; serializes course, quiz, publication, assessment, and gamification transitions under database row locks; guards direct gamification changes; injects the standard response-api database URL from the existing backend secret; and removes the respondent-token header path completely.
- 2026-07-29: Remediation verification passed on a clean database: 53 utility tests, 18 response-api tests, 24 response-worker tests, 31 export tests, 17 response-mode/concurrency GraphQL tests, 7 correlated-export GraphQL tests, all affected package typechecks, Prisma schema sync, Helm rendering, the full repository `check:all` gate, and a 16-package scoped production build. The build emitted existing Next.js page-size and missing-message warnings but completed successfully.
- 2026-07-29: Exact-commit maintainability and branch reviews found six further release blockers: course assessment transitions derived decisions from stale pre-lock state; accepted responses depended on 24-hour Redis metadata; the five-minute ingress lease allowed two accepted pending events; temporary logout could invalidate an already accepted response; batch course assignment did not recheck gamification under lock; and the startup dispatcher could overlap itself. The security review separately confirmed the accepted public-anonymous Sybil limitation.
- 2026-07-29: The second remediation derives course transitions only after locking and rereading the course, locks and rechecks target courses during batch assignment, snapshots instance metadata into the encrypted outbox event, and adds a unique quiz/execution/identity response key as the authoritative admission gate. Temporary identities are durably admitted before enqueue, so an accepted event survives later leaderboard logout. The response API uses one non-overlapping background dispatcher loop, and response API plus worker consume one shared versioned event contract.
- 2026-07-29: APP_SECRET remains the outbox encryption key in this slice. Deployment documentation now requires response API and worker replicas to share it and requires draining unsettled `LiveQuizPendingResponse` ciphertext before rotation. Settled receipt rows contain no ciphertext. A dedicated keyring remains follow-up work; public anonymous participation remains intentionally susceptible to cookie clearing and identity farming.
- 2026-07-29: Second-remediation verification passed: fresh database reset through all 179 migrations; 53 utility tests; 19 response-api tests; 26 response-worker tests; 19 response-mode/concurrency GraphQL tests; 7 correlated-export GraphQL tests; 31 export tests; affected-package typechecks; Prisma schema sync; Helm rendering; the full repository `check:all` gate; and scoped backend, PWA, and manage production builds. The full gate used an ignored Python 3.12 Ruff-only environment because the dev image selected Python 3.14 and lacked a compiler for the unrelated pinned pandas source build.
- 2026-07-29: Generic seeded-development screenshots for aggregate-only and correlated-export wizard settings are committed under `project/2026-06-20-live-quiz-correlated-responses/`. They contain no real course or participant data and will be linked from the draft PR.
- 2026-07-29: Exact reviews of commit `6281e0bf6` found that Hatchet still carried browser bearer credentials, Redis ingress contention could acknowledge a response before durable admission, delayed responses could use restarted-instance metadata or expired JWTs, scheduled publication and batch assignment had unlocked state races, and course assessment changes could convert a running aggregate quiz into identifiable assessment handling. The findings were accepted as release blockers.
- 2026-07-29: The third remediation makes the encrypted database outbox authoritative: ingress validates the complete response, admits its identity while the token is valid, and registers the unique response key before acknowledgement; Hatchet receives only the outbox message id; and the worker decrypts the matching row, uses its acceptance-time metadata snapshot, and never revalidates browser-token expiry. Scheduled publication, assessment transitions in both directions, and batch assignment now lock and recheck current rows. CSV size enforcement is incremental rather than post-matrix, while a dedicated response-api database role and a lock-budgeted migration rollout remain explicit operational follow-ups.
- 2026-07-29: Third-remediation verification passed: 57 utility tests, 18 response-api tests, 26 response-worker tests, 31 export tests, 23 response-mode/concurrency GraphQL tests, 7 correlated-export GraphQL tests, the full repository `check:all` gate, and scoped production builds for response API, response worker, export, GraphQL, and backend. A clean response-api rebuild also confirmed the final shared outbox re-export.
- 2026-07-29: Exact-commit review of `4c0f03fbc` found two remaining release blockers: partial or non-finite numerical strings could win durable admission, and deleting a settled outbox row allowed a completed-response retry to race between the precheck and a new insert. The same review pass identified sibling-domain cookie exposure, pre-materialization export memory, and stale pre-lock course counts as hardening issues; a reciprocal cross-course batch move can still receive a PostgreSQL deadlock abort and is tracked as a non-blocking retry/lock-order follow-up.
- 2026-07-29: The accepted fixes require finite full-string numerical parsing; retain the unique response key as a permanent settled receipt while erasing ciphertext; make anonymous respondent cookies host-only; reject exports above bounded response-count or payload-size preflight before loading rows; and recount course activities/groups after acquiring the course lock. A clean database reset applied all 179 migrations; 63 utility, 18 response API, 26 worker, 31 export, 8 GraphQL export, and 23 database-backed response-mode/concurrency tests pass; the full repository `check:all` gate and scoped response API, worker, export, GraphQL, and backend production builds pass.
- 2026-07-29: Final exact-commit maintainability, security/privacy, and whole-branch product reviews of `10e9c6025` found no actionable findings at 80% confidence or higher and no release blocker. The reciprocal cross-course batch deadlock remains the sole documented non-blocking code follow-up; the dedicated response-api database role and migration lock budget remain rollout follow-ups.

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

1. Commit the third remediation and run fresh security, maintainability, and independent branch reviews against the exact commit.
2. Address any release blockers and repeat affected checks.
3. Push the reviewed branch and update draft PR 5134 with whole-branch evidence, screenshots, rollout ordering, and documented residual privacy limits.
4. Read back the rendered draft PR, CI, reviews, and comments; keep it draft until the repository's final CI and review gates are satisfied.
