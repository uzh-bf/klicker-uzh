---
type: Design
title: Formative Free-Text Evaluation
description: Approved target design for semantic retries, rubric outcomes, durable evaluation, consent, fallback, and solution reveal in Practice Quizzes.
timestamp: '2026-08-19'
tags:
  - backend
  - frontend
  - ai
  - grading
---

# Formative Free-Text Evaluation

> **Backend contract, orchestration, lecturer authoring, participant retries, and
> aggregate analytics are implemented.** Implementation is tracked in
> [`PLAN-free-text-semantic-retries.md`](../project/plans_wip/PLAN-free-text-semantic-retries.md).

Semantic retry is an opt-in capability for `FREE_TEXT` elements in formative
Practice Quizzes. It does not change MicroLearning, Live Quiz, Group Activity,
Case Study, or assessment behavior. The public/private ownership decision is
[ADR 0042](./adr/0042-persist-formative-free-text-evaluation-in-public.md), which
specializes the Catalyst boundary established by
[ADR 0006](./adr/0006-public-catalyst-capability-floor.md).

## Authoring contract

A free-text element becomes a **semantic-retry element** only when its options have
a complete versioned configuration:

- a question language
- a rubric schema
- an attempt limit from 1 through 10, defaulting to 2 total attempts
- optional lecturer-defined outcome bands
- accepted exact answers used only by the deterministic fallback
- a rich reference solution
- whether solution reveal is enabled, defaulting to enabled

The question language is explicit and is snapshotted with the published
`ElementInstance`. The course language and participant locale can initialize the
authoring field but do not override it, and the answer text is never used to infer
it.

The rubric JSON is compatible by field name and meaning with the
[`uzh-bf/agents` open-ended Practice Quiz schema](https://github.com/uzh-bf/agents/blob/master/input/grading/practice_quiz_openended/grading_schema.json)
and its
[`Schema`, `Rubric`, and `AchievementLevel` models](https://github.com/uzh-bf/agents/blob/master/packages/evaluator/src/evaluator/models.py).
Required v1 fields are:

| Object            | Required fields                                             |
| ----------------- | ----------------------------------------------------------- |
| Schema            | `schema_version`, `name`, `description`, `rubrics`          |
| Rubric            | `id`, `name`, `description`, `weight`, `achievement_levels` |
| Achievement level | `name`, `description`, `normalized_score`                   |

Optional fields such as anchors, scale, interpolation, modalities, deterministic
caps, scoring policy, components, adversarial checks, evidence rules, and binary
checklists are preserved when the core fields are edited. Public v1 does not
interpret them. The broader bachelor-thesis schema is a compatibility example, not
the v1 editor surface.

In Manage, an entitled lecturer can enable semantic retries and edit the core
fields above. Enabling the feature copies legacy `solutions` into accepted exact
answers, leaves the reference solution empty for the lecturer to author, and forces
sample-solution support while the semantic configuration is active.
Unknown advanced fields remain visible in a collapsed read-only JSON view and
survive core-field edits. Evaluator availability is displayed independently from
entitlement: a temporary service outage does not prevent authoring, while loss of
entitlement makes an existing configuration read-only.

Outcome bands are aggregate-score ranges with lecturer-defined labels. Every band
maps to one stable behavioral category: `CORRECT`, `PARTIAL`, or `INCORRECT`. With
no custom bands, the localized defaults are correct at 75–100, partially correct
at 50–below 75, and not yet correct below 50.

## Participant state

The initial Practice Quiz action still submits the whole `ElementStack`. A
semantic-retry element then has its own server-owned practice cycle:

1. Submitting changed answer text creates one attempt with status `PENDING`.
2. An evaluated attempt receives a rubric result, aggregate score, outcome band,
   and stable correctness category.
3. A partial or incorrect result reopens only that element while attempts remain.
   The previous text is the editable starting value and all prior attempts remain
   in history.
4. Re-evaluating unchanged text after an evaluator failure updates the same attempt
   and consumes no additional answer attempt.
5. Correct, solution revealed, evaluated attempts exhausted, or an unavailable
   result at the answer limit makes the cycle terminal. **Practice again** creates
   a new cycle; points and XP eligibility remains governed independently by the
   existing reset windows.

The attempt limit applies per participant, element, and practice cycle. Distinct
submitted answers consume attempts; re-evaluating unchanged text does not. A value
of 1 disables answer retry without disabling semantic feedback.

The PWA restores this state from the server after reload and polls only while the
current evaluation is pending. Neighboring elements stay locked after the initial
stack submission; **Try again** reopens only the semantic free-text input and
prefills the previous answer. Mutations and query responses are reconciled by cycle,
attempt, evaluation revision, and terminal status so an older response cannot roll
the UI back after **Practice again**.

Question-specific generated feedback uses the question's configured language. The
versioned external-AI disclosure uses the participant app's selected interface
language and appears when the participant starts a Practice Quiz containing semantic
rubric feedback. A saved decision for the current version prevents repeat prompts.

## Availability and deterministic fallback

Entitlement, service availability, and participant consent are different gates:

- only an entitled lecturer can enable or change semantic-retry configuration
- the current activity owner's entitlement is checked again when an attempt runs
- the evaluator reports availability separately, with a sanitized reason and
  retryability
- the participant must accept the current version of the semantic-evaluation
  disclosure before an affected Practice Quiz starts and before any answer is sent
  externally

A missing or declined disclosure keeps the answer in public KlickerUZH. Changing
the disclosure version requires a new decision. Enforcement is server-side.

When semantic evaluation is unavailable, normalized exact matching can confirm a
correct answer. A non-match or missing accepted answers is inconclusive, never
incorrect. Low-confidence or `needs_review` evaluator output follows the same
unavailable path. A retryable failure exposes **Retry evaluation**; solution reveal
remains available when configured.

## Persisted evaluation and engine contract

Public KlickerUZH persists the answer before scheduling work. A Hatchet durable
workflow uses the public attempt ID for idempotency and per-attempt concurrency.
The public row, not Hatchet metadata, is the status clients query.
Every participant-visible attempt or cycle transition increments the cycle's
server-issued `stateVersion`; clients accept only a strictly newer version for
the same cycle, so a late response cannot roll back revealed feedback.

The evaluator request contains only the versioned contract, attempt ID, question,
question language, answer, reference solution, and full rubric schema. Catalyst
returns per-rubric `RubricAssessment` values and optional `FeedbackProposal` values,
including evaluator/model versions. Public code validates the result and computes
the weighted aggregate and outcome. Prompts, chain-of-thought, provider traces, and
raw internal errors are not persisted.

The public GraphQL surface consists of `freeTextPracticeState`,
`submitFreeTextAttempt`, `retryFreeTextEvaluation`,
`revealFreeTextSolution`, `startFreeTextPracticeCycle`, and
`decideSemanticEvaluationConsent`. Initial stack submission accepts a stable
`clientSubmissionId` per semantic free-text response. `semanticFreeTextCapability`
reports lecturer entitlement separately from evaluator availability.

The evaluator adapter is configured with:

- `CATALYST_FORMATIVE_EVALUATOR_URL`
- `CATALYST_FORMATIVE_EVALUATOR_TOKEN` (optional bearer token)
- `CATALYST_FORMATIVE_EVALUATOR_HEALTH_URL` (optional availability probe)
- `CATALYST_FORMATIVE_EVALUATOR_TIMEOUT_MS` (optional; 30 seconds by default)
- `SEMANTIC_EVALUATION_DISCLOSURE_VERSION`

The evaluator and optional health-check URLs are single allowlisted
destinations. They must use HTTPS and must not contain credentials or a
fragment. Redirects are rejected so the bearer token cannot cross origins.
Local HTTP is accepted only outside production for loopback or
`host.docker.internal` when
`CATALYST_FORMATIVE_EVALUATOR_ALLOW_INSECURE_LOCAL=true` (or under
`NODE_ENV=test`).

When advanced evaluation is unavailable, the deterministic exact matcher can
only confirm accepted answers as correct. Non-matches remain unavailable,
consume a distinct-answer attempt, and allow another answer until the
lecturer-configured limit is exhausted. A retryable evaluator failure can
instead re-evaluate the same attempt without consuming another answer attempt.

## Feedback and solution boundary

Before a terminal action, the participant receives only:

- the generic outcome label and stable visual category
- attempts used and remaining
- **Try again**, **Retry evaluation**, or **Show solution**, as applicable

Detailed material is fetched only after a correct answer or solution reveal. It
contains the reference solution, existing explanation, readable per-rubric level
and rationale, and peer answers. Raw rubric JSON is never shown. Solution reveal is
terminal; exhaustion reveals automatically when enabled. If reveal is disabled,
exhaustion ends with the final generic outcome only. Peer answers remain hidden
until the cycle is terminal.

Each attempt displays only its own points/XP delta. Cycle totals are not repeated in
the attempt history.

## Deterministic Playwright boundary

Playwright starts a dependency-free evaluator stub when `NODE_ENV=test`. Host-only
runs bind it to loopback. Profile-backed runs bind a Docker-facing listener protected
by a synthetic bearer token so the application container can reach it. The service
validates the outbound v1 request and returns synthetic
correct, partial, incorrect, uncertain, or failing results selected by explicit
fixture markers. It refuses to start outside the test environment. The application,
GraphQL API, database, Hatchet scheduling, and participant UI remain real; only the
private Catalyst HTTP boundary is replaced.

The local test-origin wrapper sets the stub URL and disclosure version. The profile
runtime also uses a health probe, so the evaluator is reported unavailable whenever
the authenticated test stub is absent. Set
`PLAYWRIGHT_SEMANTIC_EVALUATOR_STUB=false` to run a test environment without the
stub.

Because the evaluator URL belongs to the application and worker environment, this
focused spec cannot target an already-running devrouter container whose environment
does not contain the synthetic boundary. For local execution, start the host test
runtime with `pnpm run dev:playwright` and run the spec through
`E2E_MODE=host bash util/run-host-e2e.sh ...`; the host runner fails explicitly for
unsupported devcontainer targets. CI launches all of these processes in one test
environment and is the merge gate for the complete browser journey.

## Rewards and lecturer analytics

Within one practice cycle, only improvement beyond the already rewarded best result
can add points or XP. Starting another cycle cannot bypass `resetTimeDays` or the XP
award window.

Lecturer analytics expose aggregate first and best outcomes, attempts used, success
rate, solution-reveal rate, and unavailable-evaluation count. Individual evaluator
rationales, confidence values, internal errors, and a human review queue are outside
v1. These aggregates are attached only to semantically configured free-text
instances; the existing free-text answer and word-cloud evaluation remains
unchanged.

## Compatibility

Existing source elements and published instances retain legacy exact-match behavior.
On explicit upgrade, old `solutions` become accepted exact answers. They are not
copied into the reference solution. Publishing snapshots the complete semantic
configuration, so later edits do not alter an active quiz.
