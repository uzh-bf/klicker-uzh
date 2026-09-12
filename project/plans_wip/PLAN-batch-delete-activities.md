# Activity batch deletion

## Goal

Extend lecturer activity batch operations so selected draft and scheduled
activities can be permanently deleted together with one explicit confirmation.

## Non-goals

- Do not make published, ended, graded, or template activities selectable for
  batch operations.
- Do not change the deletion lifecycle of any activity type.
- Do not weaken the existing `ADMIN` / `OWNER` permission requirement or the
  assessment-live-quiz course-admin rule.
- Do not make the operation atomic across activities; completed deletions stay
  deleted if a later activity fails.
- Do not change gamification, scoring, scheduling, or Prisma data models.

## Product primitive boundary

| Primitive | Disposition | Contract delta | Consumers | Evidence |
| --- | --- | --- | --- | --- |
| Permanent activity deletion | Reuse | None; use the existing type-specific deletion mutations and their hard/soft deletion behavior. | Manage activity overview | `packages/graphql/src/schema/mutation.ts:deleteLiveQuiz`, `deletePracticeQuiz`, `deleteMicroLearning`, `deleteGroupActivity` |
| Activity batch operations | Extend | Add deletion as a destructive, mutually exclusive action for the already-selectable draft/scheduled set. Report partial success because each activity remains an independent deletion. | Manage batch modal, tutorial, Playwright flow | `apps/frontend-manage/src/components/activities/overview/ActivityBatchOperationsModal.tsx:ActivityBatchOperationsModal` |

## Design

- **Domain vocabulary:** the existing `LiveQuiz`, `PracticeQuiz`,
  `MicroLearning`, and `GroupActivity` activity models in
  `PublicationStatus.DRAFT` or `PublicationStatus.SCHEDULED`.
- **Layer footprint:** `apps/frontend-manage` batch modal and new batch-deletion
  UI/execution helpers; bilingual `packages/i18n` messages; the existing
  activity-batch Playwright flow; and the user-facing activity batch-operations
  tutorial. Reuse tracked generated GraphQL deletion documents, so there is no
  schema, operation, codegen, Prisma, shared-type, or Hatchet-worker change.
- **Auth:** every deletion continues through its existing
  `asUserFullAccess` (and catalyst where applicable) field plus per-object
  `PermissionLevel.ADMIN` check. The UI marks only `isManager` activities as
  eligible and additionally requires `isActivityReviewer` for assessment live
  quizzes; the server remains authoritative if permissions change.
- **Gamification:** none. The selectable activity states have no completed
  participant lifecycle to preserve, and existing deletion services own their
  cleanup semantics.
- **Async:** no new async contract. Existing deletion services retain ownership
  of scheduled Hatchet-task cancellation for scheduled activities.
- **UI:** add a destructive deletion card with a stable `data-cy` hook. Selecting
  it clears and disables edit actions. The apply button opens a second,
  destructive confirmation step that names the eligible count and requires an
  irreversible-action acknowledgement. Completion shows success, partial, or
  failure feedback and refreshes the list.
- **Failure semantics:** delete a bounded number of activities concurrently to
  avoid a request waterfall without flooding the API. Keep one outcome per
  activity; a rejected or nullable mutation is a failure while successful
  earlier deletions remain committed.
- **Test level:** extend the existing serial activity-batch Playwright flow at
  its end so fixture deletion does not affect earlier assertions. Verify action
  exclusivity, destructive confirmation, and disappearance of all four
  activity types. Run frontend and Playwright checks, focused formatting,
  browser verification in English and German, `check:all`, and the production
  build as time permits.
- **Seeds/fixtures:** reuse the four secondary batch-operation activities at the
  end of `X-review.spec.ts`; no seed-path changes.

## Slices

1. Add the batch-deletion action, eligibility derivation, execution helper, and
   confirmation flow.
2. Add English/German messages and update the user-facing tutorial.
3. Extend the existing Playwright activity-batch flow.
4. Format, typecheck, run focused tests, and verify the real UI in both locales.

## Progress

- 2026-08-23: Traced the existing batch update flow, all four deletion
  mutations/services, selection status boundary, per-object permissions, and
  existing Playwright coverage. Settled on composing the existing deletion
  mutations rather than introducing a duplicate batch deletion API.
- 2026-08-23: Added the destructive action card, mutually exclusive action
  state, per-activity eligibility, bounded deletion executor, irreversible
  confirmation step, bilingual copy, and user-facing tutorial update.
- 2026-08-23: Added a Playwright scenario covering all four activity types,
  action exclusivity, the destructive confirmation gate, successful feedback,
  and list removal. The spec typecheck and Chromium test discovery pass.
- 2026-08-23: `pnpm run check:all` and the full production build pass. The
  first runs exposed only sandbox restrictions on the shared `uv` cache and a
  Turbopack-internal port; equivalent reruns with those restrictions lifted
  completed successfully.
- 2026-08-23: Browser verification passed in an isolated, seeded Devrouter
  environment. Checked the activity deletion card and irreversible confirmation
  in English and German without deleting activities, then archived and restored
  a synthetic element through its three-dot menu. Captured the English states
  for the draft PR and confirmed that the browser reported no page errors.
- 2026-08-23: Independent review found no authorization or security issues. It
  prompted explicit uncertain-delivery outcomes and unconditional list
  reconciliation so a committed deletion with a lost response is not treated
  as an authoritative failure. A follow-up review found no blocking issues.
