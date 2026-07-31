# Regular Live Quiz Reset Review Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every actionable review finding on PR #5258 and reduce the two oversized reset/reward services into focused, behavior-preserving modules while the PR remains draft.

**Architecture:** Keep `liveQuizRewards.ts` and `liveQuizReset.ts` as compatibility façades/orchestrators, but move reward calculation, validation, legacy inspection, ledger reversal, execution-cache fencing, reset summaries, reset transactions, and Live Quiz `ActivityInfo` mapping into focused modules. Add regression coverage for exact achievement-count summaries and actual timeline-row modification totals before changing implementation.

**Tech Stack:** TypeScript 6, Node.js 24, pnpm 11, Prisma 7/PostgreSQL, GraphQL/Pothos, Redis/ioredis, Vitest, Playwright, Prettier

## Global Constraints

- Keep PR #5258 in draft.
- Preserve all public GraphQL names and generated operation contracts.
- Preserve the serializable reset transaction, assessment authorization, exact-or-reject legacy behavior, Redis generation fencing, and Hatchet retry behavior.
- Add no dependencies and make no schema or migration changes.
- Resolve all current actionable review threads after verified code changes are pushed.
- Keep the feature branch diff free of screenshots, secrets, and real participant data.

## Explicit Deferral

Keep `liveQuizReset.test.ts` and `liveQuizRewards.test.ts` as their existing
serial integration suites in this PR. They share one Prisma cleanup lifecycle
and Redis `flushdb` namespaces; physically splitting them before per-file
database and Redis isolation would introduce parallel truncation and cache
races. The focused production modules and complete 59/59 reset and 49/49 reward
suites provide the intended coverage without that harness churn.

---

### Task 1: Correct Review Findings

**Files:**

- Modify: `packages/graphql/src/services/liveQuizReset.ts`
- Modify: `packages/graphql/src/services/liveQuizRewards.ts`
- Modify: `packages/graphql/test/liveQuizReset.test.ts`
- Modify: `packages/graphql/test/liveQuizRewards.test.ts`

**Interfaces:**

- Consumes: existing reset-summary and reward-reversal results.
- Produces: achievement summaries expressed as occurrence-count deltas and timeline audit totals expressed as rows actually modified.

- [x] **Step 1: Add a failing summary regression**

Create an applied reward entry with `achievementCountAwarded: 2`, query `getLiveQuizResetSummary`, and assert `numOfAchievementChanges` equals `2`.

- [x] **Step 2: Add a failing timeline-total regression**

Reverse a reward run after both the matching daily and weekly timeline rows are absent, and assert `totals.timelineChanges` equals `0`.

- [x] **Step 3: Implement the minimal corrections**

Sum `achievementCountAwarded` in reset summaries. Increment `timelineChanges` only inside the branch that updates or deletes a timeline row.

- [x] **Step 4: Remove the six obsolete test arguments**

Keep the shared Hatchet handler contract's injected execution context required.
Type the implementation with `satisfies`, make only its unused third parameter
optional for direct calls, then delete every trailing `{} as never` passed to
`handleCleanupLiveQuizResetCache`; keep the first two arguments unchanged.

- [x] **Step 5: Run the focused tests**

Run:

```bash
pnpm --filter @klicker-uzh/graphql test:local -- liveQuizRewards.test.ts
pnpm --filter @klicker-uzh/graphql test:local -- liveQuizReset.test.ts
```

Expected: both files pass, including the new regressions.

---

### Task 2: Extract Reward Responsibilities

**Files:**

- Create: `packages/graphql/src/services/liveQuizRewardTypes.ts`
- Create: `packages/graphql/src/services/liveQuizRewardValidation.ts`
- Create: `packages/graphql/src/services/liveQuizRewardState.ts`
- Create: `packages/graphql/src/services/liveQuizRewardCalculation.ts`
- Create: `packages/graphql/src/services/liveQuizRewardLegacy.ts`
- Create: `packages/graphql/src/services/liveQuizRewardLedger.ts`
- Modify: `packages/graphql/src/services/liveQuizRewards.ts`
- Modify: `packages/graphql/src/services/liveQuizReset.ts`

**Interfaces:**

- Produces: the existing public exports from `liveQuizRewards.ts` through re-exports, plus one canonical typed reward-entry validator used by summary, legacy inspection, and reversal.

- [x] **Step 1: Move shared reward interfaces into `liveQuizRewardTypes.ts`**

Keep every exported name and field unchanged.

- [x] **Step 2: Add typed validation and shared current-state preflight**

Define the structural reward-entry contract and canonical typed partitions for participant, participation/course, timeline, achievement, and nonnegative-delta validity in `liveQuizRewardValidation.ts`. Load and preflight the matching current reward state once in `liveQuizRewardState.ts`, preserving the distinct legacy UTC-day and persisted exact-timestamp semantics.

- [x] **Step 3: Move pure calculation and snapshots**

Move reward snapshot parsing, plan calculation, sample-solution checks, rank-achievement eligibility, and achievement loading into `liveQuizRewardCalculation.ts`.

- [x] **Step 4: Move legacy reconstruction**

Move exact legacy inspection and current-reward evidence checks into `liveQuizRewardLegacy.ts`, consuming the canonical validators and calculation functions.

- [x] **Step 5: Move ledger apply/reversal**

Move reward-run creation, application, weekly recomputation, and reversal into `liveQuizRewardLedger.ts`, consuming the canonical validators.

- [x] **Step 6: Preserve the façade**

Replace `liveQuizRewards.ts` with explicit re-exports so existing consumers and tests do not need import churn.

- [x] **Step 7: Run GraphQL typechecking and both reward/reset suites**

Run:

```bash
pnpm --filter @klicker-uzh/graphql check
pnpm --filter @klicker-uzh/graphql test:local -- liveQuizRewards.test.ts
pnpm --filter @klicker-uzh/graphql test:local -- liveQuizReset.test.ts
```

Expected: no diagnostics and all tests pass.

---

### Task 3: Extract Reset Responsibilities and Canonical Activity Mapping

**Files:**

- Create: `packages/graphql/src/services/liveQuizExecutionCache.ts`
- Create: `packages/graphql/src/services/liveQuizResetCleanup.ts`
- Create: `packages/graphql/src/services/liveQuizActivityInfo.ts`
- Create: `packages/graphql/src/services/liveQuizResetSummary.ts`
- Create: `packages/graphql/src/services/liveQuizResetTransaction.ts`
- Modify: `packages/graphql/src/services/liveQuizReset.ts`
- Modify: `packages/graphql/src/services/liveQuizzes.ts`
- Modify: `packages/graphql/src/services/courses.ts`
- Modify: `packages/graphql/test/liveQuizReset.test.ts`

**Interfaces:**

- Produces: unchanged `initializeLiveQuizExecutionCache`, `clearLiveQuizExecutionCache`, reset-summary, reset-state, and reset-mutation behavior; a shared `formatLiveQuizActivityInfo` mapper used by course data and reset results.

- [x] **Step 1: Extract execution-cache generation fencing and reset cleanup**

Move Lua scripts, key scanning, generation-aware clearing, and initialization to the neutral `liveQuizExecutionCache.ts` module. Move unavailable-snapshot recovery and the Hatchet workflow to `liveQuizResetCleanup.ts`. Re-export compatibility names from `liveQuizReset.ts`.

- [x] **Step 2: Extract the shared Live Quiz mapper**

Create `formatLiveQuizActivityInfo` and use it in both `courses.ts` and reset transaction results. Keep implicit-owner handling in the reset transaction before calling the mapper.

- [x] **Step 3: Extract summary construction**

Move eligibility types, reward summary construction, authorization filtering, ledger validation, and legacy preview to `liveQuizResetSummary.ts`.

- [x] **Step 4: Extract the serializable transaction**

Move resettable-quiz loading, applied-run resolution, execution-state reset, error classification, and transaction execution to `liveQuizResetTransaction.ts`.

- [x] **Step 5: Keep `liveQuizReset.ts` as orchestration**

Retain audit delivery, cache snapshot, post-commit cleanup, public reset mutations, and compatibility re-exports.

- [x] **Step 6: Run GraphQL and course/frontend checks**

Run:

```bash
pnpm --filter @klicker-uzh/graphql check
pnpm --filter @klicker-uzh/frontend-manage check
pnpm --filter @klicker-uzh/graphql test:local -- liveQuizReset.test.ts
```

Expected: no diagnostics and the complete reset suite passes.

---

### Task 4: Verify, Publish, and Resolve Threads

**Files:**

- Review: all files changed in Tasks 1–3
- Modify if needed: PR #5258 body

**Interfaces:**

- Produces: a clean pushed branch, a still-draft PR, resolved review threads, and current verification evidence.

- [x] **Step 1: Format and inspect**

Run:

```bash
pnpm exec prettier --write packages/graphql/src/services packages/graphql/test docs/superpowers/plans/2026-07-31-regular-live-quiz-reset-review-cleanup.md
git diff --check
git diff --stat
```

- [x] **Step 2: Run the repository gate**

Run:

```bash
pnpm run check:all
pnpm run build
```

Expected: all checks and builds pass.

- [x] **Step 3: Run an independent final branch review**

Verify every review finding and responsibility boundary against the final diff. Do not edit during the independent review.

- [ ] **Step 4: Commit and push**

Stage only reviewed feature files, inspect staged data for secrets and personal data, commit with a conventional message, and push the existing branch.

- [ ] **Step 5: Resolve addressed threads and update the PR**

Resolve the seven actionable inline threads, keep the PR in draft, replace the P2 follow-up section with the completed cleanup, and record current verification results.

- [ ] **Step 6: Verify final GitHub state**

Confirm the PR is draft, mergeable, all screenshot URLs still return images, and CI has started on the new head.
