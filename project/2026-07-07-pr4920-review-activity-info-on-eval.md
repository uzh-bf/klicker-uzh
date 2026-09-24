# Review: PR #4920 — Activity metadata on evaluation screen (`activity-info-on-eval`)

Date: 2026-07-07 · Reviewer: Claude (requested by @rschlaefli) · Target: `v3`

## TL;DR

The feature is genuinely useful (context + status on embedded/inactive evaluation screens instead of a bare "not available" notice). This document records the original review findings; the current branch has since merged `origin/v3`, fixed the three blocker findings, corrected the local response-api and Hatchet runtime path, and re-verified the evaluation flow locally. Fresh CI and review confirmation remain pending.

## What the PR does (scope)

- Shows activity name, status, course name, element name/type and a link to activity details inside `EvaluationUnavailableNotification` when an evaluation (or a single scheduled element) has no data yet — mainly for the PowerPoint-embedded view.
- Adds a `BlockStatusIndicator` dot (Scheduled / Active / Executed) with tooltips incl. last-refresh and execution timestamps.
- Extends the `ActivityEvaluation` GraphQL type with `status` and `courseName`; makes `displayName` non-nullable.
- Backend: `getLiveQuizEvaluation` keeps scheduled blocks for status metadata, returns metadata-only payloads for valid HMAC requests before publication, strips elements from non-executed blocks after publication, and replaces the active block in place with cached results.
- Unrelated: adds `NEXT_PUBLIC_IS_ASSESSMENT: "true"` to the assessment frontend Helm ConfigMap.

## Current branch status

The blocker descriptions below are historical findings from the initial review. On the current branch:

- Valid HMAC evaluation access returns activity metadata in every lifecycle state, but non-published quizzes return `results: []`; after publication, non-executed blocks return metadata without element content.
- The active block is replaced in place, so it is returned once rather than appended a second time.
- A completed null evaluation stops polling and renders `EvaluationUnavailableNotification` instead of an indefinite loader.
- The local end-to-end path submitted a participant response, processed it through the response worker, and displayed one participant in the manage evaluation.

The current implementation is covered by regression tests in `packages/graphql/test/liveQuizEvaluation.test.ts` and by the local browser verification recorded in the task handoff.

## What is good (keep)

- The product idea and the UI direction are right; lecturers embedding evaluations in PowerPoint currently get zero context when a question has not started. sjschlapbach's reviews also did not question the feature itself, only the implementation.
- i18n keys added for both `en` and `de`; the `shared.<STATUS>.statusLabel` lookup used for the activity status does exist (`packages/i18n/messages/en.ts:21` ff.) and resolves correctly.
- Making `displayName` non-nullable in `ActivityEvaluation` is safe — `displayName` is `String` (non-null) on all quiz models in `packages/prisma/src/prisma/schema/quiz.prisma`.

---

## Findings

### 🔴 Blocker 1 — Security: unreleased questions and sample solutions are exposed via the API (historical; fixed)

`getLiveQuizEvaluation` on the branch removes both server-side filters:

- quiz-level: `status: { in: [PUBLISHED, ENDED] }` — removed → **DRAFT quizzes are now queryable**;
- block-level: `where: { status: EXECUTED }` — removed → **SCHEDULED (not yet started) blocks are returned with full element data**.

The evaluation payload built by `computeStackEvaluation` → `computeInstanceEvaluation` includes per instance: question `content`, `explanation`, and for choice questions each choice with its **`correct` flag and `feedback`** (`packages/graphql/src/services/stacks.ts:3269-3275`, `:3742-3747`). This endpoint is reachable by **anyone holding the HMAC embed link** (no login — see `liveQuizEvaluation` resolver, `packages/graphql/src/schema/query.ts:668` ff.). PPT slide decks containing the embed URL are routinely shared with students, so this leaks upcoming questions *and their solutions* to students via the browser network tab, before the block is ever started. The frontend "hides" scheduled content only visually (`ElementEvaluation.tsx` renders `EvaluationUnavailableNotification` next to the data — and per the reviewer's screenshot doesn't even fully hide it).

**Historical required fix:** keep returning scheduled/active blocks for the status indicator, but strip instance content for non-`EXECUTED` blocks and re-add the quiz-level status filter. The current branch preserves that data boundary while accommodating the later pre-start metadata requirement: it validates the HMAC for non-published quizzes and returns only activity metadata with `results: []`.

### 🔴 Blocker 2 — Stability: blocks rendered twice (historical; fixed)

Because `liveQuiz.blocks` was unfiltered, the active block appeared in `blocks` and was appended again as `activeBlockWithResults`. Codex flagged this as P1 and sjschlapbach reproduced it: each completed block showed twice, once with and once without results. The current implementation replaces the matching active block in place and the regression test verifies unique stack IDs.

### 🔴 Blocker 3 — UX regression: infinite spinner instead of "unavailable" notice (historical; fixed)

`apps/frontend-manage/src/pages/quizzes/[id]/evaluation.tsx` now keeps the loader only while the query is loading, stops polling after a completed null response, and renders `EvaluationUnavailableNotification` for missing or unauthorized evaluations.

### 🟠 Major 4 — Broken/hardcoded production link (fixed in current branch)

The original implementation linked to a hardcoded host and activity type. The current component uses a relative link, adds `rel="noopener noreferrer"`, and receives the activity type as a prop.

### 🟠 Major 5 — `lastRefetchTime` doesn't update (confirmed in manual review)

The `useEffect` keys on the `data` object; with `pollInterval: 5000` Apollo returns a referentially equal result when nothing changed, so the "last data refresh" tooltip timestamp goes stale — exactly what sjschlapbach observed. Either use `onCompleted` on the query, key the effect on `networkStatus`/`dataState`, or drop the timestamp feature and show only the status label. Also initializing the state with `new Date()` before any data arrived is misleading (open reviewer question).

### 🟠 Major 6 — Helm/env flag is scope creep and (partially) ineffective

`NEXT_PUBLIC_IS_ASSESSMENT: "true"` in `cm-frontend-assessment.yaml` is unrelated to this feature. More importantly, `NEXT_PUBLIC_*` vars are inlined into the client bundle at **build time**; the PWA `Dockerfile` has no `NEXT_PUBLIC_IS_ASSESSMENT` build ARG, so a runtime ConfigMap value only affects SSR code paths — client-side checks (`apps/frontend-pwa/src/components/common/Header.tsx:64` etc.) will not see it. It is also missing from `turbo.json` `globalEnv` (required per repo conventions). → Split this into its own PR that wires the flag through the Dockerfile build args + CI build + `globalEnv`, or drop it here.

### 🟡 Minor (mostly already raised by reviewers, still unresolved)

1. `text-xs` metadata block barely readable → `text-sm` (reviewer suggestion pending).
2. Raw GraphQL enum shown for element type → use `t('shared.' + elementType + '.typeLabel')` (reviewer suggestion pending; verify the key exists for all element types).
3. New i18n keys duplicate existing ones (`shared.generic.course`, `shared.generic.activity`, `manage.general.elementType`, …) → reuse instead (reviewer comment pending).
4. Tooltip shows `expiresAt` labelled "Element executed at" — semantically that is the answer deadline; `closedAt` is the execution end. Pick the right field or rename the label.
5. `toLocaleString()` renders in browser locale, not course/user locale — acceptable, but consider `next-intl` date formatting for consistency.
6. Stray comment edit in `liveQuizzes.ts` (`...completed quizzes,` trailing comma) and unrelated whitespace churn in the big i18n doc strings — harmless, but revert to keep the diff clean.
7. Layout: reviewer screenshots show the scheduled-element notification rendered *in addition to* (and overlapping) the chart/footer. The notification must replace the evaluation body, not overlay it (`ElementEvaluation.tsx` renders it as a sibling inside `relative` without hiding the content behind it).

### CI state at the original review point (2026-07-07)

`build`/`lint`/`check`/`test`/CodeQL/GitGuardian green; **`cypress-run-cloud` and one SonarCloud gate failing**; branch `BEHIND` (197 commits), merge state requires update. The latest push has triggered a fresh CI run; consult the PR checks for current results.

---

## Remaining steps to production readiness (ordered, for execution)

Work on the `activity-info-on-eval` branch. After each step: commit with a conventional message and run `pnpm run check` + affected-package tests.

1. **Update the branch.** **Complete.** The branch merged `origin/v3`, passed the repository pre-commit checks and production build, and was re-verified in the local runtime with a disposable seeded local account.
2. **Fix Blocker 1 (server-side data exposure).** **Complete.** In `getLiveQuizEvaluation` (`packages/graphql/src/services/liveQuizzes.ts`):
   - Validate the HMAC before returning any non-published quiz data, then return only activity metadata with `results: []`.
   - Keep all blocks in the query for status metadata, but before calling `computeStackEvaluation`, replace the `elements` of every non-`EXECUTED`, non-active block with `[]` (or map scheduled blocks to metadata-only stacks). Verify with a raw GraphQL query (GraphiQL at `http://localhost:3000/api/graphql`, and via the HMAC URL) that a scheduled block returns **no** `content`, `explanation`, `correct`, or `feedback` fields.
3. **Fix Blocker 2 (duplicate blocks).** **Complete.** The active block is replaced in place and the regression test verifies that each block appears exactly once with results.
4. **Fix Blocker 3 (infinite loader).** **Complete.** After loading finishes, a null evaluation renders `EvaluationUnavailableNotification` and polling stops.
5. **Fix the metadata notice (Major 4 + minors).** Relative link + `noopener noreferrer`, activity type as prop, `text-sm`, translated element type, reuse existing i18n keys, correct executed-at field, fix the overlay so the notification *replaces* the element body for scheduled elements.
6. **Fix `lastRefetchTime` (Major 5)** via `onCompleted`/`networkStatus`, or cut the timestamp from the tooltip.
7. **Split out the Helm flag (Major 6).** `git revert`/drop the `cm-frontend-assessment.yaml` hunk; open a separate PR that adds the build ARG to `apps/frontend-pwa/Dockerfile`, the CI image build args, and `turbo.json` `globalEnv`.
8. **Regenerate GraphQL artifacts.** After any change in `packages/graphql/src/`: `pnpm --filter @klicker-uzh/graphql generate`, commit generated files (`ops.ts`, `ops.schema.json`, `public/*`).
9. **Verify in the browser (mandatory per repo policy — `agent-browser` skill, delegated login).** Capture before/after screenshots of: (a) evaluation of a quiz with a scheduled, an active, and an executed block; (b) the HMAC/embedded view; (c) the empty-evaluation notice; (d) wrong-id URL (no infinite spinner). Attach the screenshots to the PR.
10. **Green CI.** Investigate `cypress-run-cloud` (likely staleness — re-run after the v3 merge) and the SonarCloud gate; fix or justify. Run the relevant Cypress/Playwright evaluation specs locally.
11. **Address every open review thread** from sjschlapbach, CodeRabbit, and Codex explicitly (fix or reply with reasoning), then re-request review from @sjschlapbach. Update the PR description with what changed since the last review (use the MR-description workflow).
12. **Final pass:** security review of the diff (focus: resolver auth + payload shaping), `pnpm run check:all`, then mark ready. Do not merge without explicit approval.

## Suggested test evidence to attach to the PR

- GraphQL response snippet (HMAC path) for a scheduled block proving no solution fields are present.
- Screenshot: status dots + tooltips for all three states.
- Screenshot: metadata notice on empty evaluation (desktop + the PPT-embed viewport ~1280×720).
- Screenshot: each block listed once after closing a block.

## References

- PR: https://github.com/uzh-bf/klicker-uzh/pull/4920 (reviews of 2025-09-17/18 by CodeRabbit, Codex, @sjschlapbach — both `CHANGES_REQUESTED` reviews contain reproduction screenshots)
- Key files: `packages/graphql/src/services/liveQuizzes.ts` (`getLiveQuizEvaluation`), `packages/graphql/src/services/stacks.ts:3722` (`computeInstanceEvaluation`), `packages/graphql/src/schema/query.ts:668` (resolver auth), `apps/frontend-manage/src/components/evaluation/*`, `apps/frontend-manage/src/pages/quizzes/[id]/evaluation.tsx`
