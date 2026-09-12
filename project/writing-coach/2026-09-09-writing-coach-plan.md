# Writing Coach with useful lecturer context

## Approval summary

Lecturers will have a 1,000-character context field with scientific and informal examples. That context will guide audience, explanations, and learning priorities across standard chat modes. Writing Coach will give specific feedback on pasted excerpts using built-in criteria and Markdown. Learners will write every revision themselves.

Writing Coach will start disabled on existing and new chatbots. Lecturers can enable it through the existing controls and use it without Tutor or Explainer. The current restriction on Quizzer-only chatbots remains. The work reuses existing model routing, history, and access rules. It adds no rubric editor, separate Notes panel, new tool, provider, database table, or output-checking model call. Notes remain an optional short section in chat.

Success requires working authoring and mode selection, preserved existing configurations, and synthetic model comparisons showing that context changes useful feedback. Prompt inclusion alone will not count as proof. The feedback-only rule is model behavior and cannot be guaranteed mathematically. Existing required-tool policies may still make the mode unavailable. Writing Coach is a new standard mode. Its identifier always uses the built-in contract; stored guidance cannot bypass that contract or its opt-in flag.

Approval authorizes the two implementation slices below, an isolated local test runtime, originally up to 60 synthetic chat turns through the existing configured provider route (later increased to 72 as recorded below), focused checks, reviews, commits, a normal task-branch push, and one draft pull request. It does not authorize merging, marking ready, deployment, production chatbot/data access, or a new provider. The stopping point is a verified draft pull request and a stopped local runtime. No product choices remain open.

## Execution details

### Working context and authority

| Item                          | Contract                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository and target         | `uzh-bf/klicker-uzh`, target `v3`, verified remote default and repository declaration. Planning baseline: `cbcede79718e8e60ff04d3f8376ab6a3f4bb64ed`.                                                                                                                                                                                                |
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

Explicitly instruct the model to apply relevant audience, prior-knowledge, task, and learning-priority information from the serialized context. Keep fixed mode, course, evidence, privacy, formatting, and language contracts authoritative. Context edits apply to the next request after saving, including in an existing conversation; an in-flight request and previous messages retain their content.

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

| Risk or behavior                                                          | Test obligation and primary seam                                                                                                             | Distinct evidence                                                                                                                                                                                          | Owner                                     |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Context length, saving, and preservation                                  | Extend existing utility/service cases and `playwright/tests/T-chatbot-authoring.spec.ts`.                                                    | Boundary acceptance/rejection, save/reload, mode-only edits, and retained configuration values.                                                                                                            | Slice 1 executor                          |
| Mode defaults, legacy requests, and standalone configuration              | Extend utility/service tests, `apps/chat/test/effective-chat-modes.test.ts`, and the existing authoring/request tests.                       | Missing flag stays off; omitted update preserves state; stored same-key guidance cannot bypass opt-in or the platform contract; disabled mode is rejected; Writing Coach alone works; Quizzer alone and invalid configurations remain rejected. | Slice 2 executor                          |
| Full context in actual instructions without authority loss                | Extend `apps/chat/test/system-prompt-compiler.test.ts` and the existing mocked provider/request seam.                                        | Full normalized synthetic context reaches each applicable mode, including information near the limit; excluded custom modes and fixed policy composition retain their contract.                            | Slice 1 executor, extended in Slice 2     |
| Feedback usefulness, genre adaptation, context steering, and no rewriting | Add small synthetic cases to the existing evaluation path; reuse the request transport in `apps/chat/scripts/klicker-evaluation-target.mjs`. | Saved real-model responses with explicit observations and failures; context comparisons in every standard mode, plus follow-ups, policy conflicts, revision checks, and rewrite pressure.                  | Main session after Slice 2                |
| Browser presentation and conversation continuity                          | Extend existing affected browser flows; add a new case only for a missing consequential interaction.                                         | Lecturer controls/examples/counter, participant selector and standalone mode, Markdown/Notes, refresh, and existing-conversation context updates.                                                          | Main session with executor-provided cases |

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

After human plan approval, commit this plan alone first and keep current glossary/research changes unstaged until their documentation commit. Preserve unrelated work. Keep ordinary source commits, review corrections, and documentation together on this branch. After complete verification and final review, push normally and create/update one draft pull request to `v3`. Include source/runtime evidence and any limits, follow one CI watcher, and fix in-scope failures. Do not mark ready, merge, deploy, or send other messages.

## Current roadmap — 12 September 2026

This section supersedes earlier execution checkpoints. Historical experiments and review dispositions remain in [evaluation results](EVALUATION_RESULTS.md), [implementation review](2026-09-10-implementation-review.md), and Git history; statements there about pending publication or completed browser acceptance must be read against this status.

### Delivered

[Draft PR 5867](https://github.com/uzh-bf/klicker-uzh/pull/5867) targets `v3`. The verified source/delivery head is `4443df2b6462387386dbed888457d1dd8f511c7d`; subsequent roadmap-only commits do not constitute new runtime evidence. The task branch matches its remote. At the 12 September fetch, `origin/v3` has eight commits outside this branch; drift alone does not authorize or require another integration.

- Lecturer context: shared 1,000-character limit, scientific/informal examples, save/reload protection, and request-time prompt composition, including existing conversations.
- Writing Coach: opt-in standard mode, standalone configuration, five adaptable criteria, passage-specific feedback, scientific/informal guidance, and optional Markdown Notes. No new tools or rubric editor.
- Cleanup: removed unreleased same-key compatibility plumbing and corrected authoring mode order. Cleanup commit `8a742f6dff` and target integration `89e4304efa` are pushed.
- Evaluation: all 30 frozen cases completed at least once; 65 of 72 submissions used. The user accepted bounded Writing Coach results and the Tutor/Explainer recap limitation. No new submissions are part of this roadmap update.

### Verification and limits

The integrated Chat suite passed 647 tests with 21 skipped. The isolated GraphQL run passed 871 with one documented pre-existing assessment-reset failure; current PR GraphQL CI passes. Current code checks, secret checks and translation smoke tests pass. The later host checks/build passed 35/35 and 23/23 tasks, respectively, but used Node 26 rather than the repository's Node 24 container toolchain.

Earlier authoring interactions and nine inspected English/German desktop/mobile captures cover context boundaries, examples, save/reload, standalone mode and saved feedback. Fresh browser acceptance after integration remains incomplete: dependencies and runtime configuration changed, so unchanged UI source does not establish equivalent browser behavior. Current CI skipped actual Playwright execution. Runtime recovery/fixture access must be resolved through supported lifecycle commands with retained data preserved before recapture.

The independent Claude review and accepted corrections are recorded, but forge gates remain unresolved at the verified head: OpenCodeReview failed with provider HTTP 402 and produced no findings; `final-ai-review` is pending. These are not successful reviews or new feature defects.

Feedback-only behavior is model-instructed, not deterministically guaranteed. The synthetic results do not establish universal rewrite resistance or learning gains. Feedback can be verbose; Tutor/Explainer can repeat known definitions despite expert context. Notes are optional response text, not a persistent learning record.

### Next steps

| Order | Outcome | Owner | Completion evidence / authority |
| --- | --- | --- | --- |
| 1 | Finish integrated browser acceptance | Implementation agent | Supported runtime and synthetic fixture access; English/German desktop/mobile enable, save, reload, long-context and learner interaction checks; refreshed screenshot provenance. Preserve retained data; escalate any required reset or configuration change separately. |
| 2 | Settle review gates and delivery evidence | Implementation agent / repository reviewer | Resolve the provider HTTP 402 capability issue, complete required final review, disposition findings and verify the resulting PR head. Keep current and historical receipts distinct. |
| 3 | Review merge and staging readiness | Maintainer | Browser and review gates complete, required CI passing, and required human review recorded. Mark-ready, merge into `v3`, and staging deployment each require named approval; this roadmap authorizes none of them. |
| 4 | Run a small lecturer/learner pilot | Maintainer, with pilot owner to be assigned | Proposed after staging acceptance: assess feedback usefulness, revision ownership, audience fit and length. Agree participants, data handling and acceptance before execution. No date or capacity commitment yet. |

The immediate next action is supported runtime/fixture diagnosis for step 1, alongside resolving the outstanding review capability. Do not describe the feature as fully verified or released until those dependent gates are complete.

### Deferred product decisions

Keep the 1,000-character limit and Markdown Notes for the first pilot. Editable rubrics, a persistent Notes panel, learning analytics and a larger context limit are uncommitted candidates, to revisit only when pilot evidence establishes a need. Improving Tutor/Explainer recap behavior is a separate follow-up rather than a Writing Coach release gate under the accepted evaluation disposition.
