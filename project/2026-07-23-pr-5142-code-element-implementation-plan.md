# PR 5142 CODE Element Implementation Plan

## Research

- Architecture source: [CODE element future plan](plans_future/PLAN-code-element-type.md) and [codeapi research](plans_future/RESEARCH-codeapi-integration.md).
- Current base: `v3` at `c8de9c89782e`; merged into this branch as `5f4ee4a85e`.
- Current stack: Node 24.16.0, pnpm 11.5.0, Prisma 6.16.1, Pothos 4.3.0.
- Current code has no `CODE` element. Authoring follows the NUMERICAL mutation/service pattern; element options are validated in `validateAndProcessElementOptions`; instance result initialization is centralized in `getInitialInstanceResults`.
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

- Active: integrate current `v3` (including Prisma 7), repair generated/schema drift, update the engineering wiki, and recover routed browser verification for Slice 2b.
- Done: user approval; current `v3` merge; ADR acceptance; active-plan commit and independent review; Slice 1 implementation commit `f3c010123a` and review-fix commit `a8ff34ae89`; CODE Prisma enum/model/migration and analytics-schema sync; shared authoring/participant/evaluation/receipt contracts; strict option validation and public-test projection; authenticated full lecturer instance projection; GraphQL authoring mutation, unions, operations, and generated artifacts; instance copying/results initialization; asynchronous-activity policy; explicit activity-template rejection; exact-commit correctness and simplification reviews. Slice 2 was split into policy and interface tracers so each remains independently verifiable. Slice 2a commit `d89dada04` adds one shared CODE-stack policy, backend enforcement for every activity mutation, practice-quiz and microlearning allowlists, live-quiz exclusion, aligned drag/drop and bulk-selection guards, form validation, and exhaustive CODE handling in affected frontend projections. Its exact-commit correctness review found no defect; its simplification review found one duplicate string-response union arm, merged in the follow-up adjustment. Slice 2b commit `cb1c8d8b1` adds pinned CodeMirror dependencies, a shared accessible editor, the normal-element CODE picker, resilient create/edit form state, Python/JSON/test validation, English/German copy, the authoring mutation path, and a public-test-only participant preview; CODE remains absent from template authoring. Its exact-commit correctness review found one CODE-duplicate type-conversion crash; commit `81d26c887` disables the unsafe conversion path. The simplification review removed fixed Python/timeout policy from Formik state and centralized test-case defaults in the same adjustment.
- Browser path: devrouter workspace `docs-codeapi-feature-plans`; Manage `https://manage.klicker.docs-codeapi-feature-plans.localhost`; PWA `https://pwa.klicker.docs-codeapi-feature-plans.localhost`; successful login/dashboard session `pr5142-verify`.
- Evidence: `prisma validate`, `@klicker-uzh/prisma check`, `@klicker-uzh/types check`, `@klicker-uzh/util check`, and `@klicker-uzh/graphql check` pass; focused CODE suites pass with 2 util and 24 GraphQL tests across Slices 1 and 2a; `pnpm run check` passes after building the existing `markdown` and `word-cloud` workspace dependencies; GraphQL codegen and `git diff --check` pass. Slice 2a checks additionally cover `@klicker-uzh/frontend-manage check`, `@klicker-uzh/frontend-pwa check`, `@klicker-uzh/shared-components check`, focused 6/6 policy tests, and frontend lint with no errors. Slice 2b adds fresh Manage/shared-components typechecks, dependency-policy validation, `git diff --check`, Manage lint with no new errors, and a successful Manage production build after allowing its existing Google Font fetches. The review adjustment reran the focused checks and passed the full repository pre-commit gate across all 30 packages. The full pre-commit gate caught and prompted the missing CODE evaluation fields in `FStackFeedbackEvaluations`; regeneration plus a fresh GraphQL build and PWA typecheck verify that consumer contract. `devrouter ensure .` applied the CODE migration, seeded the isolated database, and initially proved all ten worktree routes. `agent-browser` then completed delegated login and rendered the real seeded Manage dashboard on the exact namespaced route.
- Next: merge current `origin/v3`, verify the Prisma 7 migration boundary, update affected wiki/skills, then retry routed create/edit/duplicate/preview and CODE-only stack proof.
- Blockers: Slice 2b browser proof is not complete. The isolated dependency volume first lacked the newly pinned packages; after a successful `pnpm install --frozen-lockfile`, a managed restart collided with an orphaned Manage process on port 3002. Removing that exact process allowed a clean supervisor start, but devrouter then entered its automatic recreate path, dropped all `docs-codeapi-feature-plans` routes, and hung during container setup; the wrapper was stopped to prevent further churn. A fresh route listing confirms that this worktree remains absent. The production bundle and direct in-container Manage response pass, so this remains a runtime-verification blocker rather than a known code defect. Current PRD GitOps values resolve the KEDA and tenant-mode questions, but the local Kubernetes proxy is down, so they are desired-state evidence rather than a live-cluster readback. Context7 is unavailable. The pilot course/package audit and separate CodeAPI allow-list deployment gate the live Slice 3 smoke, but not local client tests.
