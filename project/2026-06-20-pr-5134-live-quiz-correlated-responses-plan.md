# PR #5134 - Live Quiz Correlated Responses Plan

Goal: add opt-in standard live quiz mode that stores row-correlatable responses for export while keeping participant-facing UI clear and assessment separate.

Plan path: `project/2026-06-20-pr-5134-live-quiz-correlated-responses-plan.md`
Branch: `codex/live-quiz-correlated-responses`
Target: `v3`
PR: [#5134](https://github.com/uzh-bf/klicker-uzh/pull/5134)
Status: exact-review improvement implementation and verification complete; exact-commit review and PR publication in progress

Authority: [ADR 0001](../docs/adr/0001-correlated-live-quiz-response-boundary.md) and the engineering wiki define the current architecture. Dated sections in this plan preserve execution and review history; where an older design mentions Redis claims, leases, unlocked preflight, or non-concurrent indexing, the latest remediation section and ADR supersede it.

## Non-Goals

- No assessment behavior change. Assessment remains identifiable and auditable by design.
- No backfill for old standard live quizzes. Future quizzes only.
- No research / DP export in this slice. Later admin workflow.
- No PII removal from free-text responses yet.
- No per-respondent live UI. Live/evaluation UI stays aggregate-only.

## Code Quality Review Improvement Plan - 2026-07-30

Exact-commit thermo-nuclear, security, simplification, and branch crosscheck reviews of `f424f03a16..829c53b3fe` produced the following concrete work. Security found no qualifying vulnerability; every actionable maintainability, correctness, rollout, and simplification finding is included here.

| Priority | Finding | Improvement | Proof | Status |
| --- | --- | --- | --- | --- |
| High | The long execution plan still described obsolete lease and preflight architectures, making it an unsafe implementation authority. | Make ADR 0001 and the wiki authoritative; mark dated plan text historical and update the current target architecture. | Documentation review plus exact-commit maintainability review. | Implemented |
| High | Accepted instance metadata crossed GraphQL, Redis, response API, encrypted outbox, and worker as an untyped string record with duplicated question-type lists. | Add one discriminated `CorrelatedResponseInstanceInfo` contract and canonical question-type tuple in `@klicker-uzh/util`; parse at admission and decryption boundaries and consume the canonical guard in the worker. | Utility contract tests, response API tests, worker tests, and package typechecks. | Implemented |
| High | Correlated submission performed a non-authoritative readiness/PIN lookup before atomic admission, allowing state to change between checks. | Keep the lightweight lookup only for identity initialization; verify the current PIN together with mode, lifecycle, block generation, identity, and outbox insertion inside the shared-lock transaction. | Response API test proving a wrong locked PIN creates neither identity nor outbox row; database-backed concurrency tests. | Implemented |
| High | Worker delivery checked Redis and PostgreSQL before attempting the authoritative unique insert, duplicating retry classification and adding reads to every response. | Insert directly under the lifecycle transaction; on `P2002`, re-read once and distinguish same-event retry by accepted timestamp from a true duplicate. Let the atomic Lua marker own Redis idempotency. | Worker direct-insert, collision-recovery, duplicate, and Redis-marker tests. | Implemented |
| High | The new respondent uniqueness index used ordinary `CREATE UNIQUE INDEX`, which could block writes on the shared `LiveQuizResponse` table during rollout. | Build it with `CREATE UNIQUE INDEX CONCURRENTLY`; add the respondent foreign key `NOT VALID` and validate it separately. Keep correlated publication disabled until migration and all consumers are upgraded. | Clean migration run, schema drift check, and disabled Helm gate rendering. | Implemented |
| Medium | Three services independently generated live-quiz PINs with the same bounded retry loop. | Centralize six-character uppercase/numeric allocation and collision retry in `liveQuizPin.ts`. | GraphQL policy/database suites and typecheck. | Implemented |
| Medium | `LiveQuizSettingsStep` rebuilt the same filtered course list and incompatibility lookup in several render paths. | Compute the available course list, selected course, and incompatible ID set once per render. | Manage typecheck and browser regression proof. | Implemented |
| Deferred | Production currently gives the response API the broad backend database credential. | Introduce a dedicated least-privilege response-ingest role after this feature, before treating the credential boundary as hardened. | Deployment-role review and production rollout test. | Explicit follow-up |

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

> This quiz does not create a participant-level response export. Answers contribute to aggregate result totals.

German:

> Dieses Quiz erstellt keinen Export von Antworten auf Personenebene. Antworten fliessen in aggregierte Ergebniswerte ein.

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
- response API atomically rechecks current PIN, lifecycle, mode, active block generation, and identity under shared locks before inserting the encrypted outbox receipt.
- the permanent unique response key is the admission duplicate gate; the worker writes the durable response directly and classifies `P2002` collisions by accepted timestamp.
- worker applies bounded Redis aggregate mutations and the processed marker in one Lua operation, so ambiguous delivery retries cannot double-count a committed response.

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

## Maintainability Remediation - 2026-07-30

### Goal And Boundaries

- Goal: resolve the final strict-review findings without changing the approved response modes, identity model, persistence semantics, CSV shape, privacy notices, or assessment separation.
- Non-goal: no schema, endpoint, event-name, UI, or export-contract behavior change unless verification exposes a defect.
- Decision: keep the existing PR and plan for execution history; ADR 0001 and the affected wiki pages are the current architecture authority.
- Decision: preserve aggregate mode as Redis-only and correlated mode as durable outbox-backed persistence plus aggregate Redis effects.
- Decision: keep assessment processing completely separate.

### Findings And Target Shape

#### Remediation 1 - Export Package Contract

- Problem: `@klicker-uzh/export/correlated-live-quiz-responses` exposes only the `import` condition, while GraphQL's build resolves package subpaths through the default condition.
- Evidence: the GraphQL CI job fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`; local `require.resolve` reproduces it under Node 24.
- Decision: expose both the package root and correlated subpath through `types` plus `default`, matching the repository's runtime package contract.
- Check: build the export package, resolve the root and subpath from GraphQL, then run GraphQL generation/check/tests.
- Commit: `fix(export): expose correlated response package entrypoint`

#### Remediation 2 - Publication Transaction Boundary

- Problem: manual and scheduled publication perform Redis writes while a PostgreSQL row lock and transaction are open. Redis cannot roll back with Prisma, failures can leave the systems inconsistent, and network waits extend the database lock.
- Evidence: `startLiveQuiz` and `handlePublishScheduledLiveQuiz` duplicate the same lock, cache write, and state transition sequence.
- Decision: add one database-only locked publication transition that returns the authoritative quiz snapshot and whether it started. Materialize Redis only after commit through one idempotent helper.
- Decision: already-published retries also materialize Redis. Manual failures surface so a repeated start repairs the cache; scheduled failures throw so Hatchet retries. A durable database marker plus a minute-level reconciler closes the gap after bounded request or Hatchet retries without storing duplicate cache payloads.
- Check: database-backed tests for concurrent/manual/scheduled transitions, an already-published cache repair test, and GraphQL check/tests.
- Commit: `refactor(live-quiz): separate publication state and cache writes`

#### Remediation 3 - Response API Endpoints

- Problem: `/AddResponse` and `/AddCorrelatedResponse` route through one mode-flag handler with optional correlated identity, claim, and event state.
- Evidence: `apps/response-api/src/index.ts` grew to more than 800 lines and branches repeatedly on `endpointMode` and `isCorrelated`.
- Decision: keep only typed request parsing and instance lookup shared. Give aggregate and correlated endpoints dedicated handlers with mode-specific required state and event types.
- Decision: preserve endpoint mismatch responses, durable admission ordering, duplicate status codes, cookie-only identity, and Hatchet envelopes exactly.
- Check: response API tests, typecheck/build, and focused route-level tests proving each endpoint rejects the other mode.
- Commit: `refactor(response-api): split aggregate and correlated handlers`

#### Remediation 4 - Response Worker Orchestration

- Problem: the dedicated correlated Hatchet task still enters a processor that infers mode from event shape and carries both aggregate and correlated locks, buffers, persistence, settlement, and error handling.
- Evidence: `processor.ts` and `responseEffects.ts` retain repeated `isCorrelated` branches despite separate event names and task registrations.
- Decision: expose explicit aggregate and correlated processors. Share response validation and the pure question-effect plan, but keep delivery resolution, durable persistence, Redis application, lock release, and outbox settlement in the owning processor.
- Decision: remove event-shape mode inference and boolean mode arguments from the processing path.
- Check: response-worker tests for aggregate behavior, outbox resolution/settlement, duplicates, retry after persistence, acceptance-time metadata, and atomic Redis effects; typecheck/build.
- Commit: `refactor(response-worker): split correlated processing`

#### Remediation 5 - GraphQL Response-Mode Ownership

- Problem: `liveQuizResponseCollection.ts` owns only small policy helpers while courses, activities, and live quizzes reconstruct locked transitions and compatibility decisions.
- Evidence: transition logic is spread across three large services, and the database-backed response-mode/concurrency suite is almost 1,000 lines.
- Decision: make the response-collection service the canonical owner of locked state reads, transition derivation, and compatibility validation. Callers retain authorization and unrelated entity updates.
- Decision: split policy and concurrency tests where shared fixtures allow it without adding a new abstraction solely for file size.
- Check: all focused response-mode/concurrency tests, correlated-export tests, GraphQL check/build, and unchanged GraphQL error codes.
- Commit: `refactor(graphql): centralize response collection transitions`

### Execution And Finish Gate

- Slice order: package contract, publication boundary, response API split, worker split, GraphQL transition ownership, final integration.
- Baseline: current PR CI has a GraphQL package-export failure and five Playwright shard failures. The GraphQL failure is owned by Remediation 1; Playwright failures will be rerun and triaged after the branch is synchronized and static checks pass.
- Documentation: update architecture, GraphQL, worker, and testing wiki pages only where module ownership or verification commands change; add the required `docs/log.md` entry and keep the testing skill aligned.
- Final check: correlated boundary package tests together, database-backed GraphQL suites, `pnpm run check:all`, affected production builds, and relevant browser/e2e regression proof.
- Final review: exact-commit security review, thermo-nuclear maintainability review, branch crosscheck, rendered draft PR readback, and CI readback.

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
- 2026-07-30: A stricter whole-branch maintainability pass found five remaining structural issues: a broken export subpath runtime contract; Redis writes inside publication database transactions; mode-flag orchestration in the response API; event-shape mode inference in the response worker; and response-mode transitions distributed across large GraphQL services. The findings and concrete remediation slices are recorded above.
- 2026-07-30: The branch was synchronized with current `v3` through commit `f424f03a16`. Remediation 1 starts with the package export contract and a runtime resolution regression check.
- 2026-07-30: Independent plan-review tooling did not return a bounded verdict: `agy` timed out, and the read-only Codex fallback expanded into historical branch analysis until terminated. No unverified finding was accepted; exact-commit final reviews remain required.
- 2026-07-30: Remediation 1 exposes the export package root and correlated subpath through `types` plus `default` and adds a package-contract regression test. Verification passed 33 export tests, both runtime resolution probes from GraphQL, GraphQL code generation, and GraphQL typecheck. The GraphQL Rollup build emitted `created dist` but its wrapper stayed alive until interrupted.
- 2026-07-30: Remediation 2 moves the locked publication transition into one PostgreSQL-only service and materializes Redis metadata only after commit. Manual and scheduled retries rebuild metadata from the persisted `startedAt`; Redis errors surface instead of silently leaving a published quiz without cache state. The focused PostgreSQL-backed suite passed all 24 response-mode/publication cases in the managed DevPod, including after-commit ordering and retry repair, and the GraphQL typecheck passed. The suite emitted existing non-fatal loopback Redis warnings from imported global clients; its publication assertions use injected Redis fakes.
- 2026-07-30: Exact-commit review of the first Remediation 2 implementation found that bounded retries could still leave publication metadata absent, Redis failure discarded the scheduled-task id before cleanup, and legacy published rows with null `startedAt` produced unstable timestamps. The accepted fix adds a nullable materialization marker and indexed reconciliation query, retains scheduled task ids until cleanup, repairs missing timestamps under the publication row lock, and registers a minute-level idempotent Hatchet reconciler. The migration applied successfully as migration 180 in the managed DevPod; Prisma validation and schema sync passed; 27 PostgreSQL-backed response-mode/publication tests now cover recovery, cleanup, legacy timestamp repair, and durable reconciliation; GraphQL, Hatchet, and shared-type checks pass. Existing non-fatal loopback Redis warnings remain in the focused suite.
- 2026-07-30: Remediation 3 replaces the standard response API's mode-flag handler with a shared typed parser/instance lookup plus dedicated aggregate and correlated handlers. Aggregate handling owns only participant-cookie forwarding and legacy events; correlated handling owns admission, identity validation, durable encrypted outbox registration, and the versioned ID-only Hatchet envelope. All 21 response API tests pass, including both endpoint mismatch directions and a complete correlated handler path; response API typecheck and production build pass.
- 2026-07-30: Exact-commit review of Remediation 3 found no qualifying behavioral or simplification issue. Remediation 4 binds aggregate and correlated Hatchet events to separate processors: aggregate processing owns participant-cookie verification, legacy duplicate handling, pipelines, and leaderboard effects; correlated processing owns outbox resolution, accepted metadata, durable persistence, locks, atomic mutation application, and settlement. Shared code is limited to response parsing/validation, mode lookup, logging context, and the pure effect planner. The `isCorrelated` and event-shape inference paths are removed. All 26 response-worker tests, typecheck, and production build pass.
- 2026-07-30: Re-review of Remediation 2 found that a stale publication attempt could acknowledge or clear state belonging to a newer `startedAt` generation, and that a permanently failing row could monopolize the oldest bounded reconciliation batch. Materialization acknowledgement and task cleanup now require the expected published `startedAt`; failed rows receive a five-minute durable retry timestamp so later healthy rows remain eligible. The revised migration adds the retry timestamp and matching reconciliation index. All 29 database-backed response-mode/publication tests pass, including generation replacement, retry recovery, and poison-row backoff.
- 2026-07-30: Exact-commit review of Remediation 4 found no behavioral defect. Its simplification pass removed the redundant Redis assertion and the aggregate metadata helper from the correlated module. Explicit processor dependency boundaries now allow direct orchestration tests without real infrastructure; 29 worker tests cover absent aggregate metadata, correlated terminal settlement, and operational retry without settlement. Worker typecheck and production build pass.
- 2026-07-30: Remediation 5 makes `liveQuizResponseCollection.ts` the owner of locked course/quiz state reads, effective mode derivation, editability, assessment-transition guards, and gamification compatibility. Live quiz, course, and batch-activity services retain authorization, PIN generation, and unrelated writes while consuming the centralized decisions. Seven focused policy tests, all 32 database-backed response-mode/concurrency/publication cases, 8 correlated-export tests, GraphQL typecheck, and the production Rollup build pass; the build retains the branch's existing non-fatal Pothos/schema typing warnings.
- 2026-07-30: The engineering wiki and testing procedure now match the remediated architecture: dedicated standard response handlers and worker processors, database-first publication plus minute-level durable reconciliation, centralized GraphQL response-mode policy, and the focused recovery/orchestration verification matrix. The worker topology no longer incorrectly shows the response processor re-emitting aggregation work to the general worker.
- 2026-07-30: Final Remediation 2 re-review found a same-generation cleanup race: after one caller cleared the scheduled task, another treated the already-achieved state as a conflict. Cleanup now rereads on a zero-row guarded update, accepts only the same published `startedAt` generation with an already-null task, and still rejects replacement tasks or generations. The publication transition now returns a type with non-null `startedAt`. All 32 database-backed response-mode/publication cases pass, including repeated cleanup with Hatchet 404, same-generation task replacement, and changed-generation cleanup.
- 2026-07-30: Exact-commit review of Remediation 5 found no response-mode behavior or error-code regression. The accepted follow-up removes the target course's all-live-quiz lock from batch assignment; the locked course settings row already serializes assessment/gamification changes, and avoiding the broader lock removes the known reciprocal cross-course deadlock mechanism. Unused lock projections and a repeated transition lookup were also removed. Seven focused policy tests and all 32 database-backed response-mode/concurrency/publication cases pass, including unchanged published edits and mixed draft/scheduled/published course state.
- 2026-07-30: A fresh database reset applied all 180 migrations, including the publication materialization marker/retry migration. On that clean schema, the combined GraphQL policy, response-mode/publication, and correlated-export suites passed all 47 cases; the normal development fixtures were then restored.
- 2026-07-30: Final Review Remediation slices 1-4 are implemented. The durable response key is the sole admission identifier; aggregate mode never initializes correlated identity; GCM uses a 12-byte IV and 16-byte tag; Redis consumes the pure effect plan; response API admission/outbox/request ownership is split; correlated persistence and abort serialize on the live-quiz row; abort removes the temporary correlated dataset transactionally; publication has one materialization operation; and CSV formatting receives labels rather than internal identity keys.
- 2026-07-30: The final clean-schema verification passed all 180 migrations and 48 combined GraphQL lifecycle/export tests. Focused verification passed 64 utility, 20 response API, 28 response-worker, and 33 export tests. Full `check:all` passed across 30 workspaces with Python 3.12 selected for the existing analytics environment, and the complete 22-target production build passed after cleaning a stale generated TypeScript build-info file in the unchanged general worker.
- 2026-07-30: Runtime package probes resolved both the export package root and correlated subpath from GraphQL. Opengrep scanned 82 relevant files with 210 rules; the new dynamic event log was fixed. Remaining findings are pre-existing dynamic logs, an exact-allowlist CORS assignment, and the older generic `packages/util/src/crypto.ts` GCM helper; the correlated outbox path explicitly validates its IV and full authentication tag.
- 2026-07-30: Fresh real-browser proof used lecturer-owned aggregate and correlated quizzes. The settings UI selected and explained each mode at 1440x1000, and participant notices fit at 390x844. Aggregate page load and submission called only `/AddResponse`. Correlated page load made no identity call; submission called `/InitializeLiveQuizResponseIdentity` immediately before `/AddCorrelatedResponse`. The correlated response produced one respondent and one durable pending outbox row. The local Hatchet SDK workers are independently blocked by their existing heartbeat logger crash (`this.logger[message.type] is not a function`), so live worker settlement is not claimed; the 28 passing worker tests cover persistence and settlement.
- 2026-07-30: The final lifecycle audit closed a second abort race. Worker persistence now locks and verifies the exact element-block execution generation, Redis effect application rejects a missing or changed instance generation inside the atomic Lua script, and abort removes the live-quiz Redis namespace in one atomic Lua operation. An old event therefore cannot recreate PostgreSQL or Redis state after abort followed by a fast republish. The clean-schema 48-case GraphQL suite and all 28 worker cases pass after this hardening.

## Final Review Remediation - 2026-07-30

### Accepted Findings

| Priority | Finding | Concrete improvement |
| --- | --- | --- |
| Release blocker | Aborting a published correlated quiz returns it to draft without deleting durable correlated responses, respondent labels, or pending outbox rows. A subsequent mode change could expose previously correlated logged-in rows through the identifiable legacy export, and a worker racing the abort could recreate data after cleanup. | Serialize worker persistence and abort on the live-quiz row. The worker must persist only while the locked quiz is `PUBLISHED` in `CORRELATED_EXPORT`; abort must delete every correlated response, respondent, label, and pending row in the same transaction that resets the quiz. |
| High | Aggregate PWA submissions initialize the correlated anonymous identity and therefore depend on the database-backed correlated endpoint even though aggregate mode is intentionally Redis-only. | Initialize the anonymous respondent cookie only immediately before a correlated submission. Aggregate submissions must never call the correlated identity endpoint. |
| High | Durable admission is represented by a response key, a claim object, a duplicated identity key in the event, and a non-authoritative persisted-response precheck. | Make the unique durable outbox `responseKey` the sole admission identifier. Carry only the accepted identity in the encrypted event, derive its identity key in the worker, and verify the derived response key against the outbox row once. Remove the pre-admission response lookup. |
| High | `liveQuizResponseCollectionMode.test.ts` is 1,405 lines and mixes policy/concurrency with publication recovery. | Move publication lifecycle and reconciliation cases into a dedicated `liveQuizPublication.test.ts` suite, leaving both files below 1,000 lines and organized around one owner. |
| Medium | Correlated Redis effects are encoded into an in-memory mutation buffer and then manually preflighted against a hand-maintained key list before Lua validates the same keys again. | Expose the pure question-effect plan directly to the correlated processor and pass its mutations to the atomic Lua script. Remove the mutation buffer and duplicate preflight key inventory; Lua remains the authoritative key validator. |
| Medium | Correlated response admission, HTTP helpers, outbox dispatch, validation, and crypto pass-through exports share one 450-line response API module. | Split request/mode helpers, correlated admission, and outbox delivery into focused modules. Import outbox crypto directly from the utility package and move response validation to its own utility module. |
| Medium | Manual start, scheduled start, and reconciliation repeat publication materialization plus acknowledgement as separate operations. | Add one post-commit publication materialization operation that writes Redis and acknowledges the exact database generation, then use it in all three callers. |
| Medium | The export formatter receives raw stable identity keys even though GraphQL has already resolved public respondent labels. | Make the export package accept only public respondent labels and response values. Raw identity keys stay inside the authorized GraphQL query layer. |
| Security hardening | AES-GCM decryption accepts truncated authentication tags when no tag length is specified. | Require a 12-byte IV and 16-byte authentication tag during encryption and decryption and add a regression test that rejects truncated tags. |

### Architectural Decisions

- The durable outbox `responseKey` remains unique and permanent after settlement; ciphertext is still erased on terminal settlement.
- The worker keeps an authoritative current-state check, contrary to the simplification review's suggestion to remove mode lookup. It performs that check under a PostgreSQL row lock in the same transaction as response persistence so that abort and processing have a deterministic order.
- The worker also verifies the accepted element-block execution generation in PostgreSQL and Redis. Quiz status and response mode alone are insufficient after abort followed by a fast republish of the same quiz.
- Redis does not decide whether a correlated response is durable. PostgreSQL admission and active-quiz persistence remain authoritative; Lua applies the derived aggregate effects atomically after persistence.
- Abort cleanup applies only to correlated-export quizzes and deliberately removes their temporary research-response dataset. Assessment remains completely separate and always identifiable.
- The legacy identifiable export continues to exclude quizzes currently in correlated mode. Transactional abort cleanup is the invariant that prevents correlated rows from surviving a later mode transition.
- Public anonymous participation remains intentionally susceptible to cookie clearing and identity farming. This PR does not add application-level Sybil detection.
- The export remains pseudonymized, not anonymous or differentially private. Differential-privacy and free-text PII treatment remain research follow-ups.
- APP_SECRET key rotation still requires draining unsettled outbox rows because this slice does not add key versioning.

### Implementation Slices

1. **Canonical admission and browser boundary**
   - Status: completed.
   - Use `responseKey` as the sole durable admission identifier.
   - Remove the claim contract and duplicated event identity key.
   - Initialize anonymous respondent identity only for correlated submissions.
   - Enforce full-length AES-GCM tags and move response validation to its canonical utility module.
   - Checks: utility, response API, PWA, worker typechecks and focused tests.
2. **Direct Redis effect plan**
   - Status: completed.
   - Return the pure effect mutation plan directly to the correlated processor.
   - Delete the correlated mutation buffer and manual Redis-key preflight.
   - Checks: effect-plan and correlated processor tests, worker typecheck/build.
3. **Lifecycle safety and decomposition**
   - Status: completed.
   - Lock the live quiz during correlated persistence and reject terminally when it is no longer published/correlated.
   - Require the accepted block execution generation during durable persistence and atomic Redis effect application.
   - Delete correlated durable state transactionally on abort.
   - Delete the Redis quiz namespace atomically so cleanup serializes with correlated effect scripts.
   - Split response API ownership modules and the oversized GraphQL test suite.
   - Checks: abort/worker race coverage, response API tests, database-backed GraphQL suites.
4. **Publication and export boundaries**
   - Status: completed.
   - Use one post-commit publication materialization operation in manual, scheduled, and reconciliation paths.
   - Pass only respondent labels into the CSV formatter.
   - Checks: publication recovery/concurrency tests and export/GraphQL export tests.
5. **Release proof**
   - Status: in progress; implementation, clean-schema, full static/build, Opengrep, and browser gates pass. Exact-commit reviews, push, and PR readback remain.
   - Reset through every migration and run focused database-backed suites, then restore fixtures.
   - Run `check:all`, runtime package-resolution probes, affected production builds, Opengrep, browser verification, and exact-commit security, thermo-nuclear, simplification, and branch crosscheck reviews.
   - Address every qualifying finding, push, refresh the draft PR description/evidence, and read back comments and CI.

### Review Notes

- The security review found no high-confidence vulnerability beyond the accepted public-anonymous Sybil limitation, shared response-API database credential, APP_SECRET rotation constraint, and pseudonymized-not-DP export boundary.
- The independent branch crosscheck found the abort lifecycle defect above and no other defect in authorization, assessment separation, gamification compatibility, CSV semantics, or participant notices.
- The requested external `agy` crosscheck could not run in its sandbox (`operation not permitted` while opening its log/listener, followed by the requested model being unavailable). Its output was not used; the final exact-commit crosscheck remains mandatory.
- Opengrep's two logging findings were false positives against constant event names. Its AES-GCM authentication-tag finding was reproduced against the built utility package and is accepted above.

## Exact-Commit Gate Remediation - 2026-07-30

The thermo-nuclear, security, simplification, and independent branch reviews of
`f424f03a16..b5b224e619` found the following release blockers after the first
final-remediation pass.

### Accepted Findings

| Priority | Finding | Concrete improvement |
| --- | --- | --- |
| Release blocker | A response acknowledged while the quiz is published is discarded if the quiz reaches `ENDED` before the worker persists it. The worker currently treats `ENDED` as inactive and terminally settles the outbox row, after which export cannot detect the loss. | Separate admission from settlement eligibility. Admission remains `PUBLISHED` only; an already-admitted event may persist while the exact quiz remains `PUBLISHED` or `ENDED`, correlated, non-assessment, and on the accepted block execution. Export continues to wait for every unsettled event. |
| Release blocker | Anonymous and temporary respondent upserts happen before the locked outbox transaction. Abort can delete the correlated dataset, then a racing rejected submission can recreate an orphan respondent. | Replace preparation plus registration with one `admitCorrelatedResponse` transaction. Take a shared lifecycle lock, recheck the quiz and exact active block generation, validate or upsert identity, derive the response key, encrypt the accepted snapshot, and insert the outbox row atomically. |
| Security blocker | Selection and other structured responses can expand attacker-controlled cardinality into a large Redis mutation plan. Repeated selection IDs also inflate displayed aggregates. | Validate choice, selection, and case-study responses against trusted acceptance metadata, including exact authored dimensions, allowed IDs, finite values, uniqueness, and bounds. Add a correlated-worker mutation ceiling and terminally settle over-limit events rather than redriving them. |
| Release blocker | An old PWA and old response-API replica can still route a correlated quiz through the legacy aggregate endpoint during a rolling deployment. | Add a server-side correlated-publication capability gate. Deploy migration, worker, response API, and PWA with the gate disabled; enable publication only in a second backend configuration rollout after old replicas are gone. |
| High | Abort releases the quiz row lock before deleting `lq:<quizId>:*`. A fast republish can materialize a new generation that the old abort then deletes. | Make Redis namespace cleanup conditional on the aborted publication's `startedAt` generation. Delete old or missing metadata only; leave a newer materialized generation untouched. |
| High | Aggregate-mode participant copy claims answers are not linked across questions, but logged-in and temporary gamified processing uses a stable identity in transient Redis and leaderboard state. | Describe the durable outcome precisely: aggregate mode creates no participant-level response export, while answers still contribute to aggregate results. Use the same accurate distinction in lecturer and participant copy. |
| High | Admission and persistence each use an exclusive quiz-row lock, serializing all respondents. | Use shared row locks for ordinary admission and persistence. Publication, end, abort, mode changes, and export retain exclusive locks, so lifecycle transitions still serialize while independent responses can proceed concurrently. |
| Medium | The correlated processor retains a Redis processing lease in addition to the permanent outbox response key, database uniqueness, and atomic Redis processed marker. | First make a uniqueness collision re-read and classify the persisted response by accepted timestamp. Then remove the lease, release script, busy error, and lease-only branches; concurrent same-message delivery remains recoverable through database retry classification plus the atomic Redis marker. |
| Medium | The decrypted event is runtime-validated, but the worker retains a pass-through metadata resolver and unreachable missing-envelope branches. | Remove the pass-through resolver and guards that cannot follow successful decryption. Keep validation at the encrypted-event boundary and business validation in the response preparation layer. |

### Decisions and Non-Findings

- Persisted respondent labels remain. Stable labels across repeated exports were
  an explicit product decision, and the table also supports future controlled
  export evolution without changing historical labels.
- Export authorization remains `WRITE`. This matches the existing lecturer
  evaluation/download authorization model; the UI continues to warn that
  free-text responses may contain participant-entered personal data.
- Public anonymous participation remains intentionally vulnerable to cookie
  resets. Rate limiting and Sybil controls are deployment follow-ups, not a
  substitute for the accepted mutation and shape bounds.
- The acceptance transaction will verify that the addressed block is active and
  on the accepted execution. This closes the database-to-Redis block-close
  admission window; already-admitted pre-close responses remain eligible for
  durable settlement.

### Execution Slices

1. **Bound and type the accepted response**
   - Status: completed.
   - Publish trusted choice counts, selection IDs/input count, and case-study
     shape in instance metadata.
   - Enforce exact response shape and a hard correlated mutation ceiling.
   - Checks: utility validation, response API, response-effects, and worker
     terminal-settlement tests.
2. **Atomic concurrent admission**
   - Status: completed.
   - Consolidate identity upsert, lifecycle/block-generation checks, response-key
     derivation, encryption, and outbox insertion into one transaction.
   - Use shared lifecycle locks; retain exclusive transition/export locks.
   - Checks: duplicate, abort, block-close, and concurrent-admission tests.
3. **Settlement and abort generations**
   - Status: completed.
   - Persist accepted events after `ENDED`, but never after abort/mode or block
     generation change.
   - Guard abort Redis cleanup with the aborted `startedAt` generation.
   - Remove the redundant processing lease after collision recovery is proven.
   - Checks: end/worker, abort/republish, same-message concurrency, and Redis
     generation tests.
4. **Rollout and copy**
   - Status: completed.
   - Add the disabled-by-default publication capability gate and deployment
     configuration.
   - Correct English and German aggregate notices and refresh browser evidence.
   - Checks: publication gate tests, Helm rendering, desktop/mobile browser proof.
5. **Repeat release gates**
   - Status: completed.
   - Clean-schema database suites, all focused tests, `check:all`, complete build,
     Opengrep, and exact-commit thermo/security/branch/simplification reviews.
   - Push only the reviewed commit, refresh the draft PR, and read back current
     comments and CI.

### Progress

- 2026-07-30: Exact-commit remediation slices 1-4 are implemented. Structured
  responses are bounded by authored metadata and a hard mutation ceiling;
  acceptance is one shared-lock transaction; already accepted responses settle
  through normal end while abort and generation changes reject them; duplicate
  delivery relies on database uniqueness plus the Redis processed marker; and
  abort cleanup preserves a newer publication generation.
- 2026-07-30: Correlated publication now has a disabled-by-default deployment
  capability gate for the required two-phase rollout. Aggregate copy states the
  durable export outcome without claiming that all transient processing is
  unlinkable. Helm rendering and isolated publication/abort tests pass.
- 2026-07-30: Refreshed real-browser proof covers aggregate and correlated
  settings at 1440x1000 and both participant notices at 390x844. The selected
  setting, concise consequence text, quiz header, and participant notice fit
  without overlap in each captured state.
- 2026-07-30: A clean reset applied all 180 migrations and the subsequent Prisma
  push completed without drift. The repeated database-backed response-mode,
  abort, publication, and export suites passed 43/43 cases; the focused policy
  suite passed another 7/7 cases.
- 2026-07-30: Focused utility, response API, response worker, export, and GraphQL
  suites pass (157 cases outside the clean-schema database run). `check:all`
  passed every typecheck, format, lint, schema-sync, and dependency-consistency
  task, and the complete production build passed 22/22 tasks.
- 2026-07-30: Helm rendering confirms the publication capability gate defaults
  to disabled for the backend and general worker. The runtime resolves both the
  export package root and its correlated-response public subpath. Opengrep ran
  210 rules over 42 affected source files; its six findings are on unchanged
  legacy lines and no finding is introduced by this remediation.
- 2026-07-30: The code-quality improvement pass replaced the cross-process
  string record with one discriminated metadata contract, made PIN validation
  part of atomic admission, removed the worker's Redis and database pre-reads,
  centralized live-quiz PIN allocation, switched the respondent index to a
  concurrent build, and removed repeated course-list derivation. ADR 0001 and
  the engineering wiki now own the current architecture.
- 2026-07-30: Post-improvement verification passed 68 utility, 20 response API,
  28 response-worker, and 50 database-backed GraphQL cases. A clean database
  replay applied all 180 migrations and Prisma reported no drift; `check:all`
  and the full 22-task build passed. Helm still renders the publication gate
  disabled. Opengrep's three findings are unchanged legacy format-string
  findings outside the changed hunks.
- 2026-07-31: The exact-commit gates ran independently against
  `f424f03a16..c6f60e3f48`. Maintainability returned one low legibility item
  (`enableGamification` calls the transition helper only for its guard throw and
  discards the result). Security returned zero findings after independently
  re-tracing AES-GCM IV/tag handling, export reidentification, resolver
  authorization, input cardinality bounds, SQL parameterization, secrets, and the
  publication gate. Simplification returned three low items (`isRecord` defined
  three times in `packages/util/src`, a one-line `releaseInvalidResponse`
  wrapper, and a duplicated inline `P2002` check). The branch crosscheck returned
  two claimed release blockers, both refuted below, plus a German copy
  inconsistency and a concurrency test-coverage gap.
- 2026-07-31: Refuted crosscheck blocker "the `CONCURRENTLY` migration will abort
  because Prisma transaction-wraps multi-statement files". A full
  `prisma migrate deploy` of all 180 migrations against a clean throwaway
  PostgreSQL 15 database applied every migration successfully;
  `pg_index` then reported the concurrent unique index as `indisvalid = t`,
  `indisunique = t`, and all four new CHECK/FK constraints as `convalidated = t`.
  Prisma does not transaction-wrap migration files, so
  `docs/data-and-migrations.md` is correct as written and the migration is
  unchanged.
- 2026-07-31: Refuted crosscheck blocker "reopening a closed block silently drops
  a correlated response". The block-status and `execution` logic in
  `activateLiveQuizBlock` is byte-identical to base `f424f03a16`, and
  `@@unique([instanceId, elementBlockExecution, participantId])` already exists
  on `v3`, so the mechanism is pre-existing rather than introduced here. The
  cockpit timeline only advances forward (`firstBlock` opens `blocks[0]`,
  `nextBlock` opens `lastActiveBlockId + 1`), so no product path reopens an
  `EXECUTED` block. Rejecting a second response for the same block execution is
  the documented first-accepted-response rule that already governs assessment
  quizzes. Recorded as a follow-up, not a change in this PR.
- 2026-07-31: Applied the one qualifying finding: the German
  `responseExportEmpty` string used "verknüpften" where every other German string
  in this feature uses "korreliert". No other gate finding qualified for change
  at the release gate; the remaining low items are recorded as follow-ups because
  they are cosmetic, behaviour-preserving, and would add churn to an already
  large branch. A copy-only change cannot affect the maintainability, security,
  or correctness gates, so those were not re-run.
- 2026-07-30: Desktop browser evidence at 1440x1000 confirms the aggregate-only
  state disables correlated export for a gamified course and explains why,
  while the correlated state uses no course and communicates random-label
  export without identifiable respondent fields. Existing 390x844 participant
  notice evidence remains valid because this pass did not change PWA behavior.

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

1. Commit the complete remediation scope after staged data-hygiene review.
2. Run exact-commit thermo-nuclear maintainability, security, simplification, and branch crosscheck reviews.
3. Address every qualifying review finding and rerun affected verification.
4. Push the reviewed branch, refresh the draft PR description and evidence, and read back CI, reviews, and comments. Keep the PR draft until all release gates pass.
