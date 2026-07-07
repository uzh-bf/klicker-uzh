# Review: PR #4587 — Unpublish published practice quizzes and microlearnings

- **PR**: https://github.com/uzh-bf/klicker-uzh/pull/4587 (branch `unpublish-activities`, target `v3`)
- **Reviewed**: 2026-07-07, against `v3` @ `d6c7772f8`
- **Reviewer**: Claude (automated deep review, evidence-checked against the current `v3` codebase)
- **Verdict**: **Do not merge or mechanically rebase.** The feature itself is useful and requested, and the backend semantics are a good starting point, but the PR is ~15 months behind `v3`. The manage frontend it modifies has been deleted and rewritten, and the backend services gained a permission system and Hatchet task scheduling that this PR does not handle. Treat this branch as a **reference implementation** and re-implement on a fresh branch (plan below).

---

## 1. What the PR does

Today (on `v3`), `unpublishPracticeQuiz` / `unpublishMicroLearning` only work for **SCHEDULED** activities (revert to DRAFT before they go live). This PR extends both mutations to also unpublish **PUBLISHED** activities, with a new required `deleteResponses: Boolean!` argument:

- Backend: fetch activity in status `PUBLISHED | SCHEDULED`; if `PUBLISHED && deleteResponses`, loop over all element instances inside a `$transaction`, `deleteMany` their `responses` + `detailResponses`, and reset `results` / `anonymousResults` via `getInitialInstanceResults()`; then set status to `DRAFT`.
- Frontend (manage): repurposes the deletion modals into combined `*UnpublishDeletionModal` components with an `unpublishingMode` prop; adds an "Unpublish" dropdown entry for published activities that opens the modal with `deleteResponses: true`.
- Drive-by fix: adds `fetchPolicy: 'network-only'` to seven summary queries in confirmation modals so they don't show stale counts.
- i18n: new unpublish confirmation messages (EN/DE); renames key `unpublishMicrolearning` → `unpublishMicroLearning`.

---

## 2. Findings

### 2.1 Stability / rot (blocking)

**F1 — The frontend files this PR edits no longer exist.** `git merge-tree v3 unpublish-activities` reports modify/delete conflicts: `MicroLearningElement.tsx`, `PracticeQuizElement.tsx`, and `actions/UnpublishMicroLearningButton.tsx` were **deleted on `v3`**. The manage UI was rewritten into hook-based actions:
- `apps/frontend-manage/src/components/activities/actions/usePracticeQuizActions.ts` / `useMicroLearningActions.ts`
- `apps/frontend-manage/src/components/activities/overview/PracticeQuizActions.tsx` / `MicrolearningActions.tsx` (per-`PublicationStatus` action maps — `unpublishPracticeQuiz` currently only appears in the `Scheduled` block)

There is nothing to "resolve" in these conflicts — the frontend part must be re-implemented in the new structure.

**F2 — Backend services drifted: Hatchet scheduled tasks are not handled.** The current `v3` implementations of both unpublish functions delete the Hatchet scheduled publication task (`scheduledPublicationTaskId`, and for microlearnings also `scheduledCompletionTaskId`) and null those columns (see `packages/graphql/src/services/practiceQuizzes.ts:591` and `services/microLearning.ts` on `v3`). The PR predates Hatchet entirely. A naive conflict resolution in favor of the PR would leave orphaned scheduled tasks that later fire and re-publish/complete an activity the lecturer just unpublished. For microlearnings specifically: unpublishing a PUBLISHED microlearning must also cancel the pending **completion** task, a case that doesn't exist on `v3` today.

**F3 — Transaction timeout risk.** The PR runs one `elementInstance.update` per instance, sequentially, inside an interactive `$transaction` with the **default 5s timeout**. Compare `deletePracticeQuiz` on `v3`, which passes `{ timeout: 60000 }` for a similar cleanup. A large published quiz with many instances/responses will exceed 5s and abort mid-flight (the transaction rolls back, but the user gets an opaque error). Fix: batch the deletions (`questionResponse.deleteMany({ where: { elementInstanceId: { in: ids } } })`, same for `questionResponseDetail`) and keep only the per-instance `results` reset as individual updates (needed because `getInitialInstanceResults` depends on each instance's `elementData`), plus an explicit generous timeout.

**F4 — Silent failure on `null`.** Both services return `null` when the activity isn't found in an unpublishable state (e.g. someone else unpublished it first, TOCTOU between the `findUnique` and the transaction). The modal `onSubmit` just awaits the mutation and closes — no error toast, no feedback. The current `v3` action hook at least guards the cache update (`if (!res?.unpublishPracticeQuiz?.id) return`) but also shows nothing to the user. Re-implementation should surface success/failure toasts.

**F5 — Concurrent student submissions can race the wipe.** Responses are written synchronously in `respondToElementStack` (`packages/graphql/src/services/stacks.ts:3164`). A student submitting during the unpublish transaction can upsert a response and rewrite `results` after the reset but before the status flips to DRAFT, leaving a DRAFT quiz with a handful of orphan responses and non-initial results. Low probability, but worth either a status-flip-first ordering (set DRAFT, then wipe) or a documented acceptance of the residual risk.

### 2.2 Security / authorization (blocking)

**F6 — Authorization model changed under the PR.** The PR guards with `ownerId: ctx.user.sub` in the Prisma `where`. On current `v3`, both mutations are wrapped in `withPermission((args) => ({ practiceQuizId: args.id }), DB.PermissionLevel.EXECUTE, ...)` on top of `asUserWithCatalyst / asUserFullAccess` (see `packages/graphql/src/schema/mutation.ts:3285` and `:3300`), and the services **no longer check `ownerId`** — object-level sharing permissions are the source of truth. The re-implementation must:
1. Keep the `withPermission` wrapper.
2. **Decide the permission level deliberately.** Unpublish-with-response-deletion is destructive (irreversibly deletes student data). `EXECUTE` is what plain unpublish uses today; check what `deletePracticeQuiz` requires and match the *destructive* variant to the deletion-level permission rather than inheriting `EXECUTE` silently. This is a product/security decision — confirm with @rschlae before implementing.

**F7 — Data-retention inconsistency.** `deletePracticeQuiz` on `v3` deliberately refuses to hard-delete responses: published quizzes with responses are only **soft-deleted** (`isDeleted: true`, permissions stripped, stacks detached) precisely to preserve response data. This PR introduces the first code path that **hard-deletes** `questionResponse`/`questionResponseDetail` rows for a published activity. That may be exactly what lecturers want ("reset and start over"), but it contradicts the existing retention posture and deserves an explicit sign-off, plus consideration of whether the soft-delete pattern (or archiving) should be used instead.

### 2.3 Data integrity / gamification (blocking decision, then straightforward)

**F8 — XP and leaderboard points are NOT reverted.** Responding to elements awards XP and course leaderboard points as separate aggregates: `participant` XP increment and `leaderboardEntry.upsert` in `packages/graphql/src/services/stacks.ts:2546` / `:2564`. Deleting `questionResponse` rows and resetting instance `results` does not touch these. Consequences:
- Students keep XP/points from a quiz whose "results were deleted" (the modal text claims "all their results will be deleted" — not fully true).
- **Double earning**: after unpublish-with-deletion + republish, students can answer again from scratch; `questionResponse.upsert` finds no prior row, so first-attempt scoring and XP are awarded a second time.

Options: (a) accept and document (delete flow has the same asymmetry today — soft-deleted quizzes also keep awarded XP), (b) compute and subtract awarded points/XP before deleting (complex, probably not worth it), or (c) keep responses always and only revoke access (i.e. drop `deleteResponses` entirely). Decision needed before implementation; my recommendation is (a) with honest modal wording, given precedent.

**F9 — Republish behavior with kept responses is untested.** With `deleteResponses: false` on a PUBLISHED quiz, responses stay attached to instances of a now-DRAFT quiz, which the lecturer can then **edit** (change elements, add/remove stacks) and republish. Nothing validates that editing a quiz with live response data keeps `results` consistent with `elementData`. Needs at minimum a manual test; possibly the manage UI should lock element editing when responses exist (or the flow should force response deletion when the lecturer edits).

### 2.4 UX

**F10 — The `deleteResponses` choice is not actually offered.** The API supports keep-vs-delete, but the modal hard-codes `deleteResponses: true` and the quick action (`deleteResponses: false`) is only reachable for SCHEDULED activities. The CodeRabbit summary on the PR ("enabling users to unpublish without deleting responses") describes a capability the UI never exposes for published activities. Re-implementation should present an explicit choice (radio/checkbox in the confirmation modal: "revoke access only" vs "revoke access and delete all responses"), with the destructive option requiring the existing `ConfirmationItem` checkboxes.

**F11 — Reused deletion modal is confusing.** The combined `*UnpublishDeletionModal` keeps `confirmationType="delete"` and deletion-phrased confirmation items even in unpublish mode, and the dual-open-state wiring (`open={deletionModal || unpublishModal}` with a setter that flips both) is fragile. The current `v3` modal structure (separate, single-purpose modals + status-gated action maps) makes a dedicated `PracticeQuizUnpublishModal` cleaner.

**F12 — No success feedback.** Existing publish/unpublish actions on `v3` update the Apollo cache; a destructive unpublish should additionally show a success toast and refetch the course activity list (`GetSingleCourseDocument` refetch exists in the PR for practice quizzes but is missing for microlearnings).

### 2.5 Quality / smaller items

- **F13 — i18n key rename is churn**: `unpublishMicrolearning` → `unpublishMicroLearning` conflicts with `v3`, which kept the old key and now uses it in `useMicroLearningActions.ts:197` and `MicrolearningActions.tsx`. Drop the rename; add only the two new `unpublish*Message` keys (EN/DE both present and translated correctly in the PR — reuse those strings, but fix the overclaim per F8: results are deleted, already-awarded XP is not revoked).
- **F14 — The `fetchPolicy: 'network-only'` drive-by fix is still partially unapplied on `v3`**: `LiveQuizDeletionModal` and `CancelLiveQuizModal` already have it upstream, but `CourseDeletionModal`, `GroupActivityDeletionModal`, `GroupActivityEndingModal`, `MicroLearningEndingModal`, `MicroLearningDeletionModal`, `PracticeQuizDeletionModal` do **not**. Extract this into a tiny separate PR — it is uncontroversial and mergeable today.
- **F15 — Generated GraphQL artifacts** (`ops.ts`, `ops.schema.json`, `public/*.json`, `schema.graphql`) conflict and must be regenerated (`pnpm --filter @klicker-uzh/graphql generate`) rather than merged by hand. Never hand-edit these.
- **F16 — No tests.** The repo now has a Playwright E2E suite (plus the legacy Cypress suite) covering manage flows. A destructive, data-deleting feature must not ship without an E2E test.
- **F17 — Required vs optional arg**: `deleteResponses: Boolean!` breaks the persisted-operation hashes (fine, they regenerate) but also every other caller. Making it optional with backend default `false` is the safer contract; the SCHEDULED quick-action path then needs no variable change at all.

### 2.6 Usefulness

The feature is genuinely valuable: today a lecturer who publishes a practice quiz or microlearning by mistake (wrong content, wrong course, too early) has no way back except deleting the whole activity (soft-delete, losing the activity itself) or leaving it live. "Unpublish + optional reset" is the natural fix, and the backend shape in this PR (status guard, ownership/permission guard, transactional reset via `getInitialInstanceResults`) is a solid semantic blueprint. The work is worth finishing — just not by rebasing this branch.

---

## 3. Recommended path to production (junior-executable plan)

**Overall approach: supersede, don't rebase.** Keep PR #4587 open as reference until the replacement PR is up, then close it with a link.

### Step 0 — Product decisions (ask Roland / team, 30 min)
Get explicit answers before writing code:
1. XP/points on response deletion: accept non-reverted XP (recommendation: yes, matches delete-flow precedent) → adjust modal wording accordingly (F8).
2. Should the UI offer "unpublish keeping responses" for published activities, or always delete (F9/F10)? If keeping is allowed, decide whether editing-while-responses-exist needs a guard.
3. Permission level for the destructive variant (F6): same as `deletePracticeQuiz` or `EXECUTE`?

### Step 1 — Split out the trivial fix (0.5 day)
New branch off `v3`: apply `fetchPolicy: 'network-only'` to the six modals listed in F14. Open as its own small PR. This clears the drive-by noise from the main feature PR.

### Step 2 — Backend re-implementation (1 day)
New branch off `v3` (e.g. `unpublish-published-activities`). In `packages/graphql/src/services/practiceQuizzes.ts` and `microLearning.ts`, extend the **current** `unpublishPracticeQuiz` / `unpublishMicroLearning`:
1. Widen the status guard to `{ in: [PUBLISHED, SCHEDULED] }`, keep `isDeleted: false` on **both** (the PR forgot it for practice quizzes; the field exists on both models in `quiz.prisma`).
2. Keep all existing Hatchet cleanup (publication task; completion task for microlearnings) — it must run for the PUBLISHED path too (F2).
3. Add `deleteResponses?: boolean` (optional, default false — F17). When `status === PUBLISHED && deleteResponses`:
   - Collect all instance ids from the included stacks.
   - `questionResponse.deleteMany` / `questionResponseDetail.deleteMany` with `elementInstanceId: { in: ids }` (batched — F3).
   - Per-instance `update` only for `results` / `anonymousResults` reset via `getInitialInstanceResults(instance.elementData)` (exported from `@klicker-uzh/util`, already used in `services/elements.ts:344`).
   - Wrap in `$transaction(..., { timeout: 60000 })`, mirroring `deletePracticeQuiz`.
   - Order the status flip to DRAFT **before** the wipe inside the transaction if feasible, to shrink the F5 race window.
4. In `packages/graphql/src/schema/mutation.ts`: add the `deleteResponses` arg to both mutations; keep `withPermission(..., <level from Step 0.3>)`.
5. Regenerate: update the two `.graphql` ops (`MUnpublishPracticeQuiz.graphql`, `MUnpublishMicroLearning.graphql`), then `pnpm --filter @klicker-uzh/graphql generate` (F15).

### Step 3 — Frontend re-implementation (1 day)
In the **current** activities UI (not the deleted files):
1. `apps/frontend-manage/src/components/activities/overview/PracticeQuizActions.tsx` and `MicrolearningActions.tsx`: add `unpublishPracticeQuiz` / the microlearning equivalent to the `[PublicationStatus.Published]` action lists.
2. In `usePracticeQuizActions.ts` / `useMicroLearningActions.ts`: for published activities, route the action to open a new confirmation modal instead of firing the mutation directly (keep the direct-fire behavior for SCHEDULED).
3. New `PracticeQuizUnpublishModal` / `MicroLearningUnpublishModal` (pattern: copy `PracticeQuizDeletionModal`, keep `GetPracticeQuizSummary` with `fetchPolicy: 'network-only'`): title/message from the PR's i18n strings (fixed per F8/F13); if Step 0.2 allows keeping responses, add the explicit keep-vs-delete choice (F10); reuse `ConfirmationItem` checkboxes for the destructive path; on success: toast + Apollo cache update / `GetSingleCourseDocument` refetch for both activity types (F12); on `null` result: error toast (F4).
4. i18n: add `unpublishPracticeQuizMessage` / `unpublishMicroLearningMessage` to `packages/i18n/messages/{en,de}.ts`. Do **not** rename `unpublishMicrolearning` (F13).
5. Add `data-cy` attributes following the existing naming in the action hooks.

### Step 4 — Tests (0.5–1 day)
1. Playwright E2E (see `.agents/skills/klicker-playwright-e2e`): lecturer publishes a practice quiz → student (`testuser1`/`abcdabcd`, course "Testkurs") answers → lecturer unpublishes with deletion → assert status back to draft, summary counts zero, student no longer sees the quiz. Repeat the access-revocation assertion for a microlearning.
2. Manual check of F9 (unpublish keeping responses → edit → republish) if that path is enabled.

### Step 5 — Verification and PR (0.5 day)
1. `pnpm run check:all` and the affected Playwright spec locally.
2. `agent-browser` run against the local dev environment (delegated login, credentials in CLAUDE.md) with before/after screenshots of: published state with the new action, the confirmation modal, post-unpublish draft state. Attach to the PR description.
3. Draft PR to `v3`, conventional-commit title (e.g. `enhance(apps/frontend-manage): allow unpublishing published practice quizzes and microlearnings`), description covering the Step 0 decisions and their rationale. Then close #4587 with a link to the successor.

**Total estimate: 3.5–4.5 days** for a junior, including review cycles.

---

## 4. Evidence index

| Claim | Evidence |
| --- | --- |
| Branch conflicts, files deleted on v3 | `git merge-tree $(git merge-base origin/v3 origin/unpublish-activities) ...` → modify/delete conflicts on `MicroLearningElement.tsx`, `PracticeQuizElement.tsx`, `UnpublishMicroLearningButton.tsx`; content conflicts in both services, `mutation.ts`, generated artifacts, i18n |
| 25 commits touched the two service files since the merge-base | `git log origin/unpublish-activities..origin/v3 -- packages/graphql/src/services/{practiceQuizzes,microLearning}.ts \| wc -l` → 25 |
| v3 unpublish handles Hatchet tasks | `v3:packages/graphql/src/services/practiceQuizzes.ts:591` ff. (`scheduledPublicationTaskId`), `microLearning.ts` (`scheduledCompletionTaskId` too) |
| v3 auth via permission layer, EXECUTE | `v3:packages/graphql/src/schema/mutation.ts:3285`, `:3300` (`withPermission(..., DB.PermissionLevel.EXECUTE, ...)`) |
| Delete flow soft-deletes when responses exist, 60s transaction timeout | `v3:packages/graphql/src/services/practiceQuizzes.ts:632` ff. (`isDeleted: true`, `{ timeout: 60000 }`) |
| XP/leaderboard written as separate aggregates | `v3:packages/graphql/src/services/stacks.ts:2546` (xp increment), `:2564` (`leaderboardEntry.upsert`) |
| Responses written synchronously (race window) | `v3:packages/graphql/src/services/stacks.ts:3164` (`respondToElementStack`) |
| Old i18n key still in active use on v3 | `v3:apps/frontend-manage/src/components/activities/actions/useMicroLearningActions.ts:197` |
| Unpublish gated to SCHEDULED in current UI | `v3:apps/frontend-manage/src/components/activities/overview/PracticeQuizActions.tsx` status→action map |
| network-only partially upstreamed | grep on v3: present in `LiveQuizDeletionModal`, `CancelLiveQuizModal`; absent in the six other modals |
| `getInitialInstanceResults` available on v3 | exported from `@klicker-uzh/util`, used in `v3:packages/graphql/src/services/elements.ts:344` |
