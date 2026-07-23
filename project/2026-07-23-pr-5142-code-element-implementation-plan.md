# PR 5142 CODE Element Implementation Plan

## Research

- Architecture source: [CODE element future plan](plans_future/PLAN-code-element-type.md) and [codeapi research](plans_future/RESEARCH-codeapi-integration.md).
- Current base: `v3` at `c8de9c89782e`; merged into this branch as `5f4ee4a85e`.
- Current stack: Node 24.16.0, pnpm 11.5.0, Prisma 6.16.1, Pothos 4.3.0.
- Current code has no `CODE` element. Authoring follows the NUMERICAL mutation/service pattern; element options are validated in `validateAndProcessElementOptions`; instance result initialization is centralized in `getInitialInstanceResults`.
- Current response grading is synchronous. CODE uses a separate async `CodeSubmission` lifecycle rather than weakening `QuestionResponse`.
- Context7 was unavailable in this session. API usage will follow pinned repository code and generated types; library-specific uncertainty must stop the affected slice.
- Earlier independent review found seven material gaps. Accepted fixes: server-held expectations, idempotent finalization, one CODE element per stack, one persistence shape, explicit Mastra blocking, separate public/hidden executions, and a concrete persistence contract.

## Goal

Ship `ElementType.CODE` for Python programming questions in practice quizzes and microlearning. Lecturers author declarative tests; participants receive reload-safe async grading; points, XP, analytics, and feedback use existing Klicker behavior.

## Non-goals

- No live-quiz or group-activity support.
- No language beyond Python.
- No arbitrary instructor assertions in codeapi.
- No mixed or multi-CODE stacks.
- No LLM grading or browser-side execution.
- No chatbot code tool; its Mastra dependency remains separate and blocked.

## Identity

- Plan: `project/2026-07-23-pr-5142-code-element-implementation-plan.md`
- Branch: `docs/codeapi-feature-plans`
- Target: `v3`
- PR: [PR 5142](https://github.com/uzh-bf/klicker-uzh/pull/5142)
- History: [future CODE plan](plans_future/PLAN-code-element-type.md)

## Approved decisions

- [ADR 0001](../docs/adr/0001-separate-code-submission-lifecycle.md): accepted. Pending attempts stay outside `QuestionResponse`.
- [ADR 0002](../docs/adr/0002-keep-grading-assertions-outside-the-sandbox.md): accepted. Expectations stay in Klicker; public and hidden tests use separate executions.
- Limits: 5 seconds per test, at most 20 tests.
- Retries: existing practice-quiz retry behavior; one active CODE attempt.
- Comparison: exact JSON equality in v1.
- Branch: continue on PR 5142; architecture, plan, and implementation ship together.

## Skill routing

- `rs-sliced-development-workflow`: one reviewed slice and commit at a time.
- `domain-modeling`: keep the accepted boundaries and glossary aligned.
- `tdd`: protect validation, lifecycle, and idempotency through public interfaces where practical.
- `agent-browser`: mandatory from the first UI slice; record worktree Manage/PWA URLs before UI edits.
- `rs-model-routing`: independent plan and slice reviews.
- `rs-mr-description-writer`: whole-branch PR updates.

## Slices

### Slice 1: Author and persist CODE contracts

- Add `ElementType.CODE`, `CodeSubmissionStatus`, `CodeSubmission`, relations, activity check constraint, and active-submission partial unique index.
- Add shared CODE option, element-data, result, response, evaluation, status, and receipt types.
- Add declarative option validation: Python only, valid entrypoint, 1–20 unique tests, JSON inputs/outputs, positive weights, and a fixed 5-second timeout.
- Add GraphQL CODE option/input/object types and `manipulateCodeQuestion`, following existing auth and service seams.
- Add CODE element-data processing, sanitization, and initial instance results.
- Add one GraphQL operation and regenerate tracked API artifacts.
- Check: Prisma format/generate/sync, focused validator tests, GraphQL package check/test, types/util checks, hidden-test payload assertions.
- Commit: `feat(code): add CODE authoring contracts`

### Slice 2: Author CODE questions in Manage

- Add the shared CodeMirror wrapper and CODE authoring options form.
- Add element picker, form state, validation, preview, edit mutation, and English/German labels.
- Enforce one CODE element per stack in UI and backend authoring validation.
- Check: focused frontend checks plus `agent-browser` create/edit/preview in desktop and mobile Manage.
- Commit: `feat(code): add CODE authoring interface`

### Slice 3: Execute public and hidden test batches

- Add the shared codeapi client and scoped JWT minter.
- Build invocation-only Python runners with fresh public/hidden sessions.
- Strictly validate and cap sandbox output; compare exact JSON results in the worker.
- Drop hidden artifacts, session IDs, output, and exception text after server-side comparison.
- Check: unit fixtures for pass/fail/timeout/malformed output, request snapshots with no expectations, distinct-session contract, one live staging smoke after infra gates pass.
- Commit: `feat(code): add sandbox grading client`

### Slice 4: Finalize submissions exactly once

- Create pending receipts from participant submissions and return the existing receipt for an active attempt.
- Add Hatchet claim/reclaim/failure flow and transactional idempotent finalization.
- Publish completion and expose authorized query/subscription polling contracts.
- Preserve every current grading side effect once: response details, aggregate response, results/statistics, spaced repetition, points, XP, leaderboard, and timeline.
- Check: duplicate delivery, retry after commit, expired claim, exhausted retry, failed retry, and active uniqueness integration tests.
- Commit: `feat(code): add asynchronous CODE grading`

### Slice 5: Answer CODE questions in the PWA

- Add CODE response input, editor, pending receipt persistence, polling/subscription, reload recovery, completion, and failure retry.
- Advance only after completion; never expose hidden execution details.
- Check: `agent-browser` plus Playwright practice-quiz journey, reload while pending, and failed retry in desktop/mobile and English/German.
- Commit: `feat(code): add CODE participant flow`

### Slice 6: Add microlearning and instructor evaluation

- Enable CODE-only stacks in microlearning.
- Add per-test aggregate results and Manage evaluation.
- Keep generic charts and templates unsupported unless an explicit compatible mapping is proven.
- Check: microlearning Playwright journey and instructor evaluation readback.
- Commit: `feat(code): add CODE evaluation`

### Slice 7: Harden and finish

- Add authorized export coverage, rate-limit handling, output caps, i18n parity, and load smoke.
- Resolve or document infrastructure and pilot gates.
- Run final E2E, security review, independent branch review, and strict maintainability gate.
- Update this plan and [PR 5142](https://github.com/uzh-bf/klicker-uzh/pull/5142) from whole-branch evidence; keep draft unless explicitly told otherwise.
- Commit: final focused fixes and `docs(project): complete CODE implementation plan`.

## Review and verification cadence

- Each slice: minimal implementation, fastest focused check, broader relevant checks, progress update, clean commit.
- Review that exact commit with a separate correctness agent and the shared review rubric.
- Review the same commit with a separate simplification agent.
- Integrate accepted findings, rerun checks, and commit adjustments before the next slice.
- UI slices require real routed applications, `agent-browser`, screenshots, relevant viewports, and both locales.

## Independent plan review

- Earlier architecture reviewer: Gemini 3.5 Flash High. Findings integrated into commits `d58b6defb` and `834c88208`.
- Active-plan reviewer: pending after this plan commit.

## Progress

- Active: plan activation and independent review.
- Done: user approval; current `v3` merge; ADR acceptance; current code and repository guidance rechecked.
- Evidence: pre-implementation documentation CI passed on head `6456f7d4339d`; merge and ADR commits are local and clean.
- Next: commit this plan, review it, integrate accepted findings, retitle the draft PR, then start Slice 1.
- Blockers: none for Slice 1. Context7 is unavailable; live codeapi integration remains gated before Slice 3.
