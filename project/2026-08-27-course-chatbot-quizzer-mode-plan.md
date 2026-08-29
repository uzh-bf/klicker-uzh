# Course chatbot Tutor, Explainer, and Quizzer modes

## Goal

Give course chatbots three clear learning modes with short, mode-specific prompts:

- Tutor guides the student's next learning step without withholding help indefinitely.
- Explainer gives a direct, structured explanation grounded in course material.
- Quizzer conducts one-question-at-a-time practice from retrieved course material.

The first pull request must improve existing chatbots automatically where the required capability is already configured. It must not claim or expose lecturer-authored question practice or personal-card generation before those open capabilities have landed.

## Non-goals

- Do not edit AI Buddy, its prompts, or its deployment.
- Do not duplicate language selection, Swiss Standard German, course scope, privacy, safety, retrieval grounding, insufficient-context handling, or citation policy inside mode prompts. The fixed compiler layers from pull request #5608 remain authoritative.
- Do not import faculty-specific templates, mandatory multi-tool fallbacks, end-of-answer source lists, hidden tool names, blanket Python defaults, or exam-equivalence claims.
- Do not integrate, rebase, amend, or otherwise mutate the open personal-practice stack in pull requests #5481 through #5483.
- Do not add lecturer-authored structured-question practice or personal-card generation in the first pull request.
- Do not migrate or rewrite stored chatbot prompts or database rows.
- Do not start or inspect a local runtime, use a browser, call a live model, access secrets, mutate a database, deploy, or merge under this plan.

## Plan identity

- Plan: `project/2026-08-27-course-chatbot-quizzer-mode-plan.md`
- Repository: `uzh-bf/klicker-uzh`
- Branch: `rs/chat-quizzer-mode`
- Worktree: `trees/chat-quizzer-mode`
- Target: `v3`
- Baseline: `origin/v3` at `86e8ac2e13c77e90a9bcd45d0f6b5f03fff18eed`
- Latest inspected target: `origin/v3` at `f0659e1301254320b2f67a0a4be752ebf6a41c0f`; the 14 newer commits do not touch the planned Chat or i18n source paths. One commit updates only the local-runtime profile paragraphs in `docs/chat-platform.md`, outside this package's documentation section.
- Baseline includes: merged pull request #5608, which enforces the fixed course language and grounding policy at prompt compilation.
- Dependent capability references: `origin/v3-ai` and open pull requests #5481, #5482, and #5483 are read-only evidence, not integration sources.
- AI Buddy reference: deployment `origin/main`, inspected by component rather than from its stale dirty checkout.

## Execution contract

- Execution owner: current main session.
- Autonomy: after one human approval of this reviewed plan, execute Stage 1 through its terminal condition without intermediate approval checkpoints.
- Boundary owner: `self`.
- Authority after approval: make only the scoped Stage 1 source, test, ADR, and wiki edits below; create local commits; run static Git checks; dispatch required read-only reviews; apply verified corrections; push `rs/chat-quizzer-mode`; and create or update a draft pull request against `v3`.
- Withheld: upstream integration, changes to the active practice stack, runtime or browser use, local container-dependent toolchain checks, live-model evaluation, secrets, database access or migration, cluster access, deployment, ready marking, merge, and worktree or branch deletion.
- Terminal: a source-complete draft pull request against `v3`, with exact-head CI reported and browser evidence explicitly outstanding because runtime use is excluded.
- Pause: stop if fresh refs materially change prompt compilation, mode configuration, or required-MCP semantics; if the task worktree gains unclear foreign changes; if safe Quizzer availability cannot distinguish absent configuration from an explicit opt-out; if retrieval inheritance requires unrestricted or wildcard Tutor tools; if the active practice stack becomes an implementation dependency; or if a withheld action becomes necessary.

## Problem

- The built-in Tutor prompt mixes persona, language, citation, safety, privacy, image handling, mathematics, and coding rules. Several now duplicate or conflict with the fixed compiler policy.
- There is no true built-in Explainer prompt. A chatbot with stored prompts can also replace the complete default mode set, despite ADR 0021 describing Tutor and Explainer as platform standard modes.
- Mode availability is resolved separately in the participant UI and chat request route. A partial change can therefore show a mode that the server rejects.
- Required MCP configuration is currently checked globally. Synthesizing a standard mode without an effective required binding can manufacture a guaranteed `503` response.
- A useful Stage 1 Quizzer can generate one grounded practice question from retrieved course material, but the richer lecturer-question and personal-card flows are not available on `v3`.

## Evidence and source comparison

### Current Klicker contract

- `DEFAULT_PROMPT` contains only Tutor, and its prompt includes superseded language and policy text.
- `resolveModeDescriptions` and `getSupportedChatModes` use replacement semantics when stored `systemPrompts` contain any entries.
- `compileSystemPrompt` already composes the mode persona beneath fixed course, citation, and language contracts.
- The layout, settings endpoint, settings store, and chat request route independently derive parts of the effective mode contract.
- Chatbot MCP configurations are mode-specific. A required configuration elsewhere on the chatbot causes a selected mode without a required binding to fail closed.
- `systemPrompts.<mode>` is a JSON object with `prompt` and `description`, so `enabled: false` can express a backward-compatible mode-level opt-out without a schema migration.

### AI Buddy inspiration

- Reuse the idea of short role-specific output checks, direct-answer-first behavior where appropriate, explicit source provenance, and a clear no-context response.
- Keep latest-message language locking, tool-output language isolation, course scope, PII-safe retrieval, insufficient-evidence handling, safety precedence, and citations in Klicker's fixed compiler layers rather than repeating them per mode.
- Exclude OEC or faculty-specific boundaries, exact referral templates, mandatory recovery counts, end-of-answer source lists, and tool implementation details.

### Available and pending practice capabilities

- `v3` can expose a course `doc_query` binding per mode. Stage 1 can therefore ask AI-generated questions based on retrieved course material.
- `v3-ai` has answer-safe lecturer-authored practice-question lookup and backend-graded submission, currently restricted to Tutor.
- Pull requests #5481 through #5483 add participant-owned personal practice and retrieval-backed flashcard generation with a plan, explicit approval, and fail-closed evidence boundary.
- The practice stack is open, its local and remote topology diverges, and its local top branch advanced during planning. Stage 2 must inspect the eventual merged source instead of relying on today's branch snapshots.

## Decisions

### Mode responsibilities

- Tutor guides learning. It diagnoses the student's current step, makes one pedagogical move at a time, asks one focused question when useful, and escalates hints gradually. It acknowledges concrete progress without generic praise. After a meaningful attempt and an explicit request for the solution, it provides the answer with reasoning instead of withholding indefinitely.
- Explainer answers directly. It leads with the core answer, defines important terms, adapts depth to the request, and uses grounded derivations or examples. It distinguishes course-backed facts from interpretation and ends with at most one optional comprehension check.
- Quizzer conducts active practice. Stage 1 retrieves course material, identifies the question as AI-generated from course material, asks one question, waits for the attempt, gives brief specific feedback, offers at most one hint or retry, and then explains before moving on.
- Quizzer does not reveal an answer before an attempt unless the student explicitly gives up. It does not claim to reproduce the lecturer's questions or the exam unless course material explicitly establishes that provenance.
- Deep exposition belongs in Explainer. Guided problem solving belongs in Tutor. Repeated practice belongs in Quizzer.

### Fixed and mode-specific prompt layers

- Keep mode prompts concise and limited to role, interaction loop, response shape, and a short role-specific self-check.
- Keep language, Swiss orthography, course scope, retrieval grounding, privacy, safety, insufficient-context handling, and citations solely in the fixed compiler layers.
- Move the existing attachment-description handling out of the Tutor persona into one fixed cross-mode input-context layer. All modes then treat supplied attachment descriptions as user-provided visual context without exposing the internal representation.
- Remove the blanket Python default, terminal execution assumptions, duplicated safety/privacy text, duplicated citation instructions, generic identity boilerplate, and system-prompt confidentiality request from the Tutor default.

### Platform mode composition

- Tutor and Explainer are platform standard candidates for every chatbot. A stored prompt overrides only the matching standard persona; missing standard prompts use platform defaults.
- Stored custom modes remain available and retain their configured prompt and description.
- `systemPrompts.<mode>.enabled: false` explicitly removes a standard or custom mode. Legacy objects without `enabled` remain enabled.
- The effective mode resolver excludes any mode that is statically known to violate the chatbot's current required-MCP contract. The same resolver drives layout options, the settings response, selected-mode validation, and request-time MCP selection.
- Known standard labels and descriptions remain localized and platform-owned. Custom descriptions remain lecturer-owned. Replace the global fallback boolean with per-mode provenance or an equivalent representation that preserves this distinction.

### Capability-gated Quizzer rollout

- Quizzer appears only when it is not explicitly disabled and a safe effective `doc_query` binding can be resolved.
- An exact Quizzer configuration for one MCP server shadows Tutor inheritance from that same server. A disabled exact Quizzer row blocks inheritance from that server.
- Otherwise, Quizzer may inherit only an enabled Tutor configuration whose strict tool alias is `doc_query` or whose explicit, non-wildcard `allowedTools` includes `doc_query`.
- Never inherit an unrestricted configuration, wildcard tools, or the complete Tutor tool set.
- Preserve priority, `required`, and alias configuration on inherited retrieval bindings. Required retrieval remains fail-closed when its server or tool is unavailable.
- Configuration precedence is resolved per MCP server, so one supplemental Quizzer configuration cannot accidentally remove a separate required retrieval binding.
- The API may inspect disabled configuration rows to resolve shadowing, but it must send only enabled effective configurations to tool setup and must not expose server configuration or secret-bearing fields to the client.

### Automatic application to existing chatbots

- No database migration or stored-prompt rewrite is needed.
- Tutor and Explainer prompt improvements apply when a chatbot does not override that mode. Existing stored overrides remain unchanged beneath the fixed platform policy.
- Missing Tutor or Explainer entries are synthesized from platform defaults unless explicitly disabled or statically incompatible with required-MCP policy.
- Quizzer appears automatically only for chatbots with a provably restricted course-retrieval binding, including a safe inherited Tutor `doc_query` binding.
- Existing chatbots without such retrieval do not show a misleading Quizzer mode. Administrators can opt out with `enabled: false` or configure an exact Quizzer binding later.

## Primitive impact

| Product primitive | Disposition | Contract delta | Affected compositions and consumers | Evidence |
| --- | --- | --- | --- | --- |
| Chatbot mode/persona | Extend | Tutor, Explainer, and capability-gated Quizzer become platform standards with per-mode stored overrides | Default and stored prompts, mode switcher, settings | ADR 0021 and current replacement semantics |
| Effective mode set | Introduce | One server-authoritative resolver composes standards, custom modes, explicit disables, and required-tool compatibility | Layout, settings API/store, request validation | Current duplicated resolution paths |
| Course retrieval binding | Extend | Quizzer can reuse only a provably restricted Tutor `doc_query` binding | MCP selection and required-tool gate | Current exact-mode configuration and `503` behavior |
| Practice turn | Introduce | Stage 1 uses a retrieved, AI-generated ask, wait, assess, feedback, next loop | Quizzer prompt and starter copy | Existing `doc_query` capability |
| Structured lecturer question | Reuse later | Stage 2 exposes answer-safe lookup and backend grading in Quizzer | `mcp-student` practice flow | `v3-ai`, not `v3` |
| Personal practice card | Reuse later | Stage 2 may practise saved flashcards and preserve plan-to-generation approval | Open personal-practice stack | Pull requests #5481 through #5483 |

## ADR gate

- Result: amend ADR 0021.
- Add Quizzer as a capability-gated platform standard mode.
- Record additive standard-mode composition, stored per-mode override precedence, explicit `enabled: false`, platform-owned standard presentation, and safe per-server retrieval inheritance.
- Record that capability-specific modes may be hidden when their required capability cannot be resolved.
- Do not create a new ADR. This extends the existing standard-mode decision rather than introducing a separate architecture.
- Reopen with a new ADR only if future work makes mode availability database-managed, introduces a general capability registry, or allows broad cross-mode tool inheritance.

## Planning-stage review

- Reviewer: native `planner` on the named draft.
- Status: `DONE_WITH_CONCERNS`.
- Accepted: two-stage delivery, capability-gated Quizzer, one shared resolver, per-server restricted retrieval inheritance, per-mode opt-out and provenance, attachment handling in a fixed layer, honest Stage 1 copy, and no practice-stack mutation.
- Rejected or narrowed: universal Quizzer exposure and inheritance of the complete Tutor MCP configuration.

## Delegation map

| Workstream | Slice | Owner | Dependency | Acceptance boundary |
| --- | --- | --- | --- | --- |
| Effective modes and safe retrieval inheritance | S1 | `main` | Approved plan and refreshed compatible refs | One resolver drives UI and server; required tools remain fail-closed; custom modes and opt-outs are preserved |
| Personas, presentation, and documentation | S2 | `main` | Passing immutable S1 | Concise prompts, honest Quizzer UI, fixed attachment policy, focused tests, amended ADR and wiki |
| Lecturer-authored question activation | Stage 2A, separate package | Future execution owner | Capability merged into eventual target | Answer-safe lookup, explicit submission, backend grading, visible provenance |
| Personal-card practice activation | Stage 2B, separate package | Future execution owner | Pull requests #5481 through #5483 merged and re-inspected | Saved-card practice and approved generation retain fail-closed evidence and visible provenance |

- S1 and S2 remain in the main session because availability, required-tool safety, prompt precedence, and UI truthfulness share one critical contract.
- Stage 2 is not authorized by approval of this plan. It needs a fresh source review and separately approved package after its dependencies land.

## Test portfolio

| Consequential behavior or risk | Existing protection | Obligation | Primary seam | Distinct failure | Slice |
| --- | --- | --- | --- | --- | --- |
| Platform standards compose with stored custom modes | Replacement-semantic mode tests | Replace and extend | Pure effective-mode resolver | Standard or custom mode disappears unexpectedly | S1 |
| Stored persona overrides only its own standard mode | Prompt compiler tests | Extend | Prompt resolution and effective modes | One stored entry suppresses other standards | S1 |
| Explicit mode disable survives synthesis | None | Add | Effective-mode resolver | Opted-out mode reappears | S1 |
| Quizzer requires safe course retrieval | Required-MCP route tests | Extend | Effective binding resolver | Ungrounded Quizzer appears or unrestricted tools are inherited | S1 |
| Exact/inherited binding precedence is per server | Exact-mode filtering only | Add | Effective binding resolver | Supplemental config drops required retrieval | S1 |
| Required retrieval remains fail-closed | Existing `503` tests | Extend | Chat route with effective bindings | Missing required server silently falls back | S1 |
| Crafted requests cannot select hidden modes | Supported-mode route check | Extend | Shared effective-mode resolver in request validation | UI-hidden mode bypasses capability gate | S1 |
| Known and custom descriptions retain ownership | Settings-store tests | Extend | Resolved mode metadata | Custom copy is overwritten or synthesized copy appears custom | S1 |
| Tutor, Explainer, and Quizzer personas remain distinct | Tutor-only default tests | Add focused contract assertions | Default prompts through compiler | Modes collapse into one mixed behavior | S2 |
| Fixed policy is composed once beneath every persona | Compiler tests from #5608 | Extend | System prompt compiler | Persona duplicates or suppresses platform policy | S2 |
| Attachment context works in every mode | Tutor prompt text only | Add | Fixed input-context layer | Explainer or Quizzer exposes or rejects the description format | S2 |
| Quizzer presentation makes Stage 1 provenance honest | Existing mode label and suggestion tests | Extend | i18n, labels, descriptions, starters | UI implies lecturer-authored questions or exam equivalence | S2 |
| Model obedience | No keyless deterministic seam | None in this package | Optional later synthetic evaluation | Model ignores an assembled rule | Withheld |

## S1: Compose effective modes and safe retrieval bindings

- Problem: UI and server mode resolution can diverge, stored prompts replace standards, and global required-MCP semantics can make synthesized modes unusable.
- Decision: introduce one pure effective-mode and binding contract shared by every server consumer, then return already-resolved presentation data to the client.
- Risk: this changes a public chatbot configuration contract and required-tool routing. Inheritance must remain narrow and fail-closed.
- Route: `main` because product behavior, prompt precedence, and MCP safety are tightly coupled.
- Acceptance: all test-portfolio rows assigned to S1 pass; no unrestricted or wildcard Tutor configuration is inherited; mode options and request validation agree; no secret-bearing MCP fields reach the client.
- Do:
  - Add the pure resolver at the smallest shared server seam.
  - Parse legacy prompt entries plus optional `enabled: false` without changing the Prisma schema.
  - Compose standard and custom modes, per-mode description provenance, required-MCP compatibility, and Quizzer capability gating.
  - Resolve exact and inherited Quizzer retrieval bindings per MCP server.
  - Use the resolver in the layout, chatbot settings endpoint, and chat request route.
  - Keep request-time server/tool outages fail-closed with the existing `503` contract.
  - Extend focused mode, settings-store, and required-MCP route tests.
- Do not expose MCP configuration details to the browser, broaden inheritance to arbitrary tools, or change database rows.
- Static verification: focused source tests through pull-request CI, `git diff --check`, exact diff review, and staged secret/personal-data inspection. Do not start a local runtime or container merely to run tests.
- Commit: `feat(chat): compose standard course modes`.
- Review: after the immutable commit, run `simplifier` and `slice-reviewer` in parallel. The slice reviewer covers public-contract correctness, required-tool fail-closed behavior, configuration compatibility, security, and regression protection.

## S2: Deliver concise personas and honest Quizzer presentation

- Problem: Tutor is policy-heavy, Explainer lacks a platform default, and Quizzer needs an honest Stage 1 behavior and participant-facing presentation.
- Decision: keep each persona short and distinct, add fixed attachment-context handling once, and describe Quizzer as AI-generated practice based on course material.
- Risk: prompts are probabilistic and UI copy can overstate unavailable capability. Tests can protect assembly and labels, not model obedience.
- Route: `main` because persona boundaries, presentation, and documentation must describe the same capability.
- Acceptance: all test-portfolio rows assigned to S2 pass; no duplicated fixed policy or future-only feature claim remains; English and German copy is complete; ADR and wiki describe automatic rollout and limitations.
- Do:
  - Replace the Tutor default with the decided guided-learning contract.
  - Add real Explainer and Stage 1 Quizzer defaults.
  - Add a fixed cross-mode input-context instruction for attachment descriptions.
  - Add Quizzer icon, localized English and German labels and descriptions, and Quizzer-specific starter prompts.
  - Update mode switcher and settings consumers only as required by the effective metadata from S1.
  - Extend prompt compiler, mode metadata, settings, suggestions, and i18n tests at existing seams.
  - Amend ADR 0021 and update `docs/chat-platform.md`. Keep the wiki change in Git history; the repository wiki workflow forbids separate log files.
  - Record that no repository skill matches course-chat prompt configuration; do not modify unrelated frontend or browser skills.
- Do not mention future lecturer-question or personal-card tools in the Stage 1 prompt, expose tool names, claim exam equivalence, or duplicate fixed policy.
- Static verification: focused source tests through pull-request CI, `git diff --check`, exact diff review, staged secret/personal-data inspection, and i18n key completeness. No runtime, browser, or live-model check.
- Commit: `feat(chat): add grounded quizzer mode`.
- Review: after the immutable commit, run `simplifier` and `slice-reviewer` in parallel. The slice reviewer covers prompt precedence, learning-mode separation, safety/privacy non-regression, UI truthfulness, accessibility of copy, and verification sufficiency.

## Integrated finish gate

- Refresh remote refs before mutation and again before push if a remote-change signal appears. Report drift and do not integrate it without separate authority.
- Apply only verified reviewer corrections in scoped follow-up commits.
- Reuse passing checks when the source tree and acceptance boundary are unchanged.
- Run one `final-reviewer` over the complete committed Stage 1 package after corrections and static verification.
- Inspect the complete staged and committed diff for unrelated changes, comments, secrets, and personal data.
- Push the exact reviewed head and create or update a draft pull request titled `feat(chat): add grounded quizzer mode` against `v3`.
- Report exact-head CI separately from source completion. Keep the pull request draft because repository policy requires browser evidence for the frontend-visible mode, while this plan explicitly excludes a runtime.

## Stage 2 activation boundary

Stage 2 is a future package, not an unimplemented slice of the Stage 1 pull request.

- Re-fetch and inspect the merged structured-practice and personal-card source before planning.
- Enable lecturer-authored structured practice in Quizzer without leaking answers before submission. Submission remains an explicit student action and backend grading remains authoritative.
- Connect saved personal-card practice only if the merged API exposes an answer-safe read path. Preserve visible provenance.
- Keep new card generation as retrieval, proposal, explicit approval, then generation. Do not describe flashcard generation as arbitrary student-question generation.
- Decide from merged capability flags and APIs whether Stage 2A and Stage 2B are one cohesive pull request or two sequential packages.
- Do not append Stage 2 to the current active stack or infer authority to reconcile its topology.

## Optional synthetic evaluation

- This is outside the terminal condition and requires separate authority for secrets and paid or external model calls.
- Use synthetic-only scenarios for mode separation, language switches, opposite-language retrieved material, no relevant evidence, an attached-image description, Tutor hint escalation, Explainer direct answers, and Quizzer ask-wait-feedback behavior.
- Record the exact model, compiled prompt revision, available tools, and result. Do not use production conversations or participant data.

## Progress

- Status: Stage 1 is source-complete; integrated final review found no P0/P1 issue, and the second correction delta is ready for its bounded recheck.
- Completed: remote-state gate, isolated worktree and branch, current Klicker prompt and mode review, AI Buddy policy comparison, `v3-ai` structured-practice review, open personal-practice stack review, product-primitive pass, stack-boundary review, native planning review, approved plan commit, reviewed and corrected S1, S2 prompt and presentation implementation, focused test updates for exact-head CI, ADR amendment, Chat wiki update, parallel S2 simplifier and risk review, request-time Quizzer retrieval enforcement, legacy citation precedence, integrated generic-continuity final review, unavailable-mode UI and required-alias corrections, and the first correction-delta review.
- Active slice: gate edit and retry generation paths when no effective mode exists, then recheck only this second correction delta.
- Remaining: correction-delta recheck, final progress receipt, push, draft pull request, and exact-head CI report.
- Required delivery layer: source-complete draft pull request against `v3`.
- Runtime: not started and excluded from this plan.
- Withheld beyond terminal: browser evidence, ready marking, merge, deployment, live evaluation, database work, upstream integration, practice-stack mutation, and cleanup.
- Next action: commit the second correction delta after static and staged data-hygiene checks, then run one bounded recheck before publication.
