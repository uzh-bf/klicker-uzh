# PLAN - PR 5126 Public Chat API And Engine Seam

## Identity

- Original date: 2026-06-24
- Revised: 2026-07-24
- Branch: `codex/mastra-chat-openrouter-smoke`
- Target: `v3`
- Pull request: [#5126](https://github.com/uzh-bf/klicker-uzh/pull/5126)
- Plan path: `project/2026-06-24-pr-5126-mastra-chat-simplification-plan.md`
- Status: approved architecture, revised implementation plan, no revised implementation started

Current branch warning:

- The local branch is one commit ahead and 27 commits behind its remote.
- The remote pull request contains unrelated history and currently conflicts with `v3`.
- Implementation must start by reconstructing the branch from current `v3`; do not layer more implementation onto the existing branch history.
- Preserve any private Catalyst/Mastra work through the Catalyst split before removing it from the public branch.

## Higher-Level Dependency

The Catalyst repository split is owned by the separate Catalyst planning session and its plan:

- local handoff: `project/_local/2026-07-21-catalyst-repo-split-handoff.md`
- local working plan: `project/plans_wip/PLAN-catalyst-repo-split.md`

This plan applies the settled split to public chat only:

- The public repository owns `apps/chat`, `apps/chat-api`, the chat engine contract, the default AI SDK engine, Prisma chat data, and deployment wiring.
- The private Catalyst repository owns the Mastra tutoring engine, tutor policy, routing, guardrails, and other private tutoring intelligence.
- The engine package boundary becomes an HTTP repository boundary. It is not inlined into `chat-api`.
- Catalyst-wide questions remain in the owning session. This plan must not duplicate or overrule them.

## Research

### Live Repository Findings

- `apps/chat` currently combines the Next.js frontend with server routes, Prisma access, participant-token verification, model execution, MCP execution, persistence, and credit charging.
- The frontend uses assistant-ui's `useExternalStoreRuntime` over a Zustand-owned message and thread model.
- Existing chat data already models stable message IDs, parent relationships, metadata, attachments, disclaimers, and thread ownership.
- The prototype branch contains `apps/chat-api`, Mastra chat code, an OpenRouter smoke, and GitHub Actions plumbing, but its remote history is not a clean base for this implementation.
- A real local smoke previously reached OpenRouter with `deepseek/deepseek-v4-flash`, streamed text, and verified persistence and credits.
- The current workflow is not a merge gate because it tolerates failure and uses a placeholder API key.

### Assistant-UI

The official External Store Runtime supports externally owned messages, conversion, and handlers for new/edit/reload/cancel actions:

- <https://www.assistant-ui.com/docs/runtimes/custom/external-store>

Therefore assistant-ui does not require Mastra storage or a Next.js backend. The current external runtime can talk directly to `chat-api` while Prisma remains canonical.

### Mastra Storage

Mastra storage would provide useful engine-local capabilities such as automatic history, working memory, semantic recall, observational memory, and Studio integration:

- <https://mastra.ai/docs/storage/overview>
- <https://mastra.ai/docs/memory/overview>
- <https://mastra.ai/docs/memory/working-memory>
- <https://mastra.ai/docs/memory/semantic-recall>

Those are not required for v1. `@mastra/memory` and `@mastra/pg` are not installed on the current branch. Making Mastra storage canonical now would duplicate or migrate ownership without proving a product benefit.

Future Catalyst engines may store derived memory under opaque identifiers if they also implement explicit reset, export, deletion, retention, and ownership rules. Prisma remains the canonical conversation record.

## Goal

Deliver one production chat path:

```text
apps/chat frontend
        |
        v
apps/chat-api
  auth, policy, persistence, credits, attachments, MCP authorization
        |
        v
deployment-selected engine
  public default AI SDK engine OR private Catalyst Mastra engine
```

The final public pull request must include a working default engine. A Catalyst deployment may select the private Mastra engine after it passes the same contract and browser flow.

## Non-Goals

- No Mastra implementation in public `chat-api`.
- No engine inlining.
- No Mastra storage migration.
- No permanent old and new backend paths.
- No Next.js API proxy in the final code.
- No per-chatbot arbitrary engine URL.
- No automatic engine fallback or generation retry.
- No public engine SDK or package publication.
- No grading, content generation, or async job placeholders.
- No broad chat UI redesign.
- No third-party extension promise beyond the internal operational seam.

## Ownership

| Component | Owns | Must not own |
| --- | --- | --- |
| `apps/chat` | assistant-ui runtime, Zustand state, local draft state, canonical request IDs, rendering, URL synchronization | Prisma, JWT verification, credits, engine credentials, server policy |
| `apps/chat-api` | browser auth, CSRF/CORS, authorization, Prisma conversation record, attachments, disclaimers, model policy, credits, engine selection, MCP authorization, stream adaptation | generation strategy, tutor policy, hidden conversation memory |
| engine | generation, approved tool execution, raw normalized usage, provider interaction | participant auth, database access, credits, public model pricing, canonical chat history |

## Engine Contract

The contract is a small internal HTTP seam shared as an un-published workspace package, for example `packages/chat-engine-contract`.

### Manifest

`GET /v1/manifest`

Minimum response:

- engine identity
- supported contract version
- chat feature flags: text, reasoning, images, tools, cancellation

`chat-api` validates the manifest at startup and periodically. An unavailable or incompatible engine places generation in degraded mode while non-generation endpoints remain available.

### Chat

`POST /v1/chat`

Transport:

- service-to-service bearer authentication
- versioned request validation
- AI SDK UI-message stream response
- abort propagation from browser through `chat-api`
- no automatic retry

Request contains only:

- opaque participant, course, chatbot, thread, message, and run IDs
- locale
- resolved chatbot system prompt and model parameters
- ordered message history
- attachment descriptors or bounded engine-readable content
- approved MCP server/tool descriptors
- one short-lived scoped MCP execution token
- trace context

Do not send names, email addresses, enrolment objects, roles, full database rows, `APP_SECRET`, database credentials, or provider credentials supplied by the browser.

Response contains:

- text deltas
- reasoning deltas when enabled
- tool lifecycle parts
- normalized raw input/output/reasoning/cache token usage
- finish reason
- structured contract errors

The engine does not calculate credits or monetary cost. Missing or invalid usage is a contract failure: `chat-api` persists available output and records the failure without inventing a charge.

### Platform Stream

The browser continues to consume an AI SDK UI-message stream. `chat-api` validates the engine stream and adds platform metadata:

- persisted thread ID before engine text for a newly adopted thread
- canonical user and assistant message IDs
- chat mode and model ID
- reasoning effort and persisted reasoning content
- credits charged
- final persistence status

Unknown or invalid engine parts fail closed and are observable. They are not passed blindly to the browser.

## Public Default Engine

The public default engine preserves today's generic chat capability:

- system prompts and resolved model parameters
- text and reasoning streaming
- image input for supported models
- MCP tool calling through the supplied scoped capability
- cancellation
- normalized token usage
- OpenRouter-compatible provider configuration

It excludes:

- tutor policy
- complexity routing
- persistent or semantic memory
- advanced guardrails
- private retrieval/ranking strategy
- multi-agent orchestration

The engine receives provider configuration from deployment secrets. It does not read Klicker Prisma or participant cookies.

## Chat API Design

### Public Surface

- `GET /health`
- `GET /ready`
- `GET /api/chatbots/:chatbotId/bootstrap`
- `GET /api/chatbots/:chatbotId/threads`
- `GET /api/chatbots/:chatbotId/threads/:threadId/messages`
- `PUT /api/chatbots/:chatbotId/threads/:threadId/title`
- `DELETE /api/chatbots/:chatbotId/threads/:threadId`
- `GET /api/chatbots/:chatbotId/threads/:threadId/messages/:messageId/attachments`
- `GET /api/chatbots/:chatbotId/disclaimer`
- `POST /api/chatbots/:chatbotId/disclaimer`
- `POST /api/chatbots/:chatbotId/chat`

Do not retain an empty-thread creation endpoint unless browser testing proves it is needed.

### Internal Modules

Keep Hono handlers thin:

```text
apps/chat-api/src/
  http/             route registration, request/response mapping
  auth/             participant cookie, CORS, CSRF, ownership guards
  conversation/     Prisma-backed use cases and DTO mapping
  engine/           manifest client, chat client, stream validation
  mcp/              tool authorization and scoped token minting
  services/         credits, attachments, disclaimers
```

Prisma stays inside `conversation/`. Do not add a generic `ConversationRepository` interface until a real second canonical adapter exists. Test conversation behavior through module and database integration tests.

### Failure Behavior

- No automatic generation retry.
- No automatic switch to another engine.
- Engine failure returns a structured `503` or terminates the stream with a structured error.
- Existing persisted user input and partial assistant output remain recoverable.
- Explicit user retry creates a new engine invocation.
- Operators change the deployment-wide engine URL when changing engines.

## Assistant-UI Invariants

Keep:

- `useExternalStoreRuntime`
- `ExtendedThreadMessageLike`
- `onNew`, `onEdit`, `onReload`, and `onCancel`
- stable parent IDs and branch paths
- assistant-ui attachment adapter plus Klicker attachment hydration
- `attachmentSourceMessageId` for edited image branches
- URL synchronization and thread list behavior

### Draft Thread Adoption

1. The frontend creates a local draft and canonical user and assistant message IDs.
2. It sends the first message to `chat-api` with no persisted thread ID.
3. `chat-api` validates IDs, creates the thread and user message idempotently, and emits the persisted thread ID before engine text.
4. The frontend adopts that ID, updates the URL, and retains the same messages and running state.
5. `chat-api` invokes the configured engine exactly once.
6. `chat-api` persists final or partial assistant output and validated usage.

Block or queue further sends while adoption is unresolved. Editing and reloading require a persisted thread ID.

Frontend IDs are canonical when valid. Any unavoidable ID replacement must be reported before attachments, branches, editing, or reload can depend on it.

## Security

- Use the existing participant cookie directly from the browser with `credentials: 'include'`.
- Configure explicit credentialed CORS origins and `Vary: Origin`; never use wildcard origin with credentials.
- Require origin validation and a non-simple CSRF header or bootstrap-minted token for state-changing requests.
- Scope every thread, message, and attachment lookup by participant and chatbot ownership.
- Configure engine URLs only at deployment level from an allowlist.
- Authenticate engines with service credentials held in memory and excluded from logs.
- Authorize MCP servers and tools in `chat-api`.
- Mint short-lived, audience-bound, asymmetrically signed MCP tokens; the engine receives no signing key.
- Apply body, attachment, concurrency, and rate limits before provider invocation.
- Validate manifest, engine stream parts, usage, tool calls, and finish data.
- Redact prompts, credentials, tokens, and attachment contents from operational logs.
- Propagate trace IDs without exposing user identity.

## Deployment

Each deployment selects exactly one engine:

- public default AI SDK engine, or
- private Catalyst Mastra engine.

Required configuration includes:

- browser origin allowlist
- public `chat-api` URL
- engine base URL and service credential
- engine manifest compatibility range
- MCP signing key and verification configuration
- provider key for the selected engine

Readiness distinguishes:

- `chat-api` can serve authenticated non-generation endpoints
- configured engine is compatible and reachable
- generation is degraded

The browser never selects an engine URL. A future deployment-defined `engineProfileId` is allowed only after a concrete need appears.

## Implementation Slices

Each slice is one tracer bullet: minimal implementation, fastest meaningful verification, plan progress update, conventional commit, separate review and simplification, accepted fixes, and verification rerun.

### Slice 0 - Reconstruct The Public Branch

Prerequisite:

- Confirm private Catalyst/Mastra source needed by the split is preserved in the Catalyst work before rewriting this public branch.

Work:

- Fetch current `v3`.
- Reconstruct `codex/mastra-chat-openrouter-smoke` from current `v3`.
- Make this revised plan the first branch commit.
- Retain only public chat work in the reconstructed pull request.
- Confirm the whole diff is narrow and contains no secrets or unrelated changes.

Verification:

- `git log --oneline v3..HEAD`
- `git diff --stat v3...HEAD`
- `git diff --check v3...HEAD`
- GitHub secret and mergeability checks after the later force-with-lease push

### Slice 1 - Contract And Default Engine Tracer

Work:

- Add the minimal internal contract schemas and fixtures.
- Implement default engine manifest and one streaming chat endpoint.
- Preserve OpenRouter provider injection and DeepSeek V4 Flash smoke configuration.
- Add cancellation and normalized usage.
- Add one engine conformance smoke.

Verification:

- contract schema tests
- stream fixture tests
- default-engine typecheck/build
- real engine-direct OpenRouter smoke with `deepseek/deepseek-v4-flash`

### Slice 2 - Chat API To Engine Tracer

Work:

- Add manifest validation and degraded readiness.
- Call the default engine from one authenticated `chat-api` chat route.
- Validate and adapt the engine stream.
- Add platform finish metadata and raw-usage validation.
- Prove no retry and no fallback behavior.
- Keep the old Next route temporarily while this tracer is verified.

Verification:

- contract mismatch and engine-unavailable tests
- abort propagation test
- invalid stream and missing-usage tests
- full `chat-api` to default-engine OpenRouter smoke

### Slice 3 - Conversation And Policy Surface

Work:

- Move bootstrap, threads, messages, title, delete, disclaimer, and attachments to `chat-api`.
- Implement the deep Prisma conversation module without a generic repository interface.
- Add participant/chatbot ownership guards, credentialed CORS, CSRF, rate limits, and request limits.
- Add idempotent thread and message creation.
- Persist complete and partial assistant output.
- Validate usage and compute credits from the public model registry.
- Mint scoped MCP tokens and authorize supplied tools.

Verification:

- database integration tests for ownership, branches, attachments, abort persistence, and idempotency
- CORS, CSRF, IDOR, rate-limit, and token-scope tests
- credit calculation and missing-usage tests

### Slice 4 - Frontend Direct Cutover

Work:

- Add a typed `chatApiClient` with configured base URL and credentials.
- Move bootstrap and all conversation calls to direct `chat-api` requests.
- Implement draft-thread adoption and canonical message IDs.
- Preserve assistant-ui edit, reload, cancel, branching, reasoning, tools, and attachment behavior.
- Verify the complete new route while the old route still exists.
- Delete `apps/chat/src/app/api/**` and remove obsolete server-only chat dependencies and configuration.
- Search for and remove all fallback references.

Verification:

- frontend store and stream parser tests
- direct browser authentication and thread adoption
- new, edit, reload, cancel, branch, image attachment, tool, disclaimer, title, delete, and reload-after-persist flows
- source search proving no old chat backend or runtime fallback remains

Browser verification:

- run the real local frontend, `chat-api`, and default engine
- use `npx agent-browser`
- capture and inspect before/after screenshots at desktop and mobile widths

### Slice 5 - Deployment And Real CI Smoke

Work:

- Add runtime/deployment resources for `chat-api` and the public default engine.
- Configure engine URL, service auth, CORS, MCP keys, readiness, and observability.
- Replace the placeholder workflow with a real secret-backed smoke.
- If `OPENROUTER_API_KEY` is absent, skip the smoke explicitly.
- If the secret is present, any contract, generation, persistence, or credit failure fails the job.
- Exercise the full path through `chat-api`, not only the provider.
- Use concurrency cancellation and path filters to control CI use.

Verification:

- deployment manifest rendering
- service health and degraded-mode checks
- real GitHub Actions smoke with `deepseek/deepseek-v4-flash`
- check that logs and artifacts contain no credential or prompt leakage

### Slice 6 - Finish Gates

Verification:

- relevant package typechecks, builds, lint, formatting, and tests
- public default engine contract smoke
- real OpenRouter full-chain smoke
- assistant-ui browser journeys and screenshots
- code-level `$security-review`
- independent whole-branch review
- `$thermo-nuclear-code-quality-review`
- clean whole-branch diff against current `v3`
- pull request title, body, plan progress, and evidence updated from the whole branch

Catalyst gate:

- The private Mastra engine must pass the same contract smoke and browser flow before a Catalyst deployment selects it.
- Catalyst engine readiness does not block merging a functional public/default path.

## Cutover And Rollback

Development may temporarily contain both paths only to verify the new path. The pull request must not merge with both.

Cutover:

1. Run all flows against `apps/chat -> apps/chat-api -> default engine`.
2. Switch frontend configuration completely.
3. Delete the Next backend and fallback code.
4. Rerun browser, contract, security, and smoke gates.

Rollback after deployment changes engine configuration or rolls back the release. It does not restore a second code path.

## Merge Criteria

- `apps/chat` is frontend-only for chat behavior.
- All browser chat traffic goes directly to `apps/chat-api`.
- Prisma is the canonical conversation store.
- The public default engine works through the versioned HTTP contract.
- No automatic retry, fallback engine, or legacy Next backend remains.
- Engine failure degrades generation without hiding non-generation endpoints.
- Assistant-ui edit, reload, cancel, branching, attachment, and draft-adoption flows pass.
- Real OpenRouter smoke is a truthful CI signal when its secret is configured.
- No secrets or personal data are present in commits, logs, or workflow artifacts.
- Required security, maintainability, branch, and browser reviews pass.

## Progress

- [x] Existing prototype and real OpenRouter smoke reviewed.
- [x] Assistant-ui direct-to-API feasibility confirmed.
- [x] Mastra storage benefits and migration cost reviewed.
- [x] Catalyst repository seam and deployment-wide engine choice approved.
- [x] Chat ownership, contract, failure, security, storage, and cutover rulings approved.
- [x] Old plan superseded by the public chat API and engine seam.
- [ ] Revised plan independently reviewed and accepted.
- [ ] Revised plan committed.
- [ ] Private Catalyst source preservation confirmed.
- [ ] Public branch reconstructed from current `v3`.
- [ ] Slices 1-6 implemented and verified.

## Next Action

Review and commit this revised plan. Then coordinate the private-source preservation prerequisite and reconstruct the public branch before implementation.

The durable repository-seam ADR belongs to the Catalyst split owner. Reference that ADR here when it exists; do not create a competing decision record in this pull request.
