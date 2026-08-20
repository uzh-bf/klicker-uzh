# Course deletion: optional draft-activity cleanup

## Goal

Extend course deletion with a backwards-compatible option that also hard-deletes
associated draft activities.

## Non-goals

- Do not change deletion behavior for scheduled, published, ended, graded, or
  template activities.
- Do not make assessment courses deletable.
- Do not change activity ownership, sharing, gamification, or scheduling rules.

## Design

- **Domain vocabulary:** `Course` and its `LiveQuiz`, `PracticeQuiz`,
  `MicroLearning`, and `GroupActivity` relations. The new option applies to
  `PublicationStatus.DRAFT`. Course deletion already cascades to every linked
  asynchronous activity; linked live quizzes are the only activities currently
  disconnected and retained, so they are the only observable behavior change.
- **Layer footprint:** `packages/graphql` service, schema, operation, generated
  artifacts, and focused service test; `apps/frontend-manage` deletion modal;
  `packages/i18n` English and German messages; the existing course Playwright
  flow; `docs/domain-model.md` and its log entry. No Prisma migration, shared
  type, seed, or Hatchet worker change.
- **Auth:** keep the existing `asUser` role gate and course-level
  `PermissionLevel.ADMIN` check. The service continues to reject assessment
  courses.
- **Gamification:** none. Draft live quizzes have no participant results.
- **Async:** none. Only `DRAFT` live quizzes are newly deleted, so no scheduled
  task cancellation is required.
- **UI:** add an unchecked checkbox to the lecturer course-deletion modal when
  one or more draft live quizzes are linked. Add bilingual copy and a stable
  `data-cy` hook. Pass the value through the generated mutation document.
- **Test level:** add focused GraphQL service coverage proving the default
  retains draft live quizzes and the opt-in deletes only drafts, including the
  permission-recomputation boundaries; extend the existing Playwright
  course-deletion flow to select the checkbox and verify removal. Run codegen,
  targeted GraphQL tests, `check:all`, build, and browser checks in English and
  German.
- **Seeds/fixtures:** reuse the existing draft live quiz created by the course
  deletion Playwright scenario; no new seed path is needed.

## Slices

1. Extend the service and GraphQL contract; add focused service coverage.
2. Add the deletion-modal checkbox, i18n, and e2e assertion.
3. Update the wiki and generated artifacts.
4. Verify, review, and publish a draft PR targeting `v3`.

## Progress

- 2026-08-20: Traced the current service, schema, modal, Prisma relations, and
  existing Playwright deletion flow; design settled on an opt-in draft-live-quiz
  cleanup with unchanged default behavior.
- 2026-08-20: Implemented the service and GraphQL contract, focused service
  test, lecturer checkbox with bilingual copy, Playwright flow, and wiki
  updates.
- 2026-08-20: Preserved the legacy persisted operations and hashes alongside
  newly named operations so rolling frontend/backend deployments remain
  compatible. Extracted the canonical transaction-aware live-quiz hard-delete
  primitive, guarded the course boundary, and added post-commit cache
  invalidation.
- 2026-08-20: Verified the unchecked and selected modal states in English and
  German in the real local app. Evidence is stored in
  `project/plans_wip/assets/course-deletion-draft-activities/`.
- 2026-08-20: Passed the focused GraphQL service suite (3/3), GraphQL and
  frontend typechecks, Playwright test discovery/typecheck, `check:all`,
  formatting, `git diff --check`, and the production build (22/22 packages).
- 2026-08-20: Completed strict maintainability and independent integrated
  reviews; all findings were addressed and the final review reported no
  blockers. The full data-dependent Playwright scenario remains for CI. The
  skill-referenced wiki validator could not run because its script is absent
  from this environment; repository formatting and consistency checks passed.
