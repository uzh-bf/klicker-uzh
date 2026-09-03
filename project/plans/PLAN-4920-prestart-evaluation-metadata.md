# PR 4920: pre-start evaluation metadata

## Goal

Show the LiveQuiz name, publication status, and course name on a valid signed
evaluation embed before the quiz starts, using the existing unavailable-state
notification.

## Non-goals

- Do not expose ElementInstance content, choices, explanations, feedback, or
  result data before publication.
- Do not change evaluation behavior after publication or ending.
- Do not add UI strings, schema fields, persisted operations, seeds, or
  database changes.

## Design

- Domain: `LiveQuiz` activity metadata is safe to display; `ElementInstance`
  snapshots and evaluation results remain unavailable while the activity has a
  non-published `PublicationStatus`.
- Layers: change only `packages/graphql` service behavior and its focused
  service test. The existing `frontend-manage` query and
  `EvaluationUnavailableNotification` already render the returned metadata.
- Auth: the public embed path still requires the existing HMAC over the
  LiveQuiz namespace and id. Invalid or absent credentials continue to return
  `null`; authenticated no-HMAC reads keep their existing READ permission
  check.
- Payload boundary: for a valid HMAC and a DRAFT or SCHEDULED LiveQuiz, return
  activity/course/status metadata with `results: []`. Do not compute or return
  block or element evaluation data.
- Gamification: no impact. Leaderboards, points, and XP are unchanged.
- Async: no impact. Publication scheduling and Hatchet workers are unchanged.
- UI/i18n: no component or translation changes; the existing unavailable state
  is populated by the newly available metadata.
- Fixtures: use the existing seeded draft LiveQuiz in the GraphQL service test
  and the existing local Calendar Live Quiz 2 for browser verification.

## Slices

1. Change the existing draft-HMAC regression to require safe metadata and an
   empty result list.
2. Confirm the test fails against the current status-filtered query.
3. Load the LiveQuiz before status filtering, validate the HMAC, and suppress
   all evaluation results for signed non-published requests.
4. Run the focused GraphQL test/check and repeat the signed browser flow before
   starting the quiz.

## Progress

- 2026-08-26: Reproduced the missing metadata on Calendar Live Quiz 2 and
  captured the pre-fix screenshot.
- 2026-08-26: Traced the null payload to the HMAC-only PUBLISHED/ENDED Prisma
  filter in `getLiveQuizEvaluation`; confirmed the frontend needs no change.
- 2026-08-26: Added the metadata-only HMAC regression and confirmed it fails
  against the previous status-filtered lookup (`null` instead of metadata).
- 2026-08-26: Updated the service to validate the HMAC and return early with
  `results: []` for non-published signed requests.
- 2026-08-26: Focused GraphQL evaluation suite passes (4/4), GraphQL package
  check and build pass, and the signed browser view shows the Draft activity,
  course, and status metadata while retaining the unavailable notice.
