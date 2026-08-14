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
  German.
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

## Progress

- **2026-08-14:** Traced the existing four correction audiences through the
  Prisma enum, GraphQL services and operations, lecturer modal, i18n, history,
  and service tests. Confirmed with the requester that quiz participation means
  at least one genuine response anywhere in the quiz, even when the selected
  instance was not answered. The requester approved the dedicated persisted
  audience design.
