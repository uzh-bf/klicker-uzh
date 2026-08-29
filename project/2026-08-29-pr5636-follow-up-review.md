# Follow-up Review: PR #5636 - Course Duplication Date Guard

Reviewer: Codex
Scope: `origin/v3...feat/course-duplication-start-date-required` at the
remote date-validation follow-up (`f1804638e5e90eb1b670e4852f0cdb5951c87ab2`),
plus the working-tree changes prepared during this follow-up.

## Verdict

The course-duplication path is ready for another CI review after the fixes in
this follow-up. The date workflow now fails closed, preserves calendar-day
offsets across daylight-saving transitions, and keeps the derived end date
read-only. The asynchronous path has the expected persisted job status,
idempotency lock, Hatchet execution timeout, stale-job reconciliation, and
frontend polling across reloads.

Two backend lifecycle defects were found and fixed here: a malformed job with
missing arguments could remain pending while holding the source lock, and a
retry that observed a persisted `FAILED` job did not release that lock. The
heartbeat setup was also moved under the process-lock `try/finally`, so a
failed initial heartbeat cannot strand the process lock. The legacy
`createCourse(sourceCourseId: ...)` resolver now applies the same source-course
`ADMIN` check as the asynchronous entry point.

## Findings Fixed

### Date and form behavior

- Existing-course duplication starts with an empty start date and end date.
- The submit action remains disabled until a valid start date has been chosen.
- The end date is derived from the source course's calendar-day duration and
  is disabled/read-only in the form.
- Group-creation deadlines are shifted by their original calendar-day offset.
- Date deltas and the visible fixed-interval text use calendar dates rather
  than truncating UTC durations, so a winter-to-summer shift does not lose a
  day.
- Missing dates produce a dedicated localized validation message.
- Existing accessibility hardening is retained: native input labels point to
  their controls, and the date error text is referenced with
  `aria-describedby`.

### Authorization and error handling

- Both `startCourseDuplication` and the legacy duplication branch of
  `createCourse` require `ADMIN` access to the source course before invoking
  duplication.
- The frontend maps GraphQL `FORBIDDEN` responses to the dedicated access
  message instead of the generic failure message.
- The course settings error path uses `console.error`.

### Job lifecycle hardening

- A pending Redis job without stored arguments is marked `FAILED` and its
  source lock is released (with a release fallback if status persistence
  fails).
- Terminal jobs reconcile their source lock on both `COMPLETED` and `FAILED`
  states. The lock-value check prevents removing a newer job's lock.
- Heartbeat renewal and its interval are covered by the process-lock
  `try/finally`, ensuring process-lock cleanup on an initial heartbeat error.
- Local-storage hydration merges with the current in-memory list and
  deduplicates IDs, so a duplication started during initial mount cannot be
  overwritten before polling begins.
- If Redis cannot persist a terminal failure, the worker rethrows after
  best-effort lock cleanup so Hatchet retries the status transition instead of
  leaving a non-terminal job until stale reconciliation.

## Previous Review Audit

The earlier reviews' code-level findings are covered in the current `v3`
implementation and this branch:

- layered course/activity/element permission checks and the atomic transaction;
- rollback on partial activity or instance failure;
- copied direct permissions and audit entries;
- independent activity copies with shared underlying elements;
- no copied participants, groups, responses, or leaderboard results;
- Redis idempotency and persistent status polling with reload recovery;
- success notification with an action to open the new course;
- in-progress modal/dropdown affordances and localized date/duration text;
- source-owner administrative-access disclosure and past-end-date warning;
- associated labels, localized copy suffix, and redirect assertions in the
  Playwright flow;
- documentation in `docs/domain-model.md` and the lecturer course-management
  tutorial.

## Residual Risks / External Checks

These items need CI, staging, or product-owner confirmation rather than a
local code change:

1. The full authenticated Playwright flow and a large-course timing run could
   not be repeated locally. `pnpm playwright:host -- --print-env` stops before
   startup because the installed devrouter is 0.0.41, the repository requires
   0.0.42, and no router/network is active. CI should rerun the full shards
   after this push.
2. The asynchronous manage UI is the supported path for large courses. The
   backward-compatible `createCourse(sourceCourseId: ...)` API remains
   synchronous and could still be constrained by an external HTTP gateway
   timeout for callers that use it directly; it now has the correct
   authorization guard.
3. The 10-minute Prisma transaction and 30-minute Hatchet execution timeout
   should be measured against the largest realistic staging course. If the
   transaction approaches its limit, the next step is reducing the work inside
   the transaction or moving more work to a resumable workflow, not another
   frontend timeout increase.
4. GitGuardian findings previously reported on this branch were dev-only
   credentials inherited from `v3`; dashboard triage/ignore status is an
   external check and must be confirmed in the PR after CI reruns.
5. Native form controls versus the design-system components remain a visual
   consistency decision for maintainers. The controls are labeled and tested,
   but this review does not claim a design-system sign-off.
6. Product owners should retain the documented decisions that a non-owner
   duplicator grants the source owner `ADMIN` on the copy and that a copy may
   intentionally be created with an end date in the past.

## Verification

Passed locally:

- `pnpm run check`
- `pnpm --filter @klicker-uzh/graphql check`
- `pnpm --filter @klicker-uzh/frontend-manage check`
- `pnpm --filter @klicker-uzh/playwright check`
- `pnpm exec vitest run --configLoader runner test/courseDuplicationDates.test.ts`
  (6 tests)
- `pnpm --filter @klicker-uzh/frontend-manage build` (completed; existing
  next-intl, page-data, and service-worker warnings remain)
- Prettier check for the touched Playwright/docs files
- `git diff --check`

The full monorepo build was attempted. It reached the frontend builds but
failed in the unrelated `@klicker-uzh/chat` Turbopack build when the sandbox
denied a subprocess port bind (`Operation not permitted`). CI must still run
the normal pre-push build in its production environment.

- Browser screenshots and the full Playwright run were not completed because
  the devrouter
  startup failure above. The existing PR screenshots remain representative
  of the visible blank-date and derived-end-date states; no visual code change
  in this follow-up requires replacing them.
