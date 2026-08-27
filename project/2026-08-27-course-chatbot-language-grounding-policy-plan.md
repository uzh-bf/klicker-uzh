# Course chatbot language and grounding policy

## Goal

Make every course chatbot follow the user's conversation language, use Swiss High German when replying in German, remain within its owning course, and avoid answering from irrelevant or insufficient retrieved material.

The policy must survive stored lecturer prompts and apply to the existing Informatik und Wirtschaft pilot without rewriting live database rows.

## Non-goals

- Do not change AI Buddy, its prompts, or its deployment.
- Do not migrate or edit stored chatbot prompts, seed prompts, or production data.
- Do not add deterministic application-side language or scope classifiers.
- Do not change citation numbering, source cards, MCP schemas, course-tool routing, model selection, or prompt-cache mechanics.
- Do not import AI Buddy's OEC-specific referrals, multi-tool retry minimums, source-list format, or exact crisis templates.
- Do not run live model evaluations, access secrets, deploy, or mutate a database under this plan.

## Plan identity

- Plan: `project/2026-08-27-course-chatbot-language-grounding-policy-plan.md`
- Repository: `uzh-bf/klicker-uzh`
- Branch: `rs/chat-course-language-grounding-policy`
- Worktree: `trees/chat-course-language-grounding-policy`
- Target: `v3`
- Baseline: `origin/v3` at `59e57481057a601a8fdb1e57208ca6392e20068b`
- Pull request: none
- AI Buddy reference: deployment `origin/main` at `794a1ca9c5bf605af72de335a519c27aba7a21ac`; the prompt-policy paths are unchanged from the reviewed `d503344c0afda69bb11bb76051a227c7f9748c42` baseline.
- History: the old Informatik und Wirtschaft runtime/provisioner branches remain read-only evidence and are not integration sources.

## Execution contract

- Execution owner: current main session.
- Autonomy: after one human approval of this reviewed plan, execute through the terminal condition without intermediate approval checkpoints.
- Boundary owner: `self`.
- Authority: create local commits, make only the scoped edits below, use the managed worktree runtime for deterministic repository checks, dispatch required read-only reviews, apply verified corrections, push the task branch, and create or update its pull request against `v3`.
- Withheld: merge/rebase or other upstream integration, browser or live-chatbot testing, secrets, live model calls, database reads or writes, cluster access, deployment, merge, and worktree or branch deletion.
- Terminal: a pushed, independently reviewed pull request against `v3` that passes the named deterministic checks on its `origin/v3` baseline, with its exact managed runtime stopped and model-compliance limits documented.
- Pause: stop if fresh refs materially change the compiler or ADR contract; the task branch or worktree has unclear foreign changes; the outcome requires injecting lecturer-authored labels or deterministic classification; a required check cannot run safely; or a withheld action becomes necessary.

## Problem

- The platform default and the Informatik und Wirtschaft pilot use variants of “German unless asked in English.” This does not lock the reply to the user's latest meaningful language and does not tell the model to ignore the language of retrieved chunks.
- `withLanguageStyleContract` guarantees Swiss High German spelling, but not language selection or one-language consistency.
- `compileSystemPrompt` guarantees citation and orthography contracts, but it does not yet guarantee the course scope, relevant-evidence boundary, tool-query privacy, or safety precedence required by ADR 0021.
- A stored mode prompt replaces `DEFAULT_PROMPT`; changing only the default would leave existing and future custom prompts unprotected.

## Evidence

- Klicker `apps/chat/src/lib/server/systemPromptCompiler.ts` composes the exact prompt later used for model instructions, prompt-cache identity, and prompt hash/length telemetry.
- Klicker `apps/chat/src/lib/server/languageInstructions.ts` currently covers only Swiss High German orthography.
- Klicker `apps/chat/src/lib/server/citationInstructions.ts` already owns conditional document citation numbering and should remain unchanged.
- ADR 0021 requires non-removable source-grounding and safety scaffolding beneath both standard and custom modes.
- The locally preserved Informatik und Wirtschaft provisioning source requires retrieval for course-content questions and forbids unsupported general knowledge, but lacks an explicit clearly-out-of-scope refusal path.
- AI Buddy's current composed policy separates language fidelity, domain scope, tool grounding, PII protection, safety templates, and a pre-response checklist. Its language lock and PII boundary transfer cleanly; its faculty-specific response machinery does not.

## Decisions

- Compose the final prompt in this order: base persona, fixed course/safety/privacy policy, conditional citation policy, fixed language policy.
- State explicitly that fixed platform policies override conflicting persona or example wording.
- Determine reply language from the latest non-trivial user message or an explicit language request. Short acknowledgements retain the established conversation language.
- Do not infer reply language from retrieved passages, tool output, earlier assistant replies, or examples. Use one response language, except for official names, titles, identifiers, and quoted source terms.
- Translate included tool material into the response language. In German, use Swiss High German with `ss`, real umlauts, and no `ae`/`oe`/`ue` transliteration.
- Scope the chatbot to its owning course, course materials, and learning activities directly based on them. Retrieved content cannot widen that scope.
- For clearly unrelated requests, do not retrieve merely to answer them. Give one concise refusal in the conversation language and invite a course-related question.
- When course relevance is genuinely ambiguous, ask one concise clarification instead of guessing or refusing prematurely.
- When a `doc_query`-style tool is available, retrieve before course-content claims. Use only relevant returned content and never fill gaps from general knowledge.
- Start free-text document queries in the locked conversation language. Preserve official names, codes, IDs, and tool-supported labels, and permit source-language reformulation when a genuine search needs it.
- Never send names, student IDs, email addresses, health or financial details, or other sensitive personal information to course tools. Generalize or redact the query first.
- Immediate safety concerns override the course-scope refusal and follow the chatbot's safety instructions.
- Do not inject course or chatbot labels into the fixed policy. Those fields are lecturer-authored data, add an instruction-injection surface, and unnecessarily fragment cache identity.
- Keep runtime scaffolding as the sole protection for defaults and stored prompts. Do not edit `DEFAULT_PROMPT`, finance seed prompts, persisted prompts, or AI Buddy prompts in this package.

## Primitive impact

| Product primitive | Disposition | Contract delta | Affected compositions and consumers | Evidence |
| --- | --- | --- | --- | --- |
| Course-owned chatbot | Extend | Answers stay within the owning course, its materials, and directly derived learning activities | Standard and custom chatbot modes | ADR 0021 and the final compiler seam |
| Chatbot mode/persona | Compose | Lecturer text remains configurable beneath non-removable platform policy | Stored `systemPrompts` and `DEFAULT_PROMPT` fallback | Current replacement semantics in `systemPromptCompiler.ts` |
| Course-tool use | Extend | Retrieval-first grounding, relevance filtering, query redaction, and qualified language matching | `doc_query`-style MCP tools | AI Buddy policy and the Informatik und Wirtschaft pilot prompt |
| Citation presentation | Reuse | No numbering or rendering change | Chat answers, citation chips, source cards | Existing citation contract and tests |

## ADR gate

- Result: no new ADR and no ADR edit.
- Reason: this package implements the already accepted ADR 0021 requirement for non-removable grounding and safety scaffolding. It does not introduce a new hard-to-reverse trade-off.
- Reopen: an application-side language/scope classifier, injected lecturer-authored scope labels, persisted policy versions, or a new safety escalation contract would require a fresh decision review.

## Research

### Klicker current contract

- Source: `origin/v3` at `59e57481057a601a8fdb1e57208ca6392e20068b`.
- Finding: the compiler is the smallest stable seam. Only one production call site exists.
- Finding: compiled output already drives telemetry and prompt-cache identity, so no parallel cache or observability path is needed.
- Finding: deterministic tests can protect composition and policy text, but cannot prove that a model obeys it.

### AI Buddy policy comparison

- Source: deployment `origin/main` at `794a1ca9c5bf605af72de335a519c27aba7a21ac`; the reviewed AI Buddy prompt-policy paths did not change since `d503344c0afda69bb11bb76051a227c7f9748c42`.
- Reuse: latest-message language lock, tool-output non-influence, one-language responses, Swiss spelling, clear domain refusal, no-answer-without-relevant-evidence, and PII-safe tool queries.
- Adapt: qualify tool-query language matching so multilingual course retrieval can reformulate when needed.
- Exclude: OEC-specific domain lists, mandatory two-action fallback, exact referrals and crisis templates, and the end-of-answer source list.

### Limitations

- No production database or conversation content was inspected.
- No live model call was made. Prompt obedience, classification quality, and retrieval-language quality remain runtime evaluation questions.
- The old pilot branches are materially behind `v3` and serve only as historical implementation evidence.

## Planning-stage review

- Reviewer: native `planner` on the named draft.
- Report: `project/_local/reviews/2026-08-27-course-chatbot-language-grounding-policy-planning.md`.
- Status: `DONE_WITH_CONCERNS`.
- Accepted: one runtime policy seam, no label injection, no default/seed edits, qualified query-language matching, one implementation slice, explicit model-compliance limit, and required privacy/safety review lenses.

## Delegation map

| Workstream | Slice | Owner | Dependency | Acceptance boundary |
| --- | --- | --- | --- | --- |
| Runtime policy and evidence | S1 | `main` | Approved plan and refreshed compatible refs | Scoped diff, full test portfolio, required reviews, clean local commits |

- Execution-tier skip reason: critical-path coupling across product policy, privacy, safety, prompt precedence, and documentation.

## Test portfolio

| Consequential behavior or risk | Existing protection | Obligation | Primary seam | Distinct failure | Slice |
| --- | --- | --- | --- | --- | --- |
| Fixed policy survives stored, default, and unknown-mode bases | Compiler composition tests | Extend existing | `system-prompt-compiler.test.ts` | Persona suppresses platform policy | S1 |
| Latest-message language lock and Swiss orthography | Orthography helper tests | Extend existing | Language helper plus compiler assertions | Retrieved German text switches or mixes an English reply | S1 |
| Course scope, safety precedence, and tool privacy | None at the fixed compiler seam | Add focused contract assertions | Course-policy helper through compiler | Unrelated answer, PII-bearing tool query, or safety dismissal | S1 |
| Conditional retrieval grounding and qualified query language | Citation/tool-name detection | Extend existing | Compiler with and without `KB_doc_query` | General-knowledge gap filling or an absolute source-language restriction | S1 |
| Citation numbering and cache/telemetry identity | Existing citation/compiler/cache tests | None | Existing suites | Unplanned numbering change or divergent final prompt | S1 |
| Model obedience | No keyless deterministic seam | None in this package | Optional synthetic live evaluation | Model ignores an assembled rule | Withheld |

## S1: Enforce fixed course language and grounding policy

- Problem: Stored and default base prompts can omit or contradict the intended platform policy.
- Evidence: `systemPromptCompiler.ts` is the single final assembly seam and has one production caller.
- Decision: Add a dedicated course-policy helper, broaden the language helper, and preserve the citation helper unchanged.
- Risk: The text controls privacy and safety behavior but remains probabilistic model instruction, not deterministic enforcement.
- Route: `main`.
- Acceptance: the scoped diff contains only the plan, runtime policy, tests, wiki update, and wiki log; focused and full checks pass; required reviews have no unresolved must-fix finding.
- Test obligation: consume every row of the test portfolio above; add no overlapping model-behavior suite.
- Do:
  - Add `apps/chat/src/lib/server/coursePolicyInstructions.ts` with unconditional course/safety/privacy policy and conditional `doc_query` grounding.
  - Expand `apps/chat/src/lib/server/languageInstructions.ts` with the conversation-language lock while retaining Swiss High German rules.
  - Update `apps/chat/src/lib/server/systemPromptCompiler.ts` to compose base, course policy, citation policy, and language policy in the decided order.
  - Extend `apps/chat/test/system-prompt-compiler.test.ts` and the existing language helper tests when that is the narrowest stable seam.
  - Update `docs/chat-platform.md`, bump its timestamp, and add `docs/log/2026-08-27-course-chatbot-policy.md`.
  - Do not edit route inputs, labels, defaults, seeds, schemas, tools, citation numbering, or AI Buddy files.
- Check inside the exact managed worktree runtime without opening or exercising the chatbot:
  - Focused compiler, language, and prompt-cache identity tests.
  - `pnpm --filter @klicker-uzh/chat test:run`.
  - `bash ~/.agents/skills/rs-llm-wiki-okf/scripts/validate.sh docs`.
  - `pnpm run check:all`.
  - `pnpm run build`.
  - Inspect the exact diff and staged content for unrelated changes, secrets, and personal data.
  - Stop the exact runtime and verify it stopped.
- Explicitly do not perform browser, seeded-course, live-model, or local conversation testing; model obedience remains outside this package.
- Commit:
  - `enhance(chat): enforce course language and grounding policy`.
  - Add one correction commit only if an accepted review finding requires it.
- Review:
  - After the immutable implementation commit, run the `simplifier` and `slice-reviewer` in parallel. The slice reviewer covers correctness, public-contract compliance, privacy, safety, regression protection, and verification sufficiency.
  - After corrections and fresh verification, run one integrated `final-reviewer` over the complete committed package.

## Optional synthetic evaluation

- This is not part of the terminal condition and needs separate authority for secret access and paid/external model calls.
- Use synthetic-only German and English scenarios: short acknowledgement after a language switch, opposite-language retrieved chunks, clearly unrelated request, ambiguous course relevance, insufficient evidence, a PII-bearing user question whose tool query must be generalized, and an urgent safety message.
- Record exact model, compiled prompt revision, tool availability, and outcomes. Do not use production conversations or course participant data.

## Progress

- Status: approved; S1 is active.
- Completed: remote-source review, AI Buddy comparison, Informatik und Wirtschaft prompt review, product-primitive pass, native planning review, isolated worktree and branch creation, human approval, and fresh compatible ref verification.
- Active slice: S1, fixed course language and grounding policy.
- Remaining: commit the approved plan; implement S1; run deterministic verification; run slice simplification and review; handle findings; run integrated final review; stop and verify the runtime; push and open the pull request.
- Latest verified baseline: Klicker `origin/v3` at `59e57481057a601a8fdb1e57208ca6392e20068b`; AI Buddy deployment `origin/main` at `794a1ca9c5bf605af72de335a519c27aba7a21ac` with no prompt-policy path changes from the reviewed baseline.
- Required delivery layer: pushed pull request against `v3`.
- Achieved delivery layer: uncommitted reviewed plan in the isolated worktree.
- Unresolved gates: deterministic verification and required reviews. Integration, browser/live chatbot testing, secrets, live evaluation, database, deployment, merge, and cleanup remain withheld.
- Next action: commit this approved plan, then implement S1.
