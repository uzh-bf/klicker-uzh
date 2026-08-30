---
type: App Guide
title: Chat Platform
description: The apps/chat island — app router, zustand, assistant-ui, route-handler auth guards, and the model registry.
timestamp: '2026-08-31'
tags:
  - frontend
  - chat
  - ai
---

# Chat Platform (`apps/chat`)

> **Framework status (2026-08-03):** the AI-SDK route-handler layer described
> here **is** the current production path — the AI SDK 7 / assistant-ui 0.15
> upgrade shipped with this branch ([ADR 0003](./adr/0003-chat-framework-upgrade.md)).
> A Mastra-based `apps/chat-api` service split remains an open exploration in the
> draft PRs #5126 / #5129 (tutor architecture in #5129) with no landing date, so
> build on this layer as normal production work; the earlier "don't invest here"
> framing is obsolete. Staged doc/skill changes for that exploration:
> `project/plans_future/2026-07-07-wiki-skills-migration-roadmap.md`.

**This app is an island — do not apply the pages-router conventions here.** It is the only Next.js **app-router** app (port 3004), talks to the backend's Prisma models directly through its own API route handlers (no GraphQL ops), uses **zustand** for client state (nowhere else in the repo), and renders chat via **assistant-ui** (`@assistant-ui/react`) over the Vercel AI SDK (`@ai-sdk/*`). The current runtime keeps the app's `useChatResponse` transport adapter after the U5 `useAISDKRuntime` spike gate was not verifiable without a live model key. Domain models live in `packages/prisma` `chat.prisma` (chatbots, threads, messages, credits as `Decimal(18,6)`).

The app runs Next.js 16 / React 19 and uses Turbopack for development, test, and production builds (`apps/chat/package.json:scripts`). Control, manage, and PWA production builds retain Webpack for service-worker compatibility. The chat production image copies the Next standalone server from `.next/standalone` and starts `apps/chat/server.js` (`apps/chat/Dockerfile`). Verify that path with a production build and container smoke test; a successful source build alone does not prove the runtime copy layout.

Chatbot route recovery is intentionally split by cause. `src/app/[chatbotId]/layout.tsx` validates the route parameter as a UUID before querying Prisma, then calls `notFound()` for malformed or absent chatbot IDs; the root `src/app/not-found.tsx` preserves the 404 status while showing branded recovery and a safe return link. The root `src/app/error.tsx` sits above the dynamic layout, uses Next's `unstable_retry` callback to refresh a failed server payload, and exposes only retry/return actions; it never renders the underlying error text. The loading state in `src/components/assistant.tsx` uses the same branded card/skeleton language, and `/noLogin` keeps only a concise return notice instead of printing the UUID-bearing redirect URL.

## Structure

- `src/app/api/chatbots/[chatbotId]/…` — route handlers (chat streaming, attachments, threads).
- `src/lib/server/` — server-only helpers: auth/model configuration, image handling, telemetry, and sanitized assistant-message persistence.
- `src/stores/` — zustand: `chatStore`, `composerStore`, `settingsStore`.
- `src/stores/ratingRequestCoordinator.ts` — per-thread/message serialization of rating requests.
- `src/components/thread.tsx`, `src/components/message-parts.tsx`, and `src/hooks/` — assistant-ui composition and transport.
- `src/components/history-rail.tsx` and `src/lib/history-rail.ts` — the read-only active-path history projection, transcript anchors, and responsive navigation rail.
- `src/components/ui/` — the app's own shadcn-style primitives (`tooltip.tsx`, `action-bar-button.ts`), separate from `@uzh-bf/design-system`.
- `src/lib/sources/` — the doc_query source normalizer (`normalizeSources.ts`) and the display helpers shared by cards and citation previews (`sourceDisplay.ts`).
- `src/components/source-preview-content.tsx` — the shared title, locator, excerpt, and optional navigation hint rendered inside source and citation tooltips.
- `src/lib/config/` — shared vocabulary and prompt configuration: chat modes, reasoning efforts, MCP tool-name matching, starter suggestions, models, prompts, allowed tools.
- `packages/util/src/citations.ts` — the shared, React-free Markdown citation
  parser and opt-in `[n]` marker transformer used by response-example checks
  and rendering. The student chat renderer keeps its app-local plugin.
- `src/lib/markdown/remarkCitationMarkers.ts` — the remark plugin that rewrites `[n]` and contiguous
  `[n–m]` markers into citation links.
- `src/lib/toolOutput.ts` — live-SSE tool-result normalization (the streaming half of the provider-error redaction boundary).
- `src/lib/attachments/` — image attachment adapter plus attachment state and UI helpers.
- Local model proxy: the `litellm` compose service (port 4000).
- Local MCP fixture: `scripts/local-mcp-server.mjs` exposes a deterministic,
  read-only `doc_query` tool on port 1417 for the seeded Benibot. It returns
  synthetic Banking and Finance excerpts for matching topic or practice
  queries, including source pages, and returns no sources for unmatched terms.
- Local runtime profiles keep these capabilities independent: `chat` starts
  the Chat/PWA/API/Auth app set, `ai` starts LiteLLM, and `mcp` starts the
  fixture. Use `chat,ai,mcp` for the complete synthetic model/tool path; plain
  `chat` intentionally starts neither optional capability.

## Owner-governed response examples

Klicker stores one canonical `ResponseExampleSet` per chatbot. Each current
example carries the exact `chatMode`, the student's message, a Markdown
reference answer, an intuitive response-style choice, an approval status, and
source/chunk/content-hash/citation-index/citation-anchor lineage. Approved
edits replace the current row immediately; there is no revision-history model.
The set digest changes with canonical example or lineage content, not reviewer
timestamps.

The owner-only GraphQL surface is the source of truth for lecturer review:
the owner can inspect the set, approve, edit and approve, or reject an entry.
Non-owners receive `null`, and no production GraphQL or chat runtime path
creates candidates or marks evidence eligible. Local/test fixtures may seed
synthetic candidates and evidence solely to exercise the review lifecycle.

The chat route returns an AI SDK UI message stream and passes
`consumeSseStream: consumeStream` to `toUIMessageStreamResponse`. Keep this
explicit when changing the transport: it keeps the UI stream's abort lifecycle
consumed so abort callbacks and partial-response handling can run. It does not
detach upstream generation from `req.signal` or guarantee completion after a
client abort. The root layout also declares
`interactiveWidget: 'resizes-content'` alongside `viewportFit: 'cover'`; this
is required for Android keyboard resizing because the thread viewport is the
only conversation scroller. The standalone composer remains in the thread's
flex layout so expanded text, attachments, and errors reduce the viewport
instead of covering its final content; only embedded mode keeps the compact
overlay treatment.

The OpenAI-compatible `provider.chat(...)` path uses an aligned AI SDK 7 patch
train: `ai@7.0.52`, `@ai-sdk/openai@4.0.30`, and `@ai-sdk/mcp@2.0.25`, which
resolve `@ai-sdk/provider-utils@5.0.21`. The earlier provider-utils `5.0.12`
tracker stored streamed tool calls in an index-addressed array; a first tool
call at provider index `1` left a sparse entry that crashed during stream flush
with `hasFinished` read from `undefined`. The deterministic public-provider
fixture in `apps/chat/test/openai-chat-streaming.test.ts` covers this boundary
with injected SSE. A green fixture proves the local provider conversion path;
it does not replace a real-upstream first-turn staging smoke test.

## Provider request cache boundaries

The chat route keeps two cache mechanisms separate. `getModel` constructs a
default OpenAI-compatible provider or a chatbot-specific custom provider, and
`createOpenAIFetch` adds LiteLLM's exact-response bypass only to the default
provider request: `cache.no-cache` and `cache.no-store` are both `true`.
Custom endpoints retain their existing request fields. The same fetch boundary
continues to normalize assistant items for Responses requests.

A chatbot with a custom API key is treated as custom routing even when it has
no custom base URL and therefore still reaches the shared gateway. That
key-only path intentionally receives neither the default exact-response bypass
nor the default prompt-cache identity.

For default requests, `POST` passes the final `systemPrompt`, requested
deployment identity, transport family, and MCP tools to
`buildPromptCacheRequest`. The helper hashes only a versioned canonical
provider-visible projection with SHA-256, then emits the provider-safe
`klicker:pc:v1:<50-hex-character-digest>` key and
passes it to the OpenAI provider. Tool execution functions, MCP clients,
participant/user/chatbot/thread/message/request identifiers, and raw tool-call
identifiers are not identity inputs. Tool input examples are excluded because
neither OpenAI transport serializes them. Tool provider options are excluded
for Chat Completions and limited to the OpenAI Responses options that reach the
request. The rebuilt tools retain runtime execution, and the route supplies
their deterministic `toolOrder` to both transport families.

Function-valued tool descriptions are resolved with an undefined tool context
for both the fingerprint and the provider request because this route does not
pass AI SDK `toolsContext`. Introducing context-dependent descriptions would
require extending this identity contract before they can participate safely.

The provider's implicit prompt-cache behavior remains the default; the route
does not override it with a deployment allow-list or an explicit
`promptCacheOptions.mode`. The route does not emit an explicit prompt-cache
breakpoint. The stable key is an optimization for provider cache matching, not
evidence of resolved router behavior or a provider cache hit.

`apps/chat/test/openai-cache-policy.test.ts` and
`apps/chat/test/prompt-cache-identity.test.ts` use synthetic, no-network Chat
Completions and Responses responses. They verify serialized cache fields,
canonical tool order, privacy-negative identity inputs, and the public AI SDK
`usage.inputTokenDetails` buckets for uncached, cache-read, and cache-write
tokens. The tests prove local request shaping and SDK response conversion only;
they do not prove LiteLLM, Redis, Azure OpenAI, router affinity, production
cache hits, latency, or cost savings.

## Auth guard pattern (route handlers)

The composed helper `withChatbotAuth(req, chatbotId)` (`src/lib/server/apiGuards.ts`) verifies the participant JWT, checks the published chatbot, and confirms that a `Participation` row exists for its course. It covers the standard `{ courseId: true }` case — use it for new routes and fall back to the individual guards only for a custom chatbot `select`. `getChatbotOr404` returns 404 for any non-`PUBLISHED` chatbot (`DRAFT`, `PENDING_APPROVAL`, `PAUSED`, `REJECTED`) and reads `status` as a guard-only field, so a participant can never reach an unpublished bot regardless of the projection a caller passes — the publication gate holds on every route (see [ADR 0020](./adr/0020-two-tier-chatbot-approval.md)). Existence of a `Participation` authorizes access; `isActive` is the leaderboard opt-in and is never part of this guard ([Domain model](./domain-model.md)). Participant identity comes from the same participant JWT cookies as the PWA ([Auth Model](./auth-model.md)); local chat dev therefore needs the backend's `APP_SECRET` and `DATABASE_URL` visible to the chat app, or cookies won't verify and Prisma can't load chatbots.

The embedded lecturer assistant is a separate route family under `src/app/api/manage/`. It verifies the lecturer's NextAuth cookie, mints a short-lived internal bearer token for `apps/mcp-lecturer`, and confirms signed draft proposals through the authenticated chat route. This is an internal service exchange, not an OAuth client flow; the complete trust boundary is documented in [Auth Model](./auth-model.md#lecturer-mcp-and-manage-assistant).

**One gate with two conditions covers the assistant, and it is enforced server side.** `isManageAiEnabled` in `src/lib/server/featureFlags.ts` requires the `ai-beta` GrowthBook flag _and_ the account's `aiFeaturesEnabled` column, which records that an administrator has a cost center to bill the resulting model usage to. It covers the launcher in `apps/frontend-manage` (`src/components/Layout.tsx`, `src/components/assistant/ManageAssistantWidget.tsx`), the `/manage` page in `apps/chat`, `POST /api/manage/chat`, the lecturer MCP tools that route loads, and `POST /api/manage/proposals/confirm` — so a proposal token minted while the gate was open stops being redeemable the moment either condition is withdrawn. The API routes evaluate it per request, so hiding the launcher is not what protects them.

The entitlement is read live from the database rather than from the session token, so withdrawing it takes effect on the next request instead of at the lecturer's next sign-in. It is administered by email on the Manage admin panel (`setAiFeatures`), separately from `privatePreview`: one decides which unreleased features an account may see, the other whether it may spend model budget.

`GET /api/manage/capabilities` is an authenticated, private, no-store advisory
preflight for the embedded welcome. It opens a short-lived lecturer MCP client,
classifies the actual session-filtered inventory as `draft-and-read`,
`read-only`, or `unavailable`, and closes the client within a bounded deadline.
The response exposes no tool names, scopes, configuration, or failure detail.
The client starts in the conservative unavailable state. While the preflight is
checking, the welcome stays neutral: it does not advertise persistence or flash
degraded no-save limits. Once the preflight settles, curated-index documentation
help and explicit no-save authoring remain available in degraded states, and the
client can retry without reloading the iframe. A client-side preflight deadline
intentionally settles as retryable unavailable instead of auto-retrying in the
background. Every chat turn repeats the same inventory classification; its
response header replaces stale preflight state, so the preflight never grants
write authority or promises a missing proposal tool. Chat requests reserve a
monotonic revision when they start, so only the latest-started response can
replace capability state even when concurrent responses finish out of order.
Before the inventory is passed to the model, the adapter keeps only the known read tools for
`read-only`, the known read and draft tools for `draft-and-read`, and no tools
for `unavailable`; unknown or mismatched tools fail closed so service-version
skew cannot contradict the advertised capability.

Evaluation fails closed. An unconfigured or unreachable GrowthBook yields `false` for every flag, which is what makes a dark deploy safe: an image built before the `NEXT_PUBLIC_GROWTHBOOK_*` repository variables were set carries no SDK connection and shows nothing. Where no GrowthBook exists at all — local development, the end-to-end suite — `FEATURE_FLAGS_FORCED_ON` and `NEXT_PUBLIC_FEATURE_FLAGS_FORCED_ON` name registered keys to force on. That override is honored only when the flag environment resolves to `development` or `test` and only when no SDK connection is configured, so setting it on a staging or production build turns nothing on.

The two chat surfaces also differ in how they handle a missing model key. The participant route falls back to `apiKey: process.env.OPENAI_API_KEY || 'no-key'` (`src/app/api/chatbots/[chatbotId]/chat/route.ts`), which the local LiteLLM proxy accepts, while `createManageAssistantModel` (`src/app/api/manage/chat/route.ts`) throws `OPENAI_API_KEY is required for the Manage assistant`. The devcontainer sets `OPENAI_BASE_URL` but no `OPENAI_API_KEY`, so the Manage assistant returns 500 there until the variable is set ([Getting Started](./getting-started.md#failure-signatures-fresh-clone--wrong-state)).

The Manage chat route authenticates before admitting work, and applies its per-lecturer rate limit only after it acquires the pod's request slot; a busy rejection therefore does not consume the lecturer's rate budget. It is excluded from the Next middleware matcher so Next does not clone and truncate the body at its default 10 MiB buffer; the route therefore owns the full stream and enforces a 16 MiB serialized-body ceiling. Both declared and chunked oversized requests fail with a generic `413`, a body that exceeds the 30-second read deadline fails with a generic `408`, and malformed or structurally invalid requests retain the generic `400`. The request shape remains capped at 50 messages and also bounds aggregate parts, text, and individual encoded image/data parts before AI SDK conversion or MCP/model work.

After the resource checks, the route uses the AI SDK's message validator before opening the lecturer MCP client. Browser-supplied system messages, unsupported user parts, non-user files, malformed tool states, and invalid image base64 are rejected. Every accepted message is reconstructed from allowlisted fields, dropping browser-owned provider metadata and other extra fields. Previous assistant prose is retained for conversational continuity, but browser-supplied assistant tool, data, reasoning, and file parts are removed before model conversion; only tool results produced inside the current server-owned MCP loop reach the model as tool history.

One narrow exception supports conversational revisions such as “make this question German” without trusting browser-owned proposal JSON. Validation extracts only the opaque token from the exact signed-proposal tool part. The route verifies its signature, issuer, expiry, purpose, subject, and schema without consuming the token's replay identifier, then reconstructs a bounded canonical proposal block for the system prompt. The block uses the same unpredictable per-request data fence and structural forgery neutralizer as lecturer MCP results, because signing proves provenance but does not make lecturer-authored question text a trusted instruction. Invalid, expired, foreign, or fabricated tokens are ignored and ordinary chat continues. Raw tool output, token metadata, and browser payloads never reach the model; only the confirmation route claims the replay identifier, so creating a draft remains single-use. This continuity lasts no longer than the existing 15-minute proposal token.

A total 60-second abort deadline covers body parsing, the MCP transport's actual composed fetch signal, model streaming, and the response-lifetime slot, because self-hosted Next does not itself enforce the route's exported `maxDuration`.

Signed question proposals render as static lecturer reviews rather than interactive student previews. Choice questions show every option with explicit “Correct” or “Incorrect” text and its answer feedback; free-text questions show sample solutions and response-length restrictions. Both forms show the general explanation and use the sanitized Markdown renderer. The raw canonical JSON remains available only as an optional disclosure for diagnosis.

The Manage embed is an in-session assistant dock, not a history surface. Closing and reopening the dock preserves its mounted runtime, while **Start a new conversation** clears the current assistant-ui thread plus unsent text and attachments after an inline confirmation when content exists. Reloading the page still starts a fresh runtime; there is no durable lecturer chat history, thread list, database model, or retention contract. The composer is an in-flow sibling of the transcript so a long proposal can scroll fully above it instead of being clipped by an overlay.

The parent Manage shell treats the validated context-ready message as the only
readiness signal. A bounded deadline changes an unanswered load into an honest
“taking longer” state while keeping the iframe alive so a late valid handshake
can recover it. Retry remounts exactly one embedded iframe generation; an
actual iframe load error uses a separate failed state. Both states retain
close, Escape, retry, and a standalone fallback explicitly labelled as a new
conversation without the current page context. The focused local
`chat,manage` devrouter profile starts and probes `mcp-lecturer`; the separate
`mcp` profile remains the deterministic read-only fixture.

Inline base64 images make parsing memory-intensive. Only one Manage request per Chat pod may enter the body/model path at a time; an overlapping authenticated request receives a generic retryable `503` before its body is read. Staging and production therefore request 200 MiB and limit the Chat pod to 400 MiB: a production-standalone probe with ten concurrent 15.5 MiB requests peaked at 235 MiB, below the 280 MiB (70%) risk threshold, with one parsed request and nine pre-read rejections. The Manage composer accepts at most two 5 MiB images so its largest supported request fits the route envelope; participant chat intentionally retains its separate three-image limit.

The Manage assistant's response-quality guardrails are part of the system prompt:
single-question or single-element lookups stay scoped to the requested status,
type, and content unless the lecturer asks for related metadata, and SC/MC
drafts must keep every option-feedback pair consistent with the stem and answer
key. The live evaluator measures these behaviors through E3 grounding and E4
proposal-quality judge cases; the current DeepEval 4.1.5 / `gpt-5.6-luna`
baseline is recorded in `evaluation/manage-assistant/README.md`.

## Student practice MCP (`apps/mcp-student`)

Participant practice questions reach the chat through a second FastMCP server, not through the chat's own Prisma access. `apps/mcp-student` (default port 7080, `/mcp`) authenticates a **participant** JWT minted by `mintParticipantMcpJwt` (`src/lib/server/mcpAuthMint.ts`) and reads element data through the persisted GraphQL client rather than Prisma (`apps/mcp-student/src/graphqlClient.ts`).

`verifyParticipantSession` (`apps/mcp-student/src/auth.ts`) requires four things of the token, not just a participant subject:

- `purpose: student-mcp`. Without it, an ordinary participant session cookie would open the MCP service directly: it is signed with the same secret, for the same subject, with the same `PARTICIPANT` role, and only the issuer value differed. The purpose claim is what makes "minted by the chatbot" an explicit assertion rather than an environment-variable coincidence.
- `role: PARTICIPANT`, so a lecturer token cannot cross over.
- `actor`, either `account` or `anonymous`, carrying which participant kind the chatbot is acting for (the same `AuthMode` distinction as `src/lib/server/ltiGuest.ts`, so an LTI guest stays visible to tool policy). Both kinds mint the same scopes today.
- at least one recognized scope (`student:practice:read`, `student:practice:submit`). Which tools a scope actually reaches is decided per tool: `toolDefinition` (`apps/mcp-student/src/toolPolicy.ts`) derives each tool's `canAccess` predicate from its own `rbacScope` entry, and fastmcp only puts a tool into a session's dispatch table when the session satisfies it — so a read-only token neither sees `submit_practice_stack_answer` in `tools/list` nor can call it by name.

`pnpm --filter @klicker-uzh/mcp-student smoke:negative` exercises those rejections against a running service (the lecturer service has a matching `smoke:negative`). Answers are addressed by short-lived signed `questionRef` values (`MCP_STUDENT_QUESTION_REF_TTL_SECONDS`, default 20 min), so the chat never handles raw element ids or answer keys.

Three properties matter when debugging it:

- The lookup runs **only in `tutor` mode** (`src/app/api/chatbots/[chatbotId]/chat/route.ts`); other modes never register `start_student_practice_quiz`.
- Student practice authorization requires a matching chatbot/course pair and an
  existing `Participation` row for the participant. `Participation.isActive`
  is only the course-leaderboard opt-in and must not gate MCP practice access.
- A failed lookup degrades silently: the route logs `Student practice lookup failed; continuing without quiz candidates` and answers without the tool. A missing practice quiz is therefore an infrastructure symptom, not necessarily a model one.
- `getStudentPracticeMcpUrl` falls back to `http://localhost:7080` **only** when `NODE_ENV=development`; in production an unset `MCP_STUDENT_URL`/`MCP_STUDENT_HOST` yields `null` and the feature is simply off. The devcontainer starts both `mcp-student` and `mcp-lecturer` through `package.json:dev:container`, so tutor-mode practice tools and lecturer tools are available without a separate MCP process.

## Model registry and credits

`chatModelRegistry.ts` loads `CHAT_MODEL_REGISTRY_JSON` (deployment override in `deploy/env-uzh-*/values.yaml`). The backend keeps its own copy of the registry in `packages/graphql/src/services/chatbots.ts` for the lecturer-facing allow-list; both pods receive the same `CHAT_MODEL_REGISTRY_JSON` from the one `.Values.chat.modelRegistry` source (`cm-chat.yaml` and `cm-backend-graphql.yaml`), and `apps/chat/test/modelRegistryParity.test.ts` pins the two built-in defaults against each other AND parses both deployed values.yaml registries through both consumers, so a missing or inconsistent usage classification in either deployment file fails CI. Registry gotchas that have caused production incidents:

Every registry entry carries an explicit `usageClass` (`BASE` or `ADVANCED`),
the server-derived classification of the model lane ([ADR 0020](./adr/0020-two-tier-chatbot-approval.md)).
`auto` is invariantly `ADVANCED` (both consumers reject any other class for
it). GPT-5.6 Luna is the only `BASE` model and the participant-credit fallback;
every other current model is `ADVANCED`. Both consumers reject external
registries that violate that invariant.
External registry JSON that omits `usageClass` normalizes to `ADVANCED` —
conservative, because a missing class must never imply base usage.

Registry costs use Azure Global Standard short-context USD prices per one
million input and output tokens, verified on 2026-08-24. The schema does not
model cached-input, cache-write, or long-context rates. Auto uses the accepted
rounded accounting rate of 1 input / 5 output from an observed 90% Luna and 10%
Sol generation mix; the exact weighted rate is 0.68 input / 4.08 output.
Classifier and embedding overhead remain outside the registry's selected-model
token fields.

The account usage foundation stores one row per owner + usage class + Zurich
calendar month in `ChatAccountUsage` (`packages/prisma/src/prisma/schema/chat.prisma`):
`monthStart` is a DATE (first calendar day, `Europe/Zurich`), `budgetCredits`
and `usedCredits` are `Decimal(18,6)` defaulting to zero, and the composite
primary key prevents duplicate account/class/month rows. Counters start at
zero at migration cutover. For each class, the newest configured budget at or
before the current month remains effective until it is changed. A prior-month
budget therefore carries forward with used credits reset to zero; only a class
with no history projects budget 0 / used 0. The Zurich month boundary
(including DST) is derived deterministically in
`packages/util/src/chatUsage.ts`.

`CHAT_ACCOUNT_USAGE_ENFORCEMENT_ENABLED` controls only the participant route's
pre-provider budget rejection and defaults to `false`. Turn lifecycle attempt
tracking has an independent default-off switch,
`CHAT_TURN_LIFECYCLE_WRITES_ENABLED` (`chat.lifecycleWritersEnabled`; see
[ADR 0041](./adr/0041-chatbot-trusted-pilot-boundary.md)). The Helm template
omits the runtime key while the writer gate is false, so an older chart cannot
accidentally enable it after a newer application is rolled back. With the
switch disabled, claims still create hidden markers with a null attempt token;
complete-only readers keep those markers out of history. A configured account
row is still recorded after a completed provider response even when neither
switch is enabled. Enabling each switch is a separate operational cutover
decision for a named environment and cohort.

The lecturer-facing GraphQL API projects the effective account month through
`getChatAccountUsage` as exactly `baseModelUsage` and `advancedModelUsage`.
Each lane returns its fixed usage class, budget, used credits, non-negative
remaining credits, and the exact next Zurich reset instant. Missing rows become
zero-valued lanes only when no budget was ever configured; otherwise, an absent
current-month row carries the latest budget and resets used credits. The outer
`authorized` field always reflects the live account capability. An
`ACCOUNT_OWNER` can access only its own account; an `ADMIN` can supply a target
owner ID. Other lecturer login scopes are denied by the service. Participant
roles are denied by the schema, while the service repeats the role and scope
checks as a direct-call safeguard.

`setChatAccountUsageBudgets` is an `ADMIN`-only operations mutation and requires
an explicit target owner ID. It validates both values against the shared
`Decimal(18,6)` credit contract and upserts the current BASE and ADVANCED rows
in one transaction. It changes only `budgetCredits`, preserving existing or
concurrent `usedCredits`. A newly created month becomes the latest configured
limit for subsequent months; a disabled account cannot write. The API
deliberately has no cost-center, contribution, provider, settlement,
participant-credit, or per-model fields.

The lecturer settings page requests this overview only after confirming an
`ACCOUNT_OWNER` login scope. It shows two responsive lanes labelled “Base model
usage” and “Advanced model usage” in English, with fixed German equivalents.
Each lane names its configured credit estimate, used and remaining credits,
reset date, and empty or exhausted status. The configured budget is a soft
planning target, while the reset date is exact; in-flight requests may exceed
the target. It is read-only for account owners, and it does not expose
internal funding or provider details.

The deployed Klicker Auto option is a LiteLLM `auto-router` endpoint. The
only in-repo record of its tier map is the comment above `modelRegistry` in
`deploy/env-uzh-{stg,prd}/values.yaml`: SIMPLE = `gpt-5.6-luna-medium`, MEDIUM
= `gpt-5.6-luna-high`, COMPLEX = `gpt-5.6-luna-xhigh`, REASONING =
`gpt-5.6-sol-medium` (match_threshold 0.55). The authoritative router
configuration lives in the external AI deployment repository's
`litellm/config.yaml` and **cannot be verified from this repository** — treat
the values.yaml comment as the best available record and confirm against the
deployment before making a routing claim. The deployed registry also exposes
direct `gpt-5.6-luna` through the existing
`klickeruzh/azure/gpt-5.6-luna` alias; the router's effort targets remain
internal.
Both staging and production now use `auto` as the global automatic-model
primary, so chatbots using automatic model selection use Auto by default.
Chatbots with an explicit model selection can continue using that selection.
Keep the `v3-ai` staging values aligned with this block when resolving merges:
`CHAT_PRIMARY_MODEL_ID=auto`, the `auto` registry entry targets
`klickeruzh/azure/auto-router`, and that entry sets `usesResponsesApi: true`.
This repository controls those consumer values but does not prove that the
external LiteLLM key or team is authorized for the deployment.
Model registry capabilities separate the student-facing reasoning-effort
selector from the provider protocol: `supportsReasoning` controls whether the
effort picker is offered, while `usesResponsesApi` selects OpenAI Responses so
reasoning summary parts can stream. When `usesResponsesApi` is omitted it
inherits `supportsReasoning`, preserving older registry JSON and existing
reasoning models. Auto sets only `usesResponsesApi: true`, so its routed tier
keeps ownership of effort instead of accepting a participant override.

The local devcontainer simulation in `util/litellm/config.yaml` mirrors the
deployed Klicker Auto V2 policy and semantic corpus with local, unprefixed model
aliases: Luna medium/high/xhigh for SIMPLE/MEDIUM/COMPLEX and Sol medium for
REASONING. It deliberately retains the generic
`UPSTREAM_OPENAI_BASE_URL`/`UPSTREAM_OPENAI_API_KEY` boundary instead of
production Azure URLs, model prefixes, secrets, or failover topology. Local
Auto Mode is therefore evidence about the wiring and policy simulation, never
live production routing. The local chat registry maps the user-facing `auto`
model id to the `auto-router` LiteLLM deployment and exposes `gpt-5.6-luna` for
a direct comparison. The seeded Benibot fixture allow-lists all three active
options — `auto`, `gpt-5.6-luna` and `gpt-4.1` — explicitly, so it satisfies
the strict model allow-list. The zero-credit safety fallback may use Luna even
when that allow-list omits it.

The local LiteLLM service pins
`ghcr.io/berriai/litellm-database:v1.96.2` by immutable multi-platform digest,
has a healthcheck, and is included in
`.devcontainer/devcontainer.json:runServices`. Auto V2 uses Luna low for its LLM
classifier and `openai/text-embedding-3-small` for semantic corpus matching,
then invokes the selected answer model. With an OpenRouter upstream, all of
those requests cross the same external provider boundary and add latency and
usage cost. A model call still requires the operator's local
`UPSTREAM_OPENAI_API_KEY`; without it, verify service health, model exposure,
picker state, and request error handling, but do not claim an end-to-end answer
stream.

Local LiteLLM enables `LITELLM_REASONING_AUTO_SUMMARY` for the Responses path.
That maps each routed alias's fixed `reasoning_effort` to a visible summary
without adding a request-level effort that would flatten Auto's Luna/Sol tier
policy. The deployed LiteLLM configuration is external; a local summary proves
the development path only, and staging still needs a Responses + tool-loop
smoke test before a production compatibility claim.

One account-level AI usage authorization, backed by an approved cost center,
covers both model classes: the Phase 0 lifecycle foundations now store an
account-scoped monthly budget and used-credit counter per `BASE` and
`ADVANCED` class in `ChatAccountUsage`. Operations manages account-wide
monthly budgets through the `ADMIN`-only mutation, while account owners see
exactly two read-only lanes — base model usage and advanced model usage — with
budget, used, remaining, and reset date. The teaching center's limited base
contribution is internal and hidden; advanced usage receives no contribution.
When account usage enforcement is enabled, class exhaustion disables only that
class and never triggers an automatic cross-class switch. Participant-facing
APIs must then return stable class-specific exhaustion codes without cost-center
or hidden funding fields.

`apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts:POST` resolves the
effective model and its server-derived usage class. When account usage
enforcement is enabled, it then reads the live account authorization and
effective owner/class/Zurich-month usage before thread creation, image
description, message persistence, or provider streaming. The latest configured
budget at or before the current month applies, with used credits reset to zero
when it carries forward. This availability pre-check runs only when
`CHAT_ACCOUNT_USAGE_ENFORCEMENT_ENABLED=true`. Under that setting, a
disabled authorization, class with no configured history or a zero budget, or
exhausted class fails closed with HTTP `403` and either
`CHAT_MODEL_UNAVAILABLE_BASE` or `CHAT_MODEL_UNAVAILABLE_ADVANCED`. The response
never exposes budgets, used credits, cost centers, contributions, providers, or
settlement details. Exhausting one class neither disables the other nor invokes
fallback. With the default-off setting, the route skips this rejection while
retaining lifecycle claims and post-completion accounting for configured usage.

The client-supplied assistant message ID remains the lifecycle row key, and the
user message ID scopes a normal turn. `apps/chat/src/services/accountUsage.ts:claimChatTurn`
validates the thread, chatbot, and owner. In R2, when lifecycle writers are
enabled, it inserts an `IN_PROGRESS` assistant placeholder with a per-attempt
UUID before MCP, image, or provider work. In R1, when lifecycle writers are
off, it inserts the same hidden placeholder with a `null` attempt ID.
Complete-only history reads keep either placeholder away from participants, and
failed or empty R1 attempts delete it. A PostgreSQL transaction advisory lock
keyed by thread and parent serializes normal claims, so concurrent requests for
one user turn cannot create multiple provider attempts. Explicit regeneration
sends an opt-in flag and may create a sibling answer. Failed R2 attempts may be
reclaimed with a new UUID. Both modes reject duplicate or in-progress keys with
the generic `409` behavior described below.

`apps/chat/src/services/accountUsage.ts:finalizeChatTurn` is the single
charging boundary. In R2, it updates the matching `IN_PROGRESS` or `FAILED`
attempt to `COMPLETED`. In R1, it updates the matching hidden `IN_PROGRESS`
placeholder to `COMPLETED` under the same thread-plus-parent lock. In either
mode, one non-empty completed answer also increments the owner/class/month
counter by its rounded six-decimal credit value and updates the thread timestamp
in one `ReadCommitted` transaction. In R1, a successful empty completion deletes
the hidden marker and is not charged; in R2, it closes the existing placeholder
as an empty completed message and is not charged. Duplicate completion returns
the stored result without charging again; a foreign or mismatched key conflicts.
A normal finish and an abort use this finalizer once, and a late `onEnd` after an
abort is ignored. Missing reliable main-stream usage still closes the message
key with `creditsUsed = null` and no account charge. History reads hide
`IN_PROGRESS` and `FAILED` placeholders. The availability check is not a
reservation, so the bounded final-turn and concurrent overrun accepted by
[ADR 0041](./adr/0041-chatbot-trusted-pilot-boundary.md) remains possible; the
next request then fails its live check.

The existing `ChatUsageCredits` balance remains a separate participant
allowance. Its decrement is part of the `finalizeChatTurn` transaction together
with the completed message and account usage, so a failed debit rolls back the
other two writes and a duplicate completion cannot debit twice. At zero
participant credits, the route switches from any effective model to GPT-5.6
Luna and clamps its effective usage class to `BASE` before enforcement; Luna is
therefore charged only through its `BASE` account lane and the participant
allowance. This fallback intentionally does not require the chatbot allow-list
to contain Luna. Automatic selection otherwise retains Auto and is attributed
to `ADVANCED`; the credits response keeps allow-listed model capabilities
visible independently of the participant balance. Strict reservations,
immutable ledgers, automated refunds, invoices, per-chatbot allocation, and
participant-credit migration remain deferred.

- Omitted `supportsImageAttachments` defaults to **false** — every image-capable model must set it explicitly in deployment values or the attach button disappears.
- The zero-credit participant path uses GPT-5.6 Luna as the base-lane fallback
  even when the chatbot allow-list excludes it. The registry must contain a
  `fallback` GPT-5.6 Luna `BASE` entry; the route denies the turn only if that
  entry is absent. Retired model IDs in persisted allow-lists are ignored, and
  an automatic chatbot with no current allowed model resolves to Luna. The
  chart still emits `CHAT_FALLBACK_MODEL_ID` for mixed-version compatibility
  and the one-off maintenance script, but the current Chat runtime ignores it.
  `CHAT_PRIMARY_MODEL_ID` controls automatic primary selection; the participant
  safety fallback is always Luna.
- OpenAI Responses backends: keep `CHAT_OPENAI_STORE_RESPONSES=true` in shared/staged deployments — with `store: false`, LiteLLM/Azure can return "item not found" when a model references prior response items across tool-call steps. Local OpenRouter-style setups can leave it false.

Credit fields are Prisma `Decimal` — never truthy-check them ([Data & Migrations](./data-and-migrations.md)).
`src/stores/settingsStore.ts:loadCredits` accepts only the latest request generation, so a late
response from another chatbot cannot expose stale credit/model state as current. `creditsLoaded`
is sticky once a load has succeeded: a refresh (including a failing one) keeps the last known
balance on screen instead of hiding the footer for the rest of the session.

The settings panel translates model capabilities into student-facing descriptions. It does not
render deployment registry descriptions, because those can expose provider or router terminology
and are not localized. Automatic, reasoning, general-purpose, and fallback models each have a
localized explanation in `packages/i18n/messages/en.ts` and `de.ts`; the read-only automatic
selection state uses the same plain-language contract. Known Tutor, Explainer, and Quizzer modes
use their platform-owned localized purpose descriptions in `src/components/mode-switcher.tsx`;
custom modes use their configured description.

`src/lib/server/effectiveChatModes.ts` is the server-authoritative mode seam. It composes platform
defaults with stored per-mode overrides and custom modes, honours `enabled: false`, excludes modes
that cannot satisfy the chatbot's required-MCP policy, and exposes Quizzer only with a provably
restricted course `doc_query` binding. Exact Quizzer configuration shadows Tutor inheritance per
MCP server, including disabled exact rows; inherited optional bindings are narrowed to
`doc_query`, while required single-tool aliases preserve their raw tool restriction and remain
fail-closed. The layout, participant settings endpoint, chat request validation, and request-time
MCP selection all use this resolver. The browser receives resolved mode descriptions but never
MCP server configuration. If explicit opt-outs leave no effective mode, the client replaces the
composer with a localized unavailable notice and suppresses edit and retry generation actions
instead of allowing requests the server would reject.

Platform standard-mode contract changes apply automatically to every chatbot that exposes that
mode. Stored standard-mode text remains lower-priority lecturer guidance rather than replacing
the contract; no stored prompt migration is required. Stage 1 Quizzer chooses one specific grounded
practice topic when the student's request is unclear and asks for simple confirmation rather than
presenting only an unprioritised menu. Agreement or no preference starts the first question. It then
presents one concise, exam-style course question at a time from retrieved course material without a
provenance label. It gives brief criterion-linked formative feedback after each completed attempt,
names a correct aspect only when supported, and otherwise states neutrally that no strength is yet
supported. It then continues automatically. On request, it gives a formative snapshot based only on
completed question-and-answer cycles visible in the conversation; fewer than two cycles are
described as too little evidence for a reliable pattern. After at least three completed cycles on one
established topic covering at least two distinct course-grounded criteria, with no hint or retry
pending, it gives a practice checkpoint with evidence-supported strengths (or a neutral statement
that none is yet supported), next focuses, and one concrete practice action before asking
whether to change topics or explore the current topic in more depth. If two distinct criteria cannot be
identified from the visible attempts and grounded material, it does not issue the automatic
checkpoint. This checkpoint is explicitly a short-round snapshot, not a claim that the topic is
complete, and it does not use grades, proficiency, mastery, or other broad ability claims. Quizzer
never infers coverage from retrieval exhaustion or a partial list of retrieved topics. It does not
present questions as lecturer-authored or exam-equivalent. Chatbots without a safe course retrieval
binding do not expose
Quizzer. If an optional binding produces no `doc_query` tool during request-time discovery, Quizzer
returns the required-tool-unavailable response instead of generating an ungrounded question. Once
discovered, the route requires that document-query tool on Quizzer's first model step, then restores
automatic tool selection for later steps. Optional retrieval outages can still degrade gracefully in
Tutor and Explainer. No stored prompt or database migration is required.

In the sidebar layout, `src/components/credits-footer.tsx:MobileCreditsBar` keeps the legacy
participant usage-credit balance visible below the header at mobile widths, even while the
design-system sidebar drawer is closed. When the balance reaches zero, it states
that some models may no longer be available; the runtime never silently
switches between base and advanced classes.
The bar is rendered only by `SidebarMain`; embedded mode continues to use its existing
`EmbeddedCreditsBar` so the two compact readouts are never shown together.

Two further credit conventions are easy to break:

- `getNextResetTime` (`src/utils/creditPeriods.ts`) returns **`null` for
  `CreditResetPeriod.NONE`** — meaning "never refills", not "date unknown".
  Consumers must branch on the null rather than pass it to a date formatter;
  the footer renders the localized `chat.credits.resetNone` copy ("These credits
  do not refill automatically") for that case.
- The credits footer is **absent, not zeroed, until the first successful credits
  fetch**: `credits-footer.tsx` returns `null` while `creditsLoaded` is false, so
  the initial load shows nothing instead of a misleading `0`. After that first
  success the footer stays visible with the last known balance, even if a later
  refresh fails.

## Theming and design tokens

Chat carries the UZH brand through the shadcn semantic tokens in `src/app/globals.css` (`--primary` = `#0028a5` etc.), not through per-component colours. Two rules:

- **The light token block must be `:root:root`, not `:root`.** A dependency stylesheet (assistant-ui) defines the same shadcn tokens at plain `:root`, and its chunk loads _after_ `globals.css`, so an equal-specificity block silently loses the cascade and the brand colour never applies. Raising it to (0,2,0) outranks the dependency's (0,1,0).
- There is no dark mode: a latent `:root.dark` block plus its `@custom-variant dark` was removed (D1) because nothing in the app ever applied a `.dark` class, and the forced-on preview was half-broken anyway (sidebar/composer/footer stayed light; `--primary` fell back to shadcn's default gray instead of UZH blue). Wiring dark mode properly would be a separate feature with its own plan.
- Use the semantic tokens (`bg-muted`, `border-border`, `text-foreground`) rather than raw `gray-*`/`slate-*` utilities, or the surface stops following the theme. Note that `text-muted-foreground` on `bg-muted` computes to ≈4.4:1 — below the WCAG AA floor for body text; use `text-foreground` for text that sits on a muted surface.
- `@uzh-bf/design-system`'s `SidebarTrigger` and `SidebarRail` render a hardcoded English
  `sr-only` "Toggle Sidebar" label. Pass an explicit localized `aria-label`; it wins the
  accessible-name computation.
- The design system's `Select` renders a Radix `SelectTrigger` — a real `<button role="combobox">`, so a plain `<label htmlFor>` does name it. Without that, the combobox's accessible name is whatever value is currently selected, which leaves several selects on a panel indistinguishable. Pass `id` to `Select` (it forwards to the trigger) and point the visible label at it.
- Tooltips (`src/components/ui/tooltip.tsx`) are the neutral popover style — `bg-popover text-popover-foreground border shadow-md` — not inverted brand blue. Anything rendered _inside_ a tooltip must use foreground/muted-foreground tones; `text-primary-foreground/70`-style spans were readable on the old blue surface and invisible on the white one. The arrow's `border-b border-r` assumes `side="top"`, which is the only side the app uses.
- Hover states on saturated color surfaces must **darken**, not alpha-lighten: `hover:bg-destructive/90` drops white-on-red text below AA (~3.5:1), so the declined-screen button uses `hover:brightness-90` instead. Blue (`bg-primary`) tolerates `/90`; red does not.

## Runtime and student-visible states

The chat branch uses `@assistant-ui/react` 0.15's stable `GroupedParts` primitive. Local
composition lives in `src/components/message-parts.tsx:AssistantMessageParts`: adjacent
reasoning parts share one disclosure, adjacent tool calls share one group when there is more
than one, and a single tool call keeps its direct result disclosure. These trace rows use the
same compact spacing, with 24px controls by default and 44px touch targets on coarse pointers.
Reasoning rows use a brain icon, while tool rows use their current status icon; both reserve the same
leading icon slot so their labels share one column.
Reasoning auto-opens only while active until the participant manually chooses an open state; that
manual choice then wins.
The source-card section is derived from completed `doc_query` tool results but
stays hidden for the full time the same assistant message is actively running,
including after answer text begins. This lets the viewport follow the growing
answer instead of jumping over it to a large source grid. When the turn becomes
terminal, resize-driven bottom scrolling switches off and the section fades
in. If the participant was following at the bottom, only the source heading is
scrolled into view; a large grid never jumps directly to its final card. If the
participant had scrolled up, their position is preserved. Terminal incomplete,
aborted, and tool-only turns still show valid completed sources instead of
losing them on reload. The source component suppresses the section when
normalization produces no sources.
The runtime render boundary is deliberately narrow: `RuntimeProvider` selects only the active
thread's messages/running state and the actions it calls, while `Thread` renders its message rows
through the assistant-ui 0.15 children renderer and passes the chatbot avatar through context. Runtime
attachment adapters are memoized as well, so a streamed message or a feedback update does not
replace every message row's component type or adapter object. Ratings have one owner: the plain
buttons in `thread.tsx` read the active `ChatMessage.rating` from `chatStore` and call
`chatStore.rateMessage` for set, switch, and clear; assistant-ui's feedback adapter is not used.
This preserves the store's optimistic persistence, per-message request serialization, and rollback
without a second runtime-owned feedback state competing with it. AI SDK 7 powers the server route
(`ai`, `@ai-sdk/openai`, and `@ai-sdk/mcp`); `src/hooks/useChatResponse.ts` remains the client
transport because the spike-gated `useAISDKRuntime` replacement could not be live-verified without
an LLM key.

The history rail is a derived navigation view over `activeThread.messages`, which is the current
branch path reconstructed by `chatStore.switchToBranch`. It never reads `allMessages`, persists
anything, or renders sibling branches. Adjacent user and assistant messages are projected into one
turn landmark; user-only and assistant-only messages remain navigable as orphan turns. On desktop
("md" and up) the rail is a vertical column of bounded ticks, one per turn (or per bounded turn
range); each tick targets a stable message-root focus target and exposes the complete user message
and assistant response in an on-demand hover/focus popover. On mobile the tick strip is replaced by
a single 44px trigger button (current turn / total) that opens the same history dialog used by the
desktop current tick — precision tick targets do not meet touch guidelines, so the dialog is the
only mobile navigation surface. Reasoning, tool calls, and client error parts stay in the transcript
and influence the turn status, but do not create rail landmarks or part anchors. Details appear only
on hover or focus.
Entry activation scrolls and focuses the matching transcript target, while a token-guarded
programmatic-scroll lock prevents the scroll spy from changing the highlighted turn mid-navigation.
On mobile, activation also preserves the trigger's top gutter so the selected message is not
covered by the history control.
The projection normalizes running, partial, and error states so loading, aborted, and incomplete
turns remain navigable without duplicating message rows; a persisted `chat-stopped` data part maps
its turn to the `partial` status. Tick and dialog labels go through `toHistoryRailPlainText`
(`src/lib/history-rail.ts`), which strips Markdown, collapses whitespace, and truncates to 100
characters, so assistive tech never reads raw Markdown syntax; the full Markdown text remains
available in the hover/focus popover body.

## Participant entry points (course page)

Participants reach a chatbot from the shared PWA header (`apps/frontend-pwa/src/components/common/Header.tsx`)
on any course page on v3 (`/course/[courseId]/…`) without any v3-ai dependency.
The header runs `GetCourseChatbots` (`courseChatbots(courseId)` query backed by
`getParticipantCourseChatbots` in `packages/graphql/src/services/chatbots.ts`)
and renders an "AI tutor" button (`data-cy="student-course-chatbot-link"`) next
to the home/back button when the caller is a participant of the course. The
button is a real anchor (`<Link target="_blank" rel="noopener">` wrapping the
design-system `Button`, the same pattern as the sibling home button), so
middle-click and copy-link behave as expected. The data model and query can
return multiple published chatbots, ordered by name and then creation time, but
the current PWA exposes only `courseChatbots[0]` as its single header
button. `Chatbot` carries no ordering field. It does carry a publication `status`
(`DRAFT`/`PENDING_APPROVAL`/`PUBLISHED`/`PAUSED`/`REJECTED`, see
[ADR 0020](./adr/0020-two-tier-chatbot-approval.md)) that gates participant
visibility — only `PUBLISHED` bots are reachable — but that is a visibility
gate, not a way to order or select among multiple bots. Lifting that limit means
deciding the multi-chatbot affordance first — the header row does not wrap and
the design-system button is `shrink-0`, so several buttons would squeeze the
course title on a narrow viewport.
The query is deliberately **not** `withAuth(asParticipant)`: course pages are
publicly reachable, and a scope error would surface as the literal message
`Unauthorized`, which the PWA `errorLink` (`apps/frontend-pwa/src/lib/apollo.ts`)
turns into a hard redirect to `/login?expired=true` for every anonymous visitor
and every logged-in lecturer. Instead the resolver mirrors its page siblings
`getCourseOverviewData` and `getStudentCourseLeaderboard` — a public field whose
service returns `[]` unless the caller is a `PARTICIPANT` with a `Participation`
record for the course. Each button opens the existing PWA deep-link route
`course/[courseId]/chatbot/[chatbotId]` in a new tab, which redirects to login
when needed, runs `ensureParticipation` server-side, and then 302-redirects to
`chat.klicker.uzh.ch/<chatbotId>`. The public GraphQL shape is `ChatbotPublic`
(`id`, `name`, `description`, `avatar`) and matches the v3-ai blueprint so a
later v3-ai sync reconciles without a diff. That sync is sequenced by
[ADR 0007](./adr/0007-reintegrate-v3-ai-behind-feature-flags.md): v3 merges into
v3-ai first, and v3-ai comes back into v3 with its surfaces flagged default-off.

## Lecturer authoring and publication contract

The owner-facing GraphQL contract lives in
`packages/graphql/src/services/chatbots.ts`. Catalyst or full-access lecturers
can create a course-bound `DRAFT` chatbot before their account is authorized to
publish. The course is fixed after creation. Metadata and model policy are
editable in `DRAFT`, `REJECTED`, and `PUBLISHED`; they are read-only in
`PENDING_APPROVAL` and `PAUSED`. Disclaimer content is editable only in
`DRAFT` and `REJECTED`.

`saveChatbotDisclaimer` accepts the lecturer-editable title and introduction
plus the disclaimer ID the client loaded. It normalizes line endings and outer
whitespace, validates both fields, and rejects introduction Markdown outside
paragraphs, bold, italic, ordered or unordered lists, and line breaks. It then
uses transactional copy-on-write. The replacement retains the internal name,
description, and media fields. A stale expected ID fails with
`CHATBOT_DISCLAIMER_CONFLICT`, and a normalized no-op keeps the existing ID.
This preserves the participant acceptance contract: acceptance and Manage's
accepted count apply only when
`acceptedDisclaimerId` equals the chatbot's current disclaimer ID. See
[ADR 0042](./adr/0042-version-chatbot-disclaimers-by-replacement.md).

`requestChatbotPublication` still requires the live account capability from
[ADR 0020](./adr/0020-two-tier-chatbot-approval.md). It additionally requires a
linked, non-empty disclaimer before moving a `DRAFT` or `REJECTED` chatbot to
`PENDING_APPROVAL`. A dedicated Boolean query exposes only this live capability
to Catalyst and full-access lecturers; it does not expose account budget data.
Submission never publishes automatically; the existing administrator approval
remains a separate transition.

Manage exposes draft preparation through
`apps/frontend-manage/src/components/resources/Chatbots.tsx`: creation is
limited to the lecturer's owned, non-archived courses, and the newly created
chatbot is selected immediately. The workspace keeps chatbot selection in a
persistent desktop rail and a compact mobile selector. Its URL identifies the
selected chatbot plus the `overview`, `setup`, `advanced`, or `usage` view; the
setup view optionally uses `step=basics`, `step=disclaimer`, or `step=review`
as the initial accordion section hint. Invalid deep links fall back to the
first valid lifecycle view or section. Published chatbots preserve any valid
setup-section hint while keeping their read-only Disclaimer and Review
contracts.
Navigation, chatbot switching, and creation protect unsaved Formik, Slate, and
model-policy changes, and block while an affected mutation is pending.

Draft and rejected chatbots use the setup view as one page with a multiple-open
accordion containing Basics, Disclaimer, and Review and submit. Each section
keeps its form mounted when collapsed, so unsaved Formik and Slate input remains
available while lecturers inspect another section. Basics saves the name and
description, Disclaimer saves the lecturer-written introduction while showing
the fixed participant preview, and Review and submit summarizes the saved
configuration before showing the publication request form.
The course remains read-only after creation. Publication inputs are preparation
fields in the Review and submit section and persist only when the lecturer submits the existing
publication mutation. A successful Basics or Disclaimer save opens the next
accordion section after the refetched chatbot is complete. Edit actions in the
review section open the relevant accordion section, while the workspace
navigation guard still prevents dirty or pending changes from being discarded
silently.

The selected course is read-only. Name, description, and model settings follow
the metadata lifecycle matrix above; the disclaimer title and introduction are
editable only for `DRAFT` and `REJECTED` chatbots. `ContentInput` keeps its full
toolbar by default and uses the `basic` preset for disclaimer introductions,
retaining simple formatting while omitting media, video, math, code, and quote
controls. The lecturer preview renders the fixed `chat.disclaimer.*` sections
without participant actions, and its Slate editor remounts when either the
chatbot or current disclaimer ID changes so a selection change cannot retain
stale text.

The publication section keeps `DRAFT` and `REJECTED` request details editable
for preparation, but enables submission only when a complete disclaimer, the
live account publication capability, and clean, settled Basics and Disclaimer
forms are present. While publication is pending, those sibling forms are
locked so late edits cannot be lost during the lifecycle transition.
`PENDING_APPROVAL`, `PAUSED`, and `PUBLISHED` chatbots show read-only
publication details, while a rejected request retains its review comment for
correction and resubmission.

Initial thread and message loading uses skeleton rows and message-shaped placeholders, and an
empty running assistant message shows a localized thinking indicator. Send/stream failures,
disclaimer action failures, and thread-list failures are localized with retry affordances where
the action can be retried. Asynchronous disclaimer failures render in a live `role="alert"`
region. The required disclaimer is a deliberate consent gate: the modal has no close or Escape
exit, the consequence summary appears before the Accept/Decline actions, and Accept is the
primary action. Students must choose one of those two explicit outcomes. Stream/send errors
inside a message render as a styled callout, not inline markdown:
`useChatResponse` pushes a `{ type: 'data', name: 'chat-error', data: { errorLabel, message } }`
content part (assistant-ui's official `DataMessagePart` shape) and `message-parts.tsx` renders it
as `ChatErrorPart` (`data-cy="chat-message-error"`). The error convention is client-side only —
`chat-error` parts never persist (the `chat-stopped` marker under Client-state gotchas is the
persisted exception) and `serializeMessageContent` excludes data parts from the model-visible
history, so an error label can never leak into a follow-up prompt. A `hasStreamError` guard keeps the
partial text from being re-pushed alongside the error part. Truncated responses append the
localized `chat.response.truncated` notice, and a failed image-attachment read surfaces the
typed `AttachmentAdapterError` from `imageAttachmentAdapter.ts` as a localized composer error
rather than a stringified `ProgressEvent`. A cached thread list intentionally remains visible if only its background refresh fails.
The welcome view contains localized, mode-aware starter suggestions: Tutor offers interactive
practice prompts for a specific topic or pasted problem, while Explainer offers source-oriented
explanations of a specific concept or comparisons between two concepts. The prompts are inserted
into the composer without sending and use complete, editable wording rather than raw bracket
templates. The starter panel tells students to adjust the wording before sending. Broad
whole-course summaries and study plans are intentionally not offered here; a reliable planner
needs a separate structured planning flow and tool/result budget. Chatbot-scoped mode descriptions
are supplied with the initial shell, so the welcome view and starters do not wait for the settings
request or briefly render the wrong persisted mode. A genuine configured description, including an
empty one, overrides the localized generic mode explanation; the synthesized Tutor fallback keeps
the localized generic copy. On an empty thread, the selected-mode card also renders the same mode
switcher as the header, so participants can change modes before choosing a starter. Message action bars
remain mounted for touch users rather than relying on hover. An unavailable image edit uses
`aria-disabled` instead of native `disabled`, so its explanatory Radix tooltip remains focusable.
Failed assistant turns, including silent stream interruptions, keep their own localized retry
callout but omit the normal reload and thumbs-rating actions and the relative timestamp, so an
incomplete answer is not presented as a finished answer ready for feedback.
Each thread row shows the thread's last chat mode as an icon plus localized label under the title
(`thread.lastChatMode` via `formatModeLabel`), and Markdown blockquotes in answers render as
amber info callouts (the `blockquote` override in `markdown-text.tsx`, which only assistant
messages render through — user text never gets the callout styling). A reply to an
image-bearing user turn carries a static "Image analyzed" / "Bild analysiert" chip
(`ImageAnalyzedChip` in `thread.tsx`, gated by the pure `parentMessageHasImageAttachment`
helper over the chatStore's loaded message list — the store, not the runtime message, because
the assistant-ui conversion moves `imageAttachments` into `metadata.custom`).

Assistant message persistence passes completed AI SDK steps through
`src/lib/server/persistedAssistantContent.ts:mapAssistantStepContent`. Successful text,
reasoning, tool arguments, and tool results remain intact. Both thrown `tool-error` parts and
MCP `tool-result` envelopes with `output.isError === true` persist only the generic
`Tool execution failed` result plus `isError: true`; never copy provider error messages or MCP
error bodies into `ChatMessage.content`. The live SSE path applies the same boundary through
`src/lib/toolOutput.ts:normalizeLiveToolOutput` before a result reaches `ToolFallback`.

The mobile layout exports `viewportFit: 'cover'`, keeps the standalone composer
in normal layout with bottom safe-area padding, wraps Markdown tables in
horizontal scrolling, and uses a compact mode dropdown in an overflow-safe
header grid. The Chat/Knowledge graph workspace switch appears once in that
header's right-hand control cluster in standalone and embedded layouts; the
sidebar and content area do not repeat it
(`src/components/assistant.tsx:SidebarMain`,
`src/components/assistant.tsx:AssistantLayout`). Embedded mode shows the
loading state and compact credit/model information through the shared settings
components. Direct thread URL
activation resynchronizes the thread's stored chat mode once per activation,
without overriding a mode manually chosen afterward.

Switching mode mid-thread affects **only the turns sent afterwards**, and the choice is not
persisted until the next send: a thread's stored mode is `lastChatMode`, derived from its most
recent message's `chatMode`, so a switch that is never followed by a message leaves no trace.
Whether that is the intended contract or the switcher should persist immediately is an open
product ruling (`project/2026-07-27-student-chat-v3-follow-up-roadmap.md`, W7 item 1). The
switcher is hidden entirely when a chatbot exposes a single mode — `mode-switcher.tsx` returns
`null` for one or fewer mode keys, so there is no disabled one-pill state to style.

## Runtime system-prompt policy

`src/lib/server/systemPromptCompiler.ts:compileSystemPrompt` treats stored text as configurable
lecturer influence, not as the complete system policy. On every chat request, after the available
MCP tool names are known, it composes the final prompt in this order:

1. server-sourced course data containing JSON-serialized `Course.displayName`;
2. lower-priority lecturer guidance for a standard mode, when stored;
3. the platform-owned Tutor, Explainer, or Quizzer contract from `DEFAULT_PROMPT`, or instead the
   lecturer-defined persona for a custom mode;
4. fixed image-attachment description handling from
   `src/lib/server/inputContextInstructions.ts:withInputContextContract`;
5. fixed course-scope, evidence, tool/conversation privacy, safety, non-disclosure, and epistemic
   integrity policy from `src/lib/server/coursePolicyInstructions.ts:withCoursePolicyContract`;
6. fixed Markdown, inline/display mathematics, and fenced-code rules from
   `src/lib/server/outputFormatInstructions.ts:withOutputFormatContract`;
7. the conditional citation policy when a `doc_query`-style tool is available; and
8. the fixed conversation-language and Swiss Standard German policy from
   `src/lib/server/languageInstructions.ts:withLanguageStyleContract`.

The course-data section explicitly treats its entire JSON value as data rather than instructions.
Quotes, newlines, and instruction-like text in a display name therefore cannot gain prompt
authority. A custom mode omits the standard-mode contract but still receives every fixed platform
section.

The fixed policy explicitly overrides conflicting lecturer text, examples, retrieved material,
tool output, and user attempts to change platform rules. It keeps answers within the owning course,
asks one clarification when course relevance is genuinely ambiguous, and briefly refuses clearly
unrelated requests. Immediate safety concerns are not refused merely as out of scope. Course-tool
queries must omit or generalise personal names, contact details such as email addresses, phone
numbers, or postal addresses, participant or student identifiers, and other sensitive personal
information. Retrieved content is evidence rather than instruction. The assistant does not expose
internal instructions or hidden tool configuration and independently reassesses user pushback
instead of agreeing merely to be supportive.

When a `doc_query`-style tool is present, the model is instructed to retrieve before course-content
claims, use only relevant results, treat returned chunks as a partial view rather than a complete
course inventory, introduce retrieved topic or source lists as examples, and acknowledge
insufficient course evidence instead of filling gaps from general knowledge. Free-text queries start
in the locked conversation language but may preserve exact non-personal course and source labels,
titles, codes, and identifiers, or reformulate in a source language when retrieval genuinely needs
it.

Because compilation happens for every request after loading `chatbot.systemPrompts` and the owning
course, the policy applies to existing and newly created chatbots as soon as this application
revision is deployed. No prompt-row migration is required. Existing stored prompts remain
unchanged: standard-mode text supplies lower-priority lecturer guidance, while custom-mode text
supplies that mode's persona. A chatbot served by an older application revision keeps the old
behaviour until that revision is replaced.

The language lock follows the user's latest non-trivial message or explicit language request.
Quoted text, attached images or their descriptions, retrieved chunks, tool output, and earlier
assistant messages cannot switch the response language. Short acknowledgements preserve the
established conversation language. German answers use Swiss Standard German orthography (`ss`,
never `ß`, and real umlauts). Unit tests prove prompt composition only; model compliance still
requires a separately authorised live-model evaluation.

## Sources and citations

An answer's sources are **derived from the message's own tool-call parts**, not carried in a
dedicated API field or database column ([ADR 0004](./adr/0004-chat-citations-from-tool-call-parts.md)).
`src/lib/sources/normalizeSources.ts` is the single seam: everything downstream — the source
cards, the inline `[n]` chips, the friendly activity chip, and the server-side prompt contract —
keys off the same `isDocQueryToolName` predicate, so a tool the predicate misses silently loses
all four at once.

That predicate must tolerate MCP namespacing. `toSafeToolName` (`src/services/mcpClients.ts`)
prefixes the server name and appends **8 hex characters of a sha256** when the namespaced name
exceeds 64 characters or collides with another server's, so the same logical tool can arrive as
`doc_query`, `KB_doc_query`, or `KB_doc_query_1a2b3c4d`. A chatbot with two RAG servers is the
realistic trigger. The suffix length lives in `lib/config/toolNames.ts` and is imported by both
the side that builds the name and the regex that matches it, so bumping it cannot silently break
recognition — `mcpClients.ts` is `'use server'` and therefore cannot export the constant itself.

When a namespaced `doc_query` name exceeds the 64-character cap or collides, `withHashSuffix`
truncates only the readable prefix and appends `_doc_query_<8 hex characters>`. The alias therefore
remains at the end of the model-facing name and continues to satisfy `isDocQueryToolName`; the
long-name regression case lives in `test/mcp-clients.test.ts`.

`normalizeSourcesFromParts` is deliberately forgiving and never throws: it unwraps the raw MCP
`CallToolResult` envelope (`{ content: [{ type: 'text', text: '<json>' }] }`), a JSON string, or
an already-parsed object. FastMCP may put the JSON payload in a `structuredContent.result` string;
the normalizer unwraps that compatibility layer before applying the same rules. It treats the
pipeline's literal `"N/A"` as absent; it dedupes by file/page/url and normalized video range
(`startSec`/`endSec`), so citations for different video ranges remain separate, then numbers what
survives **1..N in first-appearance order across every doc_query call in one message**, capped at
`MAX_SOURCES`. Two rules follow from that numbering and are easy to break independently:

Chatbot MCP configs are optional unless their existing `parameters` JSON contains the reserved
runtime policy `{ "required": true, "toolAlias": "<name>" }`. A strict config must allow exactly
one matching raw tool. Klicker exposes that tool under the configured alias (for example, the
course-specific video expert can become `IW_doc_query`) before prompt assembly and prompt-cache
identity are built. Missing, inactive, unavailable, malformed, or colliding strict bindings return
`503 REQUIRED_MCP_UNAVAILABLE` may occur before or after a read-only effective-credit preview, but
always before credit initialization, reset, decrement, model or image work, or a retained thread or
message write. Chat may create a short-lived thread and assistant lifecycle claim to serialize the
preflight, but it marks the attempt failed and discards that new thread before returning `503`. MCP
configs without the reserved keys retain the existing optional/fail-open behavior.

- `resolveCitationSource` resolves each expanded `[n]` only for `1 <= n <= N`. Anything outside
  that range stays literal text in the answer — which is the intended failure mode, not a bug.
- Citation numbering is local to one assistant message and resets to `[1]` for every new message;
  it is not a conversation-wide counter. Within one message, numbering spans all `doc_query` calls
  in first-appearance order after normalization.
- A source returned again by a later search keeps its original number; no second index is ever
  minted. `src/lib/server/citationInstructions.ts` therefore tells the model to **reuse** a repeat
  source's number rather than keep counting, or a multi-search answer emits `[4]` when only three
  unique sources exist. That contract is appended to the system prompt only when a doc_query-style
  tool is actually available for the request.
- **Model compliance with the citation contract is unverified.** Prompt assembly is unit-tested;
  whether a given model honours it needs a live model key, which the devcontainer does not carry.

On the render side, `remarkCitationMarkers` rewrites `[n]` and contiguous `[n–m]` markers in
markdown **text** nodes into adjacent `#cite-n` links, expanding a range into one link per source
number. It skips anything inside a link label (including nested emphasis), and
`markdown-text.tsx` intercepts those links in its `a` override to render `CitationChip`.
Normalization runs once per message in `AssistantMessage` (`useMessageSources`) and reaches both
the cards and the chips through `MessageSourcesContext` — do not re-parse the tool JSON in a leaf
component.

A chip must wrap **with** the word it cites, never start a line on its own — and the
punctuation after it must not wrap alone either. Two mechanisms enforce that and both are
needed: `splitCitationMarkers` strips spaces/tabs directly before a marker (newlines survive —
a soft break is content), and `CitationChip` emits a U+2060 WORD JOINER on **both** sides of
the chip (`CITATION_CHIP_JOINER`, exported from `citation-chip.tsx`), because an atomic inline
like the chip's inline element is a legal break point under UAX #14 even with no whitespace around it.
LB11 makes the joiner glue only what is immediately adjacent — it cannot reach past a space
(LB18 still allows the break after a space), so a symmetric joiner welds `word[1].` into one
unit and adjacent chip runs like `[1][2]` into another, while normal inter-word wrapping stays
untouched. The string-level contract is pinned by `test/citation-chip.test.ts`; removing either
mechanism reintroduces orphaned chips or lone trailing periods at narrow widths.

The line under a source's name is per-type, chosen by `getSourceSecondaryLine` in
`src/lib/sources/sourceDisplay.ts` and shared by the card and the citation hover preview:
documents lead with the page (`p. 12` / `S. 12`, plus the publisher's own label when distinct)
and fall back to a cleaned display URL when they carry no page; web links always lead with the
display URL (host kept visible, scheme/`www.`/trailing slash stripped, middle-truncated); videos
lead with a `12:34`-style position; images keep their type label. doc_query video results now carry
structured `start_sec` and optional `end_sec` values in the first chunk, plus a clock-valued
`labeled_page_number` compatibility field. The source normalizer maps those to `startSec`/`endSec`
and prefers the structured start for the card and citation preview. Legacy results remain
supported: a video position can still come from a clock- or `1m30s`-valued `labeled_page_number`
or from a `t`/`start`/`time_continue`/`#t=` parameter on the source URL (`getSourceTimestamp`).
A bare numeric `labeled_page_number` remains a publisher page label, never seconds; other labels
such as `Kapitel IV` also remain page text. Each card's index badge mirrors the inline chip —
a bare digit in a small `bg-primary/10` rounded square (`sources-section.tsx`), not a
zero-padded `01` — so the number on the card and the `[n]` in the answer read as the same
token. Cards show only the title and locator by default; hover or keyboard focus opens a
shared tooltip with the full title and excerpt when one exists. Inline citation previews use the
same content and add the existing navigation hint. These are passive Radix tooltips, so touch
behavior remains compact cards plus the existing URL and in-page citation actions. Card titles
clamp at two lines — and note that `line-clamp-2` needs `display: -webkit-box`, so adding `block`
alongside it silently disables the clamp. All source types share one
`repeat(auto-fit, minmax(min(230px, 100%), 1fr))` grid: `auto-fit` (not
`auto-fill`) collapses empty tracks so fewer cards stretch across the whole row
and only wrap when they genuinely no longer fit. Equal-width tracks keep mixed
document/media results aligned, and the `min(230px, 100%)` floor keeps a track
from forcing horizontal overflow in containers narrower than 230px (mobile and
embedded mode).

The activity chip's four states come from the pure `getDocQueryChipState` in `tool-fallback.tsx`.
"No results" is claimed only for a payload that actually **parsed**: a cancelled call leaves the
literal `'Loading...'` / `'Executing...'` placeholder from `src/hooks/useChatResponse.ts` behind as
its result, and labelling that as an empty search would be a lie.

Expanding the chip no longer dumps raw JSON for a successful doc_query: `getDocQueryPanelContent`
(same file, pure, tested in `test/tool-fallback-doc-query.test.ts`) yields a friendly panel — the
model's search query (parsed defensively from the possibly-streaming args JSON by
`parseDocQueryArgsQuery`) plus a "results appear as sources below" hint keyed on the parsed-`done`
state. The raw tool-name/args/result path is preserved wherever the friendly panel would lie or be
empty: non-doc_query tools, running/failed calls, unparseable results, and the doneEmpty +
unreadable-args combination (which would otherwise render a blank panel).

## Streamed Markdown math

`src/components/markdown-text.tsx:MarkdownTextImpl` reads the current text-part status before
rendering Markdown. While a text part is running, `src/lib/markdown/streamingMath.ts` removes only
the unmatched tail of a supported math span (`$`, `$$`, `\\(...\\)`, `\\[...\\]`, `[/inline]`, or
`[/math]`); ordinary prose before that span continues to stream. The scanner ignores escaped
dollars, currency-like `$5`, inline code, and fenced code. Once a supported opener appears, the
component disables assistant-ui's smooth text replay for that part, so the closing delimiter adds
the complete formula in one render rather than exposing raw LaTeX or a partial KaTeX parse. A
terminal or persisted message renders its full text normally, including an incomplete span from an
aborted turn.

`normalizeCustomMathTags` keeps custom and bracketed display-math fences on separate Markdown lines.
Without those boundaries, a multiline formula can consume the prose or links that follow it. The
streaming regression in `playwright/tests/Y-chat.spec.ts` pauses before a closing delimiter,
observes the DOM for raw delimiters, partial formulas, and KaTeX errors, then asserts the final
formula, surrounding Markdown, and assistant-row identity.

## Localization

Chat has no locale switcher: the locale comes from the `NEXT_LOCALE` cookie and falls back to `en` ([ADR 0001](./adr/0001-chat-locale-from-cookie.md)). It is resolved **directly in the chat-local `getRequestConfig`** (`src/types/i18n.ts`). Relying on `setRequestLocale`/`requestLocale` alone produces a split brain — `<html lang>` follows the cookie while server-side `getTranslations()` stays on the default locale. Messages come from the static `messagesByLocale` map exported there, which the root layout reuses: Turbopack cannot build a dynamic-import context for a bare package subpath (`import('@klicker-uzh/i18n/messages/' + locale)`), so the dynamic form silently resolves nothing in this app. Strings live in `packages/i18n/messages/{en,de}.ts`; `apps/chat/src/types/app.d.ts` enforces en/de key parity through a `DeepIntersection`, so a missing key fails `pnpm --filter @klicker-uzh/chat check` rather than at runtime. German addressed to students is informal (`Du`/`Dein`/`Dir`), instructors are "Dozierende", and Swiss `ss` is used instead of `ß`.

Model-answer language and orthography are fixed by the runtime system-prompt policy above, not by
the UI locale or by a lecturer's stored persona prompt.

Two recurring traps in this app's strings:

- **Per-chatbot vocabulary is free-form**, so chat modes (`systemPrompts` keys) and reasoning efforts are `string`, not unions. Only the well-known values get a translation; anything else falls back to its raw name. `src/lib/config/modes.ts` holds the own-property known-mode predicate and `formatModeLabel` (used by the mode dropdown and thread-list subtitle; unknown modes fall back to their capitalized raw name), while `src/lib/config/reasoning.ts` exports `formatReasoningEffort` outright, since its three call sites want nothing but the label and had already drifted apart once. The mode dropdown shows the same localized label and description in its Radix menu, never an English-only registry description for a known mode. Either way, go through those modules so the selector and the caption under an answer cannot end up with different words for the same value. When a model registry or LiteLLM alias introduces a new effort id, add it to `KNOWN_REASONING_EFFORTS` and to both message files in the same change — otherwise the raw-name fallback leaks an English id (`xhigh` shipped that way and read "Xhigh" next to Niedrig/Mittel/Hoch until it was fixed, and `none` — offered by `gpt-5.1` and `gpt-5.5` in prd, by `gpt-5.1` only in stg, and by no model in the local default registry — read "None" for the same reason). The local `DEFAULT_MODEL_REGISTRY` and the deployed registries in `deploy/env-uzh-{stg,prd}/values.yaml` only overlap partly — both expose `gpt-5.6-luna`, while deployments additionally offer GPT-5.1, GPT-5.4, GPT-5.5, and effort ids (`none`, `minimal`) that no local model does — so check both before assuming a browser pass covered every effort id.
- **ICU plurals must be selected on the displayed number.** `formatCredits(1.2)` renders `1` but `Intl.PluralRules.select(1.2)` is `other`, so passing the raw float prints "1 credits". Feed `count` the rounded value the user actually sees.

## Message feedback and Langfuse

Participants rate assistant answers through `ChatMessage.rating` (`ChatMessageRating` enum, nullable — null means no vote; [ADR 0002](./adr/0002-message-feedback-as-a-rating-field.md) records why a field on the message beat a separate feedback entity). `POST …/threads/[threadId]/messages/[messageId]/feedback` scopes its lookup by participant _and_ chatbot and reports someone else's message as 404, not 403, so the endpoint cannot be used to probe which message ids exist.

A failed rating request (`chatStore.rateMessage`) rolls the optimistic vote back and surfaces an inline `role="alert"` notice next to the rating buttons ("Rating could not be saved."), which clears on the next attempt. There is still no toast — `apps/chat` mounts no `<Toaster/>` — the inline alert replaced the earlier deliberate silent revert because a silent rollback is invisible to screen-reader users and indistinguishable from a lost click for everyone else. Rapid votes are serialized per thread/message, not globally: `src/stores/ratingRequestCoordinator.ts` applies each choice optimistically, starts each request after the previous same-message request settles, and lets only the latest failed request roll the visible value back to the last confirmed database rating. The action-bar buttons intentionally bypass assistant-ui's feedback adapter so clicking the active vote can send `rating: null` and retract it without remounting the conversation.

Ratings are currently **write-only**: nothing in the repository reads them back. There is no lecturer-facing view and no GraphQL field or aggregate over `ChatMessage.rating`, so votes accumulate in the database for a consumer that does not exist yet — do not cite them as a feedback loop that lecturers can act on.

PostgreSQL is the only rating store. Do not mirror votes to Langfuse while the trace exporter is nonfunctional: scores would be orphaned, and exact retry/order semantics would require a durable outbox rather than request-route network calls. Add analytical mirroring only after the OpenTelemetry integration below is operational and the delivery lifecycle is designed.

> **Known gap:** `apps/chat` pins `@opentelemetry/sdk-trace-node@1.26.0` while `@langfuse/otel` needs 2.x, so span export throws and **no trace currently reaches Langfuse**. Rating-score mirroring is disabled until the OTel major bump lands.

## Client-state gotchas

- **Zustand async actions must set fallback state in `catch`**, not just log — otherwise the UI hangs in loading state on network errors.
- **Cancel persistence lives in `onAbort`, not `onEnd`.** The chat route's `onEnd` returns early after an abort (ai@7 still flushes it when ≥1 step completed, and letting it run overwrote the partial answer and rewrote its credits). `onAbort` persists the streamed partial text/reasoning and charges the summed per-step cost; when nothing streamed (a pure tool-call first step), it persists the completed steps' tool calls instead — `partialContent` already contains completed steps' text, so the two content sources are mutually exclusive by design.
- **Stopped turns carry a persisted `chat-stopped` data marker, not a string.** `buildAbortedAssistantContent` (`src/lib/server/persistedAssistantContent.ts`) always ends aborted content with `{ type: 'data', name: 'chat-stopped', data: {} }` (marker-only when nothing streamed), so a reloaded thread can tell a stopped turn from a completed one without any user-facing text in the database; the client renders it via `ChatStoppedPart` (localized notice plus a retry that uses the assistant-ui reload path, so retrying creates a sibling version instead of a duplicate turn), `isStoppedWithoutText` (`message-parts-state.ts`) switches marker-only turns to error-style chrome (no rating, no reload), and the history rail maps the marker to the `partial` status. On the client, the `AbortError` branch in `useChatResponse` writes the stopped turn into **both** `messages` and `allMessages` one macrotask after assistant-ui's `cancelRun` resync (which itself defers via `setTimeout(0)`) — an earlier write is clobbered by that resync. Empty-text assistant turns are filtered out of outgoing request bodies so a marker-only turn never reaches the model as an empty assistant message. Known edge: a zero-content abort can outrun server persistence entirely, so its in-session marker-only turn has no server row and disappears on reload.
- **Run-state announcements come from a dedicated sr-only live region** in `thread.tsx`, driven by a `lastRunOutcome` store field rather than `isRunning` alone — cancel clears `isRunning` before the abort settles, so without the outcome field a stop would announce as a completion. The thinking indicator deliberately carries no `role="status"` to avoid double announcements.
- **Edited-message image hydration** needs the persisted source message id (`attachmentSourceMessageId`) distinct from the fresh local message id (`src/hooks/useThreadManagement.ts`, `src/stores/chatStore.ts`).
- **`ComposerPrimitive.AttachmentDropzone` must wrap both normal and edit composer roots** — it owns the drag/drop capture that prevents native browser file navigation (`src/components/thread.tsx`).
- **Login redirects**: `src/app/noLogin/page.tsx` must pass an **absolute** chat URL as the PWA login `redirect_to`; a relative path makes the PWA redirect to its own domain and 404.
- **Embedded Manage dock**: the Manage launcher portals a labelled, non-modal complementary region to `document.body`. It leaves `#__app` interactive, moves focus to its close control on open, preserves close and Escape in loading/recovery states, and restores launcher focus on close. Keep the iframe mounted across ordinary close/reopen so the in-session conversation survives.
- **Static assets need a middleware allowlist entry.** `src/middleware.ts` matches `/:path*` and passes through only `/noLogin`, `/KlickerLogo.png`, `/user-solid.svg`, `/_next…`, `/api…`, and `/favicon…`. Any other file added to `apps/chat/public/` is redirected to the login page for requests without a valid participant token (authenticated participants still get it served) — assets referenced from unauthenticated pages like `/noLogin` therefore break silently, so add new public files to that allowlist in the same change.
- **Do not put user-facing English in the store.** `chatStore` maps the API's generic enrolment 403 to `null` so the notice component can render its localized default; substituting a readable English sentence in the store makes the translated fallback unreachable.
- **Thread-row edit/delete need the row active first on touch** (`thread-list.tsx`): the buttons are `hidden` and only reveal via `group-hover`/`group-focus-within`, which touch has neither of, so a touch user must tap the row (making it active, which also sets `inline-flex`) before the edit/delete buttons appear. Accepted friction, not a bug — leave as is.
- **Thread deletion is a two-step confirm on the same button** (`thread-list.tsx`): first click turns the trash icon into a destructive-styled "Delete?" pill (aria-label switches to the confirm wording), second click deletes. The confirm state reverts on a 4s timeout, Escape, pointer leaving the row, focus leaving the row, or starting a rename — the state machine is the pure `transitionDeleteConfirm` in `thread-list-state.ts` so vitest can pin it without a DOM. `data-cy="chat-thread-delete-button"` stays on the button in both states.
- **Streaming failures need both client and server evidence**: a client-side generic error bubble does not distinguish a provider failure from a response-pipe failure. For staging smoke tests, correlate the browser request time with the chat pod logs and check for `failed to pipe response`, `stream.error`, and `stream.finish` before changing ingress timeouts or model routing.
- **Message edits must go through the edit composer's own send** — `messageRuntime.composer.send({ startRun: true })` in `thread.tsx:EditComposer`. The public `threadRuntime.append()` normalizes a `null` parentId to "last message in the current path" (vendor `toAppendMessage`), so submitting an edit through it turns a root-message edit into a brand-new turn instead of a sibling branch and the branch pager (`branch-picker.tsx`) never shows. `startRun: true` is required because the vendor's own change gate compares only composer text/attachments and cannot see the kept-original-attachment state this app tracks outside the composer; the app-side `canSubmit` is the real change gate.

## Scoped KB retrieval

The chat route derives the enabled knowledge-base id from the authenticated chatbot in PostgreSQL; it never accepts a client-supplied KB id. `src/services/mcpClients.ts` passes that id with the chatbot and session context only to the configured `KB` MCP server. For rollout and rollback compatibility, the new Chat runtime recognizes that server by its reserved `KB` name even when the persisted row still has its legacy auth type. It sends the short-lived scoped token in `X-Doc-Query-Scope-Token` by default, while preserving a configured transport bearer in `Authorization` when the `KB` row has one. A scope-only `KB` row remains supported for explicitly standalone deployments; shared multi-tenant deployments must provide the transport bearer required by the service ingress. Without an enabled binding, complete signer configuration, or the exact KB server, KB tools stay unavailable while other MCP servers continue to load.

`src/lib/server/docQueryScopeToken.ts:signDocQueryScopeToken` signs a five-minute ES256 token with `DOC_QUERY_SCOPE_PRIVATE_KEY`, `DOC_QUERY_SCOPE_KID`, `DOC_QUERY_SCOPE_ISSUER`, and `DOC_QUERY_SCOPE_AUDIENCE`. Claims bind `kb_id`, `chatbot_id`, session subject, and a unique `jti`; participant identity is intentionally absent. Scope-token requests carry the scoped bearer in `X-Doc-Query-Scope-Token` and retain `Authorization` only for transport authentication; they never use the legacy `Chatbot-ID` header for retrieval scope. Existing participant-JWT MCP authentication is unchanged.

The staging isolation verifier keeps positive and negative evidence asymmetric:
positive markers may appear in returned source references or chunk content, but
each `foreign.forbidReferences` marker must identify a stable
`source.reference` unique to the foreign corpus. Never use a shared subject
term as negative evidence; related courses can legitimately retrieve the same
terminology without crossing the signed knowledge-base boundary.

The assistant UI registers the retrieval card through `src/components/tools-ui/rag-tool-ui.tsx:RAGToolUI`. Its registration uses `src/services/mcpScope.ts:DOC_QUERY_TOOL_NAME` (`KB_doc_query`), matching the namespaced runtime tool name. The card is localized through `pwa.chatbot.retrieval` and renders only a generic failure state; raw retrieval-service errors must never reach participants.

## Testing

Start the self-contained devcontainer with
`devrouter ensure . --profile chat,ai,mcp`. `post-start.sh` then starts the
seeded local MCP fixture. Benibot's Tutor and Explainer configurations point to
`http://localhost:1417/mcp` and allow `doc_query`; Quizzer therefore inherits
the restricted Tutor binding automatically. The runtime namespaces the tool
as `KB_doc_query`; if discovery does not return that tool, Quizzer fails closed
while Tutor and Explainer retain their optional-retrieval behavior. Keep Auto
Mode selected, then prompt Benibot with “Use
the local MCP tool to test the integration. Search for
`portfolio diversification` and tell me the exact marker it returns.” The
end-to-end pass requires a completed tool call, `KLICKER_LOCAL_MCP_OK` in the
non-empty answer, and the `synthetic-course-material.pdf` source card. Keep
Auto Mode selected and require the tool result, answer, and source to remain
after reloading the thread. Use direct GPT-5.6 Luna only to isolate the router
from the model/tool path. The fixture is synthetic wiring evidence only; it
does not validate retrieval quality or a deployed MCP server.

Pure-logic vitest lives in `apps/chat/test/` (safe without services); `apps/chat/vitest.config.ts` mirrors the `@/*` alias from the app tsconfig — keep them in sync. The runner is `environment: 'node'` with no jsdom/testing-library, so component behavior is tested by extracting the decision logic into pure modules next to the component (`message-parts-state.ts`, `thread-list-state.ts`) — follow that pattern rather than adding a DOM environment. The whole suite shares **one fork** (`singleFork: true`), so a `vi.stubGlobal` is process-global: the config sets `unstubGlobals: true`, but that only restores before each _test_ — the next file's module **import** still sees whatever the previous file's last test left stubbed (a leaked `window`/`URL` once broke zustand-persist feature detection and `new URL` in unrelated files, order-dependently). Any file stubbing environment-shaped globals (`window`, `URL`, `document`) must also clean up itself with `afterEach(() => vi.unstubAllGlobals())`. `message-parts.test.ts` owns disclosure-state rules, while `persisted-assistant-content.test.ts` owns the provider-error redaction boundary. E2E coverage is Playwright-only (`playwright/tests/Y-chat.spec.ts`).

`history-rail.test.ts` pins active-path order, adjacent user/assistant pairing, orphan messages, complete text, stable message anchors, exclusion of reasoning/tool/error part landmarks, and running/partial/error states. Browser verification must additionally exercise desktop tick activation, the mobile history-trigger/dialog flow, complete-text popovers, focus, current-entry highlighting, rapid navigation, and EN/DE rail labels; the seeded local app can prove the navigation and error states without an upstream model key.

The `Chatbot Source Citations` block in that spec exercises the citation pipeline against real persisted tool-call parts: card ordering and count, dedupe across two doc_query calls, a valid `[n]` rendering as a citation chip/link while an out-of-range marker stays literal, compact cards with hover/focus previews for cards and inline citations, click-scroll without navigation, all four activity-chip labels with their icon gating, the composer hint's standalone/embedded gate, and the message timestamp. Seed tool results in the raw MCP envelope shape (`result: { content: [{ type: 'text', text: '<json>' }], isError }`) — that is what production sends, and `convertApiMessageToMessage` hoists `isError` to the part. Put more than one tool-call part on a single message only when you mean to: `message-parts.tsx` wraps two or more adjacent ones in a collapsed group that a test must expand first.

The chat package uses Turbopack for development, test, and production builds
(`apps/chat/package.json:scripts`). For a production-readiness gate, run the package check,
the package Vitest suite (`pnpm --filter @klicker-uzh/chat test:run` — the package has no
plain `test` script), and the package production build in the worktree's devcontainer.
The live reasoning/tool/credit matrix additionally needs a configured model key; without one,
those checks remain an explicit environment-gated follow-up rather than an unverified claim.

The chat Playwright fixture can emit `textChunks` through a delayed browser
`ReadableStream` with `chunkDelayMs`, and can pause after a chosen text delta
with `pauseAfterTextChunk` until the test explicitly releases it. The streaming stability regression in
`playwright/tests/Y-chat.spec.ts` captures the assistant row before later deltas arrive and
asserts that the same DOM node remains mounted; the rating regression performs the same identity
check across an optimistic feedback update. These checks target remounts, which are the visible
flicker signal, rather than treating a successful final answer as proof that the conversation
stayed stable.

For mobile UI verification, use a real Chromium mobile emulation or Android
Chrome and check the focused composer, the visible conversation tail, and every
primary icon control with the keyboard both closed and open. A desktop screenshot
does not prove the `dvh`/keyboard behavior.

Primary mobile controls use at least 44px touch targets and shrink only when the
primary pointer is a fine, hover-capable pointer; this includes the composer,
sidebar/header actions, mode options, message actions, and scroll-to-bottom
control. A stream failure is a message callout with a localized, labeled retry
action that uses the existing assistant-ui reload path, so retrying truncates
the failed branch instead of adding a duplicate user turn. Keep the retry and
duplicate-turn behavior in the mobile smoke matrix.

The suite runs as its own step in `.github/workflows/test-unit.yml`, whose path
union covers `apps/chat/`, its shared packages, and the grading, markdown, and
util suites consolidated into the same job. The workflow builds Prisma, types,
grading, and util once before the four suites because
`test/modelRegistryParity.test.ts` imports the backend registry from
`packages/graphql/src/services/chatbots.ts`, whose first line is a runtime prisma-client
import ([Testing](./testing.md)).

> **Do not run `pnpm --filter @klicker-uzh/chat check` while the devcontainer dev stack is up.** `check` is `next typegen && tsc --noEmit`, and typegen rewrites the same `.next/` the running dev server owns: from the next `✓ Compiled` line onward every chat route returns a bare Next 404 with nothing in `/tmp/dev.log`, including routes that just served 200. It is not a code bug — restart with `devrouter ensure .` from the host. Typecheck before the browser pass, not during it.
