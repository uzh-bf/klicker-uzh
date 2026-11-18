# Adaptive retakes and a shared student quiz UI

Status: in progress (2026-10-07).

## Goals

1. **Shared student UI.** Normal and adaptive practice quizzes use the same
   student-facing components. A later change to the practice quiz UI then
   reaches adaptive quizzes automatically.
2. **Retake from the previous result.** A retake starts its question
   selection from the student's last result instead of the middle of the
   scale.
3. **Prefer new questions on a retake.** Questions the student answered in
   earlier attempts come back only when no suitable new question is left.

## Current state (verified in the code)

### UI

Only the page shell, `PreviewMessage`, `Loader`, design-system primitives,
`QuestionContent` and the SC/MC/KPRIM/FREE_TEXT option inputs are shared.

| Part | Normal (`apps/frontend-pwa`) | Adaptive (`packages/adaptive-pwa-ui`) |
|---|---|---|
| Card container | `PracticeQuiz.tsx:129` | copied in `AdaptivePracticeQuiz.tsx:282` |
| Start screen | `PracticeQuizOverview` (H3, icon rows, `DynamicMarkdown`) | `AdaptivePracticeQuizIntro` (H2, 4 tiles, `Markdown`, own resume box) |
| Progress | `StepProgressWithScoring` (with "Reset answers") | text "Question X, at most N" |
| Restart | "Reset answers" (no confirmation) | "Start over" + confirmation modal |
| Question container | `ElementStack` → `StudentElement` | own `AdaptivePracticeQuizQuestion` |
| Numerical input | `NUMERICALAnswerOptions` | own `TextField` + validation |
| Feedback after answering | evaluation panel in `ElementStack` | `UserNotification` |
| Result | none (back to the overview) | `AdaptivePracticeQuizResult` |

### Retakes

**No carry-over from the previous attempt.**
- `createAdaptiveAttempt` sends `responses: []` and no estimates
  (`adaptivePracticeQuizCommandSupport.ts:84-154`).
- The engine is stateless.
- The V6 "carried prior" only carries the estimate from one competence to the
  next within the same attempt.

**Repeated questions are possible.**
- For IRT_V1 (the scale in use today), the engine only skips questions from
  the current attempt (`runtime.ts:2191`, `answeredPoolIds`).
- IRT_V2 already sends `priorAttemptPoolItemIds` and prefers unseen items
  (`selectionV2.ts:286-289`). The host builds that list in
  `adaptivePracticeQuizRuntimeData.ts:377-421`, matching by
  assignment/element/version, which also works across re-publications.

## Design

### A. Shared student UI (host only, no engine change)

**Where the code goes.** Shared components live in `packages/shared-components`.
Both `frontend-pwa` and `adaptive-pwa-ui` already depend on it. Apps and
packages must not import from each other.

1. **`PracticeQuizShell`.** The card container: border, max width and embed
   handling. Both quiz types use it.
2. **`PracticeQuizOverview`.** Moved to shared-components and made generic:
   - title (H3) and description (`DynamicMarkdown`);
   - a `facts` list of icon + text rows;
   - an optional notice (not logged in / resume available, both as
     `UserNotification`);
   - the primary action (Start / Resume) and an optional secondary action
     (Reset / Start over).

   Normal quizzes pass: number of question sets, order, repetition and
   multiplier. Adaptive quizzes pass: at most N questions, **repetition every N
   days** (shown the same way as on normal quizzes), no going back, can resume
   later, and privacy. `AdaptivePracticeQuizIntro` becomes a thin adapter.
3. **Progress header.**
   - Move `StepProgressWithScoring` to shared-components.
   - Add an "open length" variant for adaptive quizzes: answered steps
     plus "at most N", since the real length isn't known in advance.
   - The reset button uses one shared confirmation modal in both modes.
     Normal quizzes gain the confirmation they lack today.
4. **Question view.**
   - Adaptive renders through `StudentElement` instead of calling the option
     components itself. This also gives it `NUMERICALAnswerOptions` and drops
     the duplicate numerical validation.
   - The answer feedback becomes one shared `ElementFeedbackPanel`, used by
     `ElementStack` and the adaptive question.
   - `ElementStack` itself stays normal-only. It carries stack, bookmark,
     flagging and localStorage logic that adaptive quizzes don't have.
5. **Not shared (on purpose).**
   - The adaptive result page: normal quizzes have no result page yet.
   - The testing box and history chart, which only exist in testing environments.
6. **Guard.** An architecture test that fails if `adaptive-pwa-ui` defines its
   own overview, progress or answer-input components again.

### B. Retake starts from the previous result

- **New setting `retakeStart`.**
  - `PREVIOUS_RESULT` (default for the Diagnostic preset): start from the last
    result.
  - `NEUTRAL`: today's behaviour.
- **At attempt creation the host takes a snapshot.**
  - The host reads the per-competence θ and SE from the student's latest
    completed attempt on the same quiz.
  - It stores them on the new attempt as `startingEstimates` (JSON). They stay
    fixed for that attempt, even if another attempt completes in the
    meantime.
  - Matching is by node id. When the quiz is re-published and the tree
    changed, nodes without a match start neutral.
- **The engine uses them for routing only.**
  - The decide request gets an optional `startingEstimates` field.
  - Each competence's routing prior becomes N(θ_prev, 1), the same strength as
    the V6 carried prior.
  - This replaces the cross-competence prior for competences that have a
    previous value.
  - The reported result stays maximum likelihood on the new answers only. A
    previous result therefore never shows up in the new grade; it only
    decides where questioning begins.
- **Contract version.** This is a new engine version (V7). The host sends the
  field only when the published engine version supports it, so stg keeps
  working before the new engine image is deployed.

### C. Prefer new questions on a retake

- **New setting `repeatedQuestions`.**
  - `PREFER_NEW` (default): unseen questions first.
  - `ALLOW`: today's behaviour.
- **Host.** Builds `priorAttemptPoolItemIds` for IRT_V1 too, by reusing the
  V2 query.
- **Engine (V7, same release as B).**
  - Inside the chosen leaf, the engine filters the candidates near the target
    level to unseen items.
  - If none are left within ±1 level of the target, it falls back to seen
    items. That keeps the measurement accurate when a level has only a few
    questions.
  - It is a soft preference, as in V2. A small pool can still repeat
    questions, but only when it has to.
- **Optional extension (only if wanted).** Deliberately repeat questions the
  student got wrong last time, as a learning/repetition mode. This is a
  different goal from measuring the level and would bias the estimate.

## Slices

1. **Shared UI, part 1: shell + overview + progress header.**
   - Host only.
   - Browser before/after of both start screens and the embed.
2. **Shared UI, part 2: question view.**
   - `StudentElement` and the shared feedback panel in adaptive quizzes.
   - Playwright adaptive specs stay green.
3. **Catalyst V7.**
   - `startingEstimates` + soft unseen preference for IRT_V1.
   - Engine unit tests and a simulation: retake bias, number of answers,
     repeat rate.
4. **Host settings + persistence.**
   - Migration: config `retakeStart` and `repeatedQuestions`; publication
     snapshot; attempt `startingEstimates`.
   - Presets, GraphQL, form, request building gated on V7.
   - The diagnostics CSV gets a `starting_theta` column.
5. **Deploy.** V7 engine image to stg, then the host to stg.

## Decisions needed

1. Is the reading of goal 3 right: earlier questions should **not** come back
   unless needed? Or should wrong answers come back on purpose (the optional
   extension)?
2. Should the starting point be limited by time? For example, ignore the
   previous result if it is older than X days.
3. Defaults: `PREVIOUS_RESULT` + `PREFER_NEW` for Diagnostic, and also for
   Placement? Placement doesn't allow retakes today.
4. UI scope: slice 1 only first, or both UI slices?

## Decisions (2026-10-07)

- A: shared parts for the start screen; the standard practice quiz keeps its
  markup and behaviour.
- B: retakes start at the last result. The age limit is a quiz setting,
  default 30 days.
- C: earlier questions come back only when no suitable new one is left; the
  out-of-range subcompetence rule stays.
- Defaults on for presets that allow retakes.

## Progress

- 2026-10-07: shared start screen (uzh-bf/klicker-uzh#6426).
- 2026-10-07: Catalyst `SEQUENTIAL_ROOTS_V7` retake context
  (uzh-bf/klicker-uzh-catalyst#80). Local simulation, 300 learners, 16 levels:
  retake repeats 39% -> 17%, items more than 3 levels off 21% -> 5%,
  accuracy unchanged within noise.
- 2026-10-07: host settings, publication snapshot, attempt snapshot and
  publication guard (this PR). Deploy the V7 engine first.
- Open: question view on shared components (slice 2); browser verification
  once the local database is restored.
