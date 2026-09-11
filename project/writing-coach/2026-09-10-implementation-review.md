# Writing Coach implementation review

Status: correction implemented and verified locally; delivery commit and draft-PR update pending.

## Correction closure — 11 September

After user approval, the retained task runtime was recreated through the supported lifecycle with profile ai,chat,manage,mcp. The recreated runtime is ready, all selected applications and services are healthy, and disposable runtime data has been preserved since that approved reset. The Claude findings marked accepted above were implemented. No further model submissions were made.

Final post-correction suites ran in the recreated runtime: @klicker-uzh/util passed 71 tests; @klicker-uzh/chat test:run passed 647 and skipped 21; @klicker-uzh/graphql passed 871 and had one pre-existing failure in the assessment live-quiz reset case. Git history confirms neither the implementation nor its test changed on this branch, so that failure is outside this correction. The focused host authoring flow playwright/tests/T-chatbot-authoring.spec.ts passed with the disposable database preserved. git diff --check passes. Fresh source inspection finds no remaining hasLegacyWritingCoachMode, writingCoachIsCustom, CUSTOM_MODE_COLLISION, or chatbotWritingCoachCollision references under apps/packages outside build and dependency outputs. The remaining legacy references are unrelated project history or deliberate compatibility tests for the previously released scopeNote field.

Delivery remains: commit and push this verified cleanup, update draft PR 5867 evidence, and monitor exact-head CI. No merge, readiness change, or deployment is authorized.

Reviewed source: draft PR 5867, head `62249c7a72d262f51c20a9ef4131aa1cf4794c0c`, feature base `294e3f9f35c549be67aa7fb9d96e5539dd174e13`, plus the local correction diff. Target remains `v3`; no merge or deployment.

## Findings and corrections

1. **Medium — stored same-key guidance bypassed the platform contract.** `hasLegacyWritingCoachMode` suppressed the Writing Coach platform prompt and typed lecturer context solely because a JSON key existed. An empty prompt could leave no mode contract; an arbitrary custom prompt could replace feedback-only behavior. Removed the exception. Writing Coach always receives its platform contract, and its typed opt-in controls eligibility. Added synthetic contract composition and opt-in regression checks.
2. **Maintainability — speculative compatibility spread across the UI.** An unreleased mode had a bootstrap flag, Zustand field, React context, extra component props and label/icon exceptions. Removed this plumbing, the collision warning and rejection, and compatibility-only tests. Ordinary custom modes and pre-existing standard-mode normalization remain.
3. **Low — mode order differed between editor and review.** The review summary now follows Tutor, Explainer, Quizzer, Writing Coach, matching the editor.
4. **Verification gap — initial evaluation request was not asserted.** Extended the existing synthetic adapter test to check the first turn mode, model, parent and test-owned input. This final assertion addition has syntax validation but still requires the test rerun.

## Behavior assessment

The built-in prompt covers five generic criteria, scientific evidence/uncertainty and informal tone, specific passage-level feedback, revision operations, and optional Markdown Notes. It prohibits replacement wording, translations and completions, including follow-up pressure and conflicting lecturer guidance. No new tool or output validator was added. Those are model instructions, not deterministic enforcement.

The shared 1,000-character context is normalized and saved through the owner-authorized configuration mutation. Request-time database configuration feeds prompt compilation, including existing conversations. Save guards preserve concurrent changes. Prior synthetic model evidence applies to the unchanged built-in prompt: scientific/informal and English/German cases passed the approved bounded acceptance. Tutor/Explainer introductory recaps remain a previously accepted limitation. No additional model submissions were made; the counter remains 65 of 72.

## Fresh verification

- Dependency build: 7 tasks passed.
- Utility suite: 71 passed.
- Chat mode/compiler/request/bootstrap/presentation suites: 84 passed.
- GraphQL service suite: 71 passed after the first run found pre-existing synthetic users; direct invocation also emitted Redis loopback warnings.
- Affected package checks: 13 tasks passed.
- Host launcher and identity checks: 34 passed outside the sandbox.
- Diff whitespace and evaluation test syntax: passed.

The last small test assertions and mode-summary ordering still need a container check. Full hook-equivalent checks, fresh browser captures, independent integrated review and a correction commit/push remain outstanding. Earlier screenshots are historical evidence, not refreshed proof of this correction.

## Blockers and next action

Devrouter rejects recovery with `Repair requires the recorded profile, resource sets, and unchanged managed configuration`. Diagnostics report generated Dev Container configuration drift. A retained beta-enrollment fixture also permits only the manage profile while the recorded profile is ai,chat,manage,mcp. The fixture marker was restored unchanged. Canonical stop completed; all exact task containers are stopped and no task routes remain. Repair the exact task runtime through its supported lifecycle before container/browser checks; do not edit managed state manually.

Claude independent review failed with HTTP 401 due to an expired OAuth token. Automatic approval review rejected the configured AGY fallback because it would disclose repository material to another provider. That route was not executed. The native read-only explorer terminated with HTTP 503 and produced no report. An authorized outside-sandbox Claude retry has empty output and error files; its process state remains unverified.


## Resumed goal checkpoint

Remote state refreshed on 2026-09-10: [draft PR 5867](https://github.com/uzh-bf/klicker-uzh/pull/5867) still targets `v3`; the task head matches its upstream (0 ahead / 0 behind). The task is 12 ahead / 4 behind `origin/v3`; no integration performed merely for drift.

The runtime mismatch is now isolated to `.devcontainer/devcontainer.devrouter.json`: its generated `runServices` omits `litellm`. Adding that entry in memory, without writing the managed file, reproduces the recorded effective SHA-256 `e086f2e10ef939b08dd4ed7a3744828b30cfcb26bd02846df14abdcc4d659620` exactly. The existing generated file hashes to `d021e81a971f99c78c07ea4b964f0511d0ffb9ff5201e258626441feb0756385`. The supported repair baseline rejects generated-file drift; managed state was not edited.

Fresh Docker inspection confirms all seven containers in exact compose project `default-do-70f30` are exited. Fresh route verification is unavailable: `devrouter ls --json` fails closed because sandbox process inspection returns EPERM. Automatic approval review rejected an outside-sandbox process-status check after HTTP 429 retry exhaustion. This prevents checking the pending Claude process through that route. Earlier zero-route evidence is historical, not a fresh route result.

Fresh source inspection found no remaining `hasLegacyWritingCoachMode`, `writingCoachIsCustom`, `CUSTOM_MODE_COLLISION`, or `chatbotWritingCoachCollision` references under apps/packages (excluding build/dependency outputs). `git diff --check` passes. Container-dependent checks, browser captures, integrated independent review, and commit/push remain pending. No new model submissions, runtime deletion, or managed-state edits occurred.

Source-review follow-up: the stored-guidance regression now asserts that the synthetic guidance is present before comparing its position against the platform contract. This avoids a false pass from `indexOf` returning -1. Syntax validation of the evaluation adapter test and `git diff --check` pass; the modified compiler regression still requires its container test run. Runtime deletion has not been authorized and would depart from the active goal's data-preservation constraint.


## Independent review disposition

Claude completed its scoped review successfully (Opus 5 reported, with additional Fable provider usage in the envelope); the seven-finding result validates against the canonical review schema. It found no corrected-feature behavior defect. Accepted the test-runner mismatch: the harness guard tests now register with Vitest. Accepted redundant-test cleanup: the store case now covers mode-neutral fallback only; the duplicate disabled-Writing-Coach route case is removed while typed-disabled route and opt-in resolver coverage remain. These edits await container execution.

The bootstrap key-order recommendation is rejected: JSON object order is not the API contract and the assertion still checks the complete key set. The untracked report will be included in the correction commit after data hygiene review. Shared required-tool predicate consolidation and changing the public reason field to an enum/Boolean are deferred: current advisory and enforcing classifications agree, and neither recommendation fixes a current behavioral defect; expanding the public schema is unnecessary for this cleanup.

A fresh outside-sandbox canonical `ensure` for the exact recorded profile still fails its unchanged-configuration repair precondition. Fresh source-path route inspection confirms zero task routes. Runtime data remains preserved. Independent review is available; corrected test execution, browser captures, hook-equivalent checks and publication remain blocked on supported runtime recovery.
