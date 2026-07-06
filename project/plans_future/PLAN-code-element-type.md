# PLAN: CODE Element Type (Programming Questions, Sandbox-Graded)

Status: future / no branch started. Research base: [RESEARCH-codeapi-integration.md](RESEARCH-codeapi-integration.md). All file refs verified against `v3` @ `d6c7772f8` (2026-07-06).

## Goal

New `ElementType.CODE`: students write code (v1: Python) in a real editor, submit, the submission runs in the codeapi sandbox against instructor-defined test cases, and grading (correct/partial/wrong + points/XP) flows through the existing evaluation machinery. First type in Klicker where the grader executes untrusted student code — hence the sandbox.

Why: courses teach Python; today the closest tools are FREE_TEXT (string match — useless for code) and NUMERICAL. Auto-graded programming exercises with per-test feedback close a real gap, and the sandbox already exists in production.

## Non-Goals (v1)

- No live-quiz support (deferred; see Staging). No group-activity support.
- No languages beyond Python (codeapi supports js/ts/node/bash — enable later behind the same `language` option).
- No AnswerCollection-style reusable test banks (SELECTION/CASE_STUDY pattern) — per-element test cases only.
- No LLM-based grading of code style/quality — deterministic test execution only. (Tutor-chat feedback is the chat plan's job.)
- No in-browser execution (pyodide) — rejected: diverges from graded runtime, no stdlib parity, heavy bundle.

## Current state (code)

- No CODE anywhere: `ElementType` enum is SC/MC/KPRIM/FREE_TEXT/NUMERICAL/CONTENT/FLASHCARD/SELECTION/CASE_STUDY (`packages/prisma/src/prisma/schema/element.prisma:9-18`); zero grep hits for execute_code/sandbox/codeapi in packages/graphql, packages/types, packages/grading.
- No central type registry — a new type = one new arm in ~15 union declarations in `packages/types/src/index.ts` plus scattered switches (full checklist below).
- All existing graders are pure sync functions (`packages/grading/src/index.ts`); practice-quiz grading runs **inside one Prisma transaction in the request path** (`packages/graphql/src/services/stacks.ts`, txn opened at `:2620`, no timeout override anywhere → Prisma default 5s interactive-tx timeout on `@prisma/client` 6.16.1). A sandbox call cannot go there — and not merely because of the default timeout: even a raised timeout would hold a DB connection + row locks for the sandbox's duration under concurrent submissions (pool exhaustion), and cold-start tail latency (up to JOB_TIMEOUT 300s) blows through any in-txn budget. Async is an operational-safety decision, not a Prisma technicality.
- No code-*editor* dependency exists anywhere in the monorepo (verified: no monaco/codemirror in any package.json). Syntax-*highlighting* dep `rehype-prism-plus@2.0.2` IS already declared (`packages/markdown/package.json:13`) but its import + `.use()` are commented out (`packages/markdown/src/Markdown.tsx:6,107`).

## Key design decisions

### 1. Grading model: test-case execution, weighted partial credit

- Element options carry instructor-defined test cases. Grader assembles a per-submission Python harness (student code + test runner), executes ONE codeapi `/v1/exec` call, parses structured results (JSON on stdout), computes `pointsPercentage = Σ(weight of passed tests) / Σ(weights)`.
- Partial credit maps onto the existing `computeAwardedPointsAndXP` path (`stacks.ts:2052`) like KPRIM's distance-based partial credit — no new scoring concepts.
- Test case visibility: `public` (shown to student, with per-test pass/fail feedback) vs `hidden` (never leaves the server). Follows the existing solution-stripping discipline (`validateAndProcessElementOptions.ts` gates on `hasSampleSolution`; live-quiz payload stripping at `liveQuizzes.ts:2760-2830`).
- One exec per submission (harness runs all tests in-process) — NOT one exec per test. Keeps cost/latency O(1) per submission and stays inside the 20 exec/30s per-user limit.

### 2. Async grading seam: PENDING → Hatchet task → push/poll (the critical architectural change)

Evidence (grading-flow trace): practice-quiz/microlearning `respondToElementStack` is fully synchronous inside a single Prisma transaction (`packages/graphql/src/schema/mutation.ts:271-284` → `stacks.ts:3164` `respondToElementStack` → `:2895` `respondToElement` **(the per-type dispatch — this is where CODE's new arm goes; existing arms at `:2927, 2960, 2994, 3026, 3055, 3084, 3117`)** → `:2602` `respondToQuestion`, txn at `:2620`). Holding that txn open for a 1–300s sandbox call = pool exhaustion + HTTP timeouts. The live-quiz path is already fire-and-forget via Hatchet (`apps/response-api/src/index.ts:155` → `apps/hatchet-worker-response-processor`), proving the repo pattern for decoupled grading.

Design for CODE in practice quiz / microlearning:
1. `respondToElementStack` detects a CODE instance → persists the raw submission with `gradingStatus: PENDING` (short txn, no sandbox call), returns `StackFeedback` immediately with a pending marker for that instance. Schema change: `StackFeedback`/evaluation payload gains an optional grading-status field (`packages/graphql/src/schema/practiceQuiz.ts:144-156` currently has no job/ticket notion).
2. A Hatchet durable task (`durableTask` + `retries: 3` pattern, `apps/hatchet-worker-response-processor/src/index.ts:28-34`) executes the sandbox call with its own timeout budget (≥ JOB_TIMEOUT), parses results.
3. On completion the task runs the SAME finalization the sync path performs — and that is more than points/XP: the sync txn also writes instance results/statistics, response details, the aggregate `QuestionResponse`, spaced-repetition fields, participant XP, leaderboard, and the daily activity timeline (`stacks.ts:2685,2782,2841` alongside `computeAwardedPointsAndXP` `:2052` and `updateLeaderboardOnQuestionResponse` `:2833`). Extract ONE shared `finalizeQuestionResponse` transaction helper covering ALL of these side effects, callable from both the sync path and the worker; do not cherry-pick scoring helpers.
4. Client gets the result via GraphQL subscription (pubSub publish precedent: `runningLiveQuizUpdated`, `liveQuizzes.ts:1119,1332` — but note those publishes run in the GraphQL service process; the worker side has only pubSub *client setup* today, `apps/hatchet-worker-general/src/index.ts:103-121`, zero worker-side `pubSub.publish` calls repo-wide — our task publishes from a worker for the first time) with a polling-query fallback.
- Failure UX: sandbox errors/timeouts → `gradingStatus: FAILED` + student-visible "grading failed, retry" affordance; retries exhausted → instructor-visible flag. Never silently drop a submission.
- **PENDING breaks today's atomicity — must design, not discover (slice 1 gate):** today response + points/XP are written all-or-nothing in one txn; no `QuestionResponse`/`QuestionResponseDetail` field expresses "not yet graded" (`packages/prisma/src/prisma/schema/response.prisma:7-74` — `score`/`correctness` always written with the grade, and the participant+instance unique constraints at `:35,:69` assume one final response), `StackFeedbackStatus` has no pending/failed state (`packages/types/src/index.ts:429-435`), and the resubmission lookup `getValidateElementInstance` (`stacks.ts:1187-1214`, called at `:2621`) fetches `existingResponse` by participant with **no grading-status filter**. Splitting into raw-PENDING-persist + later graded-persist opens a partial-state window: a resubmit while PENDING would hit `updateQuestionResults` with no branch for it → double-grade / corrupted aggregation. The microlearning duplicate-submit guard (`stacks.ts:~3174`) checks existing `element.responses` only — a pending submission stored OUTSIDE the response identity path would not block duplicates. Slice 1 must therefore decide the persistence model — lean: a separate `CodeSubmission` table holding raw code + gradingStatus + jobId, with `QuestionResponse` written only on grade completion (keeps existing invariants intact), vs extending the response tables with nullable-grade states — AND the `PENDING` resubmit policy (block / cancel-previous / queue), together with open question 4. Whatever the model, pending state must be visible to both `getValidateElementInstance` and the microlearning guard.
- **Client reload/tab-close mid-PENDING needs a real state machine, not a spinner:** today `ElementStack.tsx:473-625` awaits the mutation once, derives `evaluation` synchronously from the mutation result, and immediately wipes local answer state (`setStudentResponse({})`) — nothing survives a reload, there is no submission id to resume from. Slice 4/5 must define: how stackStorage/`setStepStatus` represent "awaiting grade" across a reload, and which query resumes/polls a specific pending response id after remount.

### 3. Editor: CodeMirror 6 (not Monaco)

Net-new dependency (verified none exists). CodeMirror 6: mobile-friendly (frontend-pwa students answer on phones — Monaco is desktop-oriented and heavy), tree-shakeable, ~10x smaller, python mode available. Pinned versions, wrapped once in a new `packages/shared-components/src/CodeEditor.tsx` so manage + pwa share it.

### 4. Options shape (`ElementOptionsCode`)

```ts
{
  language: 'python',                    // enum, v1 fixed
  starterCode?: string,                  // pre-filled in student editor
  sampleSolution?: string,               // gated by hasSampleSolution, shown post-answer
  testCases: Array<{
    name: string,                        // shown for public tests
    code: string,                        // assertion snippet run in harness
    visibility: 'public' | 'hidden',
    weight: number,                      // default 1
  }>,
  executionLimits?: { timeoutSeconds?: number },   // clamp ≤ codeapi JOB_TIMEOUT
  hasSampleSolution: boolean,
}
```

Results aggregation (`ElementResultsCode`): per-test pass counts + hashed-submission dedup (mirror `ElementResultsOpen` hashed-response pattern, `packages/types/src/index.ts:673-682`).

### 5. Security posture

- Student code executes ONLY in codeapi sandbox (no egress, non-root, ephemeral — see RESEARCH doc). Never in graphql service, never in worker process.
- Hidden test cases: server-side only; strip from every student-facing payload (options sanitization in `packages/graphql/src/lib/validateAndProcessElementOptions.ts` + the per-surface stripping switches).
- codeapi JWT minted server-side per grading job (TTL ≤300s), key from Infisical/ESO. `tenant_id=klicker-<env>`, `sub=participantId`. See RESEARCH doc §auth for the principal_source decision (fork patch preferred).
- Harness must treat student code as hostile even inside the sandbox: run tests in a subprocess with per-test timeout so an infinite loop fails that test rather than eating the whole JOB_TIMEOUT.

## Full touchpoint checklist (from anatomy research; the implementation map)

1. **prisma**: enum + migration `ALTER TYPE "ElementType" ADD VALUE 'CODE'` (pattern `20250128121845_case_study_element_type`); regenerate client. New `gradingStatus` on question-response detail if not representable in existing JSON results.
2. **packages/types/src/index.ts** (~15 arms): `OptionsCodeInput`, `ElementOptionsCode`, `CodeElementData`, `SingleQuestionResponseCode`, `ElementResultsCode`, `IInstanceEvaluationCode`, `StackResponseInput.codeResponse`, `ResponseInput.code`, `GroupActivityDecision.codeResponse` (stub, unused v1).
3. **packages/grading**: `gradeQuestionCode` becomes a *result-interpreter* (takes parsed test results → pointsPercentage) so it stays pure/sync/testable; the async sandbox call lives in the Hatchet task, not here.
4. **packages/graphql schema**: `elementData.ts` (options+data objectRefs + resolveType arm), `element.ts` (input ref, `SingleQuestionResponseCode`, `CodeInstanceEvaluation`, `CodeElement`, 3 union+resolveType arms), `evaluation.ts` (`CodeActivityEvaluationData` + union arm), `mutation.ts` `manipulateCodeQuestion` (template: `manipulateNumericalQuestion` at `mutation.ts:1085`), new `lib/validateCodeOptions.ts` (mirror sibling `lib/validateNumericalOptions.ts`) + switch arm in `validateAndProcessElementOptions.ts:1-131`.
5. **packages/graphql services**: `elements.ts` — audit ~24 type-conditional sites (`grep -c 'DB.ElementType\.'` = 24; CODE behaves like NUMERICAL/FREE_TEXT: scored, no answer-collection). `stacks.ts` — new CODE arm in the response dispatcher `respondToElement` (`:2895-3163`) routing to the pending-path instead of sync grading; evaluation-shape dispatcher arm in `computeQuestionEvaluation` (`:1407-1471` — this is the *results-interpreter* switch, distinct from the response dispatcher); plus arms in results-init/merge/storage switches (`:1952-2026, 2302-2330, 3750-3816, 4249-4378` — grep `DB.ElementType.` across the file first).
5b. **packages/util**: `getInitialInstanceResults` (`packages/util/src/elements.ts:185`, if/else-if on ElementType) needs a CODE arm producing the initial `ElementResultsCode` shape — called from `stacks.ts`, `elements.ts`, `templates.ts`, `accounts.ts`, `liveQuizzes.ts` and prisma-data seeds; missing it breaks instance creation.
5c. **packages/graphql services/templates.ts**: separate per-type switches — `elementTypesWithSampleSolution` (`:1421`) plus option-combination branches (`:1669,:1778`). v1 decision: **exclude CODE from templates** (block at template creation) or add explicit arms — do not leave it to fall through silently.
6. **Hatchet**: new `gradeCodeSubmission` durable task (new file in `apps/hatchet-worker-general` or a dedicated worker; NOT the live-quiz response-processor) + codeapi client module (JWT mint, exec, parse) + pubSub publish on completion.
7. **shared-components**: `StudentElement.tsx` dispatcher arm (`:114-474`), new `CodeQuestion.tsx` (props like `FreeTextQuestion.tsx`), new `CodeEditor.tsx` (CodeMirror wrapper), new `evaluation/CodeEvaluation.tsx` (per-public-test pass/fail + sample solution reveal; `QuestionExplanation.tsx` reused as-is). Also: `utils/validateResponse.ts` needs `validateCodeResponse`; response hooks `useSingleStudentResponse.ts:73`/`useStudentResponse.ts:93` default-case handling; charts `ElementBarChart.tsx:50`/`ElementHistogram.tsx:61`/`ElementTableChart.tsx:44,53`/`ElementWordcloud.tsx:95,177,182` hardcode `supportedElementTypes` — explicit decision: CODE is **excluded** from generic charts (per-test pass/fail doesn't fit bar/histogram/wordcloud); its aggregate view is the dedicated CodeEvaluation component.
8. **frontend-manage**: `types.ts` union (`:155-162`), `useElementTypeOptions.ts` entry, `useValidationSchema.ts` `useOptionsSchemaCode()` + arm (`:794-826`), `useElementFormInitialValues.ts` create+edit arms (`:29-53,:70-212`), `helpers.ts` `prepareCodeArgs()`, `ElementEditModal.tsx` mutation arm (`:158-350`), `ElementEditForm.tsx` `<CodeOptions/>` arm (`:223-291`), new `options/CodeOptions.tsx` (starter code + test-case FieldArray mirroring `FreeTextOptions.tsx:34-87` + language select), `StudentElementPreviewWrapper.tsx` arm (`:72-135`), `evaluation/ElementEvaluation.tsx` arm + new `evaluation/elements/CodeEvaluation.tsx` (aggregate: per-test pass rates), `manipulation/ElementContentInput.tsx` label/tooltip/placeholder maps (per-type Records at `~:24-72` — `Record<ElementType, …>` maps fail to compile on enum expansion), `ElementTypeMonitor.tsx:~17-25` typename mapping (`CODE` → `'CodeElementData'`), `activities/overview/details/ActivityOverviewTable.tsx:157` question classification. Before slice 2 sign-off: grep `Record<ElementType` and `ElementType\.` across frontend-manage — the compiler catches exhaustive Records, but ad-hoc if/switch sites it does not.
9. **frontend-pwa**: `ElementStack.tsx` response-shaping arm (`:106-249, 360-501`) + pending-state UI (spinner → subscription/poll → feedback), `GroupActivityStack.tsx`/`QuestionArea.tsx` untouched v1 (CODE excluded from those surfaces — enforce at creation/wizard level).
10. **i18n**: `shared.CODE` (short `CO`, typeLabel, text) in en.ts+de.ts, `shared.objectType.CODE`, `manage.formErrors.CO*` keys.
11. **export**: `packages/export/src/elementInstances.ts` is type-agnostic (no ElementType branches, verified) — smoke-test only.
12. **markdown**: enable `rehypePrism` (uncomment `Markdown.tsx:6,107`; dep `rehype-prism-plus@2.0.2` already present at `packages/markdown/package.json:13` — only the sanitizer schema needs checking) so code fences in question prose highlight. Independent quick win — see further-features plan.

## Surface staging

| Stage | Surface | Rationale |
|---|---|---|
| v1 | Practice quiz + microlearning | Self-paced → async grading latency acceptable; both share `ElementStack`/`StudentElement` path |
| v2 | Group activity | Decision model needs a code field; grading is instructor-assisted there anyway |
| v3 (maybe never) | Live quiz | Burst = whole class simultaneously; `PYTHON_CONCURRENCY=1`/worker + cold start makes real-time aggregation risky. Only after load-testing + pre-warm strategy. Precedent warning: CASE_STUDY's live-quiz aggregation bug went unnoticed 7 months (#4915). |

Enforce staging via the static per-wizard ElementType allow-lists in `apps/frontend-manage/src/components/activities/creation/` (arrays start `practiceQuiz/PracticeQuizWizard.tsx:~45`, `microLearning/MicroLearningWizard.tsx:~44`, `liveQuiz/LiveQuizWizard.tsx:~37`, `groupActivity/GroupActivityWizard.tsx:~48`): add CODE to practice-quiz + microlearning, deliberately NOT to live-quiz or group-activity. Note the flip side: without these additions CODE is not selectable anywhere — this belongs in slice 2.

## Implementation slices (when a branch starts; each = verify + review + commit)

1. Schema + types + validation: enum, migration, types/index.ts arms, validateCodeOptions, manipulateCodeQuestion mutation + service audit + `getInitialInstanceResults` CODE arm. **Gate: decide `gradingStatus` persistence (open question 4) AND the resubmit-while-PENDING policy (block / cancel-previous / queue) — the partial-state branch in `respondToQuestion`/`updateQuestionResults` must be designed here, before slice 4.** Check: create/edit CODE element via GraphQL, options sanitized (hidden tests absent from student payload).
2. Authoring UI: CodeOptions form + editor wrapper + type picker + validation + preview. Check: author a Python question with public+hidden tests in manage.
3. codeapi client + harness: JWT mint, exec call, Python test harness, result parsing; unit tests with recorded fixtures + one live test vs stg codeapi. Check: harness grades known-good/known-bad/timeout submissions correctly.
4. Async grading path: PENDING persist, Hatchet task, points/XP reuse, subscription + poll fallback, resubmit-while-PENDING branch per slice-1 decision. Check: e2e submit→pending→graded on local stack (compose codeapi in LOCAL_MODE); resubmit during PENDING behaves per policy.
5. Student UI: CodeQuestion + CodeEvaluation + pending states in ElementStack, incl. the reload state machine (stackStorage/`setStepStatus` representation of "awaiting grade", resume/poll query by pending response id after remount — today `ElementStack.tsx:473-625` wipes local state on mutation return). Check: cypress e2e practice-quiz flow incl. reload-mid-PENDING.
6. Evaluation/analytics: CodeActivityEvaluationData + manage evaluation component. Check: instructor sees per-test pass rates.
7. Hardening: failure UX, rate-limit handling (429/Retry-After), load smoke (N parallel submissions vs stg), security review (hidden-test leakage, JWT scope), i18n parity.

## Effort estimate

Precedent: CASE_STUDY = 12 staged PRs, ~143 files, ~10 working days, single dev, full surface parity. CODE v1 is narrower (2 surfaces, no live quiz/group/scatter-analytics) but adds three genuinely novel pieces CASE_STUDY didn't need: async grading infrastructure, external service client + auth, editor dependency. Estimate: **10–15 dev-days** for v1 (slices 1–7), plus infra prerequisites from RESEARCH doc §open-questions (JWKS key add, principal_source decision) that need DF-cloud MRs.

## Testing strategy

- Unit: gradeQuestionCode interpreter, harness generator, options validation/sanitization (hidden-test stripping!), JWT minter (claims shape vs codeapi `validateClaims` fixture).
- Integration: Hatchet task against LOCAL_MODE codeapi (docker compose — the code-interpreter workspace ships `up.sh`); pending→graded round-trip.
- E2E: cypress author→answer→feedback flow (pattern: CASE_STUDY's `#4482`/`#4488` e2e commits).
- Load: scripted burst of ≥50 concurrent submissions vs stg before any course pilot.

## Open questions

1. Per-test subprocess timeout budget inside the harness (default 5s/test?) and max test count per element (cap ~20?).
2. Resubmission policy: practice quiz allows retries — does each retry consume a sandbox run without limit, or cap per participant/day? (codeapi's 20/30s per-user limit is the backstop, not a policy.)
3. Should public tests run client-visible with stdout shown, or only pass/fail? (Pedagogy: showing actual output/traceback is the point — lean yes, but sanitize/limit output size.)
4. `gradingStatus` persistence: new column vs encode in existing results JSON — decide in slice 1 with migration review.
5. Pilot course + instructor for v1 validation (drives the package-set audit in RESEARCH doc).
