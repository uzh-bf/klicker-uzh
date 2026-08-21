# 26. Personal elements are a separate participant-owned model

## Status

Accepted — 2026-08-21

## Context

Students will generate their own flashcards (later questions) in the course
chatbot and practice them with spaced repetition. The existing content model
is lecturer-owned end to end: `Element.ownerId` and `ElementInstance.ownerId`
are required foreign keys to `User`, `PracticeQuiz` requires a lecturer owner
and a course, and the per-participant scheduling state lives on
`QuestionResponse`, which requires an `ElementInstance` and a `Participation`.
Reusing that pipeline for student content means either nullable owners across
three models or a hidden system-owned practice quiz per participant and
course, and in both cases every lecturer-facing course query, the
`UserActivities` view, course duplication, and the performance tables need a
personal-content exclusion.

## Decision

Participant-owned content lives in its own `PersonalElement` table with its
own spaced-repetition fields, keyed by participant and course, and is never
written to `Element`, `ElementInstance`, `ElementStack`, `PracticeQuiz`, or
`QuestionResponse`. It reuses the element content shape, the shared
`Flashcard` component, and the `updateSpacedRepetition` function, but runs in
its own practice surface ("My cards") with its own respond mutation.
Unverified content therefore cannot reach another student's practice path or
any lecturer analytics by construction ("gate before pool"). A later lecturer
verification copies content into a real `Element`; it does not re-parent the
row.

## Consequences

- Personal elements earn no points and no XP; the reward pipeline is tied to
  lecturer-owned instances and stays untouched.
- Interleaving personal cards into the pooled course practice queue is a
  deliberate later step, not a side effect of the schema.
- Question types beyond flashcards need either a runner extension or an
  adapter that presents personal elements as synthetic stacks; that choice is
  made when those types are added.
- Personal elements are excluded from research-export and Learning Analytics
  queries, processing, and exports until their governance is decided in the
  learning-analytics track. This boundary applies to consumers; the existing
  Prisma schema synchronization into Analytics is unchanged.
