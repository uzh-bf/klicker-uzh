# PR 5142 CODE Element Implementation Plan

> **Scope addendum (2026-08-31):** The initial CODE release described below
> excluded Live Quizzes. PR 5142 now also includes the deliberately constrained
> Live Quiz slice in
> [PLAN-code-live-quiz-support.md](plans_wip/PLAN-code-live-quiz-support.md): one
> CODE-only block in a course-linked quiz for a permanent participant with an
> active Participation. Group Activities and templates remain unsupported.

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

- No Group Activity support. Live Quiz support is limited to the addendum above.
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
- For this original slice, allow CODE only in practice quizzes and microlearning;
  the later Live Quiz slice supersedes that single exclusion. Continue to reject
  CODE in group activities, mixed stacks, and multi-element stacks.
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

- CI corrections (closed, see CI closure rounds 1 and 2 below): run `30536127287` passed formatting, lint, syncpack, types, GraphQL tests, CodeQL, and Playwright compilation, while three Playwright shards exposed test-only defects: the CODE mutation tracer assumed raw query text even though production uses persisted-query transport, the direct-link autosave tracer resolved `/` against the PWA base URL instead of Manage, and the MC tracer relied on `clear()` for a Slate editor even though the captured failure left `50%` selected. The fixes execute the generated CODE mutation document with intercepted variables, use the configured Manage URL for direct links, and clear Slate through select-all plus Backspace with an explicit empty-text assertion. Keep live staging and load proof gated on the separate CodeAPI allow-list deployment and user-provided connectivity.
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
- Slice 7 final review correction: the initial release path incremented `claimAttempts` before provider execution but did not restore that attempt on a `429`, contradicting the slice contract and allowing repeated throttles to exhaust a valid submission. Rate-limit deferral now atomically returns the receipt to `PENDING`, records `retryAt`, and decrements only the claim increment it just consumed; a focused tracer proves three consecutive throttles preserve the budget and the next execution can complete.
- Final Standards/Spec closure: persistent element instances can only be reused from the exact activity being edited and are transactionally rechecked before detachment; cross-tenant instance identifiers are rejected without moving the source instance. Group-activity clue replacement now runs inside the same transaction after that fence, so rejected edits leave existing clues intact. CODE submission preflight now begins with active participation and resolves the supplied instance only through an available practice quiz or microlearning in the requested course, normalizing missing, wrong-type, foreign-course, and unavailable targets to the same response. Authoring and runtime share the 128-character test identifier and finite positive aggregate-weight constraints. Finalized CODE responses persist trusted correctness for the existing Analytics pipeline, which maps correct, partial, and incorrect outcomes without re-evaluating participant code.
- Final review closure: implementation fix `5d29d11d3`, scope tracer `0588f26f9`, mutation-sensitivity follow-up `f26ffd6b9`, and group-clue atomicity fix `d366a0c61` each passed the repository-wide pre-commit gate. The final exact Standards and Spec review passes with no threshold finding; the final maintainability review also passes. The eight-case PostgreSQL tracer independently protects the shared preflight, all four transaction fences, and group-clue preservation in both rejection windows. Closure commit `7b31f518e` records these gates and the clean-target security receipt before publication.
- Slice 7 maintainability closure: commit `9343b80516` unifies ordinary and CODE post-grading persistence, removes the unbounded aggregate submission ledger, removes unsupported public CODE input fields, centralizes fixed CODE policy and claimable-state predicates, and makes runner/response error provenance explicit. Commit `7b8296700` closes the exact-review follow-up by making the boundary error kind mandatory and covering a malformed runner outcome ID. Exact-commit correctness and simplification reviews found no additional code issue; the plan/log staleness is closed by this finalization update.
- Final security remediation: element-editor autosaves use a versioned envelope bound to the authenticated lecturer and reject legacy, malformed, mismatched, or structurally unsafe entries before recovery or Formik loading; the Create action waits for the lecturer identity. Follow-up `bf0e0d802` centralizes creation/edit parsing and edit entry handling, safely parses direct-link and duplication storage without relying on the throwing third-party storage hook, and adds Playwright regressions for invalid JSON, foreign users, and incomplete current-user CODE envelopes. Exact-review follow-up `e2ecd8235` makes the storage hook own authenticated-envelope construction, clears even empty malformed records, validates every optional and nested member before asserting `ElementFormTypes`, and covers a same-user Case Study draft containing a malformed nested item. Review follow-up `30b107c53` models the safe intermediate values Formik actually writes—unset Case Study fields, string-backed number inputs, and null serialized exact-solution slots—so strict nested validation does not delete legitimate in-progress drafts; test follow-up `9d8508515` proves partial nested Case Study solution bounds reach restored Formik fields. Both exact-commit reviewers report no remaining finding. The live-quiz template CODE preflight carries the same element-permission predicate as the authoritative path. JSON validation rejects over-wide arrays before reading their members and stops object traversal at the node work bound; focused proxy tests prove the rejected array performs zero item reads. Matching-user recovery and invalid/foreign/incomplete rejection pass in the routed Manage app. Screenshots remain outside the repository at `/private/tmp/pr5142-matching-recovery.png`, `/private/tmp/pr5142-foreign-autosave-rejected.png`, `/private/tmp/pr5142-edit-autosave-recovery.png`, and `/private/tmp/pr5142-edit-autosave-rejected.png`.
- Verification evidence: the isolated devcontainer runs Node 24.16.0 and pnpm 11.5.0. The full `pnpm run check:all` passes after installing disposable Python 3.12 for the existing analytics workspace. The final-review closure currently passes the types and util typechecks, the GraphQL typecheck, 26 service-free GraphQL CODE tests, 20 real-PostgreSQL CODE submission lifecycle tests, eight PostgreSQL activity-scope tests proving preflight and post-preflight transaction fences across every editor, 23 util CodeAPI tests with the two process-runner tests explicitly skipped in the Python-less pnpm process, two Analytics correctness tests, and Analytics Ruff lint/format checks. The earlier isolated Python 3.12 run passed all 20 CodeAPI tests, including direct file-descriptor flooding and descendant cleanup. The GraphQL production build passes with only the repository's pre-existing Rollup/Pothos warnings, and the util, Hatchet package, and general-worker production builds pass. The util browser root contains no CodeAPI/Node imports, and the focused GraphQL validator covers shared JSON boundaries. `pnpm run prisma:sync` produces no diff. The full workspace build progressed through 18 packages before Auth's existing Google Fonts fetch (`JetBrains Mono` and `Source Sans 3`) stopped Turbo; scoped GraphQL, Manage, and PWA production builds pass with `NODE_ENV=production`. Slice 6 reruns `pnpm run check:all`, the PWA production build, the 12-test lifecycle suite, and the focused routed Playwright tracer with 4/4 tests passing. The tracer proves a real microlearning mutation/finalizer, visible failed readback plus retry, participant-scoped completion storage, 5/10 partial scoring, and exact authorized public `1/1` and hidden `0/1` aggregates. The routed PWA proof covers desktop English pending/reload/completion and 390×844 mobile German; screenshots remain outside the repository under `/tmp/agent-browser-shots/code-slice5-*.png`. ADRs 0001/0002 now carry the required wiki metadata and creation-log entries.
- Final security verification rerun: affected types, util, GraphQL, and Manage typechecks pass; the focused util suites pass 4/4 tests; types, util, and GraphQL production builds pass. Commits `bf0e0d802`, `e2ecd8235`, `30b107c53`, and `9d8508515` each pass the repository-wide pre-commit gate: 26 typecheck tasks, 7 lint tasks, formatting, syncpack, Prisma sync, and AGENTS validation. The Playwright suite typechecks and discovers the new creation/edit regression cases, including malformed nested rejection and partial-draft recovery. Its focused local execution does not reach test code because the disposable devcontainer's interrupted browser installation first lacked `chromium_headless_shell` and then left the full Chromium archive unable to open its ICU data. The routed `agent-browser` proof covers creation/edit, direct-link, foreign-user, malformed-JSON, incomplete-current-user, and valid-current-user recovery paths; a later positive partial-draft rerun is additionally blocked because the restarted DevPod lost its `devnet` aliases, leaving port 3002 healthy inside the container while the namespaced Traefik routes return 404. The current Manage production build passes TypeScript and webpack compilation, then fails while prerendering the unrelated `/en/resources/mediaLibrary` and `/en/404` pages with `NextRouter was not mounted`; the changed `/` route ran successfully through devrouter before the alias loss. The local NextAuth API route also returns 404 under this Next 16 dev runtime, so earlier browser proof used a locally minted, non-production test JWT without printing it.
- CodeAPI source check: local checkout `/Volumes/HOME/Git/df/code-interpreter` is clean at `5e459dd4f2d8bea6ae7a3004f15051dff26abae0`. It still hardcodes `librechat_jwt | openid_reuse`, so `klicker_jwt` remains deployment-blocked. `POST /v1/exec` still returns the flat `ExecuteResult`; its exported `ExecuteResponse.run` wrapper remains stale. The shared client therefore targets the verified flat response and treats it as hostile input.
- CI closure round 1: commit `5d118f8ab` was published and run `30654472967` executed the full suite on that exact head. Playwright shards 2 and 8 recovered, so the persisted-query mutation tracer and the Manage direct-link URL corrections hold. Shard 5 still failed because the MC clearing fix asserted `toHaveText('')` on a Slate field that renders its placeholder when empty; the received value was the placeholder plus a zero-width no-break space, so the assertion could never pass even though the clearing itself worked. The guard now asserts that the removed choice value `50%` is absent, which still fails on the original `clear()` defect without depending on placeholder copy. The other five failures in that shard were cascades from the unsaved question.
- Exact-head security receipt: the previous receipt for `7b31f518e1` and the staged PR body were lost with `/private/tmp`, and the Codex Security workspace `9c552ce0-10a9-4085-aba4-4664dbb5b0af` was not resumable, so a fresh whole-branch review ran at head `5d118f8ab`. It covered 16 surfaces spanning the CodeAPI client and JWT minting, sandbox payload construction, hostile-response parsing, grading projections, submission preflight and authorization, the claim/lease/finalize lifecycle, GraphQL authorization, participant-safe element data, the lecturer authoring projection, authoring validation, the autosave envelope, frontend rendering, evaluation aggregation, schema constraints, Hatchet limits, and dependency and secret hygiene. It reports zero high-confidence findings, four notes carried forward, and three external exclusions, and is sealed outside the repository at `~/.security-scans/klicker-uzh/5d118f8abcf7581739d2c6fe1bdf860321f83cbb_20260731T182039Z.md`. An addendum in that file reviews every later head on this branch: each delta from `5d118f8ab` touches only the one Playwright assertion and this plan document, with no production, schema, dependency, or configuration change, so the result holds at the published head. That addendum also records how to invalidate it if a third file ever appears in the delta.
- CI closure round 2: commit `5a10769bb` reached terminal CI with every check passing except GitGuardian. All eight Playwright shards pass in run `30656677150`, alongside formatting, lint, syncpack, types, GraphQL tests, `build-and-compile`, the AMD and ARM Docker build filters, and the three CodeQL analyses. GitGuardian still fails on two generic development-password occurrences in `.devrouter.yml` and `.devcontainer/docker-compose.yml`, which an upstream merge commit introduced and which have no diff against `v3`; that incident belongs to the repository owners, not to this branch.
- Next: nothing local remains. The PR stays draft until the external gates close: the separate CodeAPI `principal_source=klicker_jwt` allow-list deployment, the live staging smoke against it, the at-least-50 concurrent load proof, and the pilot course/package audit. None of these is local implementation work, and none will be attempted without explicit user authorization.
- Blockers: the separate CodeAPI `klicker_jwt` allow-list patch and deployment gate the live Slice 3 smoke, not local client construction. The pilot course/package audit remains open. Current PRD GitOps values resolve the KEDA and tenant-mode questions, but the local Kubernetes proxy is down, so they are desired-state evidence rather than a live-cluster readback; no cluster connection will be established without explicit instruction. Context7 remains unavailable. The Auth Google Fonts fetch prevents a complete offline full-workspace build. The current scoped Manage build additionally stops on the unrelated media-library/404 prerender router error after successful TypeScript and webpack compilation; routed `/` proof passed before the current local devnet-alias loss.
