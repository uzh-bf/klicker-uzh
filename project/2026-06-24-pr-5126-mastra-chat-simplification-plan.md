# PLAN - PR 5126 Public Chat API And Engine Seam

## Identity

- Original date: 2026-06-24
- Revised: 2026-08-10
- Branch: `codex/mastra-chat-openrouter-smoke`
- Target: `v3`
- Pull request: [#5126](https://github.com/uzh-bf/klicker-uzh/pull/5126)
- Plan path: `project/2026-06-24-pr-5126-mastra-chat-simplification-plan.md`
- Status: branch reconstructed; plan refreshed against current `v3`; implementation not started

Current branch state:

- The local branch was reconstructed from `origin/v3` at `0d7b4e4612`; its four commits contain only this plan.
- The old public implementation head is preserved locally as `backup/mastra-chat-openrouter-smoke-pre-reconstruct-20260810` at `349cded017` and privately as `archive/klicker-uzh-pr-5126`.
- The remote pull request still points to the old prototype head `7717572aba` and remains conflicting. Replacing it requires a separate, explicitly approved force-with-lease push after this plan is accepted.
- Do not merge, close, or delete the old pull request or branch until the reconstructed branch has been pushed and verified on GitHub.

## Higher-Level Dependency

The Catalyst repository split has preserved the private source and established the runtime boundary:

- [Catalyst PR #2](https://github.com/uzh-bf/klicker-uzh-catalyst/pull/2) contains the operational repository wiring.
- [Catalyst PR #3](https://github.com/uzh-bf/klicker-uzh-catalyst/pull/3) contains the runnable, stateless tutoring-engine boundary and the private archive refs for public PRs [#5126](https://github.com/uzh-bf/klicker-uzh/pull/5126) and [#5129](https://github.com/uzh-bf/klicker-uzh/pull/5129).
- Both Catalyst pull requests remain draft and do not block building the public default path.

This plan applies the settled split to public chat only:

- The public repository owns `apps/chat`, `apps/chat-api`, the chat engine contract, the default AI SDK engine, Prisma chat data, and deployment wiring.
- The private Catalyst repository owns the Mastra tutoring engine, tutor policy, routing, guardrails, and other private tutoring intelligence.
- The engine package boundary becomes an HTTP repository boundary. It is not inlined into `chat-api`.
- The public contract is the neutral consumer-facing source of truth. Before a deployment selects Catalyst, its current contract must be adapted to pass the public conformance suite; this plan does not copy the private contract back unchanged.
- Catalyst-wide tutor policy and research questions remain in the private repository. This plan must not duplicate or overrule them.

## Research

### Live Repository Findings

- `origin/v3` currently runs Node 24, Next.js 16, React 19, AI SDK 7, assistant-ui 0.14, and Prisma 7. The plan must extend those versions rather than reconstructing the June prototype stack.
- `apps/chat` currently combines the Next.js frontend with server routes, Prisma access, participant-token verification, model execution, MCP execution, persistence, feedback, and credit charging.
- The frontend uses assistant-ui's `useExternalStoreRuntime` over a Zustand-owned message and thread model.
- Existing chat data already models stable message IDs, parent relationships, metadata, attachments, disclaimers, message ratings, credits, and thread ownership.
- The current public surface includes explicit thread creation, credits, and persisted message-feedback endpoints. Those are required migration scope, not optional follow-ups.
- Sources and inline citations are derived from persisted `doc_query` tool-call parts under [ADR 0004](../docs/adr/0004-chat-citations-from-tool-call-parts.md). The engine boundary must preserve the tool input and result parts needed to reconstruct them; a text-only history contract is insufficient.
- Cancellation now persists available partial text, reasoning, and completed tool calls, charges validated completed-step usage exactly once, and prevents a later finish callback from overwriting or double-charging the aborted result. The split must preserve that contract.
- Recent `v3` fixes also require sparse provider tool-call indices to stream safely and feedback requests to remain ordered without blocking the response.
- The current image adapter bounds each decoded image at 5 MiB, while the route schema separately caps a base64 data URL at 7,000,000 characters. The engine contract must distinguish those two limits.
- The old prototype branch contains `apps/chat-api`, a default engine, an OpenRouter smoke, and GitHub Actions plumbing. It is a source to adapt, not a merge base or a reason to recreate already-shipped chat behavior.
- A real local smoke previously reached OpenRouter with `deepseek/deepseek-v4-flash`, streamed text, and verified persistence and credits.
- The current workflow is not a merge gate because it tolerates failure and uses a placeholder API key.
- The generalized embedded-assistant and MCP work from [PR #5109](https://github.com/uzh-bf/klicker-uzh/pull/5109) exists only on `v3-ai`. Its owning roll-up [PR #5092](https://github.com/uzh-bf/klicker-uzh/pull/5092) is still draft and conflicting. It is source for the bounded post-seam follow-up below; it does not block Slices 1-6 or the current-`v3` frontend cutover, and its generation consumers must later adapt directly to the landed `chat-api` and engine contract.

### Research Ownership And Limits

- Evidence: The 2026-08-10 refresh used the fetched `origin/v3`, live GitHub pull-request metadata, the current chat wiki, the preserved prototype refs, and the current Catalyst runtime contract.
- Decision: Current code and pinned package sources are the implementation authority. External framework documentation is rechecked only when a slice uses an API not already pinned and exercised in this repository.
- Limitation: The earlier real OpenRouter result proves the old prototype path only. No current-head provider, browser, deployment, or CI proof exists yet.

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

Future Catalyst engines may store derived memory only through an explicit, versioned, opt-in capability under opaque identifiers. That capability must define reset, export, deletion, retention, and ownership rules. It must never be implicit or hidden from `chat-api`, and it is outside v1. Prisma remains the canonical conversation record.

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
- No automatic switch to another engine and no automatic generation retry. Existing credit-driven model selection inside `chat-api`, including the configured zero-credit model, remains platform policy and is not an engine fallback.
- No public engine SDK or package publication.
- No grading, content generation, or async job placeholders.
- No broad chat UI redesign.
- No wholesale merge of `v3-ai` or [PR #5092](https://github.com/uzh-bf/klicker-uzh/pull/5092) into this pull request.
- No third-party extension promise beyond the internal operational seam.

## Ownership

| Component | Owns | Must not own |
| --- | --- | --- |
| `apps/chat` | assistant-ui runtime, Zustand state, composer state, canonical request IDs, rendering, URL synchronization | Prisma, JWT verification, credits, engine credentials, server policy |
| `apps/chat-api` | browser auth, CSRF/CORS, authorization, Prisma conversation record, attachments, disclaimers, feedback, model and credit policy, engine selection, MCP authorization, stream validation and adaptation | generation strategy, tutor policy, hidden conversation memory |
| engine | generation, approved tool execution, normalized usage, provider interaction, provider stream normalization | participant auth, database access, credits, public model pricing, canonical chat history |

## Engine Contract

The contract is a small internal HTTP seam defined in an un-published public workspace package, `packages/chat-engine-contract`. Build it by adapting the preserved public prototype and current Catalyst schemas, then add only the fields required by current `v3`; do not redesign it from scratch.

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
- explicit request-scoped or deployment-owned provider credential mode, with no implicit credential fallback
- no automatic retry

Request contains only:

- opaque participant, course, chatbot, thread, message, and run IDs
- locale
- resolved chatbot system prompt
- a versioned resolved-generation object containing the public model ID, provider deployment ID, maximum output tokens when configured, applied reasoning effort and summary mode, response-storage behavior, and the explicit provider credential mode; it excludes price, credits, fallback flags, and the unresolved model registry
- ordered message history, including persisted text, reasoning, and tool-call/result parts needed by the active branch
- bounded image attachments as `{ id, type: 'image', mediaType, dataUrl, description? }`
- approved MCP server/tool descriptors
- one short-lived scoped MCP execution token, carried separately from the JSON body
- trace context

Provider credential modes are mutually exclusive:

- `request`: the resolved-generation object contains a validated HTTP(S) provider base URL with no embedded credentials, query, or fragment, and `Provider-Authorization: Bearer ...` is required
- `deployment`: the request contains no provider URL or provider-authorization header; the engine uses its deployment-owned provider endpoint and credential
- both or neither are rejected before streaming; credentials are never persisted or logged

The default engine maps the resolved fields to the pinned provider API, sets provider/AI SDK generation retries to zero, and rejects unknown options instead of silently dropping them. Pricing and credit calculation remain in `chat-api`.

V1 attachment rules:

- allow only JPEG, PNG, GIF, and WebP data URLs
- preserve the current 5 MiB decoded-image limit and the separate 7,000,000-character data-URL schema guard
- validate declared media type against the data URL
- do not give engines arbitrary attachment URLs or callback access
- do not let engines fetch browser-supplied remote URLs

Do not send names, email addresses, enrolment objects, roles, full database rows, `APP_SECRET`, database credentials, or provider credentials supplied by the browser.

Response contains:

- text deltas
- reasoning deltas when enabled
- tool lifecycle parts with stable call IDs, tool names, validated inputs, sanitized outputs, and no assumption that provider tool-call indices are dense
- normalized raw input/output/reasoning/cache token usage for completed provider work, including available completed-step usage on cancellation
- finish reason
- structured contract errors

The engine does not calculate credits or monetary cost. `chat-api` persists final or available partial text, reasoning, and tool-call parts and charges validated usage at most once. Missing or invalid usage is a contract failure: `chat-api` records it without inventing a charge.

### Platform Stream

The browser continues to consume an AI SDK UI-message stream. `chat-api` validates the engine stream, persists the exact sanitized parts required by current chat behavior, and adds platform metadata:

- canonical user and assistant message IDs
- chat mode and model ID
- reasoning effort and persisted reasoning content
- credits charged
- final persistence status

Unknown or invalid engine parts fail closed and are observable. They are not passed blindly to the browser.

There is no separate citation payload. Citation cards and inline markers continue to derive from the persisted tool-call parts defined by [ADR 0004](../docs/adr/0004-chat-citations-from-tool-call-parts.md).

## Public Default Engine

The public default engine preserves today's generic chat capability:

- system prompts and resolved model parameters
- text and reasoning streaming
- image input for supported models
- MCP tool calling through the supplied scoped capability
- cancellation
- normalized token usage
- OpenAI-compatible provider configuration, including the deployed LiteLLM aliases and the existing OpenRouter smoke provider

It excludes:

- tutor policy
- complexity routing
- persistent or semantic memory
- advanced guardrails
- private retrieval/ranking strategy
- multi-agent orchestration

The engine supports the contract's explicit request-scoped and deployment-owned credential modes. The public deployment uses one configured mode and never falls back implicitly between them. The engine does not read Klicker Prisma or participant cookies.

## Chat API Design

### Public Surface

- `GET /health`
- `GET /ready`
- `GET /api/chatbots/:chatbotId/bootstrap`
- `GET /api/chatbots/:chatbotId/credits`
- `GET /api/chatbots/:chatbotId/threads`
- `POST /api/chatbots/:chatbotId/threads`
- `GET /api/chatbots/:chatbotId/threads/:threadId/messages`
- `PUT /api/chatbots/:chatbotId/threads/:threadId/title`
- `DELETE /api/chatbots/:chatbotId/threads/:threadId`
- `GET /api/chatbots/:chatbotId/threads/:threadId/messages/:messageId/attachments`
- `POST /api/chatbots/:chatbotId/threads/:threadId/messages/:messageId/feedback`
- `GET /api/chatbots/:chatbotId/disclaimer`
- `POST /api/chatbots/:chatbotId/disclaimer`
- `POST /api/chatbots/:chatbotId/chat`

`POST /threads` is the explicit v1 create-before-send boundary. A first chat request without a persisted thread ID is invalid and must not invoke an engine.

### Frontend Configuration

Read `CHAT_API_PUBLIC_URL` in the App Router root layout at request time, validate it as an HTTPS URL outside local development, and pass it as a serialized prop to a client runtime-config provider. Set `export const dynamic = 'force-dynamic'` on the owning layout or route segment so Next.js cannot bake the value in during static optimization. One image must accept different deployment values. Fail clearly when the variable is unset and add it to `turbo.json`. Do not add a Next API route or proxy for configuration, and do not use `NEXT_PUBLIC_*` build-time substitution for deployed images.

Authentication behavior:

- remove participant JWT verification and `APP_SECRET` from Next middleware
- let `chat-api` remain the only verifier and authorization boundary
- have bootstrap handle `401` by navigating to `/noLogin` with the current path as `redirectTo`
- serve frame-ancestor policy at ingress rather than coupling it to auth middleware
- delete the middleware if no frontend-only routing duty remains

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

### Explicit Thread Creation Before First Send

1. A new-chat composer may hold unsent text and attachments, but there is no local draft-thread identity.
2. On first send, the frontend generates the canonical thread UUID and sends it to `POST /threads` before it calls the chat endpoint.
3. After creation succeeds, the frontend inserts the persisted thread into the store, sets it active, and updates the URL using the returned thread ID.
4. Only then does it send the first message with that persisted thread ID and canonical user and assistant message IDs.
5. A failed or cancelled creation keeps the composer content available, shows a retryable error, and never invokes an engine.
6. Further sends, edits, reloads, attachments, feedback, and cancellation always address a persisted thread.

The implementation must use the smallest URL/store synchronization needed to preserve the current route guard. It must not add a draft-to-persisted adoption map, adoption marker, or adoption state machine.

Thread creation is durably idempotent at the existing HTTP/database seam: replaying the same valid UUID for the same participant, chatbot, and title returns the existing thread. Reusing it for different ownership or payload returns a generic conflict without revealing another participant's data. A lost-response retry is the required regression case; no idempotency table or adoption mapping is added.

## Security

- Use the existing participant cookie directly from the browser with `credentials: 'include'`.
- Configure explicit credentialed CORS origins and `Vary: Origin`; never use wildcard origin with credentials.
- Require origin validation and a non-simple CSRF header or bootstrap-minted token for state-changing requests.
- Scope every thread, message, and attachment lookup by participant and chatbot ownership.
- Configure engine URLs only at deployment level from an allowlist.
- Authenticate engines with service credentials held in memory and excluded from logs.
- Authorize MCP servers and tools in `chat-api`.
- Mint short-lived, audience-bound, asymmetrically signed MCP tokens; the engine receives no signing key.
- Keep provider and MCP credentials in headers or deployment configuration, never in persisted request bodies.
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

## Existing Decisions And Documentation

- [ADR 0002](../docs/adr/0002-message-feedback-as-a-rating-field.md) remains authoritative for persisted assistant-message ratings and the feedback endpoint.
- [ADR 0004](../docs/adr/0004-chat-citations-from-tool-call-parts.md) remains authoritative for source and citation derivation.
- Before Slice 1's interface commit, this pull request unconditionally adds `ADR 0005` for the public/private repository boundary, public neutral contract authority, Prisma canonicality, explicit credential modes, one engine per deployment, Catalyst's conformance obligation, and the rejected engine-inlining, shared-database, and published-SDK alternatives.

## Feature-Wide Test Portfolio

| Risk or behavior | Existing protection | Test obligation | Primary seam | Distinct failure caught | Slice |
| --- | --- | --- | --- | --- | --- |
| Versioned manifest and streamed contract | Catalyst boundary tests and old prototype fixtures | Add new | public contract conformance suite | default or Catalyst engine accepts incompatible payloads or emits invalid parts | 1-2 |
| Credit-aware model selection without engine failover or retry | current model-registry and route tests | Extend existing | `chat-api` policy plus invocation spy | split changes zero-credit selection or invokes another engine/model after failure | 2 |
| Tool history, sparse tool-call indices, and citation reconstruction | current provider fixture and citation tests | Extend existing | engine adapter plus persisted-message integration | sources disappear, tool calls crash on sparse indices, or unsafe errors persist | 1-2 |
| Cancellation, partial persistence, and exactly-once credits | current route tests and implementation | Extend existing | `chat-api` stream/database integration | abort loses completed work or finish handling overwrites/double-charges it | 2 |
| Auth, CORS, CSRF, ownership, feedback, and attachment limits | current route guards and focused tests | Add new boundary coverage | `chat-api` HTTP/database integration | cross-user access, forged state change, omitted feedback, or oversized image reaches the engine | 3 |
| Create-before-send URL/store behavior | current thread store and browser journeys | Add focused lost-response and cutover coverage | thread-create HTTP/database seam plus frontend browser flow | retry creates a duplicate thread, first send clears state, or create failure invokes the engine | 3-4 |
| Edit, reload, branch, tools, citations, feedback, image, and mobile flows | current chat test suite and Playwright journeys | Extend existing only where a distinct gap exists | real routed browser | frontend cutover silently drops a shipped user journey | 4 |
| Deployment and provider compatibility | old OpenRouter smoke only | Add new | deployed service smoke | manifests render but the full browser-to-engine chain or LiteLLM/OpenRouter compatibility is broken | 5-6 |

## Planning-Stage Review

- Reviewer: Codex `reviewer`, GPT-5.6 Sol at high effort, read-only on the 2026-08-10 working draft.
- Verdict: `DONE_WITH_CONCERNS`; five findings met the reporting threshold.
- Accepted: define the full resolved-generation and credential-mode contract, make thread creation durably idempotent with a client-generated UUID, make the public boundary ADR unconditional, and remove duplicate Slice 3 persistence/policy tests.
- Refined: the broad `v3-ai` prerequisite becomes a separately bounded sequential follow-up package sourced from the exact [PR #5109](https://github.com/uzh-bf/klicker-uzh/pull/5109) merge commit. It does not expand this PR or reintroduce the old Next backend.
- Follow-up verdict: the five findings were resolved; one stale pre-cutover dependency sentence was removed. No reported planning finding remains open.

## Sequential Public Follow-Up

The generalized embedded-assistant and MCP work is a separate public capability package, not a hidden Slice 4 expansion or a wholesale `v3-ai` merge:

- Source: exact squash merge commit `7cf91ba2a2` from [PR #5109](https://github.com/uzh-bf/klicker-uzh/pull/5109), with a source-to-target coverage ledger.
- Include: lecturer manage-assistant UI and proposal flows; embedded/PWA authentication and chat context; lecturer/student MCP authorization, allowlists, rate limits, and tool-output fencing; the directly supporting tests and deployment resources.
- Adapt: all chat generation consumers target the public `chat-api` and engine contract from this plan. Do not restore Next.js chat generation routes, duplicate auth, or private Catalyst policy.
- Exclude: unrelated `v3-ai` merges, obsolete package versions, analytics work, and any capability not traceable to the selected source commit.
- Check: focused manage-assistant, embedded-auth, proposal, MCP-security, and real routed-browser flows on then-current `v3`, plus a coverage ledger proving every selected source path was ported, superseded, or deliberately deferred.

This is a sequential follow-up after the public seam, not another layer inside [PR #5126](https://github.com/uzh-bf/klicker-uzh/pull/5126). [PR #5092](https://github.com/uzh-bf/klicker-uzh/pull/5092) can be closed only after its remaining unique commits have the same explicit coverage ruling and the user separately authorizes closure.

## Implementation Slices

Each slice is one tracer bullet: minimal implementation, fastest meaningful verification, plan progress update, main-session simplification, conventional commit, accepted fixes, and verification rerun. Use a separate intermediate reviewer only for the architecture, security, data-integrity, or cross-system slices that meet the repository's risk gate.

### Slice 0 - Reconstruct The Public Branch - Complete

Completed work:

- Preserved the exact old [PR #5126](https://github.com/uzh-bf/klicker-uzh/pull/5126) source as the private `archive/klicker-uzh-pr-5126` ref and verified Catalyst replacement work in draft [PR #3](https://github.com/uzh-bf/klicker-uzh-catalyst/pull/3).
- Reconstructed local `codex/mastra-chat-openrouter-smoke` from fetched `origin/v3` at `0d7b4e4612`.
- Retained only this public chat plan in the local branch diff.
- Preserved the prior local implementation head at `backup/mastra-chat-openrouter-smoke-pre-reconstruct-20260810`.

Current evidence:

- `git rev-list --left-right --count HEAD...origin/v3` returned `4 0` after the 2026-08-10 fetch.
- `git diff --name-status origin/v3...HEAD` contains only this plan.
- The remote PR remains unchanged at the old prototype head. A force-with-lease push is a later explicit approval gate, not part of Slice 0's completed local work.

Remaining publication check: after an explicitly approved force-with-lease push, read back the remote SHA, diff, secret checks, CI, and GitHub mergeability before treating the reconstruction as published.

### Slice 1 - Contract And Default Engine Tracer

Work:

- Add and accept public `ADR 0005` before the interface implementation commit.
- Adapt the preserved public prototype and current Catalyst schemas into the minimal neutral `packages/chat-engine-contract` schemas and conformance fixtures.
- Extend that input only for current `v3` behavior: the resolved-generation object, persisted tool histories, sparse-index-safe tool lifecycle events, explicit provider credential modes, abort terminal data, and normalized usage.
- Implement `apps/chat-engine-default` with a manifest and one streaming chat endpoint by extracting the current generic AI SDK/provider behavior rather than rewriting it.
- Preserve explicit OpenAI-compatible provider injection and the `deepseek/deepseek-v4-flash` OpenRouter smoke configuration.
- Add cancellation, normalized usage, and sanitized structured errors.
- Keep the package un-published; Catalyst adoption consumes the versioned HTTP contract and conformance fixtures through an explicit sync/adaptation change in its own repository.

Verification:

- contract schema tests
- stream fixture tests covering text, reasoning, tool calls, sparse provider indices, cancellation, invalid parts, both credential modes, rejected ambiguous credentials, and unknown generation options
- default-engine typecheck/build
- deterministic engine-direct provider smoke as the required local gate
- real engine-direct OpenRouter smoke with `deepseek/deepseek-v4-flash` when the approved key is available, without claiming it when unavailable

### Slice 2 - Chat API To Engine Tracer

Work:

- Add manifest validation and degraded readiness.
- Call the default engine from one authenticated `chat-api` chat route that requires an existing persisted thread.
- Validate and adapt the engine stream.
- Preserve current credit-aware model selection, provider-mode selection, trace propagation, canonical IDs, and platform finish metadata.
- Validate raw usage and persist final or available partial text, reasoning, and tool parts with exactly-once credit charging.
- Prove no generation retry and no switch to another engine after failure.
- Keep the old Next route temporarily while this tracer is verified.

Verification:

- contract mismatch and engine-unavailable tests
- abort propagation, partial persistence, and no-double-charge tests
- invalid stream and missing-usage tests
- authenticated `chat-api` to default-engine deterministic smoke
- full `chat-api` to default-engine OpenRouter smoke when the approved key is available

### Slice 3 - Conversation And Policy Surface

Work:

- Add equivalent bootstrap, credits, thread create/list/title/delete, messages, feedback, disclaimer, and attachment endpoints to `chat-api`.
- Leave the old Next routes and their service imports intact until Slice 4; do not move shared files in a way that breaks the temporary old path.
- Move and adapt the current server services and the deep Prisma conversation module; do not recreate shipped behavior or add a generic repository interface.
- Add participant/chatbot ownership guards, credentialed CORS, CSRF, rate limits, and request limits.
- Preserve the existing frontend create-before-send flow, accept its canonical client-generated thread UUID, and make repeated creates replay-safe; keep message creation idempotent.
- Preserve ordered feedback writes, sanitized persisted tool results, citation-bearing tool parts, and complete/partial assistant persistence.
- Validate usage and compute credits from the public model registry.
- Mint scoped MCP tokens and authorize supplied tools.

Verification:

- database integration tests for ownership, branches, attachments, ordered feedback and telemetry, and thread/message replay semantics
- CORS, CSRF, IDOR, rate-limit, and token-scope tests
- endpoint-policy interaction tests only where they add a distinct failure beyond Slice 2

### Slice 4 - Frontend Direct Cutover

Work:

- Add a typed `chatApiClient` with configured base URL and credentials.
- Inject the deployment-specific public API URL into the app shell without a Next API route.
- Remove participant-token verification and `APP_SECRET` from Next middleware; handle bootstrap `401` in the client.
- Move bootstrap, credits, feedback, and all conversation calls to direct `chat-api` requests.
- Preserve the existing explicit `POST /threads` before the first message, extend it with the canonical client-generated thread UUID, and keep canonical user and assistant message IDs.
- Preserve assistant-ui edit, reload, cancel, branching, reasoning, tool, citation, feedback, attachment, mode-aware starter, and mobile behavior from current `v3`.
- Verify the complete new route while the old route still exists.
- Delete `apps/chat/src/app/api/**` and remove obsolete server-only chat dependencies and configuration.
- Search for and remove all legacy-backend and automatic engine-failover references while retaining the configured zero-credit model policy.

Verification:

- frontend store and stream parser tests
- direct browser authentication and create-before-send failure/success behavior
- new, edit, reload, cancel, branch, image attachment, tool/citation, feedback, disclaimer, credits, title, delete, and reload-after-persist flows
- source search proving no old chat backend or runtime fallback remains

Browser verification:

- run the real local frontend, `chat-api`, and default engine
- use `npx agent-browser`
- capture and inspect before/after screenshots at desktop and mobile widths

### Slice 5 - Deployment And Real CI Smoke

Work:

- Add runtime/deployment resources for `chat-api` and the public default engine.
- Configure engine URL, service auth, CORS, MCP keys, readiness, and observability.
- Remove `continue-on-error` and replace the placeholder workflow behavior with a real secret-backed smoke.
- If `OPENROUTER_API_KEY` is absent, skip the smoke explicitly.
- If the secret is present, any contract, generation, persistence, or credit failure fails the job.
- Exercise the full path through `chat-api`, not only the provider.
- Add a configured LiteLLM/OpenAI-compatible contract smoke for the deployed model aliases; local simulation proves wiring only, not production routing.
- Use concurrency cancellation and path filters to control CI use.
- Render and verify deployment changes locally. Applying cluster or ArgoCD changes remains a separate explicit approval gate.

Verification:

- deployment manifest rendering
- service health and degraded-mode checks
- real GitHub Actions smoke with `deepseek/deepseek-v4-flash`
- deployed LiteLLM compatibility smoke when authorized access and credentials exist
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
- Assistant-ui edit, reload, cancel, branching, attachment, feedback, citation, and explicit create-before-send flows pass.
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
- [x] Revised plan independently reviewed.
- [x] Initial revised plan committed as `834159ae1`.
- [x] Accepted review corrections integrated and committed.
- [x] Private Catalyst source preservation confirmed through archive refs and draft Catalyst PRs #2 and #3.
- [x] Public branch reconstructed from fetched `origin/v3` with only this plan in the local diff.
- [x] Current `v3` chat surface, versions, citations, feedback, credits, sparse tool calls, cancellation semantics, and image limits remapped on 2026-08-10.
- [x] V1 thread lifecycle locked to explicit `POST /threads` before the first send; no draft-adoption state machine.
- [x] 2026-08-10 plan refresh independently reviewed; accepted corrections integrated and validated.
- [x] Public ADR 0005 accepted for the versioned chat-engine boundary.
- [ ] Slice 1 active: contract schemas, conformance fixtures, and the public default-engine tracer.
- [ ] Slices 2-6 implemented and verified.

## Next Action

Implement and verify Slice 1 in this worktree. Do not force-push the reconstructed branch, change either pull request, or begin deployment work without the corresponding explicit approval.
