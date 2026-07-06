# Review: Live Quiz Correlated Responses Plan (PR #5134)

Reviewed: `project/2026-06-20-live-quiz-correlated-responses-plan.md` at `93c7d2147`
Reviewer: Claude (independent plan review, Slice 0 of the plan itself)
Date: 2026-07-06
Scope: UX, plan quality, usefulness, and remaining steps toward production readiness. All plan claims were verified against the codebase at `origin/v3`; evidence is cited as `file:line`.

## Verdict

The plan is solid and implementable. The product decisions (opt-in enum, default aggregate, assessment excluded, pseudonymous labels, no DP claims) are sound and well captured. The slice structure is realistic and the first review round (Greptile) was integrated properly.

Two findings should be resolved **before Slice 1 starts** because they change the plan itself:

1. **The export artifact never reaches the lecturer.** The export package is a CLI-only admin tool with zero wiring into the app. As planned, a lecturer can enable correlated mode but can never download the matrix. This is the biggest usefulness gap (Finding 1).
2. **The migration design is more complex than needed.** The planned partial unique indexes can be replaced by two ordinary Prisma `@@unique` constraints; only the CHECK constraint needs raw SQL (Finding 2).

Everything else is fixable inside the existing slices. Detailed findings below, ordered by severity, each with instructions a junior can execute.

## Claim Verification (Evidence)

Every "Current Evidence" claim in the plan was checked against the codebase:

| Plan claim | Verdict | Evidence |
| --- | --- | --- |
| `LiveQuiz` has `isGamificationEnabled`, `isAssessmentEnabled`, `pinCode` | Confirmed | `packages/prisma/src/prisma/schema/quiz.prisma:82-111` (`pinCode` is `String? @unique`, L99) |
| Standard responses go through response-api, Hatchet events `response-received:anonymous` / `:authenticated` | Confirmed | `apps/response-api/src/index.ts:144-155` |
| Standard worker aggregates into Redis, later `ElementInstance.anonymousResults`, no durable `LiveQuizResponse` | Confirmed, one imprecision | Worker: `apps/hatchet-worker-response-processor/src/processors/processor.ts` (zero `prisma.liveQuizResponse` calls). The Redis→DB flush is **not** done by the worker; it happens in `packages/util/src/blocks.ts:517-527` (`updateLiveQuizBlockResultsFromCache`), triggered from `packages/graphql/src/services/liveQuizzes.ts:1314` on block deactivation |
| Assessment worker writes durable `LiveQuizResponse`, first-response-wins | Confirmed | `apps/hatchet-worker-response-processor/src/processors/assessmentProcessor.ts:377-421` (explicit `findUnique` dup check, then `create`) |
| `LiveQuizResponse` hard-linked to `Participant` | Confirmed | `packages/prisma/src/prisma/schema/response.prisma:133-134` (`participantId String @db.Uuid`, required, `onDelete: Cascade`); unique constraint `@@unique([instanceId, elementBlockExecution, participantId])` at L143 |
| `TemporaryLeaderboardEntry` = quiz-scoped identity, `temporary_participant_token` JWT from `accounts.ts` | Confirmed | `packages/prisma/src/prisma/schema/participant.prisma:219-236` (composite `@@id([id, quizId])`); token created in `packages/graphql/src/services/accounts.ts:55-69,149-205` (HS256, `sub` = entry id, `expiresIn: '2w'`, cookie `maxAge` 30d) |
| Export package reads `LiveQuizResponse`, one row per response | Confirmed | `packages/export/src/liveQuizResponses.ts:85-137`; headers incl. `participantId`, `email` at L25-53 |

All file paths listed in the slices exist as named (wizard: `apps/frontend-manage/src/components/activities/creation/liveQuiz/`, PWA: `apps/frontend-pwa/src/pages/session/[id].tsx`, `LiveQuizQuestionColumn.tsx`, op `QGetRunningLiveQuiz.graphql`, worker processors, i18n message files). One correction: migrations live at `packages/prisma/src/prisma/schema/migrations/`, not `packages/prisma/src/prisma/migrations/`.

## Findings

### Finding 1 (blocker, product): the correlated export never reaches the lecturer

The plan's target user is a quiz editor ("normal quiz editors can enable mode"), but the export package is a standalone CLI (`packages/export/src/cli.ts`: `pnpm --filter @klicker-uzh/export export -- --courseId <id> [--pseudonymize]`). A repo-wide search finds **zero imports of `@klicker-uzh/export`** outside the package itself — no GraphQL resolver, no manage-UI download button. The manage evaluation pages (`apps/frontend-manage/src/pages/quizzes/[id]/evaluation.tsx`, `components/evaluation/*`) render charts only; there is no results download anywhere in frontend-manage today.

Consequence: as planned, enabling `CORRELATED_EXPORT` produces data only an admin with DB/CLI access can extract. The feature would ship invisible to its own audience.

**Instruction:** Decide one of the two options with the team before Slice 1, then write the decision into the plan:

- **Option A (recommended for v1):** keep export CLI/admin-side, and add to Slice 2 a short lecturer-facing note in the manage UI ("correlated exports are delivered on request via support"). Cheapest path, ships the data model; the UI download can come later.
- **Option B:** add a new Slice 6b "manage-UI download": GraphQL mutation or authenticated HTTP endpoint that generates the matrix XLSX server-side and streams it, plus a download button on the quiz evaluation page. This is meaningful extra work (auth, file generation in request context, size limits) — do not fold it silently into Slice 6.

### Finding 2 (blocker, tech): simplify the migration — partial unique indexes are not needed

The plan (Migration note, Slice 1) prescribes raw-SQL partial unique indexes because "Prisma cannot express the full constraint set". True for the CHECK, not for the uniques:

- Postgres treats NULLs as distinct in unique constraints (default `NULLS DISTINCT`). With the CHECK guaranteeing exactly one of `participantId` / `respondentId` is set, **two ordinary constraints work**:
  - `@@unique([instanceId, elementBlockExecution, participantId])` — rows with NULL `participantId` never collide here;
  - `@@unique([instanceId, elementBlockExecution, respondentId])` — rows with NULL `respondentId` never collide here.
- This keeps the schema fully declarative in Prisma. Only the CHECK stays as hand-written SQL in the migration file — and CHECKs are safe with Prisma migrate (not modeled, not dropped). There is direct precedent **on this very table**: `packages/prisma/src/prisma/schema/migrations/20250923154945_point_corrections/migration.sql:7` adds `LiveQuizResponse_correction_response_check`, and `20250919170000_live_quiz_scoring_constraints/migration.sql:2-7` adds five CHECKs on `LiveQuiz`.
- By contrast, there is **no partial unique index anywhere in the 175 existing migrations**. Prisma models indexes, so undeclared hand-created indexes risk being dropped by a future `prisma migrate dev` diff. Avoid the fight entirely.

**Instruction:** Update the plan's Migration note: two plain `@@unique` constraints in the `.prisma` file + one raw-SQL `CHECK (num_nonnulls("participantId", "respondentId") = 1)` appended to the generated migration. Workflow reminder for Slice 1: after editing the schema run `pnpm run prisma:migrate`, edit the generated `migration.sql` to append the CHECK **before** applying, then `pnpm run prisma:sync` (mirrors schema to `apps/analytics` — currently missing from the plan) and regenerate the client.

### Finding 3 (major): "duplicate returns recorded-before" cannot work in the current standard path

The plan adopts assessment duplicate semantics ("first response counts; duplicate returns recorded-before"). But the two paths differ structurally:

- Assessment: response-api does a **synchronous** Redis vote-hash check before accepting and returns HTTP 208 `response_recorded_before` to the client (`apps/response-api/src/index.ts:286-304`). A second explicit `findUnique` gate sits in the durable worker (`assessmentProcessor.ts:377-393`).
- Standard: response-api is fire-and-forget — it pushes the Hatchet event and returns 200 immediately (`index.ts:155-156`). The worker silently drops duplicates from identified respondents (`processor.ts:126-140`, returns `{ status: 200 }`) and the client never learns. Anonymous responses are never deduplicated at all today.

So "recorded-before" feedback for correlated mode requires a **new synchronous gate in response-api** (mirroring the assessment Redis vote-hash pattern), or the decision must be downgraded to "silent first-response-wins, no client feedback".

**Instruction:** Pick one and record it in the plan. Recommended: add the Redis vote-hash gate to `handleAddResponse` **only when the quiz is in correlated mode** (the mode flag must therefore be available to response-api — the assessment path shows how quiz-level metadata reaches it). Keep the worker-side `findUnique`-before-`create` as the authoritative second gate, copied from `assessmentProcessor.ts:377-421`. Add this to Slice 4's Do list explicitly.

### Finding 4 (major): mode lock after publish has no existing pattern — must be server-side

The plan says "Lock mode after publish/start" (Slices 1 and 2). There is no such lock mechanism in the wizard today: `LiveQuizSettingsStep.tsx` has `editMode` and a `courseSelectionDisabled` special case, but no field is disabled based on `PublicationStatus`. Editing a running quiz hits the same form as a draft.

**Instruction:** Enforce the lock in the service layer, not just the UI. In the live quiz update path in `packages/graphql/src/services/liveQuizzes.ts`, reject (or silently ignore, matching existing service conventions) a `responseCollectionMode` change when `status` is not `DRAFT`/`SCHEDULED`. Then disable the control in `LiveQuizSettingsStep.tsx` with a tooltip explaining why. A UI-only lock is trivially bypassed via the API and would let a lecturer flip a running aggregate quiz to correlated retroactively — exactly what the product decision forbids. Add a service-level unit test: update attempt on RUNNING quiz keeps the old mode.

### Finding 5 (major): respondent label ordering is underspecified and leaks information

"Labels stable per quiz/export as far as deterministic internal ordering allows" is not implementable as written — the junior has to invent the ordering rule, and the obvious ones (row id, createdAt) make `respondent_001` = "first person who joined/answered". Combined with leaderboard knowledge or seating observation, low-numbered labels are partially re-identifiable.

The codebase already has the right tool: `packages/export/src/pii.ts` does per-run HMAC pseudonymization (`applyPii`, `makePiiSalt`). Note its salt is **per-run**, so labels would change between export runs — which contradicts "stable per quiz/export".

**Instruction:** Decide the tradeoff explicitly and write it down:

- **Stable across re-exports (recommended, matches plan intent):** store a random `exportSalt` on `LiveQuiz` (or on the new respondent model), created when correlated mode is first enabled. Order identities by `HMAC(exportSalt, internalId)` and assign `respondent_001..N` in that order. Stable, deterministic, and the ordering carries no join/answer timing signal. New respondents insert into the HMAC order, which can shift neighbors' labels between exports — if that matters, only export after quiz end (reasonable for a teaching artifact) or assign labels once at first export and persist them.
- **Fresh per run:** reuse `makePiiSalt()` per run; simplest, but re-exports are not comparable.

Also specify the matrix column scheme now (currently missing): one column group per `ElementInstance` × `elementBlockExecution` (blocks can be re-executed — `response.prisma:130`), named e.g. `B{blockOrder}.{instanceOrder}.E{execution}_response|correctness|points`. Exclude `submittedAt` timestamps from the teaching matrix — response timing is another soft re-identification channel and the teaching use case doesn't need it.

### Finding 6 (major, security — carried over from Greptile, still open): anonymous respondents without secret

The plan's `LiveQuizRespondent.verificationSecretHash?` is nullable (temporary-pseudonym rows won't have one), so nothing stops code from creating an `ANONYMOUS_CORRELATED` row without a secret, silently voiding the token verification the plan requires elsewhere.

**Instruction:** Add to the Slice 1 migration a type-conditional CHECK, precedent `20250923154945_point_corrections/migration.sql:25-26` (mutual-exclusivity CHECKs on `PointCorrection`):

```sql
ALTER TABLE "LiveQuizRespondent" ADD CONSTRAINT "LiveQuizRespondent_secret_check"
CHECK ("type" <> 'ANONYMOUS_CORRELATED' OR "verificationSecretHash" IS NOT NULL);
```

And in Slice 4, note the existing expiry quirk to avoid copying it: the temporary participant cookie lives 30 days but its JWT expires after 2 weeks (`accounts.ts:19-28` vs `:55-69`) — pick one aligned lifetime for the new anonymous token, scoped to the quiz.

### Finding 7 (moderate): free-text policy diverges from the existing export convention — make it loud

The existing export already has a free-text privacy stance: in `--pseudonymize` mode, free-text answers are redacted (`packages/export/src/liveQuizResponses.ts:156-158` — "Free-text answers can carry PII; gate them behind pseudonymize mode."). The new correlated teaching matrix deliberately inverts this: pseudonymous labels **plus verbatim free text**. That is a defensible product decision (the plan records it), but a future maintainer reading `pii.ts` will assume pseudonymized == redacted.

**Instruction:** In Slice 6, do not overload the existing `PiiContext` modes. Give the matrix its own explicit mode/flag (e.g. `teachingMatrix: { labels: 'pseudonymous', freeText: 'verbatim' }`), put the warning text into the export manifest (`packages/export/src/manifest.ts`), and add a code comment cross-referencing the plan decision. The unit test list in Slice 6 already covers "free-text inclusion" — keep it.

### Finding 8 (moderate, UX): participant notice copy and placement

The copy drafts are a good start. Concrete issues:

1. **"may be linked" is too soft.** In correlated mode responses *are* stored linked; only the export is conditional. Softening invites the reading "probably won't happen". Suggested EN copy:
   - Correlated: *"Answers in this quiz are stored per participant and can be exported with random labels (e.g. respondent_001) instead of names."*
   - Aggregated: *"Answers are only counted in aggregate and are not linked across questions."*
2. **"Login is only used for scoring and leaderboard features"** is confusing for anonymous participants (nothing to log into) — show that sentence only when the user is actually logged in or the quiz is gamified, or drop it from the banner and put it in a tappable info popover.
3. **DE copy is missing** from the plan. Draft for the junior (adjust with a native check):
   - Correlated: *"Antworten in diesem Quiz werden pro Person gespeichert und können mit zufälligen Bezeichnungen (z. B. respondent_001) statt Namen exportiert werden."*
   - Aggregated: *"Antworten werden nur aggregiert ausgewertet und nicht über Fragen hinweg verknüpft."*
4. **Placement:** `LiveQuizQuestionColumn.tsx` already renders a `UserNotification` in the `beforeFirstBlock` branch (L102-129) and `QuestionArea.tsx` wraps every active question — put the compact notice there, reusing `UserNotification` (type `info`), single line with an expandable popover for detail. Mobile vertical space is contested during active questions; Slice 3's required mobile screenshots must show a question + notice on a 375px viewport without pushing the answer options below the fold.
5. **Aggregated-mode notice is new UI for the 99% default case.** The grill decision says notice in both modes; fine — but implement the aggregated variant as the *least* intrusive form (one muted line or icon+popover), and screenshot-compare against current production UI so the default experience visibly barely changes.

### Finding 9 (moderate): manage-UI setting details

- Placement in `LiveQuizSettingsStep.tsx` next to gamification (`data-cy="set-quiz-gamification"`) and PIN protection (`data-cy="set-quiz-pin-protection"`) is right. Follow the existing toggle/label pattern and add a `data-cy="set-quiz-response-collection-mode"` for E2E.
- Prefer **disable-with-explanation over hide** when `isAssessmentEnabled` is true (the plan says "ignore / hide" — pick disable). Hidden settings are undiscoverable; a disabled control with "assessment quizzes always store identifiable responses" teaches the model.
- When switching to `CORRELATED_EXPORT`, show a short inline confirmation (not a modal) summarizing consequences: "Responses will be stored per participant. Participants see a notice. Export uses random labels." This is the lecturer's informed-consent moment; a bare radio button is too quiet for a privacy-relevant switch.
- Enum GraphQL precedent: `LiveQuizAccessMode` in `packages/graphql/src/schema/liveQuiz.ts:7-9` mirrors the Prisma `AccessMode` enum (`quiz.prisma:77-80,111`) — copy that pattern exactly for `responseCollectionMode`.

### Finding 10 (moderate): deletion, retention, and cascade semantics are unaddressed

- `LiveQuizResponse.participantId` has `onDelete: Cascade` (`response.prisma:133-134`): when a participant deletes their account, their correlated rows vanish, and a later re-export produces a different matrix. That is the privacy-correct default — keep it, but document it in the export manifest ("matrices are snapshots; rows disappear if participants delete accounts").
- Mirror `TemporaryLeaderboardEntry`'s `onDelete: Cascade` on quiz for the new `LiveQuizRespondent` (`participant.prisma:224-228` precedent) so respondent rows and their responses disappear with the quiz.
- Add one sentence to the plan on retention: correlated responses live as long as the quiz. No new retention machinery needed for v1, but the statement should exist.

### Finding 11 (minor, collected): workflow and hygiene gaps

1. **`pnpm run prisma:sync` missing** from Slice 1 (mirrors schema into `apps/analytics` — repo-required after any schema change).
2. **Seed data missing:** `packages/prisma-data` is untouched by the plan; Slice 7's end-to-end run and any Playwright/Cypress specs need a seeded correlated quiz. Add to Slice 6 or 7.
3. **E2E should be mandatory, not "if dev env available":** the repo has Cypress and a fresh Playwright suite (see commits `8119fd53e`, `d6c7772f8`) plus the `klicker-playwright-e2e` / `klicker-cypress-e2e` skills. Minimum cases: (a) lecturer enables correlated mode in wizard; (b) anonymous participant answers, reloads, answers next question — same respondent row (assert via export or DB); (c) participant sees the correlated notice; (d) aggregated quiz unchanged.
4. **Cookie-blocked degradation** (Risk list already notes multi-row tolerance): add one manual test with cookies blocked to Slice 7's checklist; expected behavior = new respondent per submission, quiz still works, export shows split rows.
5. **Worker file is legacy:** `processor.ts:1` carries a "requires a complete rework" TODO. Keep Slice 4 changes strictly additive (new branch for correlated persistence), don't refactor opportunistically, and cover the new branch with focused tests.
6. **Docs:** lecturer-facing documentation (apps/docs) explaining the two modes and the lecturer's data-protection responsibility is missing from all slices. Small page, add to Slice 7.
7. Migration path in plan text should read `packages/prisma/src/prisma/schema/migrations/`.

## Usefulness Assessment

The feature fills a real gap: today the only per-person response data comes from assessment mode (identifiable, EduID-gated, `apps/response-api/src/index.ts:202-261`) or from the aggregate charts. Lecturers who want item-analysis (who got Q1 right also got Q3 right?) without identity have nothing. Correlated-pseudonymous is the correct middle tier, and keeping it out of assessment avoids weakening the audit story there.

The usefulness stands or falls with Finding 1 (delivery). A data model without a delivery path is a research feature, not a teaching feature. Resolve that decision first.

## Ordered Roadmap to Production (for the implementing junior)

Work strictly in this order; each step ends with a commit and green checks. Steps 1-2 are plan edits, not code.

1. **Resolve the two blockers on the plan document** (Findings 1, 2): pick export delivery Option A or B with the team; replace the partial-index migration note with the two-`@@unique` + CHECK design; add the smaller plan edits (Findings 3, 4, 5, 6, 10, 11 items 1-2, path fix). Commit as `docs(project): integrate second plan review`.
2. **Re-read the plan end-to-end** and confirm slice order still holds (plan's own Next Step 3).
3. **Slice 1 (schema + mode):** Prisma enum + `responseCollectionMode` on `LiveQuiz` (`quiz.prisma`), `LiveQuizRespondent` with both CHECKs (Findings 2, 6), `LiveQuizResponse.respondentId` + nullable `participantId` + two `@@unique`s, patch `packages/export/src/liveQuizResponses.ts` for nullable participant, `pnpm run prisma:migrate` (append CHECKs to the SQL before applying), `pnpm run prisma:sync`, expose enum via Pothos copying the `LiveQuizAccessMode` pattern, service-side lock (Finding 4) + unit test, `pnpm --filter @klicker-uzh/graphql generate`. Gate: `pnpm run check` green, export package tests green.
4. **Slice 2 (manage UI):** setting in `LiveQuizSettingsStep.tsx` per Finding 9, i18n EN/DE, `data-cy` attribute. Gate: typecheck + agent-browser screenshot of the wizard (delegated lecturer login, see CLAUDE.md test credentials).
5. **Slice 3 (PWA notice):** per Finding 8, both modes, EN/DE. Gate: desktop + 375px mobile screenshots, both modes, notice does not push answers below fold.
6. **Slice 4 (token + persistence):** anonymous respondent issuance (id + hashed secret; aligned cookie/JWT lifetime per Finding 6), response-api forwards token, correlated-mode sync dedup gate per Finding 3, worker verifies secret and persists via `findUnique`-then-`create` copied from `assessmentProcessor.ts:377-421`, additive only (Finding 11.5). Gate: unit tests incl. forged-id negative test; manual reload-keeps-row check.
7. **Slice 5 (temp pseudonym alignment):** as planned; verify leaderboard UX unchanged via agent-browser.
8. **Slice 6 (export matrix):** label scheme per Finding 5, own PII mode per Finding 7, column spec incl. `elementBlockExecution`, manifest warning, seed fixtures (Finding 11.2), unit tests for label stability / no identifiers / free-text inclusion.
9. **Slice 7 (verification + security):** full three-respondent-type flow, E2E specs per Finding 11.3, cookie-blocked manual test, security review (token scope, secret hashing, identifier leakage in every export column), docs page (Finding 11.6), PR with screenshots via `$df-mr-description-writer`.

## How to Re-verify This Review

```bash
# export is CLI-only, no app wiring
grep -rln "@klicker-uzh/export" --include="*.ts" --include="*.tsx" apps/ packages/ | grep -v "^packages/export"   # -> empty

# current unique constraint + required participantId
sed -n '111,145p' packages/prisma/src/prisma/schema/response.prisma

# CHECK precedent on LiveQuizResponse; no partial indexes anywhere
cat "packages/prisma/src/prisma/schema/migrations/20250923154945_point_corrections/migration.sql"
grep -rn "CREATE UNIQUE INDEX.*WHERE" packages/prisma/src/prisma/schema/migrations/  # -> empty

# silent duplicate drop in standard worker
sed -n '126,141p' apps/hatchet-worker-response-processor/src/processors/processor.ts

# synchronous recorded-before gate in assessment path
sed -n '286,304p' apps/response-api/src/index.ts

# free-text redaction convention in existing export
sed -n '150,160p' packages/export/src/liveQuizResponses.ts
```
