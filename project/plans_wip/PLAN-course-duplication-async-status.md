# Course duplication: async job status

## Goal

Move course duplication from a single long-running frontend request to a durable
job/status flow: the manage frontend starts duplication, receives a job id,
stores that id locally for reload recovery, and polls GraphQL until the backend
reports success or failure.

## Non-goals

- Do not rewrite the underlying copy algorithm in this slice.
- Do not copy participants, groups, responses, or leaderboard state.
- Do not remove the existing synchronous `createCourse(sourceCourseId: ...)`
  compatibility path.

## Design answers

- **Domain vocabulary:** `Course` duplication creates a copied course plus new
  activity instances that still share the source `Element` rows. New concept:
  `CourseDuplicationStatus`, a short-lived backend job status.
- **Layer footprint:** GraphQL services/schema/ops, Hatchet task registration,
  manage frontend provider/modal/header, i18n, docs. No Prisma schema migration:
  status is short-lived and stored in Redis with a TTL.
- **Auth:** start mutation requires `asUserFullAccess` and ADMIN permission on
  the source course. Status polling is `asUser` and returns only jobs owned by
  the current user.
- **Gamification impact:** unchanged; copy semantics remain the existing course
  duplication semantics.
- **Async impact:** one Hatchet task processes the existing duplication logic and
  writes `PENDING/RUNNING/COMPLETED/FAILED` status to Redis.
- **UI surface:** `frontend-manage` course overview. LocalStorage remembers job
  ids after reload; backend status remains source of truth.
- **Test level:** generated GraphQL ops, package checks for GraphQL/manage/types,
  targeted browser verification of start, polling, success/failure/reload states.

## Slice list

1. Add Redis status helpers and a Hatchet handler around `duplicateCourse`.
2. Add GraphQL mutation/query/types and client operations.
3. Update the manage duplication provider to start jobs and poll ids, including
   localStorage recovery.
4. Update docs and PR screenshots/description after verification.

## Progress log

- 2026-08-20: Started implementation plan after switching from in-memory status
  to job-id polling.
