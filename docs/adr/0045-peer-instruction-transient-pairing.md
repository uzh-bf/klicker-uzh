# Peer Instruction uses transient response pairing

- **Status:** Accepted — 2026-08-30

## Context

Peer Instruction repeats a frozen LiveQuiz block so participants can answer,
discuss, revise, and compare. The revised answers must not create another
scoring opportunity, while a meaningful comparison requires matching each
participant's initial and revised answer per question. Persisting those matches
would create participant-level learning history inside the aggregate LiveQuiz
mode and would duplicate the separate correlated-export response boundary.

## Decision

Peer Instruction is a formative LiveQuiz capability, independent of
gamification and excluded from assessment-enabled LiveQuizzes. It reuses the
same frozen ElementBlock and permits one revised pedagogical run per block
execution. The initial run keeps its existing points and XP behavior; the
revised run never affects points, XP, achievements, leaderboards, grades, or
access.

The complete sequence is a public, standard LiveQuiz capability. It requires
neither Catalyst entitlement nor a private Catalyst service. A future
AI-assisted debrief, semantic free-text clustering, or cross-session learning
analytics capability may compose with Peer Instruction through a separate
public contract, but the public sequence remains fully functional without it.

Response identity used to match the two runs is quiz- and execution-scoped and
exists only in transient LiveQuiz state. Completed comparisons persist only
per-question aggregate snapshots and counts for the paired cohort, plus the
unpaired revised-response count. They never persist participant-level pairs,
raw response histories, or personal mastery state.

Authenticated and temporary participants reuse their existing transient quiz
identity. Fully anonymous participants receive a server-issued, unguessable
pairing token; the server never accepts a client-selected pairing identity.
Pairing tokens and response maps have a non-renewing 24-hour limit and are
removed earlier when the next block activates, the lecturer cancels or resets
the quiz, finalization succeeds, or Peer Instruction is abandoned.

One canonical server comparison projection serves lecturer, participant, and
projected surfaces with role-specific filtering. Lecturer evaluation retains
the full aggregate view. Participant and projected aggregates are suppressed
below three paired responses per question, and raw peer responses remain
lecturer-only unless a later moderation-capable reveal flow explicitly permits
them. The server derives the viewer role from the authenticated session,
participant session, or projected-view HMAC; a requested role and a public
evaluation HMAC never grant lecturer-equivalent Peer Instruction data.

Finalization writes all per-instance comparison snapshots and the
comparison-ready lifecycle state in one database transaction. A failed
transaction retains no partial comparison. The existing initial response path
remains the only scoring path; revised responses use a separate processor that
cannot call points, XP, achievement, leaderboard, grade, access, or durable
response-history helpers.

## Consequences

- ElementBlock owns the authoring preference and revised-run lifecycle;
  ElementInstance owns the retained comparison aggregate.
- The response pipeline needs an idempotent revised-response namespace and
  transient pairing for authenticated, temporary, and anonymous participants.
- Cancellation retains the initial run and discards partial comparison data. A
  technical failure may replace the revised attempt once, without creating a
  second pedagogical cycle or scoring path.
- Spontaneous invocation requires the minimum transient pairing input to be
  collected for every standard, non-assessment block until the invocation
  window closes. It does not create a durable participant history.
- The correlated LiveQuiz export work is not reused for persistence because it
  deliberately stores durable response rows under a different identity and
  privacy contract.
- Catalyst cannot own lifecycle, transient pairing, comparison persistence,
  authorization, or the teaching surfaces. Optional private computation must
  remain a replaceable consumer of the public aggregate contract.
