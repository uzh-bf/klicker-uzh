# Custom-mode welcome messages and starter prompts

## Approval summary

Lecturers will be able to configure an optional welcome message and up to four starter prompts for each custom chat mode. The welcome will appear immediately in an empty chat. Starter buttons will copy their text into the composer; students still choose when to send. Opening a chat or clicking a starter will not contact the model or consume credits.

Both fields will use the existing custom-mode editor, revision review and approval flow. Participants receive approved content, while the owner preview can show the draft. Existing custom modes remain usable without new fields. Built-in modes and the management assistant retain their current behavior. The welcome is interface text, not an assistant message, model instruction or saved conversation turn. No dependency or database migration is planned.

The main risks are accidentally publishing draft content, losing fields during save or normalization, and showing content from another selected mode. Focused contract tests and a real local browser flow will cover those risks. Screenshots will show the editor, preview and student empty-chat states on desktop and mobile, with German and English interface checks. Test content will be synthetic; private teaching materials and live records are outside this package.

Approval authorizes the finite implementation, local verification, review corrections, ordinary task-branch pushes and one draft PR into `v3-ai`. Completion means the reviewed implementation and screenshot evidence are available in that draft PR, with required checks and any remaining blocker reported. Marking ready, merging, environment deployment and configuring live chatbots require separate authority. This feature stays separate from the pending release.

## Execution details

### Contract and working context

- Approval mode: executable batch; implementation authorized by the user’s direct request to fix both features; routine local choices resolved in this reviewed contract.
- Execution owner and boundary owner: main session (`self`), execution mode `standard` because model identity is not exposed.
- Repository: `/Users/rschlae/Git/klicker/klicker-uzh`.
- Worktree: `/Users/rschlae/Git/klicker/klicker-uzh/trees/chat-custom-mode-introductions`.
- Branch: `enhance/chat-custom-mode-introductions`; ordinary cohesive PR target `v3-ai`, following the repository's chat-development convention.
- Source baseline: `e2ac86f836c3fe78986f9ac51316d1e76bdd2556`; fetched on 15 October 2026. Main/default is `v3`; the task baseline differs deliberately.
- Canonical plan: `project/2026-10-15-custom-mode-introductions-plan.md` in this worktree. First branch commit before implementation.

Pause only for a material scope, authority, privacy or compatibility change; unavailable required verification/review after routing recovery; or a destructive operation outside the approved disposable test setup. Ordinary test failures, review corrections and integration with the resolved target stay inside the batch. No production access or changes, release mutations, credit changes, new notifications, infrastructure changes, force pushes or stack changes are included.

### Product behavior

Extend each existing custom mode with optional `welcomeMessage` and `starterPrompts` presentation fields. Starter prompts are an ordered list of plain strings, with the same text used on the button and in the composer. Separate button labels, translations per mode, rich text, automatic sending and generated greetings are deferred.

The welcome supports line breaks and at most 2,000 characters. Allow at most four starters of at most 500 characters each. Normalize surrounding whitespace and line endings. In stored data, absent, null or blank welcome means the existing generic greeting; absent, null or empty starters means no custom-mode starters. Never fall back to Tutor suggestions. In submitted writes, omission preserves the existing mode's value, while null or blank welcome clears it, and null or an empty starter array clears that list. Reject blank starter entries, non-string entries and over-limit writes with field-specific validation. The editor excludes unfilled starter rows when constructing the submitted array. On tolerant reads, discard an invalid welcome value; filter invalid or blank starter entries, preserving the order of valid entries up to the count limit. This never hides an otherwise valid mode. Existing stable mode keys, name/persona validation and reserved built-in keys retain their contract.

Display the authored welcome as escaped plain text using readable body styling. Preserve the chatbot identity, mode label and mode switcher. Hide generic instructional subtitle text that conflicts with the authored introduction. A custom mode with no starters must not invite the user to choose a starter. The standard greeting remains unchanged for built-in modes.

Show presentation content only while the thread is empty, including owner preview. It follows the resolved selected mode. Switching modes in an empty chat updates the introduction and buttons; starting a new chat restores them. Existing conversations do not acquire a new assistant turn or change their history. Explicit welcome or suggestions supplied by the management/contextual assistant keep their precedence. Rendering these fields does not add them to the model prompt, inference request, stored messages or billing.

### Primitive impact and existing evidence

| Primitive | Disposition and contract | Existing seams |
| --- | --- | --- |
| Custom chat mode | Extend optional presentation metadata; reuse stable identity and existing persona | `packages/types/src/chatbotCustomModeConfig.ts`, `packages/util/src/chatbotCustomModeConfig.ts` |
| Authoring revision | Reuse draft, review and approval; include the new fields in editor and reviewer views | `packages/graphql/src/services/chatbots.ts`, `apps/frontend-manage/src/components/resources/chatbots/ChatbotAuthoring.tsx` |
| Mode options | Extend the safe participant projection with presentation fields; exclude persona text | `apps/chat/src/lib/server/effectiveChatModes.ts`, `apps/chat/src/lib/config/modes.ts` |
| Chat thread | Compose mode presentation with existing empty state and composer suggestion interaction | `apps/chat/src/components/thread.tsx`, `apps/chat/src/lib/config/suggestions.ts` |

`customModeConfig` is already JSON in live and draft configuration. No schema migration is needed. The strict parser and tolerant reader currently reconstruct a fixed field set, so both must be extended. GraphQL input/object definitions, tracked SDL and client fragments must carry the new fields. New output fields must tolerate legacy JSON, and input fields remain optional. A mixed-version client that omits the new fields when saving an existing mode must preserve them; current clients clear them explicitly with null/empty values.

The chat already accepts an explicit welcome, but that branch suppresses some generic mode controls. Reuse the rendering surface without suppressing mode switching. Existing starter suggestions use `send={false}` and must retain that behavior. Server-resolved mode options already separate participant-approved configuration from owner preview draft configuration; both initial rendering and mode-options refresh must project the fields consistently.

Relevant decisions: ADR 0021 defines reviewed custom modes; ADR 0043 defines reviewed revisions before activation. This change extends those contracts and does not introduce another entity, lifecycle or policy. No new ADR is planned. A proposed change to automatic inference, approval isolation, content ownership or conversation persistence would reopen the ADR gate and require a scope decision.

### Research and assumptions

Main-session investigation owns chat rendering, transport and runtime choices. A completed read-only explorer mapped shared types, authoring, GraphQL and publication at the exact source baseline. The findings support additive JSON metadata and the existing revision lifecycle. No external product research is needed. Before using version-sensitive library or runtime commands, inspect installed tooling and use `rs-find-docs` for documentation beyond verified repository patterns.

Assumptions: four short starters and one multiline introduction meet this bounded request; author-provided language is shown verbatim rather than translated. Separate short labels and rich formatting can be considered later without changing this package.

### Ownership and slices

Use one branch and one cohesive PR. The main session owns integration, product choices, external effects and final proof. The two feature slices run sequentially. Within each slice, one native `executor` owns shared types, parser, GraphQL and authoring UI; main owns chat rendering, runtime options and integration. These write sets are disjoint; each writer preserves the other’s work. No new production modules or dependencies are planned; extend the existing files listed below.

| Slice | Owner and dependency | Owned paths and acceptance |
| --- | --- | --- |
| 1: welcome | Native `executor` plus main, after first plan commit | Existing custom-mode types, util parser and limits, GraphQL schema/ops/SDL, authoring/review UI, chat mode options and welcome; welcome reaches the correct approved or preview empty chat |
| 2: starters | Same native `executor` plus main, after slice 1 integration and review disposition | Extend the same surfaces plus existing suggestions; selected-mode starters fill the composer without sending |
| 3: integrated proof | Main session, after slices 1–2 | Existing browser specs and private screenshot gallery; real author/student flow, responsive proof, regression checks and stopped runtime. Main retains this coupled acceptance and external publication boundary |

Concrete implementation files: `packages/types/src/chatbotCustomModeConfig.ts`; `packages/util/src/chatbotCustomModeConfig.ts` and `chatbotCustomModeLimits.ts`; `packages/graphql/src/schema/resource.ts`; `packages/graphql/src/graphql/ops/FChatbotAuthoringRevisionData.graphql` and `QGetChatbotsInfoWithKnowledgeBases.graphql`; generated tracked `packages/graphql/src/public/schema.graphql`; `apps/frontend-manage/src/components/resources/chatbots/ChatbotAuthoring.tsx`; `packages/i18n/messages/de.ts` and `en.ts`; `apps/chat/src/lib/config/modes.ts` and `suggestions.ts`; `apps/chat/src/lib/server/effectiveChatModes.ts`; `apps/chat/src/components/thread.tsx`. Tests extend the exact paths in the portfolio. A service change is limited to the existing `packages/graphql/src/services/chatbots.ts` if preservation must be passed through there. No new test suite is planned. The only new committed document is this plan; review receipts and screenshot manifests remain under ignored `project/_local/`.

1. **Configure and display the custom-mode welcome.** Extend the existing JSON/types, parser, GraphQL projection/fragments, author/reviewer fields and runtime mode options through to the empty-chat welcome. Add matching German and English editor labels. Protect draft isolation, legacy configuration and explicit assistant overrides. Commit the end-to-end slice after focused checks.
2. **Configure and use starter prompts.** Extend the same authoring flow and participant projection with ordered strings. Reuse the existing cards, composer interaction and selected-mode handling. Cover adding, editing, removing, clearing and limits. Commit after focused checks.
3. **Verify the integrated student and author flow.** Extend the existing relevant browser specs rather than adding parallel infrastructure. Capture actual local synthetic screenshots, inspect responsive and locale states, and run the applicable native checks. Commit only justified test or documentation changes.

Each substantive slice receives the configured simplifier pass. Cross-system presentation and publication seams arm one bounded slice-reviewer pass for each affected immutable slice. Findings must be verified before changes. Run one integrated final review after the complete committed package and local verification. An optional opposing-provider plan challenge supplements the required planner loop when the configured route is available; failure remains an explicit limitation, not a substitute verdict.

### Verification portfolio

| Consequential behavior | Existing protection and smallest additional obligation | Primary seam / owner |
| --- | --- | --- |
| New content survives save; legacy and malformed JSON remain usable | Extend existing `packages/util/test/chatbotCustomModeConfig.test.ts`: synthetic round trips, clearing, omitted writes, blank/invalid entries, limits and optional-value tolerance | Shared parser / slices 1–2 |
| Draft changes do not leak to participants or regress on older-client saves | Extend existing `packages/graphql/test/chatbotRevisions.test.ts` custom-mode approval/rejection cases. Use distinct approved and draft values, save a payload omitting presentation fields, and prove draft values survive while live values remain unchanged until approval | Revision service / slices 1–2 |
| Only safe presentation reaches the correct active mode | Extend existing `apps/chat/test/effective-chat-modes.test.ts` and `suggestions.test.ts` for projection, missing fields, legacy string options, selected-mode changes and absent persona text | Chat config/transport / slices 1–2 |
| Editor and chat perform the complete interaction | Extend existing `playwright/tests/T-chatbot-authoring.spec.ts` and `Y-chat.spec.ts` with synthetic save/reload, review, preview, approved student view, starter fill without sending, explicit send, empty/nonempty/new chat and mode switching | Existing browser specs / slice 3 |
| Existing built-in and assistant consumers retain behavior | No new automated suite: reuse `apps/chat/test/suggestions.test.ts`, `manage-suggestions.test.ts` and `playwright/tests/Y-manage-assistant.spec.ts`. Main-session browser verification checks explicit assistant-provided welcome/suggestion precedence and contextual behavior | Existing chat checks plus manual proof / slices 1–3 |

Tests assert observable behavior and structured contracts using synthetic fixtures, not exact production, seed or translation prose. Unit assertions may compare round-tripped test-owned input values. Avoid duplicate browser tests where one interaction protects the complete path.

Run applicable util, GraphQL and chat tests, GraphQL generation including the tracked SDL, affected package type checks, formatting and lint through the repository-pinned container toolchain. Use the supported host Playwright command against the task's exact routed container. Authentication and fixtures stay local and synthetic. No paid model call is necessary: use the existing test provider/stub for explicit-send behavior; opening the empty state and clicking a starter must produce zero inference requests.

Use `rs-build-screenshot-gallery` for the custom-mode editor/reviewer, empty-chat welcome and starter state, filled composer, and mobile layout. Cover desktop 1440×1000 and mobile 390×844, German and English interfaces, the authored and omitted configuration states, and the management assistant regression where relevant. Inspect every included capture, retain provenance and add the reviewed synthetic images to the draft PR through the supported authenticated forge attachment path. A missing supported attachment path is reported explicitly rather than using unrelated external hosting.

Start only the task checkout's canonical development runtime when needed. After final runtime verification, stop it and prove the exact provider/route state through `rs-local-runtime-lifecycle`. Retain no runtime without an explicit lease. Public artifacts contain only synthetic source, tests and screenshots; credentials, live data and private teaching content stay excluded.

### Delivery and recovery

Before each commit, inspect staged hunks and run secret/personal-data and real-environment-data checks. Preserve unrelated source and comments. Commit the approved plan first, then the slices. Refresh target knowledge before source integration or push; integrate only for an actual readiness reason and recheck affected behavior. Push normally and open a draft PR into `v3-ai`, with the entire capability, checks, screenshots and material limitations described under `rs-mr-description-writer`.

The terminal condition is the integrated implementation, local browser proof, configured reviews, stopped task runtime and draft PR with exact-head CI/feedback disposition or a named external blocker. Continue through ordinary correction cycles. Required human approval, unavailable CI/provider access or a material new compatibility/data effect is a concrete stopping point. Do not alter the pending release or deploy this package under its authority.

### Progress

- Completed: fetched source, mapped existing authoring and chat seams, selected additive JSON metadata and created the isolated task worktree.
- Current: frozen implementation plan for planner challenge; required planning review APPROVED; direct implementation authority is recorded above.
- Remaining: first plan commit, three slices, reviews, browser evidence and draft PR.
- Required delivery layer: reviewed source and local browser acceptance. Achieved layer: investigation only; no implementation or runtime started.

### Planning review

Native planner challenge: REVISE then APPROVED on 15 October 2026. Accepted explicit sequential ownership, complete field normalization rules and the revision-boundary preservation case. Main retained disjoint chat ownership to allow useful parallel execution. Optional AGY challenge could not complete because its sandbox could not write session state; the exact failed process was stopped and no verdict is claimed. No product-contract changes followed the approved round.
