# Writing Coach with useful lecturer context

For current readiness and next actions, use [Current roadmap](#current-roadmap--26-october-2026).
The original execution details below retain the September implementation contract and history.

## Approval summary

Lecturers will have a 1,000-character context field with scientific and informal examples. That context will guide audience, explanations, and learning priorities across standard chat modes. Writing Coach will give specific feedback on pasted excerpts using built-in criteria and Markdown. Learners will write every revision themselves.

Writing Coach will start disabled on existing and new chatbots. Lecturers can enable it through the existing controls and use it without Tutor or Explainer. The current restriction on Quizzer-only chatbots remains. The work reuses existing model routing, history, and access rules. It adds no rubric editor, separate Notes panel, new tool, provider, database table, or output-checking model call. Notes remain an optional short section in chat.

Success requires working authoring and mode selection, preserved existing configurations, and synthetic model comparisons showing that context changes useful feedback. Prompt inclusion alone will not count as proof. The feedback-only rule is model behavior and cannot be guaranteed mathematically. Existing required-tool policies may still make the mode unavailable. Writing Coach is a new standard mode. Its identifier always uses the built-in contract; stored guidance cannot bypass that contract or its opt-in flag.

Approval authorizes the two implementation slices below, an isolated local test runtime, originally up to 60 synthetic chat turns through the existing configured provider route (later increased to 72 as recorded below), focused checks, reviews, commits, a normal task-branch push, and one draft pull request. It does not authorize merging, marking ready, deployment, production chatbot/data access, or a new provider. The stopping point is a verified draft pull request and a stopped local runtime. No product choices remain open.

## Execution details

### Working context and authority

| Item                          | Contract                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository and target         | `uzh-bf/klicker-uzh`, target `v3-ai` after the 15 September repoint, verified through the live pull-request base and repository declaration. Planning baseline: `cbcede79718e8e60ff04d3f8376ab6a3f4bb64ed`. The pull request was originally opened against `v3`.                                                                                     |
| Worktree and branch           | Reuse `/Users/rschlae/Git/klicker/klicker-uzh/trees/proposal-writing-coach` on `docs/writing-coach-proposal`. It has no upstream and is zero commits ahead of and one commit behind the target refreshed during execution. No existing pull request was found for it.                                                                                |
| Plan and supporting documents | Final path: `project/writing-coach/2026-09-09-writing-coach-plan.md`. Existing proposal: `project/writing-coach/RESEARCH_PROPOSAL.md`. Agreed terms are in `CONTEXT.md`.                                                                                                                                                                             |
| Ownership                     | Main session owns architecture, integration, model/runtime access, final proof, reviews, and delivery. Bounded source work uses the configured executor. Boundary owner: self.                                                                                                                                                                       |
| Authority and pause           | Product decisions and planning are approved. Implementation begins on approval of this reviewed plan. Pause only for an uncovered data/provider boundary, unavailable required runtime or credentials, exhausted review/correction budget, or a material change to scope. Ordinary fixes and passing-check transitions do not need another approval. |

Terminal: complete the planned source and behavioral evidence, resolve applicable reviews, push the task branch, create or update one draft pull request, check its initial required CI outcome with one supported watcher, and stop the exact local runtime. A missing live-model route is an incomplete verification boundary; report it and finish independent checks without claiming the feature works. No cluster connectivity is required or authorized.

This is one cohesive full-path package. Although it spans authoring and chat, the layers implement one lecturer-configured writing capability and share acceptance evidence. Use one ordinary pull request with two implementation commits rather than separate layer pull requests. Repository stack support was verified; no stack topology change is needed. Reassess packaging only if substantive implementation uncovers an independently useful additional capability.

### Agreed product behavior

The user accepted 1,000 characters, lecturer-controlled enablement on every chatbot, and a dedicated Writing Coach chatbot. The earlier research proposal remains supporting evidence; this plan is the execution contract.

The built-in criteria cover purpose and audience, substance and reasoning, organization and coherence, clarity and precision, and tone and conventions. Adapt their relevance to the genre and excerpt. Offer specific strengths, a few prioritized issues, and detailed analysis when requested. Each priority identifies its evidence, explains its effect on the reader, and gives an action the author can take. Avoid grades, invented references, and claims about unseen parts of a document.

Writing Coach must not provide replacement wording, paraphrases, translations, completions, or rewritten documents, including on follow-up requests. It may quote the submitted text to locate an issue and explain how to revise. Optional Notes summarize a few useful tips or current priorities in ordinary Markdown; no separate persistence, progress tracking, or background behavior is introduced.

Lecturer context remains the single shared framing field. Keep its current label and access rules. Use one shared 1,000-character limit for the UI and server, preserve existing saved values, and give localized scientific and informal examples as persistent help. Do not prefill or overwrite the field. Empty context retains normal mode behavior. The examples and helper copy in the research proposal are starting copy, not strings to pin in tests.

Explicitly instruct the model to apply relevant audience, prior-knowledge, task, and learning-priority information from the serialized context. Keep fixed mode, course, evidence, privacy, formatting, and language contracts authoritative. Context edits apply to subsequent requests once the configuration is active, including in existing conversations. Published chatbots retain their live configuration until the saved revision is approved; in-flight requests and previous messages retain their content.

### Compatibility and implementation seams

| Surface                       | Required behavior and source evidence                                                                                                                                                                                                                                                                                                                                              |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authoring and save            | `ChatbotAuthoring.tsx` currently restricts edits to 200 characters. `packages/util/src/chatbotStandardModeConfig.ts` already accepts 1,000. Reuse normalization, GraphQL ownership/status checks, and existing JSON storage. No database migration is planned.                                                                                                                     |
| Mode configuration            | Extend shared types, validation, GraphQL fields/operations, and normal mode controls. Historical configurations without the new flag must keep every existing value and treat Writing Coach as disabled. Older update requests that omit the new field must preserve an already stored explicit Writing Coach choice. Do not overwrite legacy custom modes.                        |
| Availability and selection    | Register the mode in `apps/chat/src/lib/config/prompts.ts` and `modes.ts`, then use `effectiveChatModes.ts` consistently for layout, bootstrap, and requests. Permit at least one of Tutor, Explainer, or Writing Coach; Quizzer alone remains invalid. Preserve the current selected mode unless it becomes unavailable. A Writing-Coach-only chatbot selects its available mode. |
| Prompt composition            | `systemPromptCompiler.ts` currently includes typed context only for Tutor, Explainer, and Quizzer. Add Writing Coach and clarify `lecturer-standard-context.hbs`. Keep JSON serialization and existing fixed contracts. The chat route already reloads configuration and supplies compiled instructions per request.                                                               |
| Tools, history, and rendering | Preserve required MCP checks and exact mode binding behavior. Do not inherit Quizzer's special tool behavior, silently expose another mode, or bypass a required binding. Keep standard text streaming, Markdown, and existing message persistence. Use the mode's normal unavailable state when current course/tool policy excludes it.                                           |

The identifier `writing-coach` always denotes the new standard mode. The user explicitly superseded the speculative same-key custom-mode compatibility design on 10 September. Stored guidance cannot bypass typed opt-in or replace the platform contract. Preserve unrelated custom modes and existing standard-mode normalization; do not add collision flags, warnings or migration behavior for an unreleased feature.

A standalone Writing Coach configuration does not waive tool policy. The authoring experience must make incompatibility visible and must not imply that a mode is usable when the effective mode set excludes it. No new MCP tool is required for writing feedback itself.

### Primitive impact and documentation

| Primitive                   | Disposition                  | Contract                                                                                 |
| --------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------- |
| Standard-mode configuration | Extend                       | Optional Writing Coach flag with compatibility behavior; shared longer lecturer context. |
| Effective mode set          | Extend                       | Same server policy, with the new mode available only when enabled and eligible.          |
| Writing criteria            | Compose into the mode prompt | Platform-owned generic feedback guidance, no lecturer-authored rubric entity.            |
| Chat messages and Notes     | Reuse                        | Ordinary text and Markdown in existing conversation history.                             |
| Lecturer context            | Reuse and clarify            | Teaching guidance within fixed platform contracts, with demonstrated behavioral effect.  |

Update `CONTEXT.md` for the new mode and the changed conversational-mode invariant. Update `docs/chat-platform.md` for context application and Writing Coach's integration. Retain [ADR 0019](../../docs/adr/0019-chatbot-config-postgresql-authoritative.md) on per-request configuration authority and [ADR 0020](../../docs/adr/0020-two-tier-chatbot-approval.md) on publication/account approval. No new ADR passes all three tests at present: these choices are reversible, expected from the product, and reuse existing boundaries. A new durable assessment entity, provider, retention rule, or mode-authority change would reopen that assessment.

### Research basis

The existing proposal contains the source-backed literature review. Its relevant conclusions are that specific, actionable feedback and learner-controlled revision merit a pilot, while improved assisted revisions do not establish durable learning gains. The implementation needs no further literature search, document editor, or multi-agent feedback pipeline. The earlier public research consultation is reused for pedagogy only; it is not evidence that the present implementation works.

### Feature-wide verification portfolio

| Risk or behavior                                                          | Test obligation and primary seam                                                                                                             | Distinct evidence                                                                                                                                                                                                                               | Owner                                     |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Context length, saving, and preservation                                  | Extend existing utility/service cases and `playwright/tests/T-chatbot-authoring.spec.ts`.                                                    | Boundary acceptance/rejection, save/reload, mode-only edits, and retained configuration values.                                                                                                                                                 | Slice 1 executor                          |
| Mode defaults, legacy requests, and standalone configuration              | Extend utility/service tests, `apps/chat/test/effective-chat-modes.test.ts`, and the existing authoring/request tests.                       | Missing flag stays off; omitted update preserves state; stored same-key guidance cannot bypass opt-in or the platform contract; disabled mode is rejected; Writing Coach alone works; Quizzer alone and invalid configurations remain rejected. | Slice 2 executor                          |
| Full context in actual instructions without authority loss                | Extend `apps/chat/test/system-prompt-compiler.test.ts` and the existing mocked provider/request seam.                                        | Full normalized synthetic context reaches each applicable mode, including information near the limit; excluded custom modes and fixed policy composition retain their contract.                                                                 | Slice 1 executor, extended in Slice 2     |
| Feedback usefulness, genre adaptation, context steering, and no rewriting | Add small synthetic cases to the existing evaluation path; reuse the request transport in `apps/chat/scripts/klicker-evaluation-target.mjs`. | Saved real-model responses with explicit observations and failures; context comparisons in every standard mode, plus follow-ups, policy conflicts, revision checks, and rewrite pressure.                                                       | Main session after Slice 2                |
| Browser presentation and conversation continuity                          | Extend existing affected browser flows; add a new case only for a missing consequential interaction.                                         | Lecturer controls/examples/counter, participant selector and standalone mode, Markdown/Notes, refresh, and existing-conversation context updates.                                                                                               | Main session with executor-provided cases |

Tests assert observable behavior and structured contracts, not exact helper text, translations, rubric prose, or production prompt wording. Where touched tests pin changed prose, replace those assertions with relevant serialization, authority-composition, or behavioral coverage rather than updating the expected sentence. Do not refactor unrelated tests or add a prompt-only snapshot suite.

### Synthetic model verification

Use a local isolated synthetic chatbot and the existing provider route. No student drafts, personal data, production configuration, new judge service, or new telemetry sink are involved. Existing model calls incur the route's normal usage. Cap the run at 60 attempted chat submissions in total: allocate 30 to the initial mandatory matrix and 30 to retries or revalidation after corrections. Count browser-generated submissions and failed or interrupted attempts that may incur usage. Reuse the matrix turns for browser proof rather than generating extra uncounted responses. Provider-internal routing, classification, tool-loop, and fallback calls can exceed the chat-submission count; retain their normal metering where exposed. Do not expand the cap or change provider to bypass an unavailable route.

Before generation, freeze the full mandatory case table with the input, context variant, expected behavioral difference, language, requested route, and follow-up. Use this bounded allocation:

| Case group                        | Initial submissions | Required coverage                                                                                                                                                                                                                                                     |
| --------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Writing Coach context comparisons | 14                  | Eight turns cover two genres, two languages, and contrasting audience/focus contexts. Four repeat two matched pairs. Two use empty context. Include relevant guidance near the 1,000-character limit and a strong excerpt that should not attract invented criticism. |
| Existing standard modes           | 6                   | One matched context pair each for Tutor, Explainer, and an eligible Quizzer. Include English and German across these pairs. Expect mode-appropriate changes in explanations or practice, not writing feedback from every mode.                                        |
| Conversation continuity           | 2                   | One saved-context change within an existing conversation and one learner-authored revision; reuse initial matrix conversations.                                                                                                                                       |
| Boundary challenges               | 6                   | Direct rewrite requests in both languages, a disguised completion request, instructions embedded in an excerpt, conflicting lecturer context in Writing Coach, and conflicting context in another standard mode.                                                      |
| Participant-credit fallback       | 2                   | A first turn and follow-up with synthetic exhaustion preconditions and separately observed routing outcomes.                                                                                                                                                          |

Use the same input and learner request within each context comparison, hold route/settings constant, and repeat the specified pairs. A reviewer checks that expected differences are meaningful and consistent with the fixed mode policy before generation; cases are not selected after seeing favorable responses.

Record the requested model, persisted application-selected model, observed gateway/provider model when exposed, completed responses, and usage as separate evidence. For the fallback case, request an already-configured non-fallback model with exhausted synthetic participant credits and otherwise valid synthetic account prerequisites; expect the configured participant fallback. Verify those preconditions and the persisted selection after the request. Do not infer the route from response quality or an echoed requested model. Unknown gateway/provider internals remain unknown, without overstating application-level evidence.

The main session rates each response against the frozen behavioral expectations. Every mandatory case and repeat must complete and pass its frozen expectations. Every contrast pair must show the expected relevant difference, remain useful, and preserve the relevant mode boundary; no delivered replacement prose in Writing Coach, fabricated result/reference, or false claim of source verification is acceptable in this bounded set. Missing, failed, interrupted, or budget-exhausted cases leave verification incomplete even when all available responses look good. Report every failure and disagreement rather than averaging away severe failures. Fix in-scope problems and rerun affected cases within the cap. This acceptance describes the evaluated cases, not a statistical guarantee or universal model qualification.

The current adapter accepts Tutor/Explainer fixtures, creates a new conversation per question, and has mocked transport tests. Its message reader requires the persisted model to equal the requested model, and its completion payload echoes the requested identifier. For the explicit fallback case, introduce an expected application-selected model separate from the requested model and retain both receipts. Keep ordinary unexpected-model mismatch rejection intact. Missing selection or exhaustion evidence leaves fallback verification incomplete. Extend it narrowly or reuse its existing transport for Writing Coach and follow-ups; do not claim existing adapter tests cover these behaviors. Keep synthetic cases reproducible and the result summary in `project/writing-coach/`; raw local run receipts belong under ignored `project/_local/` with no credentials. A source-only or mocked success cannot substitute for these model runs.

### Delegation map and slices

| Workstream                 | Slices                          | Execution owner                        | Dependency and acceptance                                                                                                                             |
| -------------------------- | ------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lecturer context           | Slice 1 — usable context        | Configured executor; main integrates   | Current source mapping; completed save-to-request path with 1,000-character coverage.                                                                 |
| Writing feedback           | Slice 2 — Writing Coach         | Same configured executor, sequentially | Slice 1; complete mode behavior, compatibility checks, and runnable synthetic cases.                                                                  |
| Runtime proof and delivery | Both slices' integrated outcome | Main                                   | Integrated source; browser/model evidence, review disposition, and draft pull request. Main retains provider access, shared runtime, and final proof. |

#### Slice 1 — Lecturers can provide useful context

Route: executor. Increase the authoring limit to the existing shared 1,000-character constant, provide localized persistent examples, and clarify how standard-mode context guides the model. Extend the existing save and request-composition tests. Owned source: Manage chatbot authoring, relevant i18n entries, context wrapper/compiler only as needed, and the matching tests. Preserve existing client/server input behavior and stored values.

Acceptance: boundary and persistence tests pass; a full-length normalized synthetic value reaches the provider request for existing standard modes; affected builds/checks and the lecturer browser flow pass. Commit this complete source slice after verification. The post-commit simplifier and slice reviewer both apply because the change is substantive and crosses the authoring-to-inference contract.

#### Slice 2 — Lecturers can offer feedback-only Writing Coach

Route: executor. Add the generic mode prompt, localized presentation, opt-in flag and backward-compatible save path, standalone configuration support, and ordinary Markdown/Notes responses. Extend the existing mode resolver and selection flow, attach lecturer context, and prepare the bounded synthetic evaluation cases. Owned source: shared configuration/types, GraphQL input/output/service operations, Manage controls, Chat mode/compiler/prompt/selector paths, evaluation adapter/fixtures where necessary, and directly relevant tests/docs.

Acceptance: configuration and request-policy checks pass; the browser can enable the mode, use it alone, and reload its conversation; full context reaches the mode; model cases are runnable without a new tool or framework. Complete the integrated browser/model proof below before final review. Commit the source slice after its focused checks; run its simplifier and slice reviewer together. Main handles live-model execution and integrates any in-scope corrections into the same package.

### Verification, runtime, and delivery sequence

Use installed repository tooling and current lockfiles. Build affected dependencies before checks. Execute toolchain commands in the isolated task devcontainer; host Git/gh and the repository's host Playwright wrapper remain on the host. Use the existing `devrouter` task-worktree profile and provider configuration, with any secrets accessed only through the existing Infisical operator. Do not install or reconfigure integrations. No application runtime is started during planning.

Run focused package tests first: utility configuration cases, GraphQL chatbot service cases, Chat compiler/effective-mode/request cases, and the evaluation adapter's transport tests. Run the relevant existing authoring and participant Playwright flows through `pnpm playwright:host`. Regenerate GraphQL artifacts using the repository script if fields change, retain only expected tracked schema changes, then run affected builds and checks plus mandatory hooks. Exact narrowed test selections are resolved from current package scripts at execution; record commands and results.

Browser proof covers the changed lecturer and learner states in English and German at desktop and narrow mobile widths, including keyboard access and the expanded context field. Capture representative screenshots under the existing screenshot-gallery workflow for the draft pull request. Test only affected app profiles. Run the bounded model matrix after integration, then stop the exact local runtime and verify it stopped; do not delete its worktree, volumes, or data.

The main session owns review dispatch under `rs-model-routing`, corrections, and integration. Apply the configured post-slice simplifier/risk-review pair and one integrated final review after all required runtime evidence exists. Final review covers correctness, plan compliance, maintainability, bounded input/authority risks, and the configuration-to-chat contract. This does not authorize a broad security assessment. Use the configured continuity ladder for terminal reviewer failures; unresolved required review or runtime gaps keep delivery pending.

After human plan approval, commit this plan alone first and keep current glossary/research changes unstaged until their documentation commit. Preserve unrelated work. Keep ordinary source commits, review corrections, and documentation together on this branch. After complete verification and final review, push normally and create/update one draft pull request to the repository target. Include source/runtime evidence and any limits, follow one CI watcher, and fix in-scope failures. Do not mark ready, merge, deploy, or send other messages. The pull request was opened against `v3` and repointed to `v3-ai` on 15 September.

## Current roadmap — 26 October 2026

This section owns current status and supersedes earlier execution checkpoints and
the September readiness claims in this file. The approval summary still defines
the product contract. Earlier execution details describe their recorded baseline,
not today's target branch. The user approved integration, refreshed browser acceptance and review closure
after delivery-hook [PR #6724](https://github.com/uzh-bf/klicker-uzh/pull/6724)
merged on 26 October. Merge, staging acceptance and a learner pilot remain
separately gated.

### Status and evidence

| Area                          | Status                                   | Evidence and remaining boundary                                                                                                                                                                                                                                                                                                                                                 |
| ----------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product source                | Implemented on the task branch; unmerged | [PR #5867](https://github.com/uzh-bf/klicker-uzh/pull/5867) is open against `v3-ai`. The previously published feature head is `2bde9343c840870ef3f5cbf35b92e6b6d5524bff`; the integrated candidate awaits publication. Writing Coach is absent from the current target's standard-mode configuration.                                                                           |
| Lecturer context and feedback | Current focused acceptance passed        | Shared 1,000-character limit, localized scientific/informal examples, saved context on subsequent requests, five adaptable criteria and optional Markdown Notes. The accepted synthetic evaluation covered context contrasts, rewrite pressure and learner revisions.                                                                                                           |
| Current integration           | Candidate under verification             | Integrated target `432dd7bdc927a6ee49300ee6d2f41a6933daee31` into the existing task branch. Resolved revision-editor, custom-mode, evaluator and GraphQL conflicts. The shared standard-mode registry includes Writing Coach, preserving opt-in and exact tool bindings. Integrated local source checks and a seven-case current-model check pass; hosted CI remains pending.   |
| Automated checks              | Local pass; hosted candidate pending     | The eight September required contexts passed at `2bde9343c8` on 16 September, including all eight Playwright shards. Current integrated typechecks, lint, utility/Chat/evaluator, 94 GraphQL and host contracts pass. All 16 host authoring tests pass across two matching-profile runs; current-head hosted checks remain pending. Current rules also require `sync-ancestry`. |
| Review                        | Needs closure                            | Earlier corrections are retained, but one published documentation thread remains unresolved. The September final AI review ended partial; fixing its two reported findings does not establish a completed integrated review.                                                                                                                                                    |
| Browser evidence              | Refreshed and published                  | Ten current synthetic captures cover English/German desktop/mobile authoring, standalone setup and owner preview. Context examples, the 1,000-character boundary, save/reload, standalone selection and required-tool availability were exercised; images are published on the existing PR. Historical captures are labeled separately.                                         |
| Release and pilot             | Not established                          | This PR has not merged. No current staging acceptance, production release or learner pilot is established by this roadmap.                                                                                                                                                                                                                                                      |

The branch implements the agreed scope: feedback on pasted excerpts, no
replacement wording, generic criteria, lecturer context and ordinary Markdown.
No rubric editor, separate Notes store, new model tool or database migration was
added. The unreleased same-key Writing Coach compatibility paths were removed;
ordinary support for stored configurations that lack the new opt-in field remains.

### Review and evaluation disposition

The earlier implementation and review record remains in
[implementation review](2026-09-10-implementation-review.md),
[evaluation results](EVALUATION_RESULTS.md), and Git history. Treat their status
statements as dated evidence.

The remaining [documentation finding](https://github.com/uzh-bf/klicker-uzh/pull/5867#discussion_r4024180445)
is valid and corrected in the integration candidate: `saveChatbotRevision`
locks the chatbot row and checks `expectedRevisionVersion`. The previous claim
about comparing configuration and custom prompt text was removed. Verify the
thread's disposition before claiming all feedback is closed.

The two findings from the partial final AI review were fixed in `1e0f0664da`:
the evaluation harness now checks `LOCAL_COURSE_ID` and requires
`passChatbotId === false` for its exact fixture. The PR still shows a pending
`final-ai-review` status and a failed CodeQL aggregate; the earlier record
accepted two harness CodeQL alerts as advisories. Reassess applicable findings
and review requirements against the integrated candidate rather than treating
a non-required status or a partial review as completed review coverage.

All 30 frozen synthetic cases completed at least once. Bounded acceptance was
approved after 65 submissions. On 26 October the user explicitly approved the
remaining seven current-route calls and temporary synthetic test setup. All seven
completed and met their frozen expectations, exhausting the 72-call ceiling. Feedback-only behavior
is model-instructed, not a universal guarantee. Verbosity and Tutor/Explainer
recaps remain documented limitations, and the evaluation does not establish
learning gains. Preserve the original failed transport receipts and historical
ratings. Counter exhaustion and follow-up resolution still need isolated
test-owned counter/receipt paths for unit coverage without real submissions.

### Remaining work, in order

| Order | Outcome                                    | Owner                             | Completion condition                                                                                                                                                                                                                                                                                                                                       |
| ----- | ------------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Restore compatibility with current `v3-ai` | Implementation agent              | Resolve the actual target and its conflicts in the existing worktree. Preserve current revision-based authoring, custom modes, welcomes/starters and student answer-format/tone preferences. Verify that presentation preferences cannot authorize rewriting or override the Writing Coach contract. Record the integrated target SHA.                     |
| 2     | Close review and browser gaps              | Implementation agent              | Correct the documented save-conflict mechanism, disposition the open finding, and complete integrated review. Exercise context examples, save/reload, existing conversations, standalone mode and required-tool availability. Capture and visually inspect current English/German desktop/mobile authoring and learner states.                             |
| 3     | Qualify one candidate                      | Implementation agent              | Run affected checks and all current required contexts on the integrated candidate. Reuse unaffected historical evidence. Recheck changed prompt behavior with focused scientific/informal, rewrite-pressure and learner-revision cases within the remaining authorized allowance; report any uncovered boundary. Stop the task runtime after verification. |
| 4     | Decide merge and staging acceptance        | Maintainer / implementation agent | Present the qualified candidate and any remaining limitations. Merge only with named approval and required reviews complete. Resolve the current promotion route and request exact deployment authority separately; verify the served revision and the lecturer/learner workflow after an approved rollout.                                                |
| 5     | Assess a small pilot                       | Pilot owner to be agreed          | Agree participants, data handling and acceptance before execution. Assess feedback usefulness, length, audience fit and learners' ability to make their own revisions. Keep real learner evidence in approved private custody. Functional acceptance alone does not establish learning gains.                                                              |

Current required contexts are `sync-ancestry`, `check`, `check-gitleaks`,
`test-graphql-status`, `test-playwright-status`, `test-unit-status`,
`test-olat-api-status`, `test-intl-production-status` and
`build-images-status`. Discover them again when qualifying the candidate.
Human reviewers are requested by the user. The PR is already marked ready;
that state does not establish review approval.

### Verification and close-out discipline

Write readiness documentation before the final candidate push. Hold that
candidate while its checks run, and report the resulting SHA and run links in
the final response. A successful CI run does not create a new documentation
task. Add a later commit only for a substantive correction, not to chase the
phrase “current head.” Never describe a later head as verified by an earlier
run without stating the unchanged acceptance boundary.

Use one supported watcher per run and retain its identity. After repeated
identical failures, change the diagnostic approach rather than repeating
reruns without new evidence. Historical frontend image builds failed with
`ERR_PNPM_VERIFY_DEPS_BEFORE_RUN` and later passed on unchanged revisions.
A shared-cache interaction was suspected, but neither a corrupt layer nor a
concurrent-writer mechanism was proved. Do not carry that hypothesis forward
as an established infrastructure diagnosis.

The repository has pre-commit secret scanning, hook-managed checks, a pre-push
build and CI validation. Earlier commits bypassed hooks while reporting local
runtime limitations; that history is not permission to bypass current mandatory
checks. A documentation-only edit needs focused documentation validation, not
a new application runtime. If the hook cannot express that path, report the
delivery blocker and propose a bounded hook improvement separately.

### Deferred product decisions

Retain the 1,000-character context limit and Markdown Notes for the first pilot.
Editable rubrics, persistent Notes, learning analytics and a larger context
limit remain candidates only if pilot evidence supports them. Tutor/Explainer
quality work has a separate course-chatbot roadmap; reconcile current upstream
prompt changes during integration without expanding this feature into that
workstream.

## Integration progress — 26 October 2026

- Root outcome: feedback-only Writing Coach with useful lecturer context.
- Authorized terminal: verified source candidate on the existing pull request,
  refreshed browser evidence, closed review findings and a stopped local runtime.
- Execution mode: standard. Main owns integration, runtime, proof and delivery;
  bounded read-only evaluation mapping completed independently.
- Source integration: target `432dd7bdc927a6ee49300ee6d2f41a6933daee31`.
  Syntax, integrated typechecks, application lint, utility/Chat/evaluator and
  host contract checks pass. Authoring save/reload, standalone preview and
  responsive locale captures passed. All 94 selected GraphQL checks pass.
  Integrated review and hosted CI are pending. Ten refreshed browser captures
  were inspected and published on the existing PR. All 16 host authoring tests pass after the approved locked dependency refresh
  and matching standard profile with an explicit routed API origin.
- First useful acceptance: existing utility and Chat mode/compiler tests, then
  lecturer context save/reload and standalone learner mode in the real browser.
- Active runtime: exact task checkout with `manage,chat,ai,mcp`. A stale
  September fixture marker selected an incompatible Manage-only test path; it
  was preserved under ignored local artifacts before canonical runtime repair.
- The user directly approved seven remaining synthetic calls, temporary
  account/model/100-credit budget setup, and a frozen-lockfile host dependency
  refresh on 26 October. Earlier automatic-review refusals were not bypassed.
  Both actions completed. The seven current GPT-6 Luna responses met the selected
  frozen expectations with bullets/direct preferences. Temporary settings were
  restored with usage retained; the cumulative counter is 72 of 72.
- Next action: finish source review, publish the integrated candidate and fresh
  authoring captures, run hosted CI, and stop the exact runtime. Merge, deployment
  and a learner pilot remain separate unfulfilled boundaries.

The model-evaluation harness accepts explicit current model and answer-preference
settings. Receipts fingerprint the effective settings, so historical responses
from a different model cannot satisfy resumed cases. The frozen scientific and
informal case text remains unchanged. Current base route is GPT-6 Luna; the
historical full-matrix acceptance used GPT-5.6 Luna. The current seven-case smoke
check qualifies only its selected boundaries on GPT-6 Luna.
