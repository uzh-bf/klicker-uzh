---
type: App Guide
title: Chat Platform
description: The apps/chat island — app router, zustand, assistant-ui, route-handler auth guards, and the model registry.
timestamp: '2026-08-22'
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
- `src/lib/markdown/remarkCitationMarkers.ts` — the remark plugin that rewrites `[n]` markers into citation links.
- `src/lib/toolOutput.ts` — live-SSE tool-result normalization (the streaming half of the provider-error redaction boundary).
- `src/lib/attachments/` — image attachment adapter plus attachment state and UI helpers.
- Local model proxy: the `litellm` compose service (port 4000).
- Local MCP fixture: `scripts/local-mcp-server.mjs` exposes a deterministic,
  read-only `doc_query` tool on port 1417 for the seeded Benibot.

The chat route returns an AI SDK UI message stream and passes
`consumeSseStream: consumeStream` to `toUIMessageStreamResponse`. Keep this
explicit when changing the transport: it keeps the UI stream's abort lifecycle
consumed so abort callbacks and partial-response handling can run. It does not
detach upstream generation from `req.signal` or guarantee completion after a
client abort. The root layout also declares
`interactiveWidget: 'resizes-content'` alongside `viewportFit: 'cover'`; this
is required for Android keyboard resizing because the thread viewport is the
only conversation scroller and the composer is positioned over it.

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

Three steps: `getParticipantId` → `getChatbotOr404` → `requireParticipation`. The composed helper `withChatbotAuth(req, chatbotId)` (`src/lib/server/apiGuards.ts`) covers the standard `{ courseId: true }` case — use it for new routes; fall back to the individual guards only for a custom chatbot `select`. Participant identity comes from the same participant JWT cookies as the PWA ([Auth Model](./auth-model.md)); local chat dev therefore needs the backend's `APP_SECRET` and `DATABASE_URL` visible to the chat app, or cookies won't verify and Prisma can't load chatbots.

The embedded lecturer assistant is a separate route family under `src/app/api/manage/`. It verifies the lecturer's NextAuth cookie, mints a short-lived internal bearer token for `apps/mcp-lecturer`, and confirms signed draft proposals through the authenticated chat route. This is an internal service exchange, not an OAuth client flow; the complete trust boundary is documented in [Auth Model](./auth-model.md#lecturer-mcp-and-manage-assistant).

**One gate with two conditions covers the assistant, and it is enforced server side.** `isManageAiEnabled` in `src/lib/server/featureFlags.ts` requires the `ai-beta` GrowthBook flag _and_ the account's `aiFeaturesEnabled` column, which records that an administrator has a cost center to bill the resulting model usage to. It covers the launcher in `apps/frontend-manage` (`src/components/Layout.tsx`, `src/components/assistant/ManageAssistantWidget.tsx`), the `/manage` page in `apps/chat`, `POST /api/manage/chat`, the lecturer MCP tools that route loads, and `POST /api/manage/proposals/confirm` — so a proposal token minted while the gate was open stops being redeemable the moment either condition is withdrawn. The API routes evaluate it per request, so hiding the launcher is not what protects them.

The entitlement is read live from the database rather than from the session token, so withdrawing it takes effect on the next request instead of at the lecturer's next sign-in. It is administered by email on the Manage admin panel (`setAiFeatures`), separately from `privatePreview`: one decides which unreleased features an account may see, the other whether it may spend model budget.

Evaluation fails closed. An unconfigured or unreachable GrowthBook yields `false` for every flag, which is what makes a dark deploy safe: an image built before the `NEXT_PUBLIC_GROWTHBOOK_*` repository variables were set carries no SDK connection and shows nothing. Where no GrowthBook exists at all — local development, the end-to-end suite — `FEATURE_FLAGS_FORCED_ON` and `NEXT_PUBLIC_FEATURE_FLAGS_FORCED_ON` name registered keys to force on. That override is honored only when the flag environment resolves to `development` or `test` and only when no SDK connection is configured, so setting it on a staging or production build turns nothing on.

The two chat surfaces also differ in how they handle a missing model key. The participant route falls back to `apiKey: process.env.OPENAI_API_KEY || 'no-key'` (`src/app/api/chatbots/[chatbotId]/chat/route.ts`), which the local LiteLLM proxy accepts, while `createManageAssistantModel` (`src/app/api/manage/chat/route.ts`) throws `OPENAI_API_KEY is required for the Manage assistant`. The devcontainer sets `OPENAI_BASE_URL` but no `OPENAI_API_KEY`, so the Manage assistant returns 500 there until the variable is set ([Getting Started](./getting-started.md#failure-signatures-fresh-clone--wrong-state)).

The Manage chat route authenticates before admitting work, and applies its per-lecturer rate limit only after it acquires the pod's request slot; a busy rejection therefore does not consume the lecturer's rate budget. It is excluded from the Next middleware matcher so Next does not clone and truncate the body at its default 10 MiB buffer; the route therefore owns the full stream and enforces a 16 MiB serialized-body ceiling. Both declared and chunked oversized requests fail with a generic `413`, a body that exceeds the 30-second read deadline fails with a generic `408`, and malformed or structurally invalid requests retain the generic `400`. The request shape remains capped at 50 messages and also bounds aggregate parts, text, and individual encoded image/data parts before AI SDK conversion or MCP/model work.

After the resource checks, the route uses the AI SDK's message validator before opening the lecturer MCP client. Browser-supplied system messages, unsupported user parts, non-user files, malformed tool states, and invalid image base64 are rejected. Every accepted message is reconstructed from allowlisted fields, dropping browser-owned provider metadata and other extra fields. Previous assistant prose is retained for conversational continuity, but browser-supplied assistant tool, data, reasoning, and file parts are removed before model conversion; only tool results produced inside the current server-owned MCP loop reach the model as tool history. A total 60-second abort deadline covers body parsing, the MCP transport's actual composed fetch signal, model streaming, and the response-lifetime slot, because self-hosted Next does not itself enforce the route's exported `maxDuration`.

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
- A failed lookup degrades silently: the route logs `Student practice lookup failed; continuing without quiz candidates` and answers without the tool. A missing practice quiz is therefore an infrastructure symptom, not necessarily a model one.
- `getStudentPracticeMcpUrl` falls back to `http://localhost:7080` **only** when `NODE_ENV=development`; in production an unset `MCP_STUDENT_URL`/`MCP_STUDENT_HOST` yields `null` and the feature is simply off. The devcontainer starts both `mcp-student` and `mcp-lecturer` through `package.json:dev:container`, so tutor-mode practice tools and lecturer tools are available without a separate MCP process.

## Model registry and credits

`chatModelRegistry.ts` loads `CHAT_MODEL_REGISTRY_JSON` (deployment override in `deploy/env-uzh-*/values.yaml`). The backend keeps its own copy of the registry in `packages/graphql/src/services/chatbots.ts` for the lecturer-facing allow-list; both pods receive the same `CHAT_MODEL_REGISTRY_JSON` from the one `.Values.chat.modelRegistry` source (`cm-chat.yaml` and `cm-backend-graphql.yaml`), and `apps/chat/test/modelRegistryParity.test.ts` pins the two built-in defaults against each other — the deployed values.yaml registries are NOT covered by that test, so values-only drift still needs a manual check. Registry gotchas that have caused production incidents:

The deployed Klicker Auto option is a LiteLLM `auto-router` endpoint. The
only in-repo record of its tier map is the comment above `modelRegistry` in
`deploy/env-uzh-{stg,prd}/values.yaml`: SIMPLE = `gpt-5.6-luna-medium`, MEDIUM
= `gpt-5.6-luna-high`, COMPLEX = `gpt-5.6-luna-xhigh`, REASONING =
`gpt-5.6-sol-medium` (match_threshold 0.55). The authoritative router
configuration lives in the external AI deployment repository's
`litellm/config.yaml` and **cannot be verified from this repository** — treat
the values.yaml comment as the best available record and confirm against the
deployment before making a routing claim. The deployed registry exposes no
direct GPT-5.6 picker option; the router's tier targets are internal.
Both staging and production now use `auto` as the global automatic-model
primary, so chatbots using automatic model selection use Auto by default.
Chatbots with an explicit model selection can continue using that selection.
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
a direct comparison. The seeded Benibot fixture allow-lists all three of
`auto`, `gpt-5.6-luna` and `gpt-4.1-mini` explicitly, so it satisfies the
fallback invariant below without relying on the `|| m.fallback` exemption that
the runtime filters apply anyway.

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

- Omitted `supportsImageAttachments` defaults to **false** — every image-capable model must set it explicitly in deployment values or the attach button disappears.
- Zero-credit course chatbots need a usable fallback model (`CHAT_FALLBACK_MODEL_ID`, default `gpt-4.1-mini`) AND explicit chatbot `allowedModelIds` must include it. Audit/fix with `packages/prisma-data/src/scripts/2026-06-15_ensure_chatbot_fallback_model.ts`.
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
selection state uses the same plain-language contract. Known Tutor and Explainer modes use their
localized purpose descriptions in `src/components/mode-switcher.tsx`; custom modes fall back to
their configured description.

In the sidebar layout, `src/components/credits-footer.tsx:MobileCreditsBar` keeps the current
balance visible below the header at mobile widths, even while the design-system sidebar drawer
is closed. When the balance reaches zero it also states that new messages use the smaller model.
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
than one, and a single tool call keeps its direct result disclosure. Reasoning auto-opens only
while active until the participant manually chooses an open state; that manual choice then wins.
The source-card section is derived from completed `doc_query` tool results but
stays hidden while the same assistant message is actively running without
non-whitespace answer text. This keeps tool activity in stream order and
prevents a result card from appearing as if it were the answer during the gap
between tool completion and the model's next text step. If the turn becomes
terminal before producing answer text, including an incomplete or aborted
tool-only turn, valid completed sources are shown instead of being lost on
reload. The source component still suppresses the section when normalization
produces no sources.
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
middle-click and copy-link behave as expected. It links `courseChatbots[0]`:
courses are deliberately limited to a single chatbot for now, which is also why
`Chatbot` carries no ordering or visibility field. Lifting that limit means
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

The mobile layout exports `viewportFit: 'cover'`, reserves the bottom safe area for the
composer, wraps Markdown tables in horizontal scrolling, and makes the mode pills horizontally
scrollable. Embedded mode shows the loading state and compact credit/model information through
the shared settings components. Direct thread URL activation resynchronizes the thread's stored
chat mode once per activation, without overriding a mode manually chosen afterward.

Switching mode mid-thread affects **only the turns sent afterwards**, and the choice is not
persisted until the next send: a thread's stored mode is `lastChatMode`, derived from its most
recent message's `chatMode`, so a switch that is never followed by a message leaves no trace.
Whether that is the intended contract or the switcher should persist immediately is an open
product ruling (`project/2026-07-27-student-chat-v3-follow-up-roadmap.md`, W7 item 1). The
switcher is hidden entirely when a chatbot exposes a single mode — `mode-switcher.tsx` returns
`null` for one or fewer mode keys, so there is no disabled one-pill state to style.

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
`503 REQUIRED_MCP_UNAVAILABLE` before a thread, model request, credit read, or message write. MCP
configs without the reserved keys retain the existing optional/fail-open behavior.

- `resolveCitationSource` resolves `[n]` only for `1 <= n <= N`. Anything outside that range stays
  literal text in the answer — which is the intended failure mode, not a bug.
- A source returned again by a later search keeps its original number; no second index is ever
  minted. `src/lib/server/citationInstructions.ts` therefore tells the model to **reuse** a repeat
  source's number rather than keep counting, or a multi-search answer emits `[4]` when only three
  unique sources exist. That contract is appended to the system prompt only when a doc_query-style
  tool is actually available for the request.
- **Model compliance with the citation contract is unverified.** Prompt assembly is unit-tested;
  whether a given model honours it needs a live model key, which the devcontainer does not carry.

On the render side, `remarkCitationMarkers` rewrites `[n]` in markdown **text** nodes into
`#cite-n` links, skipping anything inside a link label (including nested emphasis), and
`markdown-text.tsx` intercepts those in its `a` override to render `CitationChip`. Normalization
runs once per message in `AssistantMessage` (`useMessageSources`) and reaches both the cards and
the chips through `MessageSourcesContext` — do not re-parse the tool JSON in a leaf component.

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
alongside it silently disables the clamp. Document cards lay out with
`repeat(auto-fit, minmax(min(230px, 100%), 1fr))`: `auto-fit` (not `auto-fill`) collapses empty
tracks so fewer cards stretch across the whole row and only wrap when they genuinely no longer
fit, and the `min(230px, 100%)` floor keeps a track from forcing horizontal overflow in
containers narrower than 230px (embedded mode).

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

Model answers are held to the same orthography server-side: the chat route wraps every system
prompt in `withLanguageStyleContract` (`src/lib/server/languageInstructions.ts`) — unconditionally,
unlike the citation contract, because a lecturer's stored prompt replaces `DEFAULT_PROMPT`
entirely and a rule written only in the default text silently disappears the moment a custom
prompt is saved. The contract asks for Swiss High German ("ss" not "ß", real umlauts, never
ae/oe/ue). As with the citation contract, only prompt assembly is unit-tested; model compliance
needs a live key the devcontainer does not carry.

Two recurring traps in this app's strings:

- **Per-chatbot vocabulary is free-form**, so chat modes (`systemPrompts` keys) and reasoning efforts are `string`, not unions. Only the well-known values get a translation; anything else falls back to its raw name. `src/lib/config/modes.ts` holds the own-property known-mode predicate and `formatModeLabel` (used by the thread-list mode subtitle; unknown modes fall back to their capitalized raw name), while the older call sites still translate inline alongside their icon lookups; `src/lib/config/reasoning.ts` exports `formatReasoningEffort` outright, since its three call sites want nothing but the label and had already drifted apart once. The mode switcher's tooltip — a Radix popover, not a native `title` — uses the same localized label, never the English-only registry description. Either way, go through those modules so the selector and the caption under an answer cannot end up with different words for the same value. When a model registry or LiteLLM alias introduces a new effort id, add it to `KNOWN_REASONING_EFFORTS` and to both message files in the same change — otherwise the raw-name fallback leaks an English id (`xhigh` shipped that way and read "Xhigh" next to Niedrig/Mittel/Hoch until it was fixed, and `none` — offered by `gpt-5.1` and `gpt-5.5` in prd, by `gpt-5.1` only in stg, and by no model in the local default registry — read "None" for the same reason). The local `DEFAULT_MODEL_REGISTRY` and the deployed registries in `deploy/env-uzh-{stg,prd}/values.yaml` only overlap partly — local has a `gpt-5.6-luna` the deployments do not ship, and the deployments offer effort ids (`none`, `minimal`) that no local model does — so check both before assuming a browser pass covered every effort id.
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
- **Embedded Manage modal**: the Manage launcher portals its dialog to `document.body` and makes `#__app` inert and hidden from assistive technology while open. Keep the portal outside `#__app`; otherwise the dialog would hide itself together with the background.
- **Static assets need a middleware allowlist entry.** `src/middleware.ts` matches `/:path*` and passes through only `/noLogin`, `/KlickerLogo.png`, `/user-solid.svg`, `/_next…`, `/api…`, and `/favicon…`. Any other file added to `apps/chat/public/` is redirected to the login page for requests without a valid participant token (authenticated participants still get it served) — assets referenced from unauthenticated pages like `/noLogin` therefore break silently, so add new public files to that allowlist in the same change.
- **Do not put user-facing English in the store.** `chatStore` maps the API's generic enrolment 403 to `null` so the notice component can render its localized default; substituting a readable English sentence in the store makes the translated fallback unreachable.
- **Thread-row edit/delete need the row active first on touch** (`thread-list.tsx`): the buttons are `hidden` and only reveal via `group-hover`/`group-focus-within`, which touch has neither of, so a touch user must tap the row (making it active, which also sets `inline-flex`) before the edit/delete buttons appear. Accepted friction, not a bug — leave as is.
- **Thread deletion is a two-step confirm on the same button** (`thread-list.tsx`): first click turns the trash icon into a destructive-styled "Delete?" pill (aria-label switches to the confirm wording), second click deletes. The confirm state reverts on a 4s timeout, Escape, pointer leaving the row, focus leaving the row, or starting a rename — the state machine is the pure `transitionDeleteConfirm` in `thread-list-state.ts` so vitest can pin it without a DOM. `data-cy="chat-thread-delete-button"` stays on the button in both states.
- **Streaming failures need both client and server evidence**: a client-side generic error bubble does not distinguish a provider failure from a response-pipe failure. For staging smoke tests, correlate the browser request time with the chat pod logs and check for `failed to pipe response`, `stream.error`, and `stream.finish` before changing ingress timeouts or model routing.
- **Message edits must go through the edit composer's own send** — `messageRuntime.composer.send({ startRun: true })` in `thread.tsx:EditComposer`. The public `threadRuntime.append()` normalizes a `null` parentId to "last message in the current path" (vendor `toAppendMessage`), so submitting an edit through it turns a root-message edit into a brand-new turn instead of a sibling branch and the branch pager (`branch-picker.tsx`) never shows. `startRun: true` is required because the vendor's own change gate compares only composer text/attachments and cannot see the kept-original-attachment state this app tracks outside the composer; the app-side `canSubmit` is the real change gate.

## Scoped KB retrieval

The chat route derives the enabled knowledge-base id from the authenticated chatbot in PostgreSQL; it never accepts a client-supplied KB id. `src/services/mcpClients.ts` passes that id with the chatbot and session context only to the configured `KB` MCP server. Without an enabled binding, complete signer configuration, or the exact KB server, KB tools stay unavailable while other MCP servers continue to load.

`src/lib/server/docQueryScopeToken.ts:signDocQueryScopeToken` signs a five-minute ES256 token with `DOC_QUERY_SCOPE_PRIVATE_KEY`, `DOC_QUERY_SCOPE_KID`, `DOC_QUERY_SCOPE_ISSUER`, and `DOC_QUERY_SCOPE_AUDIENCE`. Claims bind `kb_id`, `chatbot_id`, session subject, and a unique `jti`; participant identity is intentionally absent. Scope-token requests carry only the bearer token and content type, never the legacy `Chatbot-ID` header. Existing participant-JWT MCP authentication is unchanged.

The assistant UI registers the retrieval card through `src/components/tools-ui/rag-tool-ui.tsx:RAGToolUI`. Its registration uses `src/services/mcpScope.ts:DOC_QUERY_TOOL_NAME` (`KB_doc_query`), matching the namespaced runtime tool name. The card is localized through `pwa.chatbot.retrieval` and renders only a generic failure state; raw retrieval-service errors must never reach participants.

## Testing

The self-contained devcontainer starts the seeded local MCP fixture through
`post-start.sh`. Benibot's Tutor and Explainer configurations already point to
`http://localhost:1417/mcp` and allow `doc_query`; the runtime namespaces the
tool as `KB_doc_query`. Keep Auto Mode selected, then prompt Benibot with “Use
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

The suite runs in CI via `.github/workflows/test-chat.yml` (single-job fail-open path
filter like `test-markdown.yml`, covering `apps/chat/` plus `packages/{i18n,prisma,graphql}/`).
The workflow builds `packages/prisma` before vitest because
`test/modelRegistryParity.test.ts` imports the backend registry from
`packages/graphql/src/services/chatbots.ts`, whose first line is a runtime prisma-client
import ([Testing](./testing.md)).

> **Do not run `pnpm --filter @klicker-uzh/chat check` while the devcontainer dev stack is up.** `check` is `next typegen && tsc --noEmit`, and typegen rewrites the same `.next/` the running dev server owns: from the next `✓ Compiled` line onward every chat route returns a bare Next 404 with nothing in `/tmp/dev.log`, including routes that just served 200. It is not a code bug — restart with `devrouter ensure .` from the host. Typecheck before the browser pass, not during it.
