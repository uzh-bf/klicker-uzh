# 42. Persist formative free-text evaluation in public KlickerUZH

- **Status:** Accepted — 2026-08-18

## Context

Free-text questions in Practice Quizzes are currently evaluated synchronously by
trimmed, case-insensitive exact matching. The participant receives the existing
explanation, peer answers, and sample solutions immediately, and browser storage
locks the whole submitted stack. This cannot represent a semantic evaluation that
is pending, unavailable, uncertain, retried without changing the answer, or resumed
after a reload.

The semantic evaluator is a private Catalyst capability under
[ADR 0006](./0006-public-catalyst-capability-floor.md). An LLM call can outlive a
GraphQL request and can fail independently of entitlement, participant consent, or
the rest of the Practice Quiz submission. Hatchet can retry work durably, but a
Hatchet run ID is an orchestration handle rather than participant-facing product
state.

The feature also changes scoring semantics. A participant may improve one answer
over several attempts, while points and XP must reward only the positive improvement
inside one practice cycle and must still respect their existing reset windows.

## Decision

Public KlickerUZH owns the complete formative-evaluation state machine:

- the versioned rubric-schema snapshot on `ElementInstance`
- question language, outcome bands, accepted exact answers, reference solution,
  solution-reveal policy, and attempt limit
- participant consent and the current disclosure version
- practice cycles, answer attempts, evaluation status, sanitized availability
  reason, terminal state, and solution-reveal state
- aggregate score, correctness category, rewards, and lecturer analytics

An answer submission first creates a public attempt row. A Hatchet durable workflow
then sends a versioned request to Catalyst and persists the terminal result against
that attempt. The public attempt ID is the idempotency and concurrency key. Hatchet
workflow IDs remain internal diagnostics; clients query the public attempt state.
The worker failure hook must make a still-pending attempt explicitly unavailable.

Catalyst performs computation only. It receives the question, answer, question
language, reference solution, and the complete rubric schema. It returns the
`RubricAssessment` and optional `FeedbackProposal` structures used by
[`uzh-bf/agents`](https://github.com/uzh-bf/agents/tree/master/packages/evaluator),
plus evaluator and model versions. It does not read or write KlickerUZH tables,
choose product outcome bands, award points, render copy, or decide whether a
solution may be shown. Public code validates the response, computes the weighted
aggregate, maps it to an outcome band and stable correctness category, and applies
rewards transactionally.

Semantic evaluation requires all three gates independently: the owning lecturer's
Catalyst entitlement, evaluator availability, and the participant's acceptance of
the current capability-level disclosure. Low-confidence or `needs_review` output is
unavailable, not a correctness outcome. Re-evaluating the same answer does not
create another answer attempt.

When semantic evaluation cannot run, the public deterministic fallback is
asymmetric exact matching. A normalized match to an accepted exact answer confirms
`CORRECT`; a non-match is inconclusive and remains unavailable. Public v1 therefore
does not invent partial rubric scores without the semantic evaluator. This is the
concrete free-text interpretation of ADR 0006's degraded formative-evaluation
default.

The capability is opt-in and snapshot-based. Existing free-text elements and
published instances retain their current `solutions` and exact-match behavior.
Upgrading an element writes the new semantic-retry configuration; old solution
strings become accepted exact answers, but are never inferred to be the rich
reference solution.

## Considered options

**Call Catalyst synchronously from `respondToElementStack`.** Rejected because model
latency and transient failures would hold or fail the entire stack submission and
could not be resumed reliably after navigation.

**Expose Hatchet workflow status directly.** Rejected because Hatchet is an internal
orchestrator, not the canonical authorization, disclosure, reward, or participant
state boundary.

**Let Catalyst persist attempts and rewards.** Rejected because it would couple the
private engine to the public database and violate ADR 0006's ownership boundary.

**Treat every exact non-match as incorrect.** Rejected because wording variants can
be semantically correct; an unavailable semantic evaluator must not turn an
inconclusive deterministic check into authoritative negative feedback.

## Consequences

- The public schema needs durable practice-cycle and attempt records plus versioned
  participant consent.
- Practice Quiz free-text submission becomes eventually consistent and the PWA must
  poll public attempt state while it is pending.
- The general Hatchet worker becomes required for semantic results, while exact-match
  fallback and honest unavailability remain usable without Catalyst.
- Retry and reward transitions need transactional idempotency tests; duplicate jobs
  must not duplicate response details, points, XP, or analytics.
- Solution details and peer answers must be gated server-side, not merely hidden in
  the PWA.
- Assessment, MicroLearning, Live Quiz, Case Study, and lecturer review workflows are
  outside this decision.
