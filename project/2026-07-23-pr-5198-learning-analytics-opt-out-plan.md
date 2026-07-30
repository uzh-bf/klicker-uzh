# Learning analytics opt-out milestone

## Identity

- Status: implementation and final re-review complete; production gates pending
- Branch: `codex/learning-analytics-opt-out-plan`
- Target: `analytics-stack-04-verification-privacy`
- Pull request: [#5198](https://github.com/uzh-bf/klicker-uzh/pull/5198)
- Change type: `feat`
- ADRs:
  - [ADR 0001](../docs/adr/0001-separate-course-and-participant-learning-analytics-controls.md)
  - [ADR 0002](../docs/adr/0002-deidentified-learning-analytics-output.md)
  - [ADR 0003](../docs/adr/0003-purge-pre-control-learning-analytics-results.md)

This is the fifth and final review milestone for the complete learning
analytics production stack. Earlier experimental slice PRs are consolidated
here; implementation commits remain separate inside this branch where they
help review, but no additional PR is created per commit or sub-slice.

## Portfolio

The complete LA work is intentionally limited to five ordered PRs:

| Milestone | Pull request | Purpose |
| --- | --- | --- |
| 1 | [#5199](https://github.com/uzh-bf/klicker-uzh/pull/5199) | Bring the original chat-analytics work onto `v3` |
| 2 | [#5073](https://github.com/uzh-bf/klicker-uzh/pull/5073) | Establish the analytics Phase A baseline |
| 3 | [#5230](https://github.com/uzh-bf/klicker-uzh/pull/5230) | Add incremental processing and the native Python Hatchet runtime |
| 4 | [#5231](https://github.com/uzh-bf/klicker-uzh/pull/5231) | Complete runtime verification and privacy hardening |
| 5 | [#5198](https://github.com/uzh-bf/klicker-uzh/pull/5198) | Add course and participant LA controls, eligibility enforcement, de-identified output, cleanup, and legal text |

Draft PRs #5242 through #5246 were temporary review slices. Their code is
preserved in this milestone and they are superseded by #5198.

## Goal

Make dedicated learning analytics optional and production-safe:

- lecturers decide whether a course offers LA;
- participants independently decide whether their activity may contribute;
- every computation, write, read, dashboard, and export applies the same
  eligibility boundary;
- lecturer output is de-identified and suppressed below an effective sample of
  five;
- normal course use, chat, feedback, grading, gamification, and research remain
  independent of LA choice;
- the existing native Python Hatchet worker performs recomputation and
  reconciliation without introducing another control plane or runtime.

## Locked product rules

### Course and participant controls

- LA is disabled by default for new and existing courses.
- A course administrator may enable, disable, and re-enable it.
- Disabling immediately hides LA and deletes dedicated course results while
  preserving operational data and participant choices.
- An undecided or excluded participant does not contribute to LA.
- Inclusion starts prospectively at the current disclosure acknowledgement.
- Opt-out immediately removes participant-level derived results and excludes
  all of that participant's activity from later calculations.
- Already-de-identified aggregates may remain until their normal
  recalculation, as recorded in ADR 0001.
- A material disclosure change suspends inclusion until a new choice; an
  editorial change does not.

### Chat boundary

- The chatbot disclaimer gates chat access. Without acceptance, the participant
  cannot use chat.
- The disclaimer is therefore not a second analytics consent.
- If chat activity exists, the shared LA eligibility rule alone decides whether
  it contributes to analytics.
- Disclaimer acceptance and decline counts may remain product metrics, but
  their rows are computed only within the LA-eligible population.

### Lecturer output

- LA output never exposes participant IDs, usernames, email addresses, stable
  pseudonyms, free text, exact student timestamps, item-level sequences, rare
  attributes, or cross-report links.
- Report-local labels such as `Student 1` are regenerated per report/export.
- Row output and every filtered breakdown require effective sample size
  `N >= 5` after eligibility and coverage filters.
- Each retained aggregate or chart point carries its own effective sample size.
- Lecturers do not see opt-out, undecided, or participant-choice status.
- Exports default to complete coverage; partial coverage is explicit.

## Eligibility contract

Activity contributes only when all four conditions hold:

1. `Course.isLearningAnalyticsEnabled` is true.
2. `Participation.learningAnalyticsStatus` is `INCLUDED`.
3. `Participation.learningAnalyticsDisclosureVersion` is current.
4. The activity timestamp is on or after
   `Participation.learningAnalyticsIncludedFrom`.

The current participation snapshot serves frequent checks.
`LearningAnalyticsChoiceEvent` records the minimal append-only audit history.
Course toggles and analytics writes use the same transaction-scoped advisory
lock so a disable or choice transition cannot race a stale write.

## Implementation boundary

### State and authorization

- Prisma and the analytics schema mirror contain the course flag,
  participation status, timestamps, disclosure version, choice history, and
  effective participant counts.
- Course toggles require course `ADMIN` permission.
- A participant can read and change only their own course choice.
- The rollout gate fails closed until production prerequisites are approved.

### Computation and native Hatchet

- The SQLAlchemy analytics runtime resolves eligible courses and
  participations centrally.
- Attempt-sensitive metrics are rebuilt from eligible
  `QuestionResponseDetail` rows; cumulative response counters are not reused
  across eligibility boundaries.
- Free-text responses never enter LA.
- Every save path rechecks eligibility under the course advisory lock.
- Chat, live-quiz, chat-outcome, topic, course, participant, activity, and
  platform computations use the same boundary.
- Participant-choice changes invalidate the course and chat watermarks.
- The existing native Python Hatchet DAG performs incremental reconciliation,
  finalization, cancellation, and guarded full rebuilds. The ended-course
  scanner requeues stale finalized courses.

### Reads, output, and cleanup

- GraphQL LA reads fail closed for rollout-disabled or course-disabled states
  and reapply current participant eligibility to participant-derived data.
- The server de-identifies row output and applies post-filter suppression.
- Course disable cleanup covers every dedicated LA model, including chat,
  topic, outcome, and live-quiz results.
- Participant opt-out removes participant-scoped derived rows immediately.
- The one-time global cleanup is dry-run by default, aggregate-only,
  idempotent, transactionally serialized, and protected by a replay-blocking
  receipt.

### UI and legal text

- Lecturer creation/settings expose the deliberate default-off control and
  disable warning.
- Participants receive a neutral include/exclude choice, can decide later, and
  can change it later without losing course access.
- German and English disclosures distinguish LA from normal course use,
  chatbot access, and research.
- Legal and product text describes de-identification accurately and prohibits
  re-identification attempts.

## Verification

Required before refreshing the draft PR:

- analytics Ruff and complete unit suite;
- database-backed analytics eligibility, reconciliation, and race tests;
- Prisma schema mirror and migration status;
- focused utility, GraphQL, Hatchet, Manage, PWA, and Docs checks;
- GraphQL generation after schema/operation changes;
- affected production builds and, disk permitting, the repository-wide gates;
- browser proof for lecturer control, participant choice, suppression/export,
  and legal text in English and German at desktop and mobile sizes;
- final code, privacy/security, and maintainability review.

Required before production enablement:

- recorded UZH data-protection/legal approval;
- aggregate-only production cleanup dry run and separate write approval;
- guarded cleanup plus one full recomputation in a maintenance window;
- staging native-worker proof and one low-volume incremental run;
- production image/security and secret-readiness checks;
- rollout gate enabled only after the preceding checks pass.

No cleanup, deployment, rollout change, or merge is authorized by this plan.

## Progress

- 2026-07-23: Product decisions, ADRs, code inventory, ClickUp review, and the
  initial plan were completed.
- 2026-07-29: Eligibility state, migration, schema mirror, and central scalar
  contract were implemented and verified.
- 2026-07-30: Lecturer control, participant lifecycle, computation filtering,
  de-identified output/export, dedicated cleanup, and German/English legal text
  were implemented in temporary review slices.
- 2026-07-30: The user limited the full LA portfolio to five clean milestones.
  All opt-out slices were rebased onto milestone 4 and consolidated into this
  fifth milestone.
- 2026-07-30: The chat rule was aligned with the product boundary: disclaimer
  acceptance grants chat access, while shared LA eligibility alone determines
  analytics inclusion.
- 2026-07-30: The consolidated branch passed Ruff, the complete analytics suite
  (`206 passed, 3 skipped` with PostgreSQL), focused Prisma, utility, GraphQL,
  and Hatchet tests, workspace type checks, schema generation and mirroring,
  and affected production builds.
- 2026-07-30: Independent specification and privacy reviews found and closed
  gaps in decide-later access, coverage semantics, platform free-text and
  course scoping, live-quiz free-text filtering, course-disable cleanup, and
  cleanup replay protection. The cleanup inventory is shared across runtime
  and contract tests, and the one-time cleanup now records a durable receipt in
  the same transaction.
- 2026-07-30: The cleanup command was rehearsed against an isolated PostgreSQL
  database: aggregate-only dry run, reviewed-snapshot-hash-bound write,
  post-write verification, durable receipt creation, and replay rejection all
  behaved as specified. A clean DevPod database also applied all 184 migrations,
  including the new receipt migration.
- 2026-07-30: Browser evidence was rechecked for lecturer control, participant
  choice, de-identified export, suppression below five, and English/German
  disclosure and legal text across desktop and mobile states. The consolidated
  frontend and translation tree matches the browser-tested implementation. The
  decide-later validation change also passes two focused frontend tests, the
  PWA production build, and GraphQL integration tests; a fresh current-branch
  browser smoke is blocked by an unrelated non-idempotent
  catalog/derived-permission seed failure.
- 2026-07-30: Final whole-branch standards, specification, privacy/security,
  and maintainability re-reviews were clean at implementation commit
  `a0ee97ccd`. The rollout remains disabled and production cleanup has not run.
