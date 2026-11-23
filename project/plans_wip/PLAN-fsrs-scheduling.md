# FSRS-7 scheduling for spaced-repetition practice

## Goal

Replace SM-2 with FSRS-7 for ordering spaced-repetition practice quizzes and
the course practice pool, as decided in
[ADR 0059](../../docs/adr/0059-fsrs-7-orders-spaced-repetition-practice.md).

## Non-goals

- No change to grading, points, XP or leaderboards.
- No change to sequential practice quizzes or microlearnings.
- No removal of the SM-2 fields or function yet (later cleanup PR).
- No fitting of FSRS weights in the app; the default FSRS-7 weights are used.

## Design answers

- **Domain vocabulary:** the scheduled unit is a `QuestionResponse`, one per
  `Participant` x `ElementInstance`; ordering applies to `ElementStack`s of a
  `PracticeQuiz` with `orderType = SPACED_REPETITION` and the course practice
  pool.
- **Layer footprint:** `packages/prisma` (three nullable `QuestionResponse`
  fields, migration, analytics sync), `packages/graphql` (`lib/fsrs.ts` for
  the algorithm, `lib/spacedRepetition.ts` for rating mapping, state updates
  and ordering, `services/stacks.ts` write paths, `ts-fsrs` dependency),
  `docs/adr`. No GraphQL schema, frontend or i18n change.
- **Auth:** unchanged; existing participant answer and quiz endpoints.
- **Gamification/async:** none.
- **Rating mapping and ordering:** as decided in ADR 0059.
- **Test evidence:** unit tests for `lib/fsrs.ts` and
  `lib/spacedRepetition.ts`, graphql typecheck, browser check of a
  spaced-repetition practice quiz in the dev stack.

## Slices

1. Schema fields, FSRS module, write paths, ordering, tests, ADR (this PR).
2. One-time backfill that replays stored answers of existing responses through
   FSRS-7, with a dry run and a report of incomplete histories (separate PR).
   It replays all stored answers, including those given after slice 1 is
   deployed, and overwrites any FSRS state already set.
3. Later: remove the SM-2 fields and function.

## Open questions

- **Repeat missed elements within a session:** the order is computed once
  when the practice quiz or pool loads, and the frontend steps through that
  fixed list. A stack answered wrongly therefore only comes back after a
  reload, where it is placed first because its predicted recall drops right
  after a lapse (FSRS-7 models short-term memory). Anki instead repeats lapses
  within the session. Doing so here would need a frontend change, such as
  moving the stack further back in the current list or refetching the order
  after each stack. To be decided with the supervisor; out of scope for slice 1.

## Progress

- **2026-11-19:** Slice 1 implemented; migration, dependency install and test
  run pending in the dev container.
- **2026-11-23:** Migration created and dependency installed; graphql typecheck
  and unit tests pass in the dev container. Slice 1 committed in four commits
  (schema, FSRS module, integration, docs). Browser check of a
  spaced-repetition practice quiz still pending.
