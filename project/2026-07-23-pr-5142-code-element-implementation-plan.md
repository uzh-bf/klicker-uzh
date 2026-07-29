# PR 5142 CODE Element Implementation Plan

## Research

- Architecture source: [CODE element future plan](plans_future/PLAN-code-element-type.md) and [codeapi research](plans_future/RESEARCH-codeapi-integration.md).
- Current base: `v3` at `f16b9ceb4d`; merged into this branch as `e3904584d8`.
- Current stack: Node 24.16.0, pnpm 11.5.0, Prisma 7.8.0, Pothos 4.3.0.
- The branch contains Slices 1, 2a, and 2b. Authoring follows the NUMERICAL mutation/service pattern; element options are validated in `validateAndProcessElementOptions`; instance result initialization is centralized in `getInitialInstanceResults`.
- Current response grading is synchronous. CODE uses a separate async `CodeSubmission` lifecycle rather than weakening `QuestionResponse`.
- Refreshed `df-cloud` `origin/prd` (`8ed487e5`) pins the deployed codeapi source to `c1509a88` and the PRD Helm overlays to `b1a3eb23`. Desired PRD runner scaling is queue length 1 with at most 3 replicas. `CODEAPI_TENANT_ISOLATION_STRICT` is unset, while `CODEAPI_JWT_SINGLE_TENANT_ID` is configured; Klicker tokens still carry an explicit tenant.
- The deployed source accepts only `librechat_jwt` and `openid_reuse` principal sources. [ADR 0003](../docs/adr/0003-use-klicker-codeapi-principal-source.md) selects `klicker_jwt` through an environment-configurable allow-list; the separate CodeAPI patch and deployment remain prerequisites for the live smoke, not for local client construction.
- The deployed Python image includes the scientific package set needed for general numerical teaching (`numpy`, `pandas`, `matplotlib`, `scipy`, and related packages), but not `pytest`. The pilot course/package audit remains open.
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
- [ADR 0003](../docs/adr/0003-use-klicker-codeapi-principal-source.md): accepted. Klicker tokens identify themselves as `klicker_jwt`; CodeAPI exposes an environment-configurable principal-source allow-list.
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
- Add complete lecturer-only CODE option/input/object types and `manipulateCodeQuestion`, following existing auth and service seams.
- Add a separate participant instance projection containing public tests only. Hidden tests, expectations, names, and inputs must be absent rather than nullable.
- Add `CodeElement` and `CodeElementData` to every relevant GraphQL union list and `resolveType` switch.
- Add CODE element-data processing, sanitization, initial instance results, and both `asynchronousActivityValid` service arms.
- Reject CODE explicitly in activity-template creation and instantiation for v1.
- Add one GraphQL operation and regenerate tracked API artifacts.
- Check: Prisma format/generate/sync, focused validator tests, GraphQL package check/test, types/util checks, lecturer/full versus participant/public payload assertions, union-resolution tests, async activity-copy coverage, and template rejection.
- Commit: `feat(code): add CODE authoring contracts`

### Slice 2a: Enforce CODE-only activity stacks

- Enforce one CODE element per stack in shared activity construction and backend validation.
- Allow CODE only in practice quizzes and microlearning; reject it in live quizzes, group activities, mixed stacks, and multi-element stacks.
- Keep the picker and form validation aligned with the backend policy.
- Check: focused pure policy tests, GraphQL checks, frontend checks, and `agent-browser` stack-builder validation.
- Commit: `feat(code): enforce CODE-only activity stacks`

### Slice 2b: Author CODE questions in Manage

- Add the shared CodeMirror wrapper and CODE authoring options form.
- Add element picker, form state, validation, preview, edit mutation, and English/German labels.
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
- Active-plan reviewer: Gemini 3.5 Flash High reviewed commit `325957615`.
- Accepted: require distinct lecturer and participant GraphQL projections; enumerate both CODE union resolvers; cover both `asynchronousActivityValid` service arms; reject CODE templates explicitly in v1.
- Result: Slice 1 remains bounded and reviewable with those gates.

## Progress

- Active: Slice 4 research and exact-once lifecycle design. The next tracer follows an accepted CODE submission from its pending receipt through Hatchet claim/reclaim/failure handling and transactional, idempotent finalization while preserving the existing grading side effects exactly once.
- Done: user approval; ADR acceptance; active-plan commit and independent review; Slice 1 implementation commit `f3c010123a` and review-fix commit `a8ff34ae89`; CODE Prisma enum/model/migration and analytics-schema sync; shared authoring/participant/evaluation/receipt contracts; strict option validation and public-test projection; authenticated full lecturer instance projection; GraphQL authoring mutation, unions, operations, and generated artifacts; instance copying/results initialization; asynchronous-activity policy; explicit activity-template rejection; exact-commit correctness and simplification reviews. Slice 2 was split into policy and interface tracers so each remains independently verifiable. Slice 2a commit `d89dada04` adds one shared CODE-stack policy, backend enforcement for every activity mutation, practice-quiz and microlearning allowlists, live-quiz exclusion, aligned drag/drop and bulk-selection guards, form validation, and exhaustive CODE handling in affected frontend projections. Its exact-commit correctness review found no defect; its simplification review found one duplicate string-response union arm, merged in the follow-up adjustment. Slice 2b commit `cb1c8d8b1` adds pinned CodeMirror dependencies, a shared accessible editor, the normal-element CODE picker, resilient create/edit form state, Python/JSON/test validation, English/German copy, the authoring mutation path, and a public-test-only participant preview; CODE remains absent from template authoring. Its exact-commit correctness review found one CODE-duplicate type-conversion crash; commit `81d26c887` disables the unsafe conversion path. The simplification review removed fixed Python/timeout policy from Formik state and centralized test-case defaults in the same adjustment. Current `v3` commit `f16b9ceb4d` was merged as `e3904584d8`; the migration reset, generated schema, and existing CODE contracts now pass on Prisma 7.8.
- Browser path: devrouter workspace `docs-codeapi-feature-plans`; Manage `https://manage.klicker.docs-codeapi-feature-plans.localhost`; PWA `https://pwa.klicker.docs-codeapi-feature-plans.localhost`; delegated lecturer sessions `pr5142-proof` and `pr5142-stack`.
- Browser evidence: selecting CODE originally reproduced a deterministic `CodeMirror` crash because the asynchronous artificial-preview transition temporarily paired `type: CODE` with the previous choice response `{}`. The preview now passes a response to CodeMirror only when it is a string; the exact selector-based repro passes and no debug instrumentation remains. On the routed app, synthetic CODE authoring, public/hidden test entry, public-only participant preview, save, reopen, and edit all pass. The mobile create flow accepts CODE data and renders its live participant preview; mobile edit also passes and the scrolled preview visibly contains `Public sum example` while `Hidden edge case` is absent. Mobile German edit rendering includes the localized CODE labels. In the practice-quiz wizard, a selected CODE element plus a normal element disables `Add 1 stack with 2 elements` while keeping `Add 2 stacks with 1 element` enabled. Screenshots are stored outside the repository under `/private/tmp/pr5142-code-*.png`, including `pr5142-code-mobile-public-hidden-preview-en.png`.
- Slice 3: commit `da49b624c3` adds the server-only client, asymmetric `klicker_jwt` minter, invocation-only public/hidden runner requests, strict flat-response parser, distinct-session check, and exact JSON grading. Correctness and simplification reviewers inspected that exact commit. Follow-up commit `098db0e68f` closes every accepted finding: bounded process-group execution and cleanup, shared authoring/runtime JSON limits, one visibility-derived execute-and-grade boundary that discards raw sessions and hidden diagnostics, a server-only util subpath, and one cached signing-key parse per client. Both reviewers rechecked the follow-up and reported no remaining actionable issue.
- Verification evidence: the isolated devcontainer runs Node 24.16.0 and pnpm 11.5.0. The full `pnpm run check:all` passes after installing disposable Python 3.12 for the existing analytics workspace. Focused CODE contract suites pass with 2 util tests and 24 GraphQL tests. The CodeAPI suite passes all 20 tests under an isolated Python 3.12, including direct file-descriptor flooding and descendant cleanup; the Python-less devcontainer passes 18 and explicitly skips those two runner tests. The util package typecheck and split-entry production build pass, its browser root contains no CodeAPI/Node imports, and the focused GraphQL validator passes 15 tests including shared JSON boundaries. `pnpm run prisma:sync` produces no diff. The full workspace build progressed through 18 packages before Auth's existing Google Fonts fetch (`JetBrains Mono` and `Source Sans 3`) stopped Turbo; scoped Manage and PWA production builds pass with `NODE_ENV=production`. The wiki validator reports only three pre-existing metadata errors in ADRs 0001/0002 and an unrelated solution; updated files pass Prettier and `git diff --check`.
- CodeAPI source check: local checkout `/Volumes/HOME/Git/df/code-interpreter` is clean at `5e459dd4f2d8bea6ae7a3004f15051dff26abae0`. It still hardcodes `librechat_jwt | openid_reuse`, so `klicker_jwt` remains deployment-blocked. `POST /v1/exec` still returns the flat `ExecuteResult`; its exported `ExecuteResponse.run` wrapper remains stale. The shared client therefore targets the verified flat response and treats it as hostile input.
- Next: trace the current participant-response, Hatchet, points/XP, leaderboard, timeline, spaced-repetition, result/statistics, and subscription paths; define the smallest transaction and worker seam that makes duplicate delivery, reclaim, and retry behavior testable before implementing Slice 4.
- Blockers: the separate CodeAPI `klicker_jwt` allow-list patch and deployment gate the live Slice 3 smoke, not local client construction. The pilot course/package audit remains open. Current PRD GitOps values resolve the KEDA and tenant-mode questions, but the local Kubernetes proxy is down, so they are desired-state evidence rather than a live-cluster readback; no cluster connection will be established without explicit instruction. Context7 remains unavailable. The Auth Google Fonts fetch prevents a complete offline full-workspace build, while scoped Manage and PWA production builds pass.
