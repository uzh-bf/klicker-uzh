# PLAN: CODE Element Type (Programming Questions, Sandbox-Graded)

Status: future / no implementation branch started. Research base: [RESEARCH-codeapi-integration.md](RESEARCH-codeapi-integration.md). Code touchpoints rechecked against `v3` @ `c8de9c897` (2026-07-23); line numbers below still refer to the original `d6c7772f8` review base unless stated otherwise.

Proposed ADRs: [ADR 0001](../../docs/adr/0001-separate-code-submission-lifecycle.md) keeps pending attempts outside `QuestionResponse`; [ADR 0002](../../docs/adr/0002-keep-grading-assertions-outside-the-sandbox.md) keeps expected outputs and instructor assertions outside codeapi.

Note 2026-07-12: the Mastra chat migration ([PR #5126](https://github.com/uzh-bf/klicker-uzh/pull/5126) / [PR #5129](https://github.com/uzh-bf/klicker-uzh/pull/5129)) does NOT affect this plan — the grading path is backend GraphQL + Hatchet, untouched by the chat-stack change. Only touchpoint: the codeapi client + JWT minter should be a shared `packages/` module built by whichever implementation lands first, then reused by the other.

## Progress

- 2026-07-23: implementation-readiness review integrated; code touchpoints rechecked against current `v3`.
- Resolved in this future plan: separate `CodeSubmission`, active-resubmit blocking, claim/expiry + idempotent finalization, CODE-only stacks, and server-side grading assertions.
- Ready next: approve the proposed v1 validation and retry defaults under Decisions below, sync the carrying branch with current `v3`, add a dated active execution plan, and implement slice 1 in the same PR. Recommended: continue on PR 5142 and retitle it for the CODE implementation. If a fresh branch is preferred, carry all architecture commits into its implementation PR and close PR 5142 unmerged.
- External gates: resolve the four codeapi infrastructure questions in the research doc before slice 3 exercises the live service; identify the pilot course/package set before end-to-end sign-off.

## Goal

New `ElementType.CODE`: students write code (v1: Python) in a real editor, submit, the submission runs in the codeapi sandbox against instructor-defined test cases, and grading (correct/partial/wrong + points/XP) flows through the existing evaluation machinery. First type in Klicker where the grader executes untrusted student code — hence the sandbox.

Why: courses teach Python; today the closest tools are FREE_TEXT (string match — useless for code) and NUMERICAL. Auto-graded programming exercises with per-test feedback close a real gap, and the sandbox already exists in production.

## Non-Goals (v1)

- No live-quiz support (deferred; see Staging). No group-activity support.
- No languages beyond Python (codeapi supports js/ts/node/bash — enable later behind the same `language` option).
- No AnswerCollection-style reusable test banks (SELECTION/CASE_STUDY pattern) — per-element test cases only.
- No arbitrary instructor assertion snippets in the sandbox. V1 uses function-style, JSON-serializable inputs and expected outputs; Klicker compares outcomes after execution.
- No mixed or multi-CODE stacks in v1. A CODE stack contains exactly one CODE element so pending state has one submission identity and one final score.
- No LLM-based grading of code style/quality — deterministic test execution only. (Tutor-chat feedback is the chat plan's job.)
- No in-browser execution (pyodide) — rejected: diverges from graded runtime, no stdlib parity, heavy bundle.

## Current state (code)

- No CODE anywhere: `ElementType` enum is SC/MC/KPRIM/FREE_TEXT/NUMERICAL/CONTENT/FLASHCARD/SELECTION/CASE_STUDY (`packages/prisma/src/prisma/schema/element.prisma:9-18`); zero grep hits for execute_code/sandbox/codeapi in packages/graphql, packages/types, packages/grading.
- No central type registry — a new type = one new arm in ~15 union declarations in `packages/types/src/index.ts` plus scattered switches (full checklist below).
- All existing graders are pure sync functions (`packages/grading/src/index.ts`); practice-quiz grading runs **inside one Prisma transaction in the request path** (`packages/graphql/src/services/stacks.ts`, txn opened at `:2620`, no timeout override anywhere → Prisma default 5s interactive-tx timeout on `@prisma/client` 6.16.1). A sandbox call cannot go there — and not merely because of the default timeout: even a raised timeout would hold a DB connection + row locks for the sandbox's duration under concurrent submissions (pool exhaustion), and cold-start tail latency (up to JOB_TIMEOUT 300s) blows through any in-txn budget. Async is an operational-safety decision, not a Prisma technicality.
- No code-*editor* dependency exists anywhere in the monorepo (verified: no monaco/codemirror in any package.json). Syntax-*highlighting* dep `rehype-prism-plus@2.0.2` IS already declared (`packages/markdown/package.json:13`) but its import + `.use()` are commented out (`packages/markdown/src/Markdown.tsx:6,107`).

## Key design decisions

### 1. Grading model: test-case execution, weighted partial credit

- Element options carry declarative function tests: entrypoint, JSON-serializable arguments, expected output, visibility, and weight. The codeapi request receives student code plus test invocations, but never expected outputs or instructor assertion code ([ADR 0002](../../docs/adr/0002-keep-grading-assertions-outside-the-sandbox.md)).
- At most two codeapi `/v1/exec` calls run per submission: one batches public invocations and one batches hidden invocations. Each call uses a fresh sandbox session, and each invocation runs in a child process. Public and hidden tests never share a session, filesystem, file reference, stdout/stderr stream, or result payload.
- Each execution returns raw values, exceptions, stdout/stderr, and timeout markers. The Klicker worker treats the response as untrusted, validates its schema, and compares each raw outcome with the server-held expectation. It discards every hidden artifact, session identifier, stdout/stderr stream, and exception message after deriving the instructor-only result.
- The worker computes `pointsPercentage = Σ(weight of passed tests) / Σ(weights)`. Student code and the sandbox runner can report outcomes, but they never report whether a test passed.
- Partial credit maps onto the existing `computeAwardedPointsAndXP` path (`stacks.ts:2052`) like KPRIM's distance-based partial credit — no new scoring concepts.
- Test case visibility: `public` shows its inputs, expected output, and capped per-test stdout/stderr after grading. `hidden` keeps its name, expectation, and captured output server-side. Hidden invocation arguments are necessarily visible to the executing student function, but the client never receives them. This follows the existing solution-stripping discipline (`validateAndProcessElementOptions.ts` gates on `hasSampleSolution`; live-quiz payload stripping at `liveQuizzes.ts:2760-2830`).
- One execution per visibility class, not one execution per test. This keeps cost and latency O(1) per submission. A submission containing both public and hidden tests consumes two of the 20 executions allowed per user per 30 seconds.

### 2. Async grading seam: PENDING → Hatchet task → push/poll (the critical architectural change)

Evidence (grading-flow trace): practice-quiz/microlearning `respondToElementStack` is fully synchronous inside a single Prisma transaction (`packages/graphql/src/schema/mutation.ts:271-284` → `stacks.ts:3164` `respondToElementStack` → `:2895` `respondToElement` **(the per-type dispatch — this is where CODE's new arm goes; existing arms at `:2927, 2960, 2994, 3026, 3055, 3084, 3117`)** → `:2602` `respondToQuestion`, txn at `:2620`). Holding that txn open for a 1–300s sandbox call = pool exhaustion + HTTP timeouts. The live-quiz path is already fire-and-forget via Hatchet (`apps/response-api/src/index.ts:155` → `apps/hatchet-worker-response-processor`), proving the repo pattern for decoupled grading.

Design for CODE in practice quiz / microlearning:
1. Backend validation requires a CODE stack to contain exactly one CODE element. `respondToElementStack` creates a `CodeSubmission` with immutable input fields and `PENDING` status in a short transaction and returns `{ submissionId, gradingStatus: PENDING }`; `QuestionResponse` remains absent ([ADR 0001](../../docs/adr/0001-separate-code-submission-lifecycle.md)).
2. `StackFeedback` gains an orthogonal `gradingStatus` (`PENDING | RUNNING | COMPLETED | FAILED`) plus nullable `submissionId`. The existing non-null correctness `status` remains `UNANSWERED` until completion; score and evaluation remain null. Clients use `gradingStatus`, rather than overloading `StackFeedbackStatus` with job lifecycle.
3. A Hatchet durable task (`durableTask` + `retries: 3` pattern, `apps/hatchet-worker-response-processor/src/index.ts:28-34`) atomically claims a `PENDING` row or reclaims an expired `RUNNING` row with a random claim token and expiry, increments `claimAttempts`, executes the sandbox calls with a timeout budget of `numberOfVisibilityClasses × JOB_TIMEOUT + bounded overhead` (at most two calls), and parses raw outcomes. A duplicate worker exits when it cannot claim the row.
4. `finalizeCodeSubmission(submissionId, claimToken, outcomes)` locks the submission and runs one transaction. If the row is already `COMPLETED`, it returns the stored result without side effects. Otherwise it verifies the active claim, writes every side effect of today's sync path, and marks the submission `COMPLETED` in the same commit. This covers instance results/statistics, response details, aggregate `QuestionResponse`, spaced repetition, participant XP, leaderboard, and daily activity timeline (`stacks.ts:2685,2782,2841`, `computeAwardedPointsAndXP` at `:2052`, `updateLeaderboardOnQuestionResponse` at `:2833`). A retry after commit is therefore a no-op.
5. The client gets the result via GraphQL subscription (pubSub publish precedent: `runningLiveQuizUpdated`, `liveQuizzes.ts:1119,1332`; worker-side setup exists in `apps/hatchet-worker-general/src/index.ts:103-121`) with a query/poll fallback.
- Failure UX: after Hatchet retries are exhausted, `failCodeSubmission(submissionId, claimToken, failure)` locks and verifies the active claim, sets `FAILED`, stores bounded instructor-only failure metadata, clears the claim, and publishes the terminal receipt. The student sees a generic "grading failed, retry" affordance. Never silently drop a submission.
- A partial unique index on `(participantId, elementInstanceId)` for `PENDING`/`RUNNING` submissions enforces one active attempt. A resubmit while active returns the existing receipt and does not enqueue another task. After `FAILED`, the student can create a new submission; after `COMPLETED`, normal practice-quiz retries create a new submission. The microlearning duplicate guard checks completed `QuestionResponse` rows and active/completed `CodeSubmission` rows.
- **Client reload/tab-close mid-PENDING needs a persisted receipt, not a spinner:** today `ElementStack.tsx:473-625` awaits the mutation once, derives `evaluation` synchronously, and clears local answer state. The client must first store `submissionId` and `gradingStatus` in `stackStorage`, resume the submission query after remount, and clear the editable response only after the receipt is durable. It advances the stack only after `COMPLETED`; `FAILED` keeps a retry affordance.

### 3. Editor: CodeMirror 6 (not Monaco)

Net-new dependency (verified none exists). CodeMirror 6: mobile-friendly (frontend-pwa students answer on phones — Monaco is desktop-oriented and heavy), tree-shakeable, ~10x smaller, python mode available. Pinned versions, wrapped once in a new `packages/shared-components/src/CodeEditor.tsx` so manage + pwa share it.

### 4. Options shape (`ElementOptionsCode`)

```ts
{
  language: 'python',                    // enum, v1 fixed
  starterCode?: string,                  // pre-filled in student editor
  sampleSolution?: string,               // gated by hasSampleSolution, shown post-answer
  entrypoint: string,                    // function exported by student code
  testCases: Array<{
    id: string,                          // stable opaque result key
    name: string,                        // shown only for public tests
    args: JsonValue[],                   // arguments passed to entrypoint
    expectedOutput: JsonValue,           // compared in Klicker worker, never sent to codeapi
    visibility: 'public' | 'hidden',
    weight: number,                      // default 1
  }>,
  executionLimits?: {
    perTestTimeoutSeconds?: number,      // clamp to server maximum
  },
  hasSampleSolution: boolean,
}
```

Results aggregation (`ElementResultsCode`): per-test pass counts + hashed-submission dedup (mirror `ElementResultsOpen` hashed-response pattern, `packages/types/src/index.ts:673-682`).

### 4a. Persistence contract (`CodeSubmission`)

Slice 1 starts from this schema contract; names may change only with a plan update and migration review:

```prisma
enum CodeSubmissionStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
}

model CodeSubmission {
  id     String               @id @default(uuid()) @db.Uuid
  status CodeSubmissionStatus @default(PENDING)

  code      String @db.Text
  timeSpent Float  @db.Real

  /// [PrismaCodeSubmissionResult]
  result Json?

  claimToken     String?   @db.Uuid
  claimExpiresAt DateTime?
  claimAttempts  Int       @default(0)
  failureCode    String?
  failureDetails String?   @db.Text
  completedAt    DateTime?
  failedAt       DateTime?

  participant   Participant @relation(fields: [participantId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  participantId String      @db.Uuid

  participation   Participation @relation(fields: [participationId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  participationId Int

  elementInstance   ElementInstance @relation(fields: [elementInstanceId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  elementInstanceId Int

  practiceQuiz   PracticeQuiz? @relation(fields: [practiceQuizId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  practiceQuizId String?       @db.Uuid

  microLearning   MicroLearning? @relation(fields: [microLearningId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  microLearningId String?        @db.Uuid

  course   Course @relation(fields: [courseId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  courseId String @db.Uuid

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([participantId, elementInstanceId, createdAt])
  @@index([practiceQuizId])
  @@index([microLearningId])
}
```

The migration adds matching `codeSubmissions CodeSubmission[]` back-relations to `Participant`, `Participation`, `ElementInstance`, `PracticeQuiz`, `MicroLearning`, and `Course`; a raw-SQL partial unique index on `(participantId, elementInstanceId)` where status is `PENDING` or `RUNNING`; and a check constraint requiring exactly one of `practiceQuizId` or `microLearningId`. `code`, `timeSpent`, participant/activity identity, and the element instance are immutable after insert. Only claim fields, lifecycle status, bounded failure metadata, timestamps, and the normalized `result` may change.

GraphQL exposes an authorized `CodeSubmissionReceipt { id, gradingStatus, feedback }` and a participant-owned `codeSubmission(id)` query with the same shape. `feedback` is null until completion or failure and never contains hidden inputs, outputs, artifacts, session identifiers, stdout/stderr, or exception text. `StackFeedback` embeds the receipt fields so mutation, subscription, and polling share one contract.

### 5. Security posture

- Student code executes ONLY in codeapi sandbox (no egress, non-root, ephemeral — see RESEARCH doc). Never in graphql service, never in worker process.
- Expected outputs, weights, hidden test names, and pass/fail decisions stay in the Klicker worker. The outbound codeapi payload must contain no expected values or instructor assertion source; a contract test inspects the serialized request. See [ADR 0002](../../docs/adr/0002-keep-grading-assertions-outside-the-sandbox.md).
- Hidden test cases are stripped from every student-facing payload (options sanitization in `packages/graphql/src/lib/validateAndProcessElementOptions.ts` + the per-surface stripping switches). Public and hidden invocations use separate fresh sandbox sessions. Public feedback may expose capped stdout/stderr; hidden artifacts, session identifiers, stdout/stderr, and exception text never enter the participant receipt or any later public execution.
- codeapi JWT minted server-side per grading job (TTL ≤300s), key from Infisical/ESO. `tenant_id=klicker-<env>`, `sub=participantId`. See RESEARCH doc §auth for the principal_source decision (fork patch preferred).
- The runner treats student code and all sandbox output as hostile: each invocation runs in a fresh subprocess with a per-test timeout, output and exception text are capped, and only a strict result schema crosses back into the worker.
- Finalization is idempotent by submission identity and claim token. Hatchet delivery, retry, and acknowledgement are never treated as exactly-once guarantees.

## Full touchpoint checklist (from anatomy research; the implementation map)

1. **prisma**: enum + migration `ALTER TYPE "ElementType" ADD VALUE 'CODE'` (pattern `20250128121845_case_study_element_type`); regenerate client. Add `CodeSubmission` + `CodeSubmissionStatus` (`PENDING`, `RUNNING`, `COMPLETED`, `FAILED`), immutable code/response metadata, claim token/expiry, failure metadata, timestamps, and relations to participant/participation/instance/activity. Add a raw-SQL partial unique index for one active submission per participant+instance. Do not add nullable grading state to `QuestionResponse`.
2. **packages/types/src/index.ts** (~15 arms): `OptionsCodeInput`, `ElementOptionsCode`, `CodeElementData`, `SingleQuestionResponseCode`, `ElementResultsCode`, `IInstanceEvaluationCode`, `CodeSubmissionReceipt`, `CodeSubmissionStatus`, `StackResponseInput.codeResponse`, `ResponseInput.code`, `GroupActivityDecision.codeResponse` (stub, unused v1).
3. **packages/grading**: `gradeQuestionCode` becomes a *result-interpreter* (takes parsed test results → pointsPercentage) so it stays pure/sync/testable; the async sandbox call lives in the Hatchet task, not here.
4. **packages/graphql schema**: `elementData.ts` (options+data objectRefs + resolveType arm), `element.ts` (input ref, `SingleQuestionResponseCode`, `CodeInstanceEvaluation`, `CodeElement`, 3 union+resolveType arms), `evaluation.ts` (`CodeActivityEvaluationData` + union arm), `mutation.ts` `manipulateCodeQuestion` (template: `manipulateNumericalQuestion` at `mutation.ts:1085`), new `lib/validateCodeOptions.ts` (mirror sibling `lib/validateNumericalOptions.ts`) + switch arm in `validateAndProcessElementOptions.ts:1-131`.
5. **packages/graphql services**: `elements.ts` — audit ~24 type-conditional sites (`grep -c 'DB.ElementType\.'` = 24; CODE behaves like NUMERICAL/FREE_TEXT: scored, no answer-collection). `stacks.ts` — reject mixed/multi-CODE stacks server-side; add a CODE response arm that creates/returns a `CodeSubmission` receipt instead of sync grading; add an idempotent `finalizeCodeSubmission` path and the evaluation-shape arm in `computeQuestionEvaluation` (`:1407-1471`); plus arms in results-init/merge/storage switches (`:1952-2026, 2302-2330, 3750-3816, 4249-4378` — grep `DB.ElementType.` across the file first).
5b. **packages/util**: `getInitialInstanceResults` (`packages/util/src/elements.ts:185`, if/else-if on ElementType) needs a CODE arm producing the initial `ElementResultsCode` shape — called from `stacks.ts`, `elements.ts`, `templates.ts`, `accounts.ts`, `liveQuizzes.ts` and prisma-data seeds; missing it breaks instance creation.
5c. **packages/graphql services/templates.ts**: separate per-type switches — `elementTypesWithSampleSolution` (`:1421`) plus option-combination branches (`:1669,:1778`). v1 decision: **exclude CODE from templates** (block at template creation) or add explicit arms — do not leave it to fall through silently.
6. **Hatchet**: new `gradeCodeSubmission` durable task in `apps/hatchet-worker-general` or a dedicated worker, not the live-quiz response processor. It claims with token+expiry, calls the shared `packages/` codeapi client once per non-empty visibility class with fresh sessions, sends invocation-only runner input, discards hidden execution artifacts/output after comparison, validates raw outcomes, finalizes once, and publishes completion. Add recovery for expired claims and an on-failure transition to `FAILED`.
7. **shared-components**: `StudentElement.tsx` dispatcher arm (`:114-474`), new `CodeQuestion.tsx` (props like `FreeTextQuestion.tsx`), new `CodeEditor.tsx` (CodeMirror wrapper), new `evaluation/CodeEvaluation.tsx` (per-public-test pass/fail + sample solution reveal; `QuestionExplanation.tsx` reused as-is). Also: `utils/validateResponse.ts` needs `validateCodeResponse`; response hooks `useSingleStudentResponse.ts:73`/`useStudentResponse.ts:93` default-case handling; charts `ElementBarChart.tsx:50`/`ElementHistogram.tsx:61`/`ElementTableChart.tsx:44,53`/`ElementWordcloud.tsx:95,177,182` hardcode `supportedElementTypes` — explicit decision: CODE is **excluded** from generic charts (per-test pass/fail doesn't fit bar/histogram/wordcloud); its aggregate view is the dedicated CodeEvaluation component.
8. **frontend-manage**: `types.ts` union (`:155-162`), `useElementTypeOptions.ts` entry, `useValidationSchema.ts` `useOptionsSchemaCode()` + arm (`:794-826`), `useElementFormInitialValues.ts` create+edit arms (`:29-53,:70-212`), `helpers.ts` `prepareCodeArgs()`, `ElementEditModal.tsx` mutation arm (`:158-350`), `ElementEditForm.tsx` `<CodeOptions/>` arm (`:223-291`), new `options/CodeOptions.tsx` (entrypoint, starter code, declarative public/hidden tests, expected JSON output, weights), `StudentElementPreviewWrapper.tsx` arm (`:72-135`), `evaluation/ElementEvaluation.tsx` arm + new `evaluation/elements/CodeEvaluation.tsx` (aggregate: per-test pass rates), `manipulation/ElementContentInput.tsx` label/tooltip/placeholder maps, `ElementTypeMonitor.tsx` typename mapping, `ActivityOverviewTable.tsx` question classification. Authoring and backend validation require exactly one CODE element in a CODE stack. Before slice 2 sign-off: grep `Record<ElementType` and `ElementType\.` across frontend-manage.
9. **frontend-pwa**: `ElementStack.tsx` response-shaping arm (`:106-249, 360-501`) + receipt persistence + pending subscription/poll + reload recovery + completed/failed feedback. `GroupActivityStack.tsx`/`QuestionArea.tsx` remain untouched v1.
10. **i18n**: `shared.CODE` (short `CO`, typeLabel, text) in en.ts+de.ts, `shared.objectType.CODE`, `manage.formErrors.CO*` keys.
11. **export**: `packages/export/src/elementInstances.ts` is type-agnostic. Authorized instructor export may include complete authoring options, including hidden expectations; student-facing APIs and exports must never reuse that raw shape. Add one authorization/snapshot test rather than a smoke test only.
12. **markdown**: enable `rehypePrism` (uncomment `Markdown.tsx:6,107`; dep `rehype-prism-plus@2.0.2` already present at `packages/markdown/package.json:13` — only the sanitizer schema needs checking) so code fences in question prose highlight. Independent quick win — see further-features plan.

## Surface staging

| Stage | Surface | Rationale |
|---|---|---|
| v1 | Practice quiz + microlearning, one CODE element per stack | Self-paced → async grading latency acceptable; both share `ElementStack`/`StudentElement`; CODE-only stacks avoid provisional mixed-stack scoring |
| v2 | Group activity | Decision model needs a code field; grading is instructor-assisted there anyway |
| v3 (maybe never) | Live quiz | Burst = whole class simultaneously; `PYTHON_CONCURRENCY=1`/worker + cold start makes real-time aggregation risky. Only after load-testing + pre-warm strategy. Precedent warning: CASE_STUDY's live-quiz aggregation bug went unnoticed 7 months ([PR #4915](https://github.com/uzh-bf/klicker-uzh/pull/4915)). |

Enforce staging via the static per-wizard ElementType allow-lists in `apps/frontend-manage/src/components/activities/creation/`: add CODE to practice-quiz + microlearning, deliberately NOT to live-quiz or group-activity. Enforce exactly one CODE element per stack in both authoring validation and the backend; UI-only gating is not a security or integrity boundary.

## Implementation slices (when a branch starts; each = verify + review + commit)

1. Schema + contracts: enum, `CodeSubmission`, active-submission index, receipt/status GraphQL types, declarative test options, validation/sanitization, CODE-only stack validation, service audit, and `getInitialInstanceResults` arm. Check: create/edit CODE via GraphQL; hidden tests are absent from student payload; mixed/multi-CODE stacks are rejected; `QuestionResponse` schema stays unchanged.
2. Authoring UI: CodeOptions form + editor wrapper + type picker + validation + preview. Check: author a function-style Python question with public+hidden JSON tests; invalid entrypoints/outputs and mixed stacks are blocked.
3. codeapi client + runner: JWT mint, public/hidden exec separation, invocation-only Python runner, strict raw-result parser, hidden-output disposal, and worker-side comparator; unit fixtures + one live test vs stg codeapi. Check: outbound requests contain no expected values/assertion source; public and hidden tests never share a session or artifacts; known-good/known-bad/timeout/malicious-output submissions grade correctly.
4. Idempotent async grading: receipt creation, claim/expiry, Hatchet task, one-transaction finalization, failure transition, subscription + poll fallback, and active-resubmit blocking. Check: local submit→pending→graded; duplicate delivery and retry-after-commit do not double-write points/XP/leaderboard; expired claim recovers; active resubmit returns the existing receipt.
5. Student UI: CodeQuestion + CodeEvaluation + receipt-backed pending states in ElementStack. Persist before clearing input; resume by submission id after reload; advance only on completion. Check: Playwright E2E practice-quiz and microlearning flows, including reload-mid-PENDING and FAILED→retry.
6. Evaluation/analytics: CodeActivityEvaluationData + manage evaluation component. Check: instructor sees per-test pass rates.
7. Hardening: failure UX, rate-limit handling (429/Retry-After), load smoke (N parallel submissions vs stg), security review (outbound hidden-test contract, hostile result parsing, JWT scope), instructor-export authorization, and i18n parity.

## Effort estimate

Precedent: CASE_STUDY = 12 staged PRs, ~143 files, ~10 working days, single dev, full surface parity. CODE v1 is narrower (2 surfaces, CODE-only stacks, no live quiz/group/scatter analytics) but adds four novel pieces: submission lifecycle/idempotency, external service client + auth, hostile-runner boundary, and editor dependency. Estimate: **12–18 dev-days** for v1 (slices 1–7), plus infra prerequisites from RESEARCH doc §open-questions that need DF-cloud MRs. Re-estimate after slice 1.

## Testing strategy

- Unit: worker-side comparator, invocation runner generator, strict result parser, options validation/sanitization, outbound-request snapshots proving expected values/assertions are absent, public/hidden executions use distinct sessions, hidden artifacts/output are dropped, JWT claims fixture.
- Integration: Hatchet task against LOCAL_MODE codeapi; pending→graded, duplicate-delivery, retry-after-commit, expired-claim recovery, FAILED→retry, and active-submission uniqueness.
- E2E: Playwright author→answer→pending→feedback flow for practice quiz and microlearning, including reload-mid-PENDING and backend rejection of mixed/multi-CODE stacks.
- Load: scripted burst of ≥50 concurrent submissions vs stg before any course pilot.

## Decisions before implementation

| Decision | Proposed v1 default | Why / gate |
|---|---|---|
| Per-test timeout and test-count cap | 5 seconds per test, at most 20 tests | Bounds one submission below codeapi's job timeout and process cap. Approve before slice 1 validation contracts. |
| Retry budget after completed/failed attempts | Keep existing practice-quiz retry behavior; add no new course policy in v1. Only one active CODE attempt is allowed. | Avoids introducing a CODE-specific attempt model. Revisit with pilot usage data. Approve before slice 1 persistence contracts. |
| Result comparison | Exact JSON equality in v1; defer numeric tolerance until a pilot demonstrates the need. | Keeps the comparator deterministic and the authoring schema small. Approve before slice 1 options contracts. |
| Pilot | Select one course and instructor; audit its required Python packages before slice 3. | Determines whether the current sandbox image is sufficient and supplies end-to-end acceptance cases. |
