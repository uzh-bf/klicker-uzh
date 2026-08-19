# Formative Free-Text Semantic Retries Implementation Plan

> **For agentic workers:** implement this plan work package by work package. Keep
> the checkboxes and Progress section current, and request review at every stack
> boundary before starting the next layer.

**Goal:** Add durable semantic evaluation and lecturer-configurable retries to
`FREE_TEXT` elements in formative Practice Quizzes, with honest exact-match
fallback, generic outcome feedback, optional detailed solution reveal, consent,
and aggregate lecturer analytics.

**Architecture:** Public KlickerUZH owns the rubric snapshot, consent, practice
cycles, attempts, outcome mapping, rewards, solution authorization, and analytics.
A Hatchet durable workflow calls a private Catalyst evaluator through a versioned
HTTP contract, persists the terminal result, and exposes public state through
GraphQL. Existing free-text elements remain on the synchronous exact-match path
until explicitly upgraded.

**Tech stack:** Prisma 7/PostgreSQL, shared TypeScript contracts, Pothos GraphQL,
Hatchet, React/Next.js Pages Router, Apollo polling, Formik/Yup, next-intl, Vitest,
and Playwright.

## Global constraints

- Scope is `FREE_TEXT` in formative `PracticeQuiz` only.
- Rubric generation is outside this feature.
- The rubric JSON remains field-compatible with `uzh-bf/agents`; it is not a code
  dependency on that repository.
- Semantic configuration is snapshotted in `ElementInstance.elementData`.
- Default attempt limit is 2 total attempts; allowed range is 1–10.
- Default aggregate bands are `CORRECT` at 75–100, `PARTIAL` at 50–below 75,
  and `INCORRECT` below 50.
- Custom outcome labels never replace the three stable correctness categories.
- Exact matching is asymmetric: a match confirms correct; a non-match is
  unavailable, never incorrect.
- Evaluator retry reuses the same answer attempt. Changed answer text creates a new
  attempt.
- Solution reveal is enabled by default and makes the practice cycle terminal.
- Peer answers and detailed solution data are never returned before a terminal
  action.
- Points and XP award only positive improvement within a cycle and remain subject
  to the existing independent reset windows.
- Prompts, chain-of-thought, provider traces, and raw evaluator errors are neither
  persisted nor exposed.
- No new package dependency is required.

---

## Design answers

- **Domain vocabulary:** `User` authors an `Element`; publication snapshots a
  semantic-retry configuration into a Practice Quiz `ElementInstance`;
  `Participant` owns a `FreeTextPracticeCycle` containing `FreeTextAttempt` rows.
  Vocabulary is recorded in [`CONTEXT.md`](../../CONTEXT.md).
- **Layer footprint:** Prisma schema/migration and analytics sync, `packages/types`,
  `packages/grading`, GraphQL schema/services/ops/codegen, `packages/hatchet`, the
  general Hatchet worker, Manage, PWA, shared components, i18n, Playwright fixtures,
  and engineering docs.
- **Authorization:** existing element mutation keeps FULL_ACCESS plus WRITE on the
  `Element`; changing semantic configuration additionally requires the current
  `User` to have Catalyst entitlement. Participant state mutations require
  `asParticipant`, active access to the containing course, and membership of the
  requested instance in the published Practice Quiz. Solution data is checked
  server-side against the participant-owned terminal cycle.
- **Gamification:** semantic results flow through a dedicated transactional reward
  adapter. A cycle snapshots points/XP eligibility at creation, tracks its rewarded
  best, and awards only a positive delta. New cycles inside the existing windows
  are ineligible.
- **Async:** `evaluateFreeTextAttempt` is a Hatchet durable workflow with three
  retries, per-attempt concurrency one, an on-failure transition to `UNAVAILABLE`,
  and a public attempt ID as its idempotency key.
- **UI:** Manage edits the core rubric and retry settings and shows aggregate retry
  analytics. PWA shows pending/generic outcome/retry/reveal/history/consent states.
  Every new string is added in English and German; every control gets `data-cy`.
- **Tests:** pure contract/scoring Vitest, GraphQL integration against real
  Postgres/Redis/Hatchet, focused Playwright with a deterministic evaluator stub,
  and browser screenshots in Manage and PWA at desktop/mobile widths.
- **Fixtures:** extend the Playwright Practice Quiz fixture with one semantic-retry
  free-text instance. Do not change production/demo seed data for v1.

## Approved implementation stack

This is a substantial cross-layer feature and should be implemented as a native
four-layer GitHub stack after explicit topology approval. The existing isolated Codex
worktree is the stack worktree, rooted at
`/Users/paldov/.codex/worktrees/f0ec/klicker-uzh`; its bottom branch is
`feat/free-text-semantic-contract`.

| Layer | Work package                                      | Independent proof                                        |
| ----: | ------------------------------------------------- | -------------------------------------------------------- |
|     1 | Contract, deterministic domain logic, persistence | grading tests, migration, Prisma/type checks             |
|     2 | GraphQL state machine, Catalyst adapter, Hatchet  | GraphQL integration tests including idempotency          |
|     3 | Lecturer editor and aggregate analytics           | Manage check/build and browser authoring evidence        |
|     4 | Participant retry/consent/solution flow           | PWA check/build, focused Playwright, browser screenshots |

## Approved participant rubric-feedback refinement

The revealed solution state will use a KlickerUZH-native interpretation of the
provided rubric-feedback reference. The existing generic result remains the only
feedback shown before solution authorization; rubric names, achieved levels,
rationales, and the reference solution stay server-gated behind a correct result or
the existing **Show solution** action.

Once authorized, the solution area contains three progressively detailed layers:

1. a restrained rubric header with the number of fully met criteria and a segmented
   progress indicator derived from each assessment's normalized score;
2. an always-visible overview of every assessed rubric, its lecturer/evaluator-defined
   achieved-level label, and a status icon that distinguishes fully met, partially met,
   and open criteria without replacing the configured label; and
3. accessible native disclosure rows for every criterion, with the first row expanded
   initially and the remaining rows collapsed. Each row shows the rubric name,
   achieved level, normalized score, and evaluator rationale.

The presentation uses existing KlickerUZH/UZH colors, spacing, typography, icons, and
semantic HTML. It deliberately excludes the reference application's conversational
follow-up chips and free-form coaching input because those require a separate LLM
interaction contract and consent/usage model. The Playwright fixture will contain
multiple synthetic rubrics with mixed deterministic results so browser evidence proves
the complete overview and detailed-card behavior at desktop and mobile widths.

## Canonical public contracts

Create these shared shapes in `packages/types/src/freeTextEvaluation.ts`. Names in
the rubric portion deliberately retain the upstream snake_case JSON keys.

```ts
export type RubricAchievementLevel = {
  name: string
  description: string
  normalized_score: number
}

export type FreeTextRubric = {
  id: string
  name: string
  description: string
  weight: number
  achievement_levels: RubricAchievementLevel[]
  score_scale?: unknown
  anchors?: unknown
  interpolation_policy?: unknown
  modalities?: unknown
  deterministic_caps?: unknown
  scoring_policy?: unknown
  components?: unknown
  adversarial_checks?: unknown
  evidence_mode_rules?: unknown
  binary_checklist?: unknown
  credit_unverifiable?: unknown
  [key: string]: unknown
}

export type FreeTextRubricSchema = {
  schema_version: string
  name: string
  description: string
  rubrics: FreeTextRubric[]
  evidence_contract?: unknown
  score_scale?: unknown
  interpolation_policy?: unknown
  segmentation?: unknown
  feedback_required?: unknown
  feedback_register?: unknown
  batch_comparison?: unknown
  adaptations?: unknown
  scoring_policy?: unknown
  [key: string]: unknown
}

export type FreeTextOutcomeBand = {
  id: string
  label: string
  min_score: number
  max_score: number
  category: 'CORRECT' | 'PARTIAL' | 'INCORRECT'
}

export type SemanticFreeTextConfig = {
  contract_version: '1'
  question_language: 'en' | 'de'
  attempt_limit: number
  solution_reveal_enabled: boolean
  accepted_exact_answers: string[]
  reference_solution?: string | null
  outcome_bands?: FreeTextOutcomeBand[] | null
  rubric_schema: FreeTextRubricSchema
}
```

The Catalyst request contains no participant, course, or lecturer identifier:

```ts
export type EvaluateFreeTextRequestV1 = {
  contract_version: '1'
  task_bundle_id: string
  question: { content: string; language: 'en' | 'de' }
  response: { text: string }
  reference_solution?: string
  rubric_schema: FreeTextRubricSchema
}
```

The response uses the `RubricAssessment` and `FeedbackProposal` fields from
[`uzh-bf/agents/packages/evaluator/src/evaluator/models.py`](https://github.com/uzh-bf/agents/blob/master/packages/evaluator/src/evaluator/models.py):

```ts
export type EvaluateFreeTextResponseV1 = {
  contract_version: '1'
  task_bundle_id: string
  evaluator_version: string
  model_version: string
  rubric_assessments: Array<{
    task_bundle_id: string
    rubric_id: string
    rubric_name: string
    proposed_level: string
    normalized_score: number
    justification: string
    evidence_ids: string[]
    confidence: number
    needs_review: boolean
    review_flags: string[]
    used_evidence_ids: string[]
    unsupported_claims: string[]
    evidence_sufficiency?: string | null
    uncertainty_reason?: string | null
    rationale: string
  }>
  feedback_proposals?: Array<{
    task_bundle_id: string
    rubric_id: string
    rubric_name: string
    feedback: string
    strengths: string[]
    improvements: string[]
    action_items: string[]
    evidence_ids: string[]
    confidence: number
  }>
}
```

Public validation requires every configured rubric exactly once, matching task and
rubric IDs, scores from 0 through 100, confidence from 0 through 1, and no
`needs_review`. The evaluator converts its own low-confidence policy into
`needs_review`; public code does not silently reinterpret uncertain output. Public
code computes `sum(weight * normalized_score)`, then maps the score to one validated
outcome band.

## Public persistence shape

Add the following concepts to `packages/prisma/src/prisma/schema/response.prisma`:

- `FreeTextPracticeCycleStatus`: `ACTIVE`, `CORRECT`, `SOLUTION_REVEALED`,
  `EXHAUSTED`.
- `FreeTextEvaluationStatus`: `PENDING`, `EVALUATED`, `UNAVAILABLE`.
- `FreeTextEvaluationSource`: `SEMANTIC`, `EXACT_MATCH`.
- `FreeTextCorrectnessCategory`: `CORRECT`, `PARTIAL`, `INCORRECT`.
- `FreeTextPracticeCycle`: participant, participation, Practice Quiz, instance,
  ordinal, status, snapshotted attempt limit, solution timestamp, reward eligibility,
  best score/XP, awarded points/XP, and terminal timestamps.
- `FreeTextAttempt`: cycle, answer text, answer time, ordinal, client submission ID,
  evaluation revision/status/source, schema version/hash, sanitized availability
  reason and retryability, aggregate score, outcome band identity/label, correctness,
  evaluator/model versions, typed structured result JSON, internal Hatchet run ID,
  and an optional unique relation to the resulting `QuestionResponseDetail`.
- `ParticipantSemanticEvaluationConsent`: participant, disclosure version,
  `ACCEPTED`/`DECLINED`, and decision timestamp, unique per participant and version.

`FreeTextAttempt` is canonical for every answer, including unavailable answers.
Create/link the legacy `QuestionResponseDetail` and update `QuestionResponse`,
instance results/statistics, leaderboard, XP, and timeline only after a valid
evaluated or exact-match result. The transaction must check that the attempt has no
linked response detail before applying any side effect.

## GraphQL surface

Add these participant operations and include their generated artifacts:

```graphql
query FreeTextPracticeState($instanceId: Int!)
mutation RetryFreeTextEvaluation($attemptId: String!)
mutation RevealFreeTextSolution($cycleId: String!)
mutation StartFreeTextPracticeCycle($instanceId: Int!)
mutation DecideSemanticEvaluationConsent(
  $disclosureVersion: String!
  $accepted: Boolean!
)
```

Extend `StackResponseInput` with `clientSubmissionId`; semantic free-text responses
inside `respondToElementStack` call the same attempt-creation service as later
individual retries. Extend `FreeTextInstanceEvaluation` with a nullable
`semanticState`. Legacy free-text evaluations keep their current fields and behavior.

`FreeTextPracticeState` exposes cycle/attempt IDs, status, answer history, generic
outcome label/category, attempts used/remaining, points/XP delta, and server-derived
action booleans. Detailed explanation, rubric rationale, reference solution, and
peer answers are nullable and returned only after correct or reveal authorization.

Add a lecturer `semanticFreeTextCapability` query that exposes entitlement and the
separate evaluator availability state (`AVAILABLE`, `DEGRADED`, `UNAVAILABLE`) with
a sanitized reason and retryability. Never encode service health into `catalyst`.

## Task 1: Contract and deterministic domain logic

**Files:**

- Create: `packages/types/src/freeTextEvaluation.ts`
- Modify: `packages/types/src/index.ts`
- Create: `packages/grading/src/freeTextSemanticEvaluation.ts`
- Modify: `packages/grading/src/index.ts`
- Create: `packages/grading/test/freeTextSemanticEvaluation.test.ts`

**Interfaces:** produces the canonical types above plus
`validateFreeTextRubricSchema`, `validateFreeTextOutcomeBands`,
`computeFreeTextAggregate`, `mapFreeTextOutcome`, `normalizeFreeTextAnswer`, and
`matchesAcceptedExactAnswer`.

- [x] Write failing tests for required upstream fields, weight total 1, unique rubric
      and level names, scores 0–100, complete non-overlapping bands, the three default
      bands, weighted aggregation, and asymmetric exact matching.
- [x] Implement the shared types and dependency-free validators/mappers. Preserve
      unknown optional rubric fields by spreading the original JSON; never strip them
      during core-field edits.
- [x] Run `pnpm --filter @klicker-uzh/grading test`; expect all grading tests to pass.
- [x] Run `pnpm --filter @klicker-uzh/types check` and
      `pnpm --filter @klicker-uzh/grading check`; expect exit 0.
- [x] Commit the layer with `feat(grading): define semantic free-text contract`.

## Task 2: Durable practice-cycle persistence

**Files:**

- Modify: `packages/prisma/src/prisma/schema/response.prisma`
- Modify: `packages/prisma/src/prisma/schema/participant.prisma`
- Modify: `packages/prisma/src/prisma/schema/element.prisma`
- Modify: `packages/prisma/src/prisma/schema/quiz.prisma`
- Create: `packages/prisma/src/prisma/schema/migrations/20260818152213_free_text_semantic_retries/migration.sql`
- Modify: `packages/graphql/src/types/app.ts`
- Modify after sync: `apps/analytics/prisma/schema/response.prisma`
- Modify after sync: `apps/analytics/prisma/schema/participant.prisma`
- Modify after sync: `apps/analytics/prisma/schema/element.prisma`
- Modify after sync: `apps/analytics/prisma/schema/quiz.prisma`

**Interfaces:** produces `FreeTextPracticeCycle`, `FreeTextAttempt`, and
`ParticipantSemanticEvaluationConsent` with the persistence shape above.

- [x] Add the enums, models, relations, indexes, typed result JSON annotation, and a
      uniqueness constraint on `(cycleId, clientSubmissionId)` and `(cycleId, ordinal)`.
- [x] Generate the migration with the repository Prisma workflow and inspect the SQL
      for additive, backward-compatible DDL only; no legacy response row is rewritten.
- [x] Run `pnpm run prisma:sync`; verify the four shared model files are mirrored and
      analytics-owned generator/datasource files remain unchanged.
- [x] Run `pnpm --filter @klicker-uzh/prisma check`; expect client generation and
      TypeScript checking to pass.
- [x] Commit the layer with `feat(prisma): persist free-text practice cycles`.

## Task 3: Public state machine, Catalyst adapter, and Hatchet workflow

**Files:**

- Create: `packages/graphql/src/services/freeTextEvaluation.ts`
- Create: `packages/graphql/src/services/semanticFreeTextEvaluator.ts`
- Create: `packages/graphql/src/schema/freeTextEvaluation.ts`
- Modify: `packages/graphql/src/schema/element.ts`
- Modify: `packages/graphql/src/schema/elementData.ts`
- Modify: `packages/graphql/src/schema/mutation.ts`
- Modify: `packages/graphql/src/schema/query.ts`
- Modify: `packages/graphql/src/services/elements.ts`
- Modify: `packages/graphql/src/services/stacks.ts`
- Modify: `packages/graphql/src/services/practiceQuizzes.ts`
- Modify: `packages/graphql/src/index.ts`
- Modify: `packages/types/src/hatchet.ts`
- Modify: `packages/hatchet/src/index.ts`
- Modify: `turbo.json`
- Create: `packages/graphql/src/graphql/ops/QFreeTextPracticeState.graphql`
- Create: `packages/graphql/src/graphql/ops/MRetryFreeTextEvaluation.graphql`
- Create: `packages/graphql/src/graphql/ops/MRevealFreeTextSolution.graphql`
- Create: `packages/graphql/src/graphql/ops/MStartFreeTextPracticeCycle.graphql`
- Create: `packages/graphql/src/graphql/ops/MDecideSemanticEvaluationConsent.graphql`
- Create: `packages/graphql/src/graphql/ops/MSubmitFreeTextAttempt.graphql`
- Create: `packages/graphql/src/graphql/ops/QSemanticFreeTextCapability.graphql`
- Modify: `packages/graphql/src/graphql/ops/FStackFeedbackEvaluations.graphql`
- Create: `packages/graphql/test/freeTextEvaluation.test.ts`
- Regenerate: `packages/graphql/src/ops.ts`
- Regenerate: `packages/graphql/src/ops.schema.json`
- Regenerate: `packages/graphql/src/public/schema.graphql`
- Regenerate: `packages/graphql/src/public/client.json`
- Regenerate: `packages/graphql/src/public/server.json`

**Interfaces:**

- `createFreeTextAttempt` validates participant/activity/instance ownership, reuses a
  matching `clientSubmissionId`, snapshots schema hash/version, and schedules work.
- `handleEvaluateFreeTextAttempt({ attemptId, evaluationRevision })` is idempotent,
  re-checks owner entitlement/consent/configuration, calls the evaluator, and commits
  one terminal transition and reward delta.
- `retryFreeTextEvaluation` increments only `evaluationRevision`, resets the same
  attempt to `PENDING`, and schedules it again.
- `getFreeTextPracticeState` derives all action booleans server-side and withholds
  detailed solution data before authorization.

- [x] Write GraphQL integration tests first for legacy behavior, semantic opt-in,
      custom/default bands, duplicate submission IDs, attempt exhaustion, evaluation
      retry, solution reveal, terminal practice-again, consent accept/decline/version
      renewal, entitlement loss, exact match/non-match, uncertain results, and positive
      reward deltas without farming across cycles.
- [x] Add validation for `SemanticFreeTextConfig` on element manipulation.
      Require Catalyst only when semantic configuration changes; unrelated edits may
      preserve a read-only configuration after entitlement loss.
- [x] Split legacy `solutions` from new `accepted_exact_answers` and
      `reference_solution`. On explicit upgrade seed accepted answers from legacy
      solutions, leave the reference solution empty, and require it when reveal is
      enabled.
- [x] Implement participant authorization and the disclosure record. The current
      version comes from `SEMANTIC_EVALUATION_DISCLOSURE_VERSION`; expose provider-aware
      metadata without storing translated copy in the database.
- [x] Implement the HTTP adapter using native `fetch` with
      `CATALYST_FORMATIVE_EVALUATOR_URL` and
      `CATALYST_FORMATIVE_EVALUATOR_TOKEN`. Return typed availability failures; redact
      endpoint payloads and raw errors from persisted/user-visible state.
- [x] Add `evaluateFreeTextAttempt` as a three-retry Hatchet workflow with
      concurrency keyed by `attemptId`, and an on-failure handler that conditionally
      changes a still-pending matching revision to retryable `UNAVAILABLE`.
- [x] Refactor the existing response update into a transaction-safe helper reused by
      semantic completion. Guard all response-detail, aggregate, leaderboard, XP, and
      timeline writes with the attempt's unique response-detail relation.
- [x] Implement the GraphQL types, queries, mutations, StackResponseInput extension,
      and semantic state on `FreeTextInstanceEvaluation`.
- [x] Run `pnpm --filter @klicker-uzh/graphql generate`; inspect and commit all five
      generated artifacts.
- [x] Run the focused `freeTextEvaluation.test.ts` integration suite directly inside
      the DevPod; all 16 cases pass against real Postgres. (`test:local` is the
      host-owned Docker wrapper and is not used from inside the DevPod.)
- [x] Run checks for types, grading, Prisma, GraphQL, Hatchet, and the general worker;
      expect exit 0.
- [x] Commit the layer with `feat(graphql): orchestrate semantic free-text attempts`.

## Task 4: Lecturer authoring and aggregate analytics

**Files:**

- Modify: `apps/frontend-manage/src/components/elements/manipulation/types.ts`
- Modify: `apps/frontend-manage/src/components/elements/manipulation/useElementFormInitialValues.ts`
- Modify: `apps/frontend-manage/src/components/elements/manipulation/useValidationSchema.ts`
- Modify: `apps/frontend-manage/src/components/elements/manipulation/helpers.ts`
- Modify: `apps/frontend-manage/src/components/elements/manipulation/options/FreeTextOptions.tsx`
- Create: `apps/frontend-manage/src/components/elements/manipulation/options/SemanticFreeTextOptions.tsx`
- Create: `apps/frontend-manage/src/components/elements/manipulation/options/FreeTextRubricEditor.tsx`
- Create: `apps/frontend-manage/src/components/elements/manipulation/options/FreeTextOutcomeBandEditor.tsx`
- Modify: `apps/frontend-manage/src/components/evaluation/elements/FTEvaluation.tsx`
- Create: `apps/frontend-manage/src/components/evaluation/elements/FreeTextRetryAnalytics.tsx`
- Modify: `packages/graphql/src/schema/evaluation.ts`
- Modify: `packages/graphql/src/services/practiceQuizzes.ts`
- Modify: the Practice Quiz evaluation GraphQL operation that selects
  `FreeTextActivityEvaluationData`
- Modify: `packages/i18n/messages/en.ts`
- Modify: `packages/i18n/messages/de.ts`

**Interfaces:** the editor round-trips core rubric fields while preserving advanced
JSON fields; analytics returns aggregate counts/rates only.

- [x] Add form tests through pure helper/validation tests for 1–10 attempts, question
      language, weights, levels, outcome-band coverage, conditional reference solution,
      legacy upgrade, and preservation of unknown advanced fields.
- [x] Add a Catalyst-gated semantic-retry section with question language, attempt
      limit, reveal toggle, accepted exact answers, reference solution, schema metadata,
      rubrics/weights/levels, custom bands, and a collapsed read-only advanced-metadata
      view. Add stable `data-cy` hooks to every control.
- [x] Show entitlement and evaluator availability separately. A non-entitled user can
      inspect but cannot change existing semantic configuration.
- [x] Aggregate first/best category, attempts used, success rate, reveal rate, and
      unavailable count in the Practice Quiz evaluation service. Do not return
      participant-level rationale, confidence, or errors.
- [x] Render the retry analytics beside the existing free-text evaluation without
      changing legacy word-cloud/answer views.
- [x] Add all English and German authoring, validation, capability, and analytics
      strings.
- [x] Regenerate GraphQL artifacts, run Manage/GraphQL checks, and run the focused
      GraphQL aggregation test; expect exit 0.
- [x] Verify authoring in a real Manage browser in English and German, including a
      narrow viewport and an entitlement-loss read-only state; save screenshots under
      `project/plans_wip/assets/free-text-semantic-retries/`.
- [x] Commit the layer with `feat(manage): author semantic free-text retries`.

## Task 5: Participant retry, consent, and solution flow

**Files:**

- Modify: `apps/frontend-pwa/src/components/practiceQuiz/ElementStack.tsx`
- Modify: `apps/frontend-pwa/src/components/practiceQuiz/PracticeQuiz.tsx`
- Create: `apps/frontend-pwa/src/components/practiceQuiz/FreeTextRetryPanel.tsx`
- Create: `apps/frontend-pwa/src/components/practiceQuiz/SemanticEvaluationConsentModal.tsx`
- Create: `apps/frontend-pwa/src/components/practiceQuiz/useFreeTextPracticeState.ts`
- Modify: `packages/shared-components/src/FreeTextQuestion.tsx`
- Create: `packages/shared-components/src/evaluation/FreeTextRubricBreakdown.tsx`
- Modify: `packages/shared-components/src/evaluation/FTEvaluation.tsx`
- Modify: `packages/i18n/messages/en.ts`
- Modify: `packages/i18n/messages/de.ts`

**Interfaces:** `useFreeTextPracticeState` polls only while `PENDING`, merges the
initial stack result with persisted state, and preserves a client submission UUID
across network retries. `FreeTextRetryPanel` renders actions solely from server
booleans.

- [x] Keep the initial stack-wide submission. Generate and retain a
      `clientSubmissionId` for each semantic free-text answer and store the returned
      semantic state independently of the locked neighboring elements.
- [x] Poll persisted state while pending; stop on evaluated or unavailable. On reload,
      query by instance and restore the current cycle without trusting localStorage.
- [x] Render localized pending, correct, partial, incorrect, and unavailable generic
      feedback; show attempts remaining and the applicable Try again, Retry evaluation,
      Show solution, View explanation, and Practice again actions.
- [x] Reopen only the semantic free-text input with the previous answer as editable
      text. Render prior attempts without making them resubmittable.
- [x] Add the non-dismissible versioned consent modal to the Start action of every
      Practice Quiz containing semantic rubric feedback. Accept or decline persists
      the current-version decision before entering the first stack; decline runs exact
      fallback without sending an answer externally.
- [x] Fetch/render reference solution, explanation, per-rubric achieved level and
      rationale, points/XP delta, and peer answers only after the server returns detailed
      data. Never render raw rubric JSON.
- [x] Keep legacy free-text rendering unchanged when `semanticState` is null.
- [x] Add English and German participant copy and stable `data-cy` hooks.
- [x] Run PWA/shared-components checks and builds; expect exit 0.
- [ ] Verify pending, partial retry, correct explanation, unavailable retry, decline
      fallback, reveal, exhaustion, reload, and Practice again in a real PWA browser at
      desktop and mobile widths; save screenshots with the Manage evidence.
- [x] Commit the layer with `feat(pwa): add semantic free-text retry flow`.

## Task 6: Deterministic end-to-end proof and documentation completion

**Files:**

- Create: `playwright/semantic-evaluator-stub.mjs`
- Create: `playwright/global-teardown.ts`
- Modify: `playwright/global-setup.ts`
- Modify: `playwright/playwright.config.ts`
- Modify: `playwright/fixtures/Q-practice-quiz.json`
- Modify: `playwright/tests/Q-practice-quiz.spec.ts`
- Modify: `util/_with_local_test_origins.sh`
- Modify if CI environment wiring is required:
  `.github/workflows/test-playwright.yml`
- Update: `docs/formative-free-text-evaluation.md`
- Update: `docs/async-and-workers.md`

**Interfaces:** the stub binds only in the Playwright environment, verifies the
request contract, and returns deterministic correct/partial/incorrect/uncertain/
failure fixtures selected by synthetic marker text. Production has no fixture mode.

- [x] Start the no-dependency evaluator stub from Playwright global setup, expose its
      localhost URL to the already-running worker through the test environment, and stop
      it in global teardown. Refuse to start outside `NODE_ENV=test`.
- [x] Seed one semantic-retry free-text question with a synthetic rubric and accepted
      answer; add no real course or participant data.
- [x] Add a focused Practice Quiz semantic spec to prove pre-start consent,
      pending-to-partial, individual
      retry-to-correct, no neighboring unlock, reload recovery, detail gating, reveal,
      exhaustion, exact fallback, and no duplicate reward after a repeated request.
- [x] Run `pnpm --filter @klicker-uzh/playwright check`; expect exit 0.
- [ ] Run the focused Practice Quiz Playwright spec against the full local stack with
      both Hatchet workers; expect all semantic and existing legacy workflows to pass.
- [x] Run `pnpm run check:all`, `pnpm run build`, and
      `opengrep scan --config auto`; classify any unrelated existing failures explicitly.
- [ ] Run the wiki validator; its documented external script is not installed in
      this environment.
- [x] Run the Markdown formatter, attach the captured desktop/mobile English/German
      screenshots to the final draft PR, and update this plan's Progress section with
      exact commands and results.

## Task 7: Rich participant rubric feedback

**Files:**

- Modify: `packages/shared-components/src/evaluation/FreeTextRubricBreakdown.tsx`
- Modify: `packages/shared-components/src/evaluation/FTEvaluation.tsx`
- Modify: `apps/frontend-pwa/src/components/practiceQuiz/FreeTextRetryPanel.tsx`
- Modify: `packages/i18n/messages/en.ts`
- Modify: `packages/i18n/messages/de.ts`
- Modify: `playwright/fixtures/Q-practice-quiz.json`
- Modify: `playwright/semantic-evaluator-stub.mjs`
- Modify: `playwright/tests/Q-practice-quiz-semantic.spec.ts`
- Update: `docs/log/2026-08-19-formative-free-text-evaluation-participant.md`
- Add: `docs/log/assets/2026-08-19-formative-free-text-evaluation-participant/participant-rubric-feedback-desktop.png`
- Add: `docs/log/assets/2026-08-19-formative-free-text-evaluation-participant/participant-rubric-feedback-mobile.png`

**Interfaces:** `FreeTextRubricBreakdown` continues to consume the authorized
`structuredResult` JSON. Its parser additionally retains `normalized_score`, and its
rendered contract exposes stable `semantic-rubric-summary`,
`semantic-rubric-overview-{rubricId}`, and existing
`semantic-rubric-result-{rubricId}` hooks. No GraphQL or persistence contract changes.

- [x] Extend the deterministic fixture from one rubric to four equally weighted
      synthetic diversification criteria. Make the partial scenario return a mix of
      full, partial, and open achievement levels while keeping correct/incorrect
      scenarios deterministic for every rubric.
- [x] Add focused Playwright assertions for all four overview rows, the fully-met
      count, the first expanded detail row, and the remaining collapsed detail rows.
      The focused test is discovered and type-checks; local execution reaches browser
      launch but is blocked by the missing pinned Chromium executable in the DevPod.
- [x] Extend the parsed assessment shape exactly as follows and keep malformed result
      objects fail-closed:

  ```ts
  type RubricAssessment = {
    rubricId: string
    rubricName: string
    proposedLevel: string
    normalizedScore: number
    rationale: string
  }

  type RubricStatus = 'MET' | 'PARTIAL' | 'OPEN'

  function getRubricStatus(normalizedScore: number): RubricStatus {
    if (normalizedScore >= 100) return 'MET'
    if (normalizedScore > 0) return 'PARTIAL'
    return 'OPEN'
  }
  ```

- [x] Replace the flat card list with the approved three-layer presentation: a
      segmented score indicator, every-rubric overview, and native `<details>` rows.
      Use Font Awesome's existing `faCircleCheck`, `faCircleHalfStroke`,
      `faCircleXmark`, and `faChevronDown`; the first criterion uses `open` and all
      rows remain keyboard accessible. Show configured achieved-level labels and
      evaluator rationales verbatim, but never raw JSON.
- [x] Add the localized keys `semanticRubricCriteriaMet`,
      `semanticRubricCriterionCount`, `semanticRubricScore`, and
      `semanticRubricDetails` in English and German. Keep lecturer-defined level names
      in the question language rather than translating them in the UI.
- [x] Run `pnpm --filter @klicker-uzh/shared-components check`,
      `pnpm --filter @klicker-uzh/frontend-pwa check`, and
      `pnpm --filter @klicker-uzh/playwright check`; expect exit 0. Run formatting,
      lint, `git diff --check`, and an OpenGrep scan over the changed source files.
- [x] Verify the accepted partial-evaluation and revealed rubric state in the real
      PWA at desktop and mobile widths, plus the German labels in the English PWA.
      Confirm every criterion is visible in the overview, expand/collapse works by
      keyboard, and content does not overflow.
- [x] Replace the insufficient fallback screenshot evidence in PR #5433 with the new
      desktop/mobile rubric-feedback screenshots, commit the Layer 4 refinement, push
      the top stack branch, and re-read the draft PR to verify the rendered links.

## Task 8: Criterion-level AI explanations and complete student evidence

**Files:**

- Modify: `packages/shared-components/src/evaluation/FreeTextRubricBreakdown.tsx`
- Modify: `packages/i18n/messages/en.ts`
- Modify: `packages/i18n/messages/de.ts`
- Modify: `playwright/semantic-evaluator-stub.mjs`
- Modify: `playwright/tests/Q-practice-quiz-semantic.spec.ts`
- Update: `docs/log/2026-08-19-formative-free-text-evaluation-participant.md`
- Replace: `docs/log/assets/2026-08-19-formative-free-text-evaluation-participant/participant-rubric-feedback-desktop.png`
- Replace: `docs/log/assets/2026-08-19-formative-free-text-evaluation-participant/participant-rubric-feedback-mobile.png`

**Interfaces:** the authorized rubric parser keeps required non-empty assessment
`rationale` values and joins optional non-empty `feedback_proposals[].feedback` by
exact `rubric_id`. Each detail card exposes
`semantic-rubric-ai-feedback-{rubricId}` and keeps all raw evaluator metadata hidden.

- [x] Return criterion-specific German rationales and feedback proposals from the
      deterministic evaluator stub and assert the complete first-card copy in the
      focused Playwright behavior contract.
- [x] Render localized **AI feedback**, **Why this score**, and **How to improve**
      labels inside the authorized native disclosure without changing GraphQL,
      persistence, or the evaluator contract.
- [x] Run shared-components, PWA, and Playwright checks, PWA lint, formatting,
      `git diff --check`, focused OpenGrep, and the full pre-commit `check:all` suite.
- [x] Exercise the natural partial answer through the real evaluation handler and
      deterministic Catalyst boundary; verify keyboard disclosure behavior and no
      horizontal overflow at 390 px.
- [x] Replace the cropped rubric-panel evidence with complete 1440 x 1900 and
      390 x 2400 student views containing the question, answer, generic result,
      revealed solution, all criteria, and expanded AI feedback together.
- [x] Push the participant layer through native stack #5436, replace the duplicate
      screenshot sections in draft PR #5433, and re-read the PR state and checks.

## Self-review checklist

- [ ] Every confirmed product decision maps to a task and test.
- [ ] Element input, element output, `ElementInstance` snapshot, evaluator request,
      evaluator response, persisted result, and generated GraphQL types use identical
      field names.
- [ ] Legacy `solutions` remains readable and no migration infers a reference
      solution.
- [ ] Non-match, low confidence, missing consent, missing entitlement, and service
      failure can never become `INCORRECT` implicitly.
- [ ] Every state-changing mutation is idempotent and all solution checks are
      server-side.
- [ ] Participant identifiers and raw provider errors never cross the Catalyst
      contract or appear in analytics.
- [ ] MicroLearning, Live Quiz, Group Activity, Case Study, and assessment behavior
      remains unchanged.

## Progress

- **2026-08-18:** Completed the requirements interview and confirmed the full design.
- **2026-08-18:** Added the domain vocabulary, ADR 0008, target-design wiki page,
  external rubric-contract references, and this implementation plan.
- **2026-08-18:** Initialized `feat/free-text-semantic-contract` as the bottom native
  stack branch in the existing isolated Codex worktree.
- **2026-08-18:** Completed Layer 1 contracts, TDD validators/mappers, durable public
  persistence, the additive migration, analytics schema sync, and isolated-database
  application/reseed verification. Committed the contract as `e74f25273` and
  persistence as `5248ccf46`; stack-boundary review remains pending.
- **2026-08-19:** Completed Layer 2's public state machine, Catalyst adapter, durable
  Hatchet workflow, consent and entitlement gates, participant-safe GraphQL surface,
  legacy side-effect integration, and 16-case focused integration suite. All affected
  package checks, 19 grading tests, formatting, and Opengrep pass. The full GraphQL
  suite reached 555/558; three unrelated catalog/assessment fixtures fail against the
  already-used local database and also fail when rerun without file parallelism.
- **2026-08-19:** Completed Layer 3 lecturer authoring, localized defaults,
  advanced-field preservation, entitlement/availability states, responsive Manage
  UI, and aggregate Practice Quiz retry analytics. Saved-value round trips and the
  English, German, narrow, and entitlement-loss states were verified in the real
  Manage app. The authenticated published-quiz GraphQL query returned the expected
  zero-state aggregate; the existing dynamic evaluation page returned a baseline
  Next.js 404 for both the synthetic and seeded published quizzes, so no invalid
  analytics screenshot was retained. The Manage production bundle compiled, then
  hit the existing `_app` `NextRouter was not mounted` prerender failure on the 404
  and answer-collection pages.
- **2026-08-19:** Completed the Layer 4 participant state hook, localized retry and
  consent UI, stale-response protection, terminal solution/rubric rendering, and
  per-attempt reward display. Real browser verification covered exact fallback,
  decline/unavailable behavior, reload, reveal, fresh-cycle creation, German
  disclosure copy, and desktop/mobile layouts. Added a contract-validating Catalyst
  stub and four focused semantic Playwright workflows. Playwright type-checking
  passes; local browser execution remains pending because the DevPod's initially
  absent Chromium cache could not be completed cleanly on arm64.
- **2026-08-19:** Final Layer 4 verification passed the affected package checks,
  17 focused GraphQL integration tests, PWA lint, the complete `check:all` suite,
  `git diff --check`, and an OpenGrep scan of the new files. The PWA production
  build and complete pre-push build later passed from the clean hook environment;
  the focused Playwright run remains unclaimed for the browser-cache limitation
  above.
- **2026-08-19:** Published the approved draft stack as
  [#5430](https://github.com/uzh-bf/klicker-uzh/pull/5430),
  [#5431](https://github.com/uzh-bf/klicker-uzh/pull/5431),
  [#5432](https://github.com/uzh-bf/klicker-uzh/pull/5432), and
  [#5433](https://github.com/uzh-bf/klicker-uzh/pull/5433). The participant PR
  description contains the desktop/mobile solution views, exact-match result, and
  German disclosure screenshot.
- **2026-08-19:** Refined the accepted-feedback state with a full-width segmented
  rubric summary, all-criterion overview, and keyboard-accessible criterion details.
  The four mixed outcomes and German lecturer-defined labels were verified in the
  real PWA at 1440 px and 390 px without overflow. Shared-components, PWA, and
  Playwright type checks, PWA lint, formatting, `git diff --check`, and focused
  OpenGrep all passed. The focused Playwright test reached launch but the DevPod does
  not contain the pinned Chromium executable; CI remains the automated browser gate.
  Committed the refinement as `b66216c5f`, pushed the top stack branch, and updated
  draft PR #5433 so the all-rubric desktop/mobile evidence appears first.
- **2026-08-19:** Added criterion-level AI feedback that pairs each required score
  rationale with its optional exact-ID feedback proposal, preserving the existing
  solution-authorization boundary. Replaced the cropped evidence with complete
  1440 x 1900 and 390 x 2400 student views, verified keyboard expansion and mobile
  overflow in the real PWA, and committed the evidence as `0f7c4aed2`. Pushed all
  four tracked branches through native GitHub stack #5436 and updated draft PR #5433
  to show only the two integrated student views before the exact-match and disclosure
  evidence. The PR remained draft and correctly targeted #5432; its new CI runs were
  pending when checked, with no actionable comments or review threads.
