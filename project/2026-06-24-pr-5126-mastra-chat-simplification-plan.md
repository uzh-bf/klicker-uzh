# PLAN - PR 5126 Public Chat API And Engine Seam

## Identity

- Original date: 2026-06-24
- Revised: 2026-08-12
- Branch: `codex/mastra-chat-openrouter-smoke`
- Target: `v3`
- Pull request: [#5126](https://github.com/uzh-bf/klicker-uzh/pull/5126)
- Plan path: `project/2026-06-24-pr-5126-mastra-chat-simplification-plan.md`
- Status: CH-P1 foundation complete in draft PR #5126. Its canonical `v1`
  contract, default engine, authenticated generation tracer, conformance
  runner, and provider-origin boundary are implemented, reviewed, and
  published. CH-P2 through CH-P5 are separate follow-on packages.

Current branch state:

- The branch was reconstructed from fetched `origin/v3` and now contains the approved plan, ADR 0005, Slice 1 contract/default-engine commits, and the committed Slice 2 tracer.
- The old public implementation head is preserved locally as `backup/mastra-chat-openrouter-smoke-pre-reconstruct-20260810` at `349cded017`, at `refs/stack-backup/20260812-current-v3/codex/mastra-chat-openrouter-smoke`, and privately as `archive/klicker-uzh-pr-5126`.
- The explicitly approved force-with-lease replacement published contract commit `44306fb0f2fa3d1d7de7606699232f9247268009` to draft PR #5126. Remote readback matches that commit.
- Do not merge, close, or delete the pull request or branch without separate authorization.

Locked continuation decisions:

- `codex/mastra-chat-openrouter-smoke` is the canonical public implementation line. The older `codex/catalyst-repo-split` branch contributes coordination evidence only and will not remain a second implementation authority.
- Continued delivery uses clean, ordered pull-request layers. Each repository has its own stack; cross-repository dependencies are coordinated by explicit contract and deployment gates.
- Public engine contract generations are ordinal (`v1`, `v2`, `v3`), not semantic versions. The public contract and conformance suite are canonical, and Catalyst PR #3 must be adapted to them before it can merge.
- Public and private work proceeds as coherent interleaved milestones rather than finishing one repository in isolation.
- Production proves the public default-engine path first. Selecting the Catalyst engine is a later deployment configuration change after the same contract and end-to-end gates pass.
- The unfinished `v3-ai` roll-up will eventually land in `v3`, but it is not a
  prerequisite for this contract foundation. Its MCP servers, embedded
  assistant, and related generalized AI surfaces integrate later as consumers;
  this stack does not migrate or recreate them as a sibling package.
- Contract rollovers are engine-first: an engine may temporarily serve the current and next ordinal generation, while `chat-api` selects exactly one configured generation and never negotiates or silently downgrades.
- Engine manifests expose only behavior that the chat host enforces: text, reasoning, images, tools, cancellation, credential modes, and resource limits. Tutoring, routing, retrieval, and orchestration remain private implementation details.
- W3C `traceparent` and `tracestate` HTTP headers are the canonical trace transport. Each engine stream has exactly one terminal `finish`, `abort`, or `error` event, and only validated usage from completed provider work is chargeable.
- `chat-api` mints one short-lived MCP JWT per engine request. It scopes issuer, server audiences, expiry, token ID, run ID, and allowed tools; engines only forward it and MCP services verify it.
- The public repository owns the canonical generated schemas, fixtures, and black-box conformance runner. Catalyst records a pinned public commit and runs that exact suite in CI; the contract package remains unpublished and Catalyst does not maintain a second contract authority.
- Learning analytics is a complete feature stack with multiple reviewable layers, not one sibling pull request. Other substantial Catalyst capabilities use the same feature-stack model without creating dependencies between unrelated features.
- The public repository retains analytics UI, GraphQL read/control surfaces, Prisma schema, and migrations. The private analytics service reads domain tables and writes only analytics-owned derived tables; the public analytics compute service and its build/sync plumbing are removed after cutover.
- Each source repository owns its service images and service-level deployment defaults. Environment GitOps composes those services into one KlickerUZH application deployment with shared service discovery and Infisical-managed secrets.
- Public source pull requests retire only after source-to-target coverage and remote readback: replace chat prototype PR #5126 in place, close tutor/research PR #5129 after the private import, and close analytics phase-A PR #5073 only as part of retiring its full analytics source stack. Branch deletion remains a separately authorized final action.
- The private learning-analytics work preserves the existing source progression as separate review layers: foundations, production runtime, consent/finalization, current-`v3` reconciliation, computation-side privacy/eligibility, and delivery/cutover. Mixed source pull requests use path-and-commit ledgers; public Prisma, GraphQL, UI, documentation, and feature-flag work remains public.
- Adaptive learning uses its own stateless private service and ordinal contract. Public authorization, Prisma state, attempt lifecycle, deterministic grading, publication snapshots, and UI/API remain in KlickerUZH; Catalyst owns IRT estimation, calibration mathematics, item selection, stopping, classification, and psychometric diagnostics.
- The adaptive source stack splits by ownership: PR #5289 moves private with history; PR #5290 remains the public persistence layer; PR #5291 remains the public host API but calls the engine; PR #5292 remains public UI; PR #5293 remains entirely public Playwright/configuration/accessibility evidence. Private simulation evidence comes from PR #5289. PR #5113 retires only after exact coverage.
- Knowledge-base management UI and backend remain public. Knowledge-graph generation is private Catalyst logic currently in `kg-content-generation`; a later history-preserving stack moves it to `apps/knowledge-graph-generation`. Shared data ingestion remains an external infrastructure dependency.
- Grading/feedback and content generation are planned feature stacks but remain inactive beyond their existing Catalyst module roots until concrete source or product requirements exist.
- The three active split stacks are chat/tutoring, learning analytics, and adaptive learning. Knowledge-graph consolidation follows them.

## Higher-Level Dependency

The Catalyst repository split has preserved the private source and established the runtime boundary:

- The cross-feature execution plan and Catalyst ADRs live in the private
  repository at `docs/project/2026-08-11-catalyst-feature-stacks-plan.md` and
  `docs/adr/`; this public plan governs only the chat host/default-engine stack.
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
- The generalized embedded-assistant and MCP work from [PR #5109](https://github.com/uzh-bf/klicker-uzh/pull/5109) currently exists on `v3-ai`, whose owning roll-up [PR #5092](https://github.com/uzh-bf/klicker-uzh/pull/5092) is still draft and conflicting. It is not needed for the neutral `v1` contract, public default engine, or private Catalyst adapter. When it is ready, those surfaces become consumers of the host/engine seam rather than being extracted or recreated here.
- 2026-08-12 readback: fetched `origin/v3` is `5264353ff7`, while
  `origin/v3-ai` is `ee8bb99195`; PR #5092 remains draft and conflicting. This
  branch was rebased cleanly onto that current `v3` without importing unfinished
  `v3-ai` work. Its pre-rebase state is preserved at
  `refs/stack-backup/20260812-current-v3/codex/mastra-chat-openrouter-smoke`.

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

## Milestone Goal

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

The complete public stack must deliver a working default engine. A Catalyst
deployment may select the private Mastra engine after it passes the same
contract and browser flow.

PR #5126 is the inert CH-P1 foundation package. It establishes the public
contract, default engine, and authenticated generation tracer while the old
Next route remains active. It does not own the later conversation API,
frontend cutover, deployment, or route-removal packages.

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
- No manual partial merge, cherry-pick, or parallel recreation of unfinished
  `v3-ai`. Integrate its consumers in their owning later stack after the roll-up
  is ready.
- No third-party extension promise beyond the internal operational seam.

## Ownership

| Component | Owns | Must not own |
| --- | --- | --- |
| `apps/chat` | assistant-ui runtime, Zustand state, composer state, canonical request IDs, rendering, URL synchronization | Prisma, JWT verification, credits, engine credentials, server policy |
| `apps/chat-api` | browser auth, CSRF/CORS, authorization, Prisma conversation record, attachments, disclaimers, feedback, model and credit policy, engine selection, MCP authorization, stream validation and adaptation | generation strategy, tutor policy, hidden conversation memory |
| engine | generation, approved tool execution, normalized usage, provider interaction, provider stream normalization | participant auth, database access, credits, public model pricing, canonical chat history |

## Engine Contract

The contract is a small internal HTTP seam defined in an un-published public workspace package, `packages/chat-engine-contract`. Build it by adapting the preserved public prototype and current Catalyst schemas, then add only the fields required by current `v3`; do not redesign it from scratch. The package generates the canonical schemas, fixtures, and black-box conformance runner. Catalyst CI records a pinned public commit, checks out that exact contract source, and runs its suite against the built private service rather than publishing an npm package or maintaining an independent contract authority.

### Manifest

`GET /v1/manifest`

Minimum response:

- engine identity
- supported contract version
- host-enforced feature flags: text, reasoning, images, tools, cancellation
- supported provider credential modes and contract-defined resource limits

Tutoring, routing, retrieval, and orchestration are not manifest capabilities.
They remain engine implementation details unless a later contract generation
requires the chat host to change behavior based on them.

`chat-api` validates the manifest at startup and periodically. An unavailable or incompatible engine places generation in degraded mode while non-generation endpoints remain available.

During a contract rollover, the engine may expose both the current and next
ordinal endpoint generations. `chat-api` calls exactly the generation selected
by deployment configuration. It does not negotiate, choose the highest common
generation, or silently downgrade. Add the new engine generation first, switch
the host only after conformance passes, and remove the old generation in a
later deployment.

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
- one short-lived scoped MCP execution token, carried separately from the JSON body; its claims bind issuer, permitted server audiences, expiry, token ID, run ID, and allowed tools

W3C `traceparent` and optional `tracestate` HTTP headers carry trace context.
The JSON request body does not carry a second trace representation.

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

Every stream emits exactly one terminal `finish`, `abort`, or `error` event.
Only validated usage for completed provider work is chargeable. An abort may
therefore carry completed-step usage, while unknown or invalid usage remains a
contract failure rather than an inferred charge.

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
- Mint one short-lived, asymmetrically signed MCP token per engine request. Bind it to issuer, permitted server audiences, expiry, token ID, run ID, and allowed tools; the engine receives no signing key and can only forward it.
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
- selected engine contract generation
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
- Historical 2026-08-11 review note: that version expected the complete
  `v3-ai` roll-up to become this stack's baseline. The later owner ruling in
  this plan supersedes that expectation: `v3-ai` is an independent consumer,
  not a foundation prerequisite.
- Earlier review verdict: the five findings in that version were resolved; one stale pre-cutover dependency sentence was removed.
- 2026-08-13 topology review: Codex `reviewer`, GPT-5.6 Sol at high effort,
  reviewed the three uncommitted public/private plan updates read-only. Verdict:
  `DONE_WITH_CONCERNS`. Accepted corrections keep CH-P3 default-off with the old
  route retained, scope the dual-path prohibition to CH-P5, preserve MCP issuer
  ownership in the later `v3-ai` integration, and align the private manifest
  description with the canonical public fields. No ADR conflict or missing ADR
  was found.

## Later `v3-ai` Integration

The generalized MCP servers, embedded assistant, and related AI surfaces enter
the platform through their owning `v3-ai` roll-up, but they do not block this
foundation:

- Complete and land the owning roll-up independently; do not extract,
  cherry-pick, or recreate its components in this stack.
- After it lands, record the new `v3` SHA and an overlap/consumer ledger before
  building the MCP/assistant integration layer.
- Reuse its MCP server identity and authorization model when `chat-api` mints
  scoped execution tokens. Do not invent a second server registry.
- Until then, `chat-api` supplies no tools. The foundation exposes one
  fail-closed authorization seam that returns approved tools and their matching
  token together.

This is an upstream integration gate within the public core stack, not a
separate capability package. Updating, merging, or closing the existing
pull requests remains separately authorized work.

## PR #5126 Foundation Slices

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
- The old remote prototype was replaced only after explicit approval. The
  reconstructed branch was read back from draft PR #5126 at contract commit
  `44306fb0f2fa3d1d7de7606699232f9247268009`.

Publication evidence: GitHub type, format, lint, syncpack, Gitleaks, GitGuardian,
Greptile, and build-and-compile checks passed. Two install jobs failed while
downloading the pre-existing `sharp@0.32.6` libvips binary with HTTP 503 and
then attempted to compile without system libvips. This runner dependency
failure is outside the branch diff and does not invalidate the focused checks.

### Slice 1 - Contract And Default Engine Tracer

Work:

- Add and accept public `ADR 0005` before the interface implementation commit.
- Adapt the preserved public prototype and current Catalyst schemas into the minimal neutral `packages/chat-engine-contract` schemas and conformance fixtures.
- Extend that input only for current `v3` behavior: the resolved-generation object, persisted tool histories, sparse-index-safe tool lifecycle events, explicit provider credential modes, abort terminal data, and normalized usage.
- Implement `apps/chat-engine-default` with a manifest and one streaming chat endpoint by extracting the current generic AI SDK/provider behavior rather than rewriting it.
- Preserve explicit OpenAI-compatible provider injection and the `deepseek/deepseek-v4-flash` OpenRouter smoke configuration.
- Add cancellation, normalized usage, and sanitized structured errors.
- Keep the package un-published; Catalyst records a pinned public commit and runs the schemas, fixtures, and black-box conformance runner from that exact revision against its built service. Catalyst implementation adapters may differ internally but cannot redefine the contract.

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

## Follow-On Public Packages

Each follow-on package starts from updated `v3` after its predecessor lands.
PR #5126 is not widened with these packages.

### CH-P2 - Conversation And Policy Surface

Work:

- Add equivalent bootstrap, credits, thread create/list/title/delete, messages, feedback, disclaimer, and attachment endpoints to `chat-api`.
- Leave the old Next routes and their service imports intact until CH-P3; do not move shared files in a way that breaks the temporary old path.
- Move and adapt the current server services and the deep Prisma conversation module; do not recreate shipped behavior or add a generic repository interface.
- Add participant/chatbot ownership guards, credentialed CORS, CSRF, rate limits, and request limits.
- Preserve the existing frontend create-before-send flow, accept its canonical client-generated thread UUID, and make repeated creates replay-safe; keep message creation idempotent.
- Preserve ordered feedback writes, sanitized persisted tool results, citation-bearing tool parts, and complete/partial assistant persistence.
- Validate usage and compute credits from the public model registry.
- Retain the fail-closed no-tools seam from CH-P1. CH-P2 neither invents a
  second server registry nor mints MCP execution tokens; the later independent
  `v3-ai` consumer package owns tool authorization and token minting.

Verification:

- database integration tests for ownership, branches, attachments, ordered feedback and telemetry, and thread/message replay semantics
- CORS, CSRF, IDOR, rate-limit, and fail-closed no-tools tests
- endpoint-policy interaction tests only where they add a distinct failure beyond CH-P1

### CH-P3 - Frontend Direct Cutover

Work:

- Add a typed `chatApiClient` with configured base URL and credentials.
- Inject the deployment-specific public API URL into the app shell without a Next API route.
- Remove participant-token verification and `APP_SECRET` from Next middleware; handle bootstrap `401` in the client.
- Move bootstrap, credits, feedback, and all conversation calls to direct `chat-api` requests.
- Preserve the existing explicit `POST /threads` before the first message, extend it with the canonical client-generated thread UUID, and keep canonical user and assistant message IDs.
- Preserve assistant-ui edit, reload, cancel, branching, reasoning, tool, citation, feedback, attachment, mode-aware starter, and mobile behavior from current `v3`.
- Verify the complete new route behind an explicit off-by-default migration
  flag while the old route remains available.
- Retain `apps/chat/src/app/api/**` and its server-only dependencies through
  CH-P4 so the default-off package is safe to land and rollback remains
  available. CH-P5 owns activation and removal.
- Remove automatic engine-failover references while retaining the configured
  zero-credit model policy.

Verification:

- frontend store and stream parser tests
- direct browser authentication and create-before-send failure/success behavior
- new, edit, reload, cancel, branch, image attachment, tool/citation, feedback, disclaimer, credits, title, delete, and reload-after-persist flows
- source search proving no old chat backend or runtime fallback remains

Browser verification:

- run the real local frontend, `chat-api`, and default engine
- use `npx agent-browser`
- capture and inspect before/after screenshots at desktop and mobile widths

### CH-P4 - Deployment And Real CI Smoke

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

### CH-P5 - Activation, Cleanup, And Finish Gates

Work:

- Activate the direct path only after CH-P4 environment proof and explicit
  cutover approval.
- Remove the migration flag, `apps/chat/src/app/api/**`, obsolete server-only
  chat dependencies and configuration, and all remaining legacy-backend
  references after old-route traffic is verified as zero.

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

CH-P1 through CH-P4 may land with both paths because the old route stays active
and the direct path remains default-off. CH-P5 is the final cutover package and
must not merge with both generation paths active.

Cutover:

1. Run all flows against `apps/chat -> apps/chat-api -> default engine`.
2. Switch frontend configuration completely.
3. Delete the Next backend and fallback code.
4. Rerun browser, contract, security, and smoke gates.

Rollback after deployment changes engine configuration or rolls back the release. It does not restore a second code path.

## PR #5126 Merge Criteria

- The ordinal `v1` package is the canonical public contract authority.
- The public default engine and authenticated `chat-api` generation tracer
  pass their focused Node 24 checks and black-box conformance suite.
- The Catalyst adapter passes the same immutable public contract revision.
- Request-scoped provider credentials are constrained by exact deployment
  origin allowlists, and tools fail closed without their matching execution
  token.
- The old Next route remains active, so the package is inert and independently
  safe to land.
- Current-head CI, security, maintainability, and integrated review gates pass.
  The two Playwright failures from run `31635506742` are owned by Codex task
  `019ff782-1989-7301-9f80-5d5a505f34f6`; this package consumes that task's
  fix and current-head readback rather than duplicating its investigation.
- The pull request description reports the substantive package size and its
  approved existing-tracer exception.

## Milestone Completion Criteria

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
- [x] Slice 1 implementation complete locally: strict v1 contract schemas, conformance fixtures, public default-engine manifest/chat tracer, explicit credential modes, bounded images, tool capability forwarding, zero retries, normalized usage, cancellation metadata, and direct OpenRouter smoke script.
- [x] Slice 1 intermediate review completed; persisted tool-result reconstruction, MCP tool identity/uniqueness, cancellation coverage, and nested strictness findings were resolved locally.
- [x] Slice 1 corrective commits `b451f38ec` and `b335bacfa` passed the final exact-scope intermediate review; real OpenRouter smoke remains conditional on approved credentials and a running engine.
- [x] Slice 2 tracer implemented locally: authenticated existing-thread Hono route, engine manifest/readiness probe, strict request/stream adaptation, explicit credential modes, current credit-aware model selection, canonical IDs and trace context, transactional final/partial persistence, and exactly-once finalization tests.
- [x] Slice 2 focused typecheck, tests, build, and the local HTTP abort propagation spike passed on Node 22; the repository declares Node 24.
- [x] Slice 2 architecture/data-integrity intermediate review completed cleanly on `2a276b1d18..ba6599b8d`; readiness timeout, separate-chunk terminal cancellation, and canonical assistant-ID fixes are covered. Live concurrent Prisma debit integration remains deferred to CH-P2.
- [x] Slice 2 integrated final review passed cleanly on `2a276b1d18..ba6599b8d`; the final reviewer found no verified P0-P2 issues. The Node 22 versus Node 24 verification limitation and CH-P2 contention gate remain explicit.
- [x] Canonical `v1` contract candidate now keeps W3C trace context in HTTP
      headers, advertises provider modes and exact resource limits, enforces the
      three-image/user-only history rule, and exports a black-box HTTP
      conformance runner. Node 24 verification passed 6 contract tests, 4
      default-engine tests, 15 chat-api tests, and focused type-checks.
- [x] The exported public runner passed locally against the compiled Catalyst
      application: manifest `v1`, Catalyst engine identity, five validated
      stream parts, and exactly one `finish` terminal.
- [x] The cross-repository seam review identified that the first exported
      runner covered only the successful deployment-credential path. The
      canonical suite now also rejects ambiguous/missing provider credentials,
      requires and observes an approved tool execution, propagates W3C trace
      headers, and validates the abort fixture. The expanded suite passes
      locally against the compiled Catalyst adapter with `finish` terminals for
      deployment, request-credential, and tool scenarios and an `abort`
      terminal for the cancellation scenario.
- [x] Rebased the foundation onto fetched `origin/v3` at `5264353ff7` without
      importing the unfinished `v3-ai` roll-up.
- [x] Enforced a deployment-configured exact-origin allowlist before either the
      public host or engine accepts request-scoped provider credentials.
- [x] Replaced the partial public MCP hook with a fail-closed seam that returns
      approved tools and their execution token together. The later `v3-ai`
      integration will implement the issuer; no tool is exposed before then.
- [x] Corrected the shared abort scenario after final review found that the
      fixture selected an abort terminal without cancelling transport. The
      runner now starts the SSE request, aborts its actual request signal after
      the first chunk, and validates the resulting metadata and `abort`
      terminal against the private adapter.
- [x] Reran current-head Node 24 contract, default-engine, chat-api, and chart
      checks. Security, maintainability, and integrated final reviews found no
      remaining issue at confidence 75 or higher.
- [x] Published the explicitly approved force-with-lease replacement and read
      back draft PR #5126 at public contract commit `44306fb0f2`. GitHub's
      branch-relevant type, format, lint, build-and-compile, syncpack, and
      secret checks passed; two independent install jobs hit the same external
      `sharp@0.32.6` libvips download failure.
- [x] Confirmed PR #5126 ends at CH-P1; full chat cutover criteria govern the
      milestone rather than this inert foundation package.
- [ ] Consume the Playwright correction and current-head evidence from task
      `019ff782-1989-7301-9f80-5d5a505f34f6`, then complete Gate 3 for PR
      #5126.
- [ ] Land PR #5126 only after Catalyst PR #3 lands and explicit merge
      authorization is given.
- [ ] CH-P2 through CH-P5 implemented and verified as follow-on packages from
      updated `v3`.

## Next Action

Keep PR #5126 draft until the separate Playwright task supplies current-head
green evidence. After Gate 3, land Catalyst PR #3 first and PR #5126 second,
each only with explicit merge authorization. TU-C2 then runs before CH-P2; no
follow-on implementation starts while either foundation remains open.
