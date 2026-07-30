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

- Active: exact-commit review of the final security remediations, final clean-target security/Standards/Spec gates, and draft-PR refresh. The exhaustive pre-fix security pass identified and locally closed three low-impact boundaries: lecturer-bound authoring autosaves, permission-scoped template type preflights, and pre-expansion JSON breadth limits. Keep live staging and load proof gated on the separate CodeAPI allow-list deployment and user-provided connectivity.
- Done: user approval; ADR acceptance; active-plan commit and independent review; Slice 1 implementation commit `f3c010123a` and review-fix commit `a8ff34ae89`; CODE Prisma enum/model/migration and analytics-schema sync; shared authoring/participant/evaluation/receipt contracts; strict option validation and public-test projection; authenticated full lecturer instance projection; GraphQL authoring mutation, unions, operations, and generated artifacts; instance copying/results initialization; asynchronous-activity policy; explicit activity-template rejection; exact-commit correctness and simplification reviews. Slice 2 was split into policy and interface tracers so each remains independently verifiable. Slice 2a commit `d89dada04` adds one shared CODE-stack policy, backend enforcement for every activity mutation, practice-quiz and microlearning allowlists, live-quiz exclusion, aligned drag/drop and bulk-selection guards, form validation, and exhaustive CODE handling in affected frontend projections. Its exact-commit correctness review found no defect; its simplification review found one duplicate string-response union arm, merged in the follow-up adjustment. Slice 2b commit `cb1c8d8b1` adds pinned CodeMirror dependencies, a shared accessible editor, the normal-element CODE picker, resilient create/edit form state, Python/JSON/test validation, English/German copy, the authoring mutation path, and a public-test-only participant preview; CODE remains absent from template authoring. Its exact-commit correctness review found one CODE-duplicate type-conversion crash; commit `81d26c887` disables the unsafe conversion path. The simplification review removed fixed Python/timeout policy from Formik state and centralized test-case defaults in the same adjustment. Current `v3` commit `f16b9ceb4d` was merged as `e3904584d8`; the migration reset, generated schema, and existing CODE contracts now pass on Prisma 7.8.
- Browser path: devrouter workspace `docs-codeapi-feature-plans`; Manage `https://manage.klicker.docs-codeapi-feature-plans.localhost`; PWA `https://pwa.klicker.docs-codeapi-feature-plans.localhost`; delegated lecturer sessions `pr5142-proof`, `pr5142-stack`, and `pr5142-security`.
- Browser evidence: selecting CODE originally reproduced a deterministic `CodeMirror` crash because the asynchronous artificial-preview transition temporarily paired `type: CODE` with the previous choice response `{}`. The preview now passes a response to CodeMirror only when it is a string; the exact selector-based repro passes and no debug instrumentation remains. On the routed app, synthetic CODE authoring, public/hidden test entry, public-only participant preview, save, reopen, and edit all pass. The mobile create flow accepts CODE data and renders its live participant preview; mobile edit also passes and the scrolled preview visibly contains `Public sum example` while `Hidden edge case` is absent. Mobile German edit rendering includes the localized CODE labels. In the practice-quiz wizard, a selected CODE element plus a normal element disables `Add 1 stack with 2 elements` while keeping `Add 2 stacks with 1 element` enabled. Screenshots are stored outside the repository under `/private/tmp/pr5142-code-*.png`, including `pr5142-code-mobile-public-hidden-preview-en.png`.
- Slice 3: commit `da49b624c3` adds the server-only client, asymmetric `klicker_jwt` minter, invocation-only public/hidden runner requests, strict flat-response parser, distinct-session check, and exact JSON grading. Correctness and simplification reviewers inspected that exact commit. Follow-up commit `098db0e68f` closes every accepted finding: bounded process-group execution and cleanup, shared authoring/runtime JSON limits, one visibility-derived execute-and-grade boundary that discards raw sessions and hidden diagnostics, a server-only util subpath, and one cached signing-key parse per client. Both reviewers rechecked the follow-up and reported no remaining actionable issue.
- Slice 4 implementation: participant submission now creates or converges on one active receipt, keeps accepted work pending across enqueue failures, and rejects inactive participation or unavailable/deleted activities. The general worker claims with a token whose lease outlives its execution timeout, grades outside the transaction, and atomically records the normal response detail, aggregate response, CODE test aggregates, statistics, spaced repetition, points, XP, leaderboard, timeline, and completion. Duplicate/stale delivery is a no-op; two transient failures return to `PENDING`, the third becomes `FAILED`, and a minutely recovery task re-enqueues pending/expired receipts and closes expired exhausted claims. Participant-owned query/subscription contracts expose only the public receipt.
- Slice 4 exact-commit review: correctness found an unlocked instance aggregate read-modify-write, global results copied into participant history, and a worker/lease deadline shorter than valid dual-batch work. Simplification found unbounded exhausted-receipt recovery, repeated receipt selections and active-receipt lookup, plus an untested microlearning branch. The closure changes lock the element-instance row, keep instance and participant aggregates separate, apply one total CodeAPI deadline under aligned Hatchet/lease limits, bound recovery to deterministic batches of 100, share the receipt fragment and active lookup, and add the missing concurrent, retry, claim-overlap, and microlearning tracers.
- Slice 4 closure: review-fix commit `30cc6f575` passes both exact-commit closure lenses. The correctness reviewer confirmed the instance lock, separate global and participant aggregates, and aligned five-/six-/seven-minute client, Hatchet, and claim limits; the simplification reviewer confirmed bounded recovery, shared receipt selection and active lookup, and microlearning coverage. No new actionable finding remains.
- Slice 5 implementation: commit `6f1fa61d1` adds participant-safe CODE rendering, an accessible editor, active receipt persistence, subscription with polling fallback, reload recovery, public-only terminal feedback, editable failure retry, and completion-only practice-quiz advancement. Review-fix commit `deced1c74c` scopes receipt and completion recovery to the authenticated participant, gates shared microlearning rendering until Slice 6, makes terminal receipt state monotonic, restores submitted code after completion, avoids non-CODE receipt storage, and removes feedback reference-equality writes. Test commit `7d088a5b7` completes the deterministic `graphql-transport-ws` tracer: `COMPLETED` arrives through `CodeSubmissionUpdated` while HTTP polling remains stale at `PENDING`.
- Slice 5 closure: correctness and simplification reviewers rechecked the exact follow-up commits and closed every finding. Practice-quiz CODE is enabled only for an identified participant; microlearning remains read-only until Slice 6 supplies its evaluation/readback contract. The Playwright tracer proves pending reload, subscription completion over stale polling, submitted-code recovery, cross-participant isolation, public-only feedback, failure, and a new retry receipt.
- Slice 6 implementation: commit `65e32ee51` enables identified microlearning participants to submit CODE answers, restores the finalized participant-safe evaluation after completion, and adds the authorized Manage per-test aggregate. Review-fix commit `562618ea0` adds explicit evaluation-readback recovery, matches the temporary-participant UI gate to GraphQL authorization, minimizes the readback selection, centralizes CODE score/XP derivation, and drives the real GraphQL mutation plus production finalizer in the browser tracer. Test-isolation commit `fa1ed3ebc` gives that real finalizer a disposable participant and replaces the synthetic retry dispatch with an actionable click.
- Slice 6 closure: the exact-commit correctness review closed transient readback recovery, the temporary-participant mismatch, and the real mutation/finalizer requirement with no new correctness, security, or privacy finding. The simplification review confirmed result-only selection, shared score/XP logic, one element fixture, and exact partial-aggregate assertions; its follow-up isolation findings are closed by the disposable participant tracer. The participant sees public tests only; the authorized lecturer sees both public and hidden aggregate rows.
- Slice 7 implementation: commit `5073404898` persists provider retry deadlines, defers `429` submissions without consuming a grading attempt, claims only due work, and recovers due receipts in bounded batches. Commit `daf67fa50a` centralizes retry-delay interpretation, caps hostile response and runner output, completes English/German parity, protects authorized evaluation and export projections, and adds a deterministic 20-submission local concurrency tracer. The live CodeAPI staging and at-least-50 concurrent load proof remain external gates.
- Slice 7 maintainability closure: commit `9343b80516` unifies ordinary and CODE post-grading persistence, removes the unbounded aggregate submission ledger, removes unsupported public CODE input fields, centralizes fixed CODE policy and claimable-state predicates, and makes runner/response error provenance explicit. Commit `7b8296700` closes the exact-review follow-up by making the boundary error kind mandatory and covering a malformed runner outcome ID. Exact-commit correctness and simplification reviews found no additional code issue; the plan/log staleness is closed by this finalization update.
- Final security remediation: element-editor autosaves now use a versioned envelope bound to the authenticated lecturer and reject legacy, malformed, or mismatched entries before recovery or Formik loading; the Create action waits for the lecturer identity. The live-quiz template CODE preflight carries the same element-permission predicate as the authoritative path. JSON validation rejects over-wide arrays before reading their members and stops object traversal at the node work bound; focused proxy tests prove the rejected array performs zero item reads. Matching-user recovery, foreign-user rejection, and legacy-record rejection pass in the routed Manage app. Screenshots remain outside the repository at `/private/tmp/pr5142-matching-recovery.png` and `/private/tmp/pr5142-foreign-autosave-rejected.png`.
- Verification evidence: the isolated devcontainer runs Node 24.16.0 and pnpm 11.5.0. The full `pnpm run check:all` passes after installing disposable Python 3.12 for the existing analytics workspace. The focused CODE GraphQL suites now pass 36 tests, including 12 real-PostgreSQL submission lifecycle tests; the GraphQL production build passes with only the repository's pre-existing Rollup/Pothos warnings, and the util, Hatchet package, and general-worker production builds pass. Focused CODE contract suites also pass with 2 util tests. The CodeAPI suite passes all 20 tests under an isolated Python 3.12, including direct file-descriptor flooding and descendant cleanup; the Python-less devcontainer now passes 19 and explicitly skips those two runner tests. The util package typecheck and split-entry production build pass, its browser root contains no CodeAPI/Node imports, and the focused GraphQL validator passes 15 tests including shared JSON boundaries. `pnpm run prisma:sync` produces no diff. The full workspace build progressed through 18 packages before Auth's existing Google Fonts fetch (`JetBrains Mono` and `Source Sans 3`) stopped Turbo; scoped GraphQL, Manage, and PWA production builds pass with `NODE_ENV=production`. Slice 6 reruns `pnpm run check:all`, the PWA production build, the 12-test lifecycle suite, and the focused routed Playwright tracer with 4/4 tests passing. The tracer proves a real microlearning mutation/finalizer, visible failed readback plus retry, participant-scoped completion storage, 5/10 partial scoring, and exact authorized public `1/1` and hidden `0/1` aggregates. The routed PWA proof covers desktop English pending/reload/completion and 390×844 mobile German; screenshots remain outside the repository under `/tmp/agent-browser-shots/code-slice5-*.png`. The wiki validator reports only three pre-existing metadata errors in ADRs 0001/0002 and an unrelated solution; updated files pass Prettier and `git diff --check`.
- Final security verification rerun: affected types, util, GraphQL, and Manage typechecks pass; the focused util suites pass 4/4 tests; types, util, and GraphQL production builds pass. The current Manage production build passes TypeScript and webpack compilation, then fails while prerendering the unrelated `/en/resources/mediaLibrary` and `/en/404` pages with `NextRouter was not mounted`; the changed `/` route runs successfully through devrouter. The local NextAuth API route also returns 404 under this Next 16 dev runtime, so browser proof used a locally minted, non-production test JWT without printing it.
- CodeAPI source check: local checkout `/Volumes/HOME/Git/df/code-interpreter` is clean at `5e459dd4f2d8bea6ae7a3004f15051dff26abae0`. It still hardcodes `librechat_jwt | openid_reuse`, so `klicker_jwt` remains deployment-blocked. `POST /v1/exec` still returns the flat `ExecuteResult`; its exported `ExecuteResponse.run` wrapper remains stale. The shared client therefore targets the verified flat response and treats it as hostile input.
- Next: commit and close exact correctness/simplification review of the security remediations, finalize the clean-target security and independent Standards/Spec reviews, then push and update draft PR 5142 with the complete verification record. Live staging/load proof and the pilot package audit remain explicit external gates rather than local implementation work.
- Blockers: the separate CodeAPI `klicker_jwt` allow-list patch and deployment gate the live Slice 3 smoke, not local client construction. The pilot course/package audit remains open. Current PRD GitOps values resolve the KEDA and tenant-mode questions, but the local Kubernetes proxy is down, so they are desired-state evidence rather than a live-cluster readback; no cluster connection will be established without explicit instruction. Context7 remains unavailable. The Auth Google Fonts fetch prevents a complete offline full-workspace build. The current scoped Manage build additionally stops on the unrelated media-library/404 prerender router error after successful TypeScript and webpack compilation; routed `/` verification remains green.
