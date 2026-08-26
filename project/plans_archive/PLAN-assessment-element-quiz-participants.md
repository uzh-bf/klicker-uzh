# Element point corrections for quiz participants

## Goal

Add a fifth audience option for assessment point corrections that target one
`ElementInstance`: all `Participant`s who submitted at least one genuine
response anywhere in the containing `LiveQuiz`.

The correction still changes points only for the selected instance. A
qualifying participant who did not answer that instance receives a
correction-only response through the existing upsert path.

## Non-goals

- Do not add a fifth audience option to whole-quiz point corrections; that flow
  keeps its existing four options.
- Do not change the meaning of the existing `PARTICIPATING` audience: for an
  instance correction it continues to mean participants who answered that
  instance, and for a quiz correction it continues to mean participants who
  answered at least one instance in the quiz.
- Do not count correction-only responses as quiz participation.
- Do not change point calculations, XP, assessment authorization, audit-log
  delivery, or course participation rules.

## Design decision

Add a dedicated persisted `PointCorrectionType` value,
`PARTICIPATING_QUIZ`, and support it only in the instance-correction service.
This preserves the semantic audience in correction history and avoids sending
a computed participant-id snapshot from the browser.

Alternatives considered:

1. Resolve quiz participants in the frontend and submit them as `MULTIPLE`.
   This avoids an enum migration but records the wrong correction meaning,
   duplicates server-owned eligibility logic, and adds unnecessary data
   transfer.
2. Split the shared GraphQL audience enum into separate instance and quiz
   input types. This makes the schema encode the UI distinction, but it is a
   broader and potentially breaking refactor for one additive option.

## Design answers

- **Domain vocabulary:** the target is a published `ElementInstance` in an
  assessment-enabled `LiveQuiz`. The audience is the distinct set of
  `Participant`s with at least one `LiveQuizResponse` in the containing quiz's
  current block executions where `correctionOnly` is `false`.
- **Layer footprint:** add one value and one additive PostgreSQL enum migration
  in `packages/prisma`; handle it in the existing instance-correction service
  in `packages/graphql`; regenerate the GraphQL schema, operation types, and
  persisted-query artifacts; update the lecturer flow in
  `apps/frontend-manage`; add English and German strings in `packages/i18n`;
  update focused GraphQL tests and the relevant wiki/skill guidance.
- **Auth:** unchanged. The mutation remains restricted to
  `asUserFullAccess`, and the service continues to require an OWNER or ADMIN
  permission on the assessment course containing the selected instance.
- **Gamification impact:** the existing correction machinery updates
  assessment base, correctness, and bonus points and their leaderboard deltas.
  XP is not changed.
- **Async impact:** reuse the existing batched audit-log task calls; no new
  Hatchet task or worker behavior.
- **UI surface:** in `frontend-manage`, the audience select displays five
  options for `scopeType === 'instance'` and four for `scopeType === 'quiz'`.
  Changing back to quiz scope clears `PARTICIPATING_QUIZ` so it cannot be
  submitted invisibly. The summary and previous-correction history render an
  explicit quiz-participant label. All new copy is available in English and
  German. To distinguish the two participation audiences without changing
  their behavior, the instance selector and summary use the parallel English
  labels "All participating users (this element)" and "All participating users
  (entire quiz)". German uses "Alle teilnehmenden Nutzer (dieses Element)" and
  "Alle teilnehmenden Nutzer (gesamtes Quiz)". The whole-quiz selector keeps
  the unqualified "All participating users" label because only one
  participation audience is available there.
- **Validation and errors:** the instance mutation accepts the new enum value;
  the quiz mutation rejects it by returning `null`, matching the existing
  mutation failure contract. `SINGLE` and `MULTIPLE` argument validation is
  unchanged.
- **Test level and evidence:** add focused GraphQL coverage proving that an
  instance answerer and a participant who answered only another quiz element
  are corrected, while a non-participant and a participant represented only by
  correction-only responses are excluded. Verify the persisted type and
  applied corrections. Run targeted package tests, codegen cleanliness,
  `pnpm run check:all`, and `pnpm run build`. In the real manage app, capture
  browser evidence that instance scope offers five audiences and quiz scope
  offers four.
- **Seeds/fixtures:** reuse the existing assessment course and point-correction
  fixtures; no seed changes are required.

## Implementation slices

1. Add the persisted audience value and migration, then regenerate Prisma and
   GraphQL artifacts.
2. Implement quiz-participant resolution for a selected instance and add
   focused service tests, including exclusion of correction-only participation.
3. Make the audience selector scope-aware and update validation, summary,
   history, and English/German copy.
4. Update the engineering wiki and relevant skill guidance, run mechanical and
   browser verification, review the full branch, and publish a draft PR against
   `v3`.

## Detailed implementation plan

### Task 1: Persist the new correction audience

**Files:**

- Modify `packages/prisma/src/prisma/schema/response.prisma`.
- Create
  `packages/prisma/src/prisma/schema/migrations/20260814083940_point_correction_participating_quiz/migration.sql`.
- Modify `packages/types/src/index.ts`.

**Interface produced:** `PointCorrectionType.PARTICIPATING_QUIZ` is available
from both the Prisma client and `@klicker-uzh/types`.

- [x] Add `PARTICIPATING_QUIZ` next to `PARTICIPATING` in both source enums.
- [x] Run the raw Prisma migration wrapper inside the managed DevPod with the
      migration name `point_correction_participating_quiz`. The migration must
      contain only this additive statement:

  ```sql
  ALTER TYPE "PointCorrectionType" ADD VALUE 'PARTICIPATING_QUIZ';
  ```

- [x] Run Prisma sync and generation, including the mechanically synchronized
      Analytics schema enum.

### Task 2: Specify the service behavior with failing tests

**Files:**

- Modify `packages/graphql/test/instancePointCorrections.test.ts`.
- Modify `packages/graphql/test/liveQuizPointCorrections.test.ts`.

**Interfaces consumed:** the enum value from Task 1 and the existing
`seedLiveQuizWithResponses()` fixture.

- [x] Add an instance-correction test that first creates a correction-only
      response for `participant3`, then calls:

  ```ts
  await correctAssessmentPointsInstance(
    {
      instanceId: instanceId2,
      reason: 'Test Reason',
      studentReason: 'Student Test Reason',
      awardCorrectnessPoints: true,
      scope: PointCorrectionType.PARTICIPATING_QUIZ,
    },
    userOneCtx
  )
  ```

  Assert that the persisted correction has the new type, `participant1` keeps
  its response with an applied correction, `participant2` receives a new
  correction-only response on `instanceId2`, `participant3` receives none, and
  the correction has exactly two applied records.
- [x] Add a whole-quiz test asserting that passing
      `PARTICIPATING_QUIZ` to `correctAssessmentPointsLiveQuiz()` returns
      `null`.
- [x] Run both focused specs against the completed implementation and confirm
      they pass.

### Task 3: Resolve quiz participants once and apply the instance correction

**Files:**

- Modify `packages/graphql/src/services/courses.ts`.

**Interface produced:** a private helper returns the current-execution response
map for participants with at least one genuine response in a `LiveQuiz`:

```ts
type ParticipantResponseMap = Record<
  string,
  Record<number, DB.LiveQuizResponse>
>

async function getLiveQuizParticipantResponseMap(
  liveQuizId: string,
  prisma: DB.PrismaClient
): Promise<ParticipantResponseMap | null>
```

- [x] Extract the existing `PARTICIPATING` whole-quiz response-map query and
      current-execution/correction-only eligibility filter into the helper,
      without changing existing behavior.
- [x] Reuse the helper in the whole-quiz branch.
- [x] Add an instance branch for `PARTICIPATING_QUIZ` that creates one
      `PointCorrection`, then calls `upsertResponseAppliedCorrection()` for
      each eligible participant with that participant's existing selected
      instance response, if present.
- [x] Add an early `null` return for `PARTICIPATING_QUIZ` in the whole-quiz
      service so the API enforces four valid whole-quiz audiences.
- [x] Re-run both focused GraphQL specs and confirm they pass.

### Task 4: Expose five instance choices and four quiz choices

**Files:**

- Modify
  `apps/frontend-manage/src/components/courses/pointCorrections/PointCorrectionsAudienceStep.tsx`.
- Modify
  `apps/frontend-manage/src/components/courses/pointCorrections/PointCorrectionsScopeStep.tsx`.
- Modify `apps/frontend-manage/src/components/courses/PointCorrectionsModal.tsx`.
- Modify
  `apps/frontend-manage/src/components/courses/pointCorrections/PointCorrectionsSummaryStep.tsx`.
- Modify
  `apps/frontend-manage/src/components/courses/pointCorrections/PreviousPointCorrectionList.tsx`.
- Modify `packages/i18n/messages/en.ts`.
- Modify `packages/i18n/messages/de.ts`.

**Behavior produced:** the existing audience select contains this additional
item only for `scopeType === 'instance'`:

```ts
{
  value: PointCorrectionType.ParticipatingQuiz,
  label: t('manage.pointCorrections.audienceOptionParticipatingQuiz'),
}
```

- [x] Read `scopeType` in the audience step and insert the new item between the
      element-participant and whole-course audiences only for instance scope.
- [x] When the user changes back to quiz scope, clear a selected
      `ParticipatingQuiz` value in the scope step.
- [x] Add the generated enum member to Formik/Yup's allowed values while
      relying on the scope reset and server guard to reject the invalid
      combination.
- [x] Render the new value in the summary and correction history, reusing the
      existing explicit "at least one answer in this quiz" history wording.
- [x] Add matching English and German audience/summary copy and update the
      audience description so the two instance participation options are
      unambiguous.

### Task 5: Regenerate the API contract and document the behavior

**Files:**

- Regenerate `packages/graphql/src/ops.ts`.
- Regenerate `packages/graphql/src/ops.schema.json`.
- Regenerate `packages/graphql/src/public/schema.graphql`.
- Regenerate `packages/graphql/src/public/client.json`.
- Regenerate `packages/graphql/src/public/server.json`.
- Modify `docs/domain-model.md`.
- Create `docs/log/2026-08-14-element-point-correction-quiz-audience.md`.
- Modify `.agents/skills/klicker-feature-design/SKILL.md`.

- [x] Run `pnpm --filter @klicker-uzh/graphql generate` and verify the only
      contract change is the additive enum member plus mechanically updated
      operation artifacts.
- [x] Add a concise assessment point-correction section to the domain model,
      citing `response.prisma:PointCorrectionType` and
      `courses.ts:correctAssessmentPointsInstance`, and bump its timestamp.
- [x] Add the required wiki change-log file.
- [x] Add scope-dependent enum applicability to the feature-design checklist
      so future designs specify server validation and UI filtering together.
- [x] Format the wiki bundle; final validation is part of Task 6.

### Task 6: Verify, review, and publish

- [x] Run Prisma/GraphQL package checks and both focused point-correction
      specs. Run the memory-safe equivalents of `pnpm run check:all`; attempt
      the full production build and record the DevPod memory limitation.
- [x] Run `opengrep scan --config auto` and review findings against the changed
      files.
- [x] Use `npx agent-browser` against the managed `frontend-manage`
      route with delegated login. Capture screenshots showing five instance
      choices and four quiz choices, and check English and German copy.
- [x] Confirm codegen is reproducible and `git diff --check` is clean.
- [x] Review the complete branch against `origin/v3`, including staged-data
      hygiene and the draft PR body.
- [x] Prepare the conventional implementation commit and draft PR body against
      `v3`, including verification results and browser screenshots.

### Task 7: Qualify the two element participation labels

**Files:**

- Modify
  `apps/frontend-manage/src/components/courses/pointCorrections/PointCorrectionsAudienceStep.tsx`.
- Modify
  `apps/frontend-manage/src/components/courses/pointCorrections/PointCorrectionsSummaryStep.tsx`.
- Modify `packages/i18n/messages/en.ts`.
- Modify `packages/i18n/messages/de.ts`.
- Refresh
  `docs/images/2026-08-14-element-point-correction/element-audience-options.png`.
- Refresh
  `docs/images/2026-08-14-element-point-correction/quiz-audience-options.png`.

**Interface produced:** element corrections display scope-qualified labels in
the audience selector and summary, while quiz corrections retain the existing
unqualified participating-user label. Persisted enum values and mutation input
stay unchanged.

- [x] Add the English keys and exact values:

  ```ts
  audienceOptionParticipatingElement:
    'All participating users (this element)',
  audienceOptionParticipatingQuiz:
    'All participating users (entire quiz)',
  participantScopeParticipatingElement:
    'All participating users (this element)',
  participantScopeParticipatingQuiz:
    'All participating users (entire quiz)',
  ```

  Add the German equivalents:

  ```ts
  audienceOptionParticipatingElement:
    'Alle teilnehmenden Nutzer (dieses Element)',
  audienceOptionParticipatingQuiz:
    'Alle teilnehmenden Nutzer (gesamtes Quiz)',
  participantScopeParticipatingElement:
    'Alle teilnehmenden Nutzer (dieses Element)',
  participantScopeParticipatingQuiz:
    'Alle teilnehmenden Nutzer (gesamtes Quiz)',
  ```

- [x] Make the existing `PARTICIPATING` selector label scope-aware:

  ```tsx
  label:
    scopeField.value === 'instance'
      ? t(
          'manage.pointCorrections.audienceOptionParticipatingElement'
        )
      : t('manage.pointCorrections.audienceOptionParticipating'),
  ```

  Continue rendering `PARTICIPATING_QUIZ` only for instance scope, using the
  updated `audienceOptionParticipatingQuiz` translation.

- [x] Make the summary label for `PARTICIPATING` scope-aware:

  ```tsx
  [PointCorrectionType.Participating]:
    values.scopeType === 'instance'
      ? t(
          'manage.pointCorrections.participantScopeParticipatingElement'
        )
      : t('manage.pointCorrections.participantScopeParticipating'),
  ```

  Keep `PARTICIPATING_QUIZ` mapped to the updated
  `participantScopeParticipatingQuiz` translation.

- [x] Run
  `pnpm --filter @klicker-uzh/frontend-manage check` inside the managed
  DevPod. Expected result: exit 0 with TypeScript validation successful.
- [x] Use `npx agent-browser@0.32.2` with delegated login against the real
  Manage route. Verify English and German element scope show the two qualified
  labels, whole-quiz scope still shows the unqualified label, and refresh both
  existing screenshots.
- [x] Run Prettier/Biome checks for the changed files, `git diff --check`, and
  changed-file OpenGrep. Expected result: all format/type checks pass and no
  new actionable static-analysis findings.
- [x] Move this plan back to `project/plans_archive/` after implementation,
  browser verification, and final branch review; prepare the copy-only change
  for draft PR #5395.

## Progress

- **2026-08-14:** Traced the existing four correction audiences through the
  Prisma enum, GraphQL services and operations, lecturer modal, i18n, history,
  and service tests. Confirmed with the requester that quiz participation means
  at least one genuine response anywhere in the quiz, even when the selected
  instance was not answered. The requester approved the dedicated persisted
  audience design.
- **2026-08-14:** Added the persisted enum and migration, shared quiz-audience
  resolution, element-only service branch and quiz guard, scope-aware UI,
  English/German copy, focused tests, generated GraphQL artifacts, and wiki
  updates. Prisma, shared-types, GraphQL, and frontend-manage package checks
  pass; both new focused service tests pass.
- **2026-08-14:** Verified the real Manage flow with delegated local login.
  Element scope exposes five audiences, quiz scope exposes four, changing
  scope clears the element-only audience, and both English and German labels
  render correctly. Captured screenshots under
  `docs/images/2026-08-14-element-point-correction/`.
- **2026-08-14:** Completed verification with 33/33 workspace type/check tasks
  and 7/7 lint tasks at bounded concurrency, using Python 3.12 for Analytics.
  Both focused GraphQL tests pass after a clean database reset. OpenGrep found
  no issues in the changed TypeScript files. The full production build and an
  isolated `frontend-manage` build both completed type checking and reached
  webpack optimization before the DevPod terminated them with exit 137; CI is
  required for the final production-bundle signal.
- **2026-08-14:** An independent standards/spec review found no blocking,
  security, secret, PII, or behavioral issues. Applied its change-log heading
  and completed-plan archival cleanups; deliberately deferred broader service
  transaction and history-rendering refactors as out of scope.
- **2026-08-14:** The requester approved parallel scope-qualified labels for
  the two participation audiences shown for an element. This is a copy-only
  refinement; persisted enum values and correction eligibility stay unchanged.
- **2026-08-14:** Implemented the refined English and German labels and made
  the selector and confirmation summary scope-aware. The focused Manage check
  passes. Browser verification on the real seeded assessment page confirmed
  five qualified element audiences, four unchanged quiz audiences, and the
  German element-audience summary; both PR screenshots were refreshed.
- **2026-08-14:** Biome and Prettier checks pass, `git diff --check` is clean,
  and OpenGrep reports zero findings across the four changed TypeScript files.
