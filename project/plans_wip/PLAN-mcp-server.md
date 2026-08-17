# Klicker MCP Server — Review and Integration Plan

> **Superseded for current branch work (2026-05-30).** For student MCP work,
> use `project/STUDENT_MCP_CONCEPT.md` and `apps/mcp-student`. For the lecturer
> Manage assistant MCP, use `project/plans_wip/PLAN-lecturer-mcp.md`. This file
> remains as historical background for the earlier broad MCP-server concept.

## Status snapshot (2026-05-01)

This branch (`claude/mcp-server-review-planning-XMkzh`) was created from `v3` and currently
contains no MCP-server work. The MCP-related code already in `v3` is purely on the **client**
side of the protocol; we have not yet built a Klicker-owned **server** that exposes Klicker
data as MCP tools.

What already exists in the codebase:

1. **Client-side MCP integration** (`apps/chat`)
   - `apps/chat/src/services/mcpClients.ts` builds Streamable-HTTP MCP clients per chatbot
     using `@ai-sdk/mcp` and `@modelcontextprotocol/sdk`, aggregates tools across servers,
     applies wildcard tool filtering, and namespaces tool names with a hash suffix when
     they collide or exceed the 64-char OpenAI tool-name limit.
   - Per-chatbot/per-mode configuration lives in `ChatbotMCPServer` + `ChatbotMCPConfig`
     (Prisma schema in `packages/prisma/src/prisma/schema/chat.prisma`). Auth supports
     `bearer | basic | custom | none`; `passChatbotId` adds a configurable header (default
     `Chatbot-ID`) to outbound MCP requests.
   - The chat route loads tools via `getAggregatedMCPTools(...)` at
     `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts:848`.
2. **Tool-result UI primitive** — `apps/chat/src/components/tools-ui/rag-tool-ui.tsx` uses
   `makeAssistantToolUI` from `@assistant-ui/react` to render a specific tool name (`KB.doc_query`)
   as rich UI in the thread. It's currently mounted-but-disabled in
   `apps/chat/src/app/RuntimeProvider.tsx:267`.
3. **Embed-friendly PWA practice quiz** — `apps/frontend-pwa/src/pages/course/[courseId]/practiceQuizzes/[id].tsx`
   already supports `?embed=1` with a parent-handshake `postMessage` protocol
   (`klicker:embed-init` → `klicker:quiz-state`) and `frame-ancestors` is set at the ingress
   layer (HAProxy in k8s, Traefik in dev).
4. **Adjacent plans (do not duplicate)**
   - `project/KB_PLAN.md` — native KB / RAG catalog. Orthogonal: that's about ingesting
     external documents into Klicker, not about exposing Klicker objects to LLMs.
   - `project/plans_wip/PLAN-chat-pwa-integration.md` — deep links + side-panel chat between
     PWA and chat. Overlaps with the rendering questions discussed below.
   - `project/plans_archive/PLAN-chatbot-enhancements.md` — historical record of the
     existing client-side multi-MCP refactor.

## Goal of this plan

Build a Klicker-owned MCP **server** that exposes Klicker domain objects (courses, practice
quizzes, elements/questions, leaderboards, learner progress) as MCP tools, then wire it into
the existing chat app so a chatbot can:

- Look up the questions and content of a practice quiz the student is currently working on.
- Surface a single quiz question (or whole stack) inline in chat as an interactive widget.
- Pull a student's progress / weak spots and recommend next activities.
- Stay scoped to the participant's actual course enrollments; never leak data across courses.

The chat app is the first consumer, but the MCP server should be reusable by any
MCP-capable client (Claude Desktop, Cursor, OLAT integrations, etc.).

## Locked decisions (proposed — open for review)

1. **Transport**: Streamable HTTP over the same MCP SDK already used by the chat client
   (`@modelcontextprotocol/sdk/server/streamableHttp`). No stdio in v1 — we need a server
   reachable from the deployed chat app.
2. **Hosting**: New workspace `apps/mcp-server/` (Next.js route-handlers app, port `3020`),
   exposed at `https://mcp.klicker.com/mcp` via Traefik (dev) and a new ingress (prod).
   Reasoning: keeps the GraphQL backend concerns separate, avoids monkey-patching
   `apps/backend-docker`, and lets us deploy / scale / version the server independently.
   Rejected alternatives:
   - Mounting in `apps/backend-docker` — couples the LLM tool surface to the GraphQL API
     deployment cadence.
   - A standalone Express service — Next.js gives us the same Node runtime everyone here
     already understands, plus easy access to the existing `@klicker-uzh/prisma` and
     `@klicker-uzh/graphql` services.
3. **Authentication model** (server side): two layers, both required.
   - **Server-to-server**: every request must carry a static bearer token
     (`MCP_SERVER_BEARER`) that the chat app injects via the existing `authType: bearer`
     pattern. This proves the request comes from a trusted Klicker app, not a third party.
   - **Per-call participant context**: the chat app sets `passChatbotId: true` on this
     server's `ChatbotMCPServer` row, so every request includes `Chatbot-ID: <uuid>`. We
     resolve the chatbot → courseId → owner / participant scope inside each tool. We do
     **not** trust client-provided participantId; the chat app must additionally pass a
     short-lived signed participant token in a header (`X-Klicker-Participant`, JWT signed
     with `APP_SECRET`, ≤2 min TTL, claims `{ participantId, chatbotId, courseId }`).
4. **Authorization**: every tool reuses the existing service-layer guards. We reach into
   `packages/graphql/src/services/*` rather than re-implementing access checks. If a tool
   needs course context, it must pass `participantId` + `courseId` to the service and rely
   on the same enrollment / ownership rules that govern the GraphQL API.
5. **No write tools in v1**. v1 is read-only (catalog + content). Mutations like
   "submit a response" are deferred to v2 once we agree on credit/billing semantics for
   tool-mediated answers and on how to render evaluations back into chat.
6. **Tool naming**: `klicker_<entity>_<verb>`. We do **not** prefix with the server name,
   because the chat client will namespace using the `name` field of `ChatbotMCPServer`
   (e.g. `Klicker.klicker_practice_quiz_get`).

## Tool surface (v1)

Each tool is JSON-Schema-described and pure-read. Field names mirror our GraphQL types so
the LLM has a stable mental model when it later sees a quiz card in the UI.

| Tool name                          | Inputs                                                  | Output (shape)                                                                | Backing service                                              |
| ---------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `klicker_course_list`              | (none — derived from chatbot context)                   | `{ courses: [{ id, name, displayName, color }] }`                             | `Course` queries scoped via `participantId`                  |
| `klicker_course_get`               | `courseId`                                              | `{ id, displayName, description, gamified, ... }`                             | `getCourseById`                                              |
| `klicker_practice_quiz_list`       | `courseId?`                                             | `{ quizzes: [{ id, name, displayName, numOfStacks, status, ... }] }`          | `getPracticeQuizList`                                        |
| `klicker_practice_quiz_get`        | `practiceQuizId`                                        | `PracticeQuizSummary` (without solutions; mirrors `FPracticeQuizDataWithoutSolutions`) | `practiceQuizzes.getPracticeQuiz`                            |
| `klicker_element_get`              | `elementInstanceId`                                     | `ElementData` (without solutions; mirrors `FElementDataWithoutSolutions`)      | `practiceQuizzes.getElementInstance`                         |
| `klicker_progress_get`             | `courseId`                                              | `{ leaderboardRank, xp, level, completedQuizzes: [{ id, score }] }`           | participant analytics services                               |
| `klicker_recommended_next`         | `courseId, limit?`                                      | `{ items: [{ kind: 'practiceQuiz' \| 'microLearning', id, reason }] }`        | computed from progress + due dates                           |
| `klicker_search_content`           | `courseId, query, limit?`                               | `{ matches: [{ kind, id, title, snippet, score }] }`                          | full-text over name/displayName/description (Postgres)       |

Inputs always validated with Zod (consistent with the rest of the chat code). Outputs
always include the **stable id** the chat UI needs to render the corresponding rich widget,
so the chat-side renderer can hydrate from the same id without re-asking the LLM.

### Output discipline (matters for token cost)

- Tools never return solutions, explanations, or sample answers in v1. Any future "tutor"
  flow that wants those should request them via a different tool name (`*_with_solutions`)
  guarded by `chatbot.isOwner`, so the LLM cannot accidentally leak answers to participants.
- Tools return **structured JSON only** in `content[0].type = 'json'` (or `text` with a
  stable JSON envelope) — never narrative prose. The LLM is responsible for narration.
- We cap response size (e.g. quiz list ≤ 50 items, full quiz returns at most N stacks; rest
  paginated via cursor). This protects context and keeps the UI snappy.

## Chat-side rendering: showing quiz questions inline

We have two viable paths. They are **not** mutually exclusive and we expect to ship them
in this order.

### Path A — iframe-embed of the existing PWA page (v1, ~1 day)

Reuse the work that already shipped for embedded practice quizzes:

1. The `klicker_practice_quiz_get` tool returns `{ id, courseId, displayName, numOfStacks, ... }`.
2. A new `apps/chat/src/components/tools-ui/practice-quiz-tool-ui.tsx` registers a
   `makeAssistantToolUI({ toolName: 'Klicker.klicker_practice_quiz_get', render })` that:
   - On `running`: shows a skeleton card with the quiz title.
   - On `complete`: renders an iframe to
     `${NEXT_PUBLIC_PWA_URL}/course/<courseId>/practiceQuizzes/<id>?embed=1`,
     with a header above it showing the quiz name + a "Open in PWA" link.
   - Wires the existing `klicker:embed-init` / `klicker:quiz-state` postMessage protocol
     so the chat thread can react to completion (e.g. show a follow-up prompt).
3. Mount the new tool UI in `RuntimeProvider.tsx` (uncomment / next to the RAG one).
4. Add `https://chat.klicker.com` (and dev origins) to the PWA's `frame-ancestors` ingress
   directive. The CSP machinery is already in place (see CLAUDE.md Codebase Learnings entry
   on "CSP frame-ancestors via ingress").

Pros: zero duplication of question rendering, evaluation, scoring, or i18n; we get the same
behavior the embed harness already verifies.

Cons: requires the participant to have a valid PWA participant token in scope of the chat
origin. The chat app already sits under the same `COOKIE_DOMAIN`, so cookie-based auth works,
but we need to test that LTI / delegated sessions resolve the same way. Also: iframes are a
bit heavy if all we want is a single MCQ inline.

### Path B — Headless question renderer in `packages/shared-components` (v1.5, ~3 days)

For finer-grained surfaces (single question card, no quiz chrome) we extract a thin
React renderer that takes an `ElementInstance`-shaped object and renders the right
sub-component from `packages/shared-components/src/{ChoicesQuestion,NumericalQuestion,FreeTextQuestion,SelectionQuestion,Flashcard,ContentElement}.tsx`.

Concretely:

1. Add `packages/shared-components/src/QuestionCard.tsx` that:
   - Takes `{ element, mode: 'preview' | 'answerable', onResponse?, value?, hideExplanation? }`.
   - Switches on `element.elementType` to delegate to the existing per-type component.
   - Passes `disabled` / `previewOnly` for the "no submission" mode (already supported
     in the underlying components, used by the lecturer preview path).
2. Move the orchestration glue currently in `apps/frontend-pwa/src/components/practiceQuiz/`
   that *is generic* (header, content separation, "show explanation" toggle) into the same
   package; keep PWA-specific things (`useParticipantToken`, GQL fetching, scoring effects)
   where they are.
3. The chat `practice-quiz-tool-ui.tsx` switches to `<QuestionCard element={...} mode="preview" />`
   for tools that return a single element, falling back to the iframe for full quizzes.
4. We can add a `klicker_element_render` tool that returns the full element payload so the
   LLM can choose to drop a single question into the chat with no iframe at all.

Pros: lighter, no cross-origin friction, works for a single MCQ embedded in a long answer.
Cons: requires moving shared logic, must keep evaluation/grading logic out (those depend
on `packages/grading` and on participant identity, which is fine — the chat-side card is
preview-only in v1; submission still happens in the iframe).

### Tool-call → render contract

The `makeAssistantToolUI` `toolName` matches the namespaced name the chat client builds in
`mcpClients.ts:toSafeToolName`. With server name `Klicker` and tool `klicker_practice_quiz_get`
the rendered name is `Klicker_klicker_practice_quiz_get` (underscore-only, no dots — the
existing namer rejects dots to stay OpenAI-compatible). The `RAGToolUI` example uses
`KB.doc_query` because dots used to be allowed; new tool UIs must follow the underscored
form.

## Implementation roadmap

### Phase 0 — scaffold (this branch)

- [x] Read existing client + KB plan + PWA embed plan.
- [x] Write this planning doc.
- [ ] Decide on workspace name and port (proposal: `apps/mcp-server/`, port 3020,
      domain `mcp.klicker.com` / `localhost:3020`).
- [ ] Decide on the participant token format (proposal: short-lived JWT signed with
      `APP_SECRET`, claims `{ participantId, chatbotId, courseId, exp }`).

### Phase 1 — read-only server (target: 1 sprint)

1. **App scaffold** in `apps/mcp-server/`
   - Next.js (matches `apps/chat`), Volta-pinned to Node 20, TS strict.
   - Single route handler `app/mcp/route.ts` wiring the MCP SDK's
     `StreamableHTTPServerTransport` to a `Server` instance.
   - Reuse `@klicker-uzh/prisma` and `@klicker-uzh/graphql` services for data access.
   - Add to `turbo.json` and root `pnpm-workspace.yaml`.
2. **Auth middleware**
   - Verify `Authorization: Bearer ${MCP_SERVER_BEARER}`.
   - Verify `X-Klicker-Participant` JWT (signature, exp, chatbotId match).
   - Reject if either is missing/invalid (401 / 403 distinction).
3. **Tool registry**
   - One file per tool in `apps/mcp-server/src/tools/<tool>.ts`, each exporting
     `{ name, description, inputSchema, handler }`.
   - A central `registerTools(server, ctx)` that registers them all.
   - Each handler receives the resolved auth context (participant + course scope).
4. **Tool implementations** (in priority order):
   - `klicker_course_list`, `klicker_course_get`
   - `klicker_practice_quiz_list`, `klicker_practice_quiz_get`
   - `klicker_element_get`
   - `klicker_progress_get`
   - `klicker_search_content`
   - `klicker_recommended_next`
5. **Seeding**
   - Extend `packages/prisma-data/src/data/seedMCPServers.ts` to add a `Klicker` MCP server
     row with `url: http://localhost:3020/mcp`, `authType: bearer`,
     `passChatbotId: true`, `chatbotIdHeader: 'Chatbot-ID'`.
   - Add a `ChatbotMCPConfig` for the test chatbot in both `tutor` and `explainer` modes
     with `allowedTools: ['klicker_*']` (wildcard for the whole namespace).
6. **Chat app glue**
   - Extend `apps/chat/src/services/mcpClients.ts` to also forward an
     `X-Klicker-Participant` header — sign and inject in `createAuthHeaders` when the
     server is the Klicker one (recognized by name, or by a new
     `passParticipantToken: boolean` column on `ChatbotMCPServer` to keep it generic).
   - Migration adds the column with default `false`.
7. **Deploy**
   - Helm chart entry under `deploy/charts/klicker-uzh-v3/templates/` (deployment + service
     + ingress with `frame-ancestors` if we ever serve UI here, otherwise no headers).
   - `Secret`-managed `MCP_SERVER_BEARER`, `APP_SECRET` (already shared).
   - Add `MCP_SERVER_BEARER` to `turbo.json` `globalEnv`.

### Phase 2 — chat rendering (parallelizable with Phase 1)

1. **Iframe-embed renderer** (Path A)
   - `apps/chat/src/components/tools-ui/practice-quiz-tool-ui.tsx`
   - Uncomment / register in `RuntimeProvider.tsx`.
   - Add chat origin to PWA `frame-ancestors`.
2. **Manual verification** with `agent-browser`:
   - Open chat, ask "give me the second quiz from Testkurs", verify the quiz card renders
     and the iframe loads under chat's origin.
   - Complete the quiz inside the iframe; verify chat receives the
     `klicker:quiz-state: completed` event and (later) reacts.

### Phase 3 — finer-grained UI (v1.5)

1. Extract `QuestionCard` (Path B) into `packages/shared-components`.
2. Add `klicker_element_get` rendering as a single-question card in chat.
3. Optional `klicker_element_submit` tool — gated behind a feature flag and behind a
   product decision on credit consumption (writes are not in v1).

### Phase 4 — broader consumers

1. Document the MCP endpoint + auth model so external clients (Claude Desktop, Cursor,
   OLAT) can be granted scoped access. This will require an OAuth-style flow rather than a
   static bearer; defer until we have a concrete request.

## Risks / open questions

1. **Participant identity in MCP requests** — adding `X-Klicker-Participant` is a Klicker
   convention. The chat MCP client supports `authType: custom` already, but threading a
   *per-request* signed token through `mcpClients.ts` is new. We need to decide whether to
   sign in the chat route handler before each call, or in the MCP client wrapper.
2. **CSP / cookies for iframe rendering** — chat and PWA share `COOKIE_DOMAIN` today. We
   need to verify the embedded quiz loads with the participant's session (not a fresh
   anonymous one) when rendered inside the chat thread. This was the friction point in the
   "Embedded PWA messaging trust boundary" learning.
3. **Tool-name length** — `Klicker_klicker_practice_quiz_get` is 32 chars; safely under 64.
   Hash-suffix fallback won't kick in. But if we add longer tool names later we should add
   a sanity test.
4. **LLM behaviour with structured tool results** — current chat models stream prose around
   `tool-result` parts. We should confirm with both Sonnet 4.6 and GPT-5.1 that returning
   pure JSON results in clean tool-card rendering and a sensible narration.
5. **Solutions leakage** — unit tests must assert that `klicker_practice_quiz_get` and
   `klicker_element_get` strip `correctAnswers`, `feedback`, and `explanation` from the
   payload regardless of the underlying GQL fragment they use.
6. **Caching** — first cut hits Postgres on every tool call. If chat traffic grows we add
   a Redis cache keyed by `(toolName, normalizedArgs, participantScopeHash)` with short TTL
   (~30s) to ride out chatty reasoning loops.

## Next steps (concrete, in order)

1. Confirm scope of v1 with the team:
   - Read-only? ✅ proposed.
   - Workspace location and port? `apps/mcp-server/` @ 3020.
   - Auth model? bearer + signed participant token.
2. Land scaffolding PR: `apps/mcp-server/` boots, returns the empty tool list, passes auth.
3. Land first 3 tools (`klicker_course_list`, `klicker_practice_quiz_list`,
   `klicker_practice_quiz_get`) with seeded `ChatbotMCPServer` row.
4. Land `practice-quiz-tool-ui.tsx` and verify the round-trip with `agent-browser`.
5. Iterate on the remaining tools and on the `QuestionCard` extraction.
