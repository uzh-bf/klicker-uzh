# Knowledge-graph chat: review fixes and clickable answer concepts

## Approval summary

**Why and what changes?** A review of the knowledge-graph chat path found four problems. Students also cannot see which parts of an answer correspond to the concept map. This plan fixes the problems in two independent pull requests into `v3-ai`.

- **PR A, fixes.**
  - The manage setting "Use graph connections for document search" always describes itself as on. It will show an on or off description, like the concept-map setting next to it.
  - The owner preview never uses graph-assisted search, so lecturers cannot preview what students get. The preview will use it under an explicit owner identity, checked against chatbot ownership instead of participant enrollment.
  - The tutoring prompts have no rule for course logistics such as exam dates. When course documents disagree, an answer can state one value without mentioning the other. A grounding rule will require dates, times, deadlines, points and places to be copied exactly with a citation. When retrieved sources disagree, the answer must name each value with its citation and point to the binding source the material names.
  - The same rule asks for a citation on every source whose wording an answer uses.
- **PR B, concept links.** When the participant concept map is enabled, finished answers underline phrases that exactly match a concept label in the published graph. Clicking one opens the knowledge-graph panel and focuses that concept, with its details and "Ask about this".

**What stays unchanged?** Graph-assisted retrieval for students and its gates stay as they are. The concept map stays off unless the chatbot enables it. Answer text, citations and persisted messages are unchanged. Owner preview still persists nothing and stays owner-funded.

**What could change the decision?**
- Matching is exact label equality, so some concepts will not be linked. This is deliberate: a link is never fuzzy or wrong.
- PR B sends finished answer text to the chat app's own graph route. No new external data flow is added.
- Footer-only document passages come from chunking in the external KB service. They are out of scope here and are tracked as a follow-up.
- A prompt rule reduces risk but cannot guarantee model behavior. Conflicting course documents still need a correction by the course owners.

**How will we know it is done?** Unit tests for owner-preview scope, mention matching, the remark plugin and the setting description. One Playwright case in `Y-chat-knowledge-graph.spec.ts`: click an underlined concept and see the panel focus it. Browser screenshots of the manage setting in both states and of the linked answer. Both PRs open as drafts with CI green.

**What does approval authorize?** Local implementation, commits, pushes to the task branches and draft PRs into `v3-ai`. Merging, the sync into the staging source branch and staging re-verification need a separate go-ahead.

## Execution details

### Evidence and contracts

- **Description.** `apps/frontend-manage/src/components/resources/chatbots/ChatbotDetails.tsx:1033` renders a static `knowledgeGraphRetrievalDescription`. The concept-map description already switches at `:995-1001`. Two new i18n keys are needed in `packages/i18n/messages/en.ts` and `de.ts`.
- **Owner preview.**
  - The preview route calls `getAggregatedMCPTools` without `participantId`, `courseId` or `knowledgeGraphRetrievalEnabled` (`apps/chat/src/app/api/manage/chatbots/[chatbotId]/preview/chat/route.ts`).
  - `graphQueryDependencies.validateScope` (`apps/chat/src/services/graphQueryScope.ts`) accepts participants only.
  - The fix adds `ownerPreview: { userId }` to `MCPRequestContext`. In that branch, scope checks chatbot ownership instead of participant enrollment.
  - The KB-binding equality check, the retrieval setting, the GrowthBook flag, the single graph-enabled KB rule and the published, non-stale graph rule stay shared.
  - The preview uses the live chatbot row, which matches the preview's "live configuration" contract.
- **Prompt.** `apps/chat/src/prompts/course-grounding.hbs` applies whenever a doc_query tool is available, so it gets one short paragraph covering exact logistics, conflict disclosure and citing each source used. No prompt-text tests are added, per repository test policy.
- **Concept links.**
  - The graph route gains `POST ?operation=mentions` with body `{ text, kbId? }`. Text is capped at 8000 characters. The route reuses its auth, the `knowledgeGraphVisible` gate and the admission limits.
  - The server matches the text against published concept labels. It uses the same exact-phrase tokenizer as graph search seeds, skips generic `Concept N` labels, caches labels per build and returns at most 12 `{ nodeId, text }` mentions together with the matched nodes.
  - A label also matches on its head before a trailing parenthetical, so "Head (Alias)" matches "Head". A key shared by several concepts prefers the concept whose full label equals it and is otherwise skipped.
  - The client fetches mentions once per finished assistant message.
  - A module-scope `remarkConceptLinks` plugin links the first occurrence of each label in plain text nodes. It runs after citation markers, so links, code and math are skipped.
  - The `a` override renders `#concept-<id>` links as underlined buttons.
  - Panel open state moves into a small chat graph context. The shared viewer gains a `focusRequest` prop that expands the node, with search by label as a fallback.

### Sequence

1. PR A: description, owner-preview scope, grounding rule. Run focused tests and capture the manage screenshot.
2. PR B: mentions route, client fetch, remark plugin, panel context, viewer focus prop. Run unit tests and the Playwright case, and capture the chat screenshot.
3. End-of-package self-simplification and self-review (solo execution mode), then draft PRs.

### Verification

- `pnpm --filter @klicker-uzh/chat test` for the touched tests; `pnpm --filter @klicker-uzh/chat check`.
- The manage typecheck, and an i18n key check in en and de.
- Playwright `Y-chat-knowledge-graph.spec.ts` from the host against the local stack.

### Follow-ups outside this plan

- Footer-only passages are indexed as standalone chunks in the KB service. They should be filtered or merged at ingestion.
- Course owners should reconcile conflicting logistics in their documents.

## Progress

- Execution mode: solo.
- Delivered: PR A (#6645) merged as `b9962dc838` and PR B (#6647) as
  `48839978f4`, both on 2026-10-21. Both reached staging through the
  `v3-adaptive-learning` sync. Concept links, hover definitions and the
  focused panel were checked there on a test chatbot.
- Open: manage-setting screenshots for #6645 (on and off) are not captured
  yet. Graph-assisted search in the owner preview is not confirmed; the
  checked preview answered from document retrieval only.
- PR B implementation:
  - Graph package: a mention matcher and a by-id node read.
  - Chat route: a `POST` mentions operation.
  - Panel: a focus context, with a viewer `focusRequest` prop.
  - Answers: a remark concept-link plugin.
  - Tests: unit tests for the matcher, plugin and route, plus a hermetic Playwright case.
  - The devcontainer post-create hang that blocked local checks was fixed in #6646.
